import React, { useEffect, useState, useRef } from 'react';
import { chatService } from '../../services/chatService';
import { supabase } from '../../lib/supabase';
import MessageBubble from './MessageBubble';
import VoiceRecorder from './VoiceRecorder';
import { Send, MoreVertical, Phone, Video, Loader2 } from 'lucide-react';

export default function MessageArea({ chat }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const messagesEndRef = useRef(null);

  // Get current user on mount
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setCurrentUser(user));
  }, []);

  // Fetch messages when chat changes
  useEffect(() => {
    if (!chat?.id) return;

    const loadMessages = async () => {
      setLoading(true);
      try {
        const data = await chatService.getMessages(chat.id);
        setMessages(data);
        // Mark as read immediately when opening
        const unreadIds = data
          .filter(m => m.status !== 'read' && m.sender_id !== currentUser?.id) // Assuming we have currentUser by now, waiting for it might be safer but this is okay for effect
          .map(m => m.id);

        if (unreadIds.length > 0) {
          chatService.markAsRead(chat.id, unreadIds);
        }
      } catch (error) {
        console.error("Error loading messages:", error);
      } finally {
        setLoading(false);
      }
    };

    if (currentUser) {
      loadMessages();
    }
  }, [chat?.id, currentUser]);

  // Realtime Subscription
  useEffect(() => {
    if (!chat?.id) return;

    const channel = supabase
      .channel(`chat:${chat.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${chat.id}`
      }, (payload) => {
        setMessages(prev => [...prev, payload.new]);
        // If message is from other, mark read
        if (payload.new.sender_id !== currentUser?.id) {
          chatService.markAsRead(chat.id, [payload.new.id]);
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${chat.id}`
      }, (payload) => {
        setMessages(prev => prev.map(m => m.id === payload.new.id ? payload.new : m));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chat?.id, currentUser]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    setSending(true);
    try {
      await chatService.sendMessage(chat.id, newMessage);
      setNewMessage('');
    } catch (error) {
      console.error("Failed to send:", error);
    } finally {
      setSending(false);
    }
  };

  // Group messages by date
  const renderMessages = () => {
    let lastDate = null;
    return messages.map((msg, index) => {
      const msgDate = new Date(msg.created_at).toDateString();
      const showDate = msgDate !== lastDate;
      lastDate = msgDate;

      return (
        <React.Fragment key={msg.id}>
          {showDate && (
            <div className="flex justify-center my-4">
              <span className="bg-gray-100 dark:bg-zinc-800 text-gray-500 text-xs px-3 py-1 rounded-full">
                {new Date(msg.created_at).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
              </span>
            </div>
          )}
          <MessageBubble
            message={msg}
            isOwnMessage={msg.sender_id === currentUser?.id}
          />
        </React.Fragment>
      );
    });
  };

  const handleAudioSend = async (blob, duration, waveform) => {
    if (!chat?.id) return;
    try {
      // 1. Upload
      const file = new File([blob], "voice-note.webm", { type: blob.type });
      const { path } = await chatService.uploadVoiceNote(chat.id, file);

      // 2. Send Message
      await chatService.sendMessage(chat.id, path, 'audio', {
        duration,
        mime_type: blob.type,
        size: blob.size,
        waveform: waveform || [] // Pass the waveform data
      });

    } catch (error) {
      console.error("Failed to send voice note:", error);
    } finally {
      setIsRecordingAudio(false);
    }
  };

  if (!chat) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-zinc-900 text-gray-400">
        <p>Select a chat to start messaging</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-white dark:bg-zinc-950">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-zinc-800 flex justify-between items-center bg-white dark:bg-zinc-950 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          {chat.otherUser?.avatar_url ? (
            <img src={chat.otherUser.avatar_url} alt="User" className="w-10 h-10 rounded-full object-cover" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-400 flex items-center justify-center text-white font-bold text-sm">
              {(chat.otherUser?.nickname?.[0] || chat.otherUser?.email?.[0] || '?').toUpperCase()}
            </div>
          )}
          <div>
            <h3 className="font-bold text-gray-900 dark:text-gray-100">{chat.otherUser?.nickname || chat.otherUser?.email}</h3>
            <p className="text-xs text-indigo-500 font-medium">{chat.otherUser?.role || 'Student'}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-gray-400">
          <Phone size={20} className="hover:text-indigo-500 cursor-pointer transition-colors" />
          <Video size={20} className="hover:text-indigo-500 cursor-pointer transition-colors" />
          <MoreVertical size={20} className="hover:text-indigo-500 cursor-pointer transition-colors" />
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-gray-50 dark:bg-zinc-900/50">
        {loading ? (
          <div className="flex justify-center items-center h-full">
            <Loader2 className="animate-spin text-indigo-500" />
          </div>
        ) : (
          renderMessages()
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
        <form onSubmit={handleSend} className="flex gap-2 items-center">

          <VoiceRecorder onSend={handleAudioSend} onCancel={() => { }} />

          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 p-3 bg-gray-100 dark:bg-zinc-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all border-none"
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || sending}
            className="p-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send size={20} />
          </button>
        </form>
      </div>
    </div>
  );
}
