import { supabase } from '../lib/supabase';

export const chatService = {
  // Fetch all chats for the current user
  async getChats() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Get all conversation IDs the user is part of
    const { data: members, error: membersError } = await supabase
      .from('chat_members')
      .select('conversation_id, last_read_at')
      .eq('user_id', user.id);

    if (membersError) throw membersError;

    const conversationIds = members.map(m => m.conversation_id);

    if (conversationIds.length === 0) return [];

    // Fetch conversations with details
    // We also need to fetch the OTHER participants for each chat to show their names
    const { data: conversations, error: convError } = await supabase
      .from('conversations')
      .select(`
        *,
        chat_members (
          user_id,
          profiles (
            nickname,
            avatar_url,
            role,
            email
          )
        ),
        messages (
            content,
            type,
            metadata,
            created_at,
            status
        )
      `)
      .in('id', conversationIds)
      .eq('type', 'direct')
      .order('updated_at', { ascending: false });

    if (convError) throw convError;

    // Format the response
    return conversations.map(conv => {
      // Find the "other" participant (assuming direct chat for now)
      const otherMember = conv.chat_members.find(m => m.user_id !== user.id);
      const myMember = conv.chat_members.find(m => m.user_id === user.id);

      // Get the last message (Supabase return order might need sorting if not using limit in subquery)
      // Note: Supabase JS select with sub-resource order is tricky. 
      // We'll just sort the messages array here to be safe and pick the newest.
      const sortedMessages = conv.messages?.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      const lastMessage = sortedMessages?.[0];

      return {
        id: conv.id,
        type: conv.type,
        otherUser: otherMember ? otherMember.profiles : null,
        lastMessage: lastMessage ? {
          content: lastMessage.content,
          type: lastMessage.type,
          created_at: lastMessage.created_at,
          status: lastMessage.status
        } : null,
        unreadCount: 0, // TODO: Calculate based on last_read_at vs last_message
        updated_at: conv.updated_at
      };
    });
  },

  async getMessages(conversationId) {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data;
  },

  async sendMessage(conversationId, content, type = 'text', metadata = {}) {
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: user.id,
        content,
        type,      // 'text' | 'audio'
        metadata,  // { duration, waveform, size, etc. }
        status: 'sent'
      })
      .select()
      .single();

    if (error) throw error;

    // Update conversation updated_at for sorting
    await supabase.from('conversations').update({ updated_at: new Date() }).eq('id', conversationId);

    return data;
  },

  async uploadVoiceNote(conversationId, file) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Generate unique path: conversation_id/user_id/timestamp.webm
    const timestamp = Date.now();
    const fileExt = file.name.split('.').pop();
    const filePath = `${conversationId}/${user.id}/${timestamp}.${fileExt}`;

    const { data, error } = await supabase.storage
      .from('voice_note_bucket')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) throw error;

    // Get public URL (if bucket is public) or Signed URL (if private)
    // We recommended PRIVATE, so let's implement Signed URL or just store PATH and generate URL on read.
    // Storing PATH is safer. But for simplicity in UI, let's get a signed URL valid for a long time or just use the path.
    // Actually, best practice: Store PATH in 'content'.
    // UI generates signed URL on demand.

    return { path: filePath };
  },

  // Helper to get audio URL
  async getVoiceNoteUrl(path) {
    // If bucket is public:
    // const { data } = supabase.storage.from('voice_note_bucket').getPublicUrl(path);
    // return data.publicUrl;

    // If bucket is private (Recommended):
    const { data, error } = await supabase.storage
      .from('voice_note_bucket')
      .createSignedUrl(path, 60 * 60 * 24 * 7); // 7 days URL

    if (error) {
      console.error("Error creating signed URL:", error);
      return null;
    }
    return data.signedUrl;
  },

  async markAsRead(conversationId, messageIds) {
    if (!messageIds || messageIds.length === 0) return;

    // Update messages status
    const { error } = await supabase
      .from('messages')
      .update({ status: 'read' })
      .in('id', messageIds);

    if (error) console.error('Error updating message status:', error);

    // Update member last_read_at
    const { data: { user } } = await supabase.auth.getUser();
    await supabase
      .from('chat_members')
      .update({ last_read_at: new Date() })
      .eq('conversation_id', conversationId)
      .eq('user_id', user.id);
  },

  async createDirectChat(otherUserId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // 1. Check if a direct chat already exists between these two users
    // This is a bit complex in pure Supabase API. 
    // We can fetch all our chats, then filter for one that has the otherUserId.

    // Get all my conversation IDs
    const { data: myChats, error: myChatsError } = await supabase
      .from('chat_members')
      .select('conversation_id')
      .eq('user_id', user.id);

    if (myChatsError) throw myChatsError;

    const myChatIds = (myChats || []).map(c => c.conversation_id);

    if (myChatIds.length > 0) {
      // Check if other user is in any of these chats and type is 'direct'
      const { data: existingChat } = await supabase
        .from('chat_members')
        .select('conversation_id, conversations(type)')
        .eq('user_id', otherUserId)
        .in('conversation_id', myChatIds);

      // Filter for type 'direct'
      const directChat = existingChat?.find(c => c.conversations?.type === 'direct');

      if (directChat) {
        return directChat.conversation_id;
      }
    }

    // 2. Create new conversation
    const { data: newConv, error: convError } = await supabase
      .from('conversations')
      .insert({ type: 'direct', created_by: user.id })
      .select()
      .single();

    if (convError) throw convError;

    // 3. Add members
    const { error: memberError } = await supabase
      .from('chat_members')
      .insert([
        { conversation_id: newConv.id, user_id: user.id },
        { conversation_id: newConv.id, user_id: otherUserId }
      ]);

    if (memberError) throw memberError;

    return newConv.id;
  },

  // Fetch users for the new chat modal
  async getUsers() {
    // In a real app we might paginate or search.
    // Fetching profiles.
    const { data, error } = await supabase
      .from('profiles')
      .select('*');

    if (error) throw error;
    return data;
  }
};
