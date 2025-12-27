import { supabase } from '../lib/supabase';

/**
 * Helper function to retry failed requests with exponential backoff
 */
const fetchWithRetry = async (fn, retries = 3, delay = 1000) => {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(r => setTimeout(r, delay * (i + 1)));
    }
  }
};

export const classroomService = {
  /**
   * Get current user's profile with roles
   */
  async getUserProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, nickname, avatar_url, role')
      .eq('id', user.id)
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Check if user has academy access
   */
  async hasAcademyAccess() {
    try {
      const profile = await this.getUserProfile();
      const roles = profile.role || [];
      return roles.includes('academy') || roles.includes('teacher') || roles.includes('admin');
    } catch (error) {
      console.error('Error checking academy access:', error);
      return false;
    }
  },

  /**
   * Check if user is a teacher or admin
   */
  async isTeacherOrAdmin() {
    try {
      const profile = await this.getUserProfile();
      const roles = profile.role || [];
      return roles.includes('teacher') || roles.includes('admin');
    } catch (error) {
      console.error('Error checking teacher/admin status:', error);
      return false;
    }
  },

  /**
   * Get the Academy Class conversation with member info
   */
  async getAcademyClass() {
    return fetchWithRetry(async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get Academy Class conversation (group chat starting with "Batch 4:")
      const { data, error } = await supabase
        .from('conversations')
        .select(`
          *,
          chat_members (
            user_id,
            profiles (
              id,
              nickname,
              avatar_url,
              email,
              role
            )
          )
        `)
        .eq('type', 'group')
        .ilike('group_name', 'Batch 4:%')
        .single();

      if (error) {
        // Try fetching preview via RPC (for non-members/public view)
        const { data: previewData, error: previewError } = await supabase
          .rpc('get_academy_class_preview');

        if (!previewError && previewData && previewData.length > 0) {
          const preview = previewData[0];
          return {
            id: preview.id,
            name: preview.group_name,
            type: 'group',
            memberCount: preview.member_count,
            members: [], // Cannot see members if not joined
            isPreview: true
          };
        }

        return null;
      }

      return {
        id: data.id,
        name: data.group_name,
        type: data.type,
        memberCount: data.chat_members?.length || 0,
        members: data.chat_members?.map(m => m.profiles) || [],
        updated_at: data.updated_at,
        is_call_active: data.is_call_active, // Include call status
        isPreview: false
      };
    });
  },

  /**
   * Join the Academy Class
   */
  async joinAcademyClass(classId) {
    const { data, error } = await supabase.rpc('join_academy_class', { class_id: classId });
    if (error) throw error;
    return data; // true if joined, false if permission denied
  },

  /**
   * Get messages for a group conversation with sender profiles
   */
  async getGroupMessages(conversationId) {
    return fetchWithRetry(async () => {
      // First, fetch messages
      const { data: messages, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Get unique sender IDs
      const senderIds = [...new Set(messages.map(m => m.sender_id))];

      // Fetch all sender profiles in one query
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, nickname, avatar_url, email, role')
        .in('id', senderIds);

      // Create a map for quick lookup
      const profileMap = {};
      (profiles || []).forEach(p => {
        profileMap[p.id] = p;
      });

      // Fetch read counts for all messages
      const messageIds = messages.map(m => m.id);
      const readCounts = await this.getMessageReadCounts(messageIds);

      // Combine messages with sender profiles
      return messages.map(msg => ({
        ...msg,
        sender: profileMap[msg.sender_id] || null,
        readCount: readCounts[msg.id] || 0
      }));
    });
  },

  /**
   * Get read counts for multiple messages
   */
  async getMessageReadCounts(messageIds) {
    if (!messageIds || messageIds.length === 0) return {};

    const { data, error } = await supabase
      .from('message_reads')
      .select('message_id')
      .in('message_id', messageIds);

    if (error) {
      console.error('Error fetching read counts:', error);
      return {};
    }

    // Count occurrences
    const counts = {};
    data.forEach(row => {
      counts[row.message_id] = (counts[row.message_id] || 0) + 1;
    });

    return counts;
  },

  /**
   * Get read count for a single message
   */
  async getMessageReadCount(messageId) {
    const { count, error } = await supabase
      .from('message_reads')
      .select('*', { count: 'exact', head: true })
      .eq('message_id', messageId);

    if (error) {
      console.error('Error getting read count:', error);
      return 0;
    }

    return count || 0;
  },

  /**
   * Mark a message as read by current user
   */
  async markMessageRead(messageId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Upsert to avoid duplicates (PK constraint will prevent duplicates anyway)
    const { error } = await supabase
      .from('message_reads')
      .upsert({
        message_id: messageId,
        user_id: user.id,
        read_at: new Date().toISOString()
      }, {
        onConflict: 'message_id,user_id',
        ignoreDuplicates: true
      });

    if (error && error.code !== '23505') { // Ignore unique constraint violations
      console.error('Error marking message as read:', error);
    }
  },

  /**
   * Mark multiple messages as read
   */
  async markMessagesRead(messageIds) {
    if (!messageIds || messageIds.length === 0) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const reads = messageIds.map(messageId => ({
      message_id: messageId,
      user_id: user.id,
      read_at: new Date().toISOString()
    }));

    const { error } = await supabase
      .from('message_reads')
      .upsert(reads, {
        onConflict: 'message_id,user_id',
        ignoreDuplicates: true
      });

    if (error && error.code !== '23505') {
      console.error('Error marking messages as read:', error);
    }
  },

  /**
   * Send a message to a group conversation
   */
  async sendGroupMessage(conversationId, content, type = 'text', metadata = {}) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Insert the message
    const { data: message, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: user.id,
        content,
        type,
        metadata,
        status: 'sent'
      })
      .select('*')
      .single();

    if (error) throw error;

    // Fetch sender profile separately
    const { data: sender } = await supabase
      .from('profiles')
      .select('id, nickname, avatar_url, email, role')
      .eq('id', user.id)
      .single();

    // Update conversation updated_at
    await supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId);

    return { ...message, sender, readCount: 0 };
  },

  /**
   * Upload a voice note for group chat
   */
  async uploadVoiceNote(conversationId, file) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

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

    return { path: filePath };
  },

  /**
   * Get LiveKit token from Edge Function
   */
  async getLiveKitToken(roomName, participantName, identity, isTeacher) {
    const { data, error } = await supabase.functions.invoke('livekit-token', {
      body: { roomName, participantName, identity, isTeacher }
    });

    if (error) throw error;
    return data;
  },

  /**
   * Subscribe to realtime messages for a conversation
   */
  subscribeToMessages(conversationId, onNewMessage, onMessageUpdate) {
    const channel = supabase
      .channel(`classroom:${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`
      }, async (payload) => {
        // Fetch sender info for the new message
        const { data: sender } = await supabase
          .from('profiles')
          .select('id, nickname, avatar_url, email, role')
          .eq('id', payload.new.sender_id)
          .single();

        onNewMessage({ ...payload.new, sender, readCount: 0 });
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`
      }, (payload) => {
        onMessageUpdate(payload.new);
      })
      .subscribe();

    return channel;
  },

  /**
   * Subscribe to read count updates for messages
   */
  subscribeToReadCounts(conversationId, onReadUpdate) {
    const channel = supabase
      .channel(`reads:${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'message_reads'
      }, async (payload) => {
        // Verify this read is for a message in our conversation
        const { data: message } = await supabase
          .from('messages')
          .select('id')
          .eq('id', payload.new.message_id)
          .eq('conversation_id', conversationId)
          .single();

        if (message) {
          const count = await this.getMessageReadCount(payload.new.message_id);
          onReadUpdate(payload.new.message_id, count);
        }
      })
      .subscribe();

    return channel;
  },

  /**
   * Unsubscribe from a channel
   */
  unsubscribe(channel) {
    if (channel) {
      supabase.removeChannel(channel);
    }
  },

  async updateCallStatus(chatId, isActive) {
    console.log(`[classroomService] Updating call status for ${chatId} to ${isActive}`);
    const { error } = await supabase
      .from('conversations')
      .update({ is_call_active: isActive })
      .eq('id', chatId);

    if (error) {
      console.error('Failed to update call status:', error);
    } else {
      console.log('[classroomService] Call status updated successfully');
    }
  },

  subscribeToConversation(chatId, onUpdate) {
    const channel = supabase
      .channel(`conversation:${chatId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'conversations',
        filter: `id=eq.${chatId}`
      }, (payload) => {
        onUpdate(payload.new);
      })
      .subscribe();
    return channel;
  },

  subscribeToCallPresence(chatId, userId, userInfo, onSync) {
    const channel = supabase.channel(`call-presence:${chatId}`, {
      config: {
        presence: {
          key: userId,
        },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        onSync(state);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED' && userInfo) {
          await channel.track(userInfo);
        }
      });

    return channel;
  }
};
