import React, { useEffect, useState, useRef, useCallback } from 'react';
import { classroomService } from '../../services/classroomService';
import { supabase } from '../../lib/supabase';
import GroupMessageBubble from './GroupMessageBubble';
import VoiceRecorder from '../chat/VoiceRecorder';
import { useToast } from '../ui/Toast';
import { useAutoRetry } from '../../hooks/useNetworkStatus';
import {
  Send,
  MoreVertical,
  Phone,
  Loader2,
  Users,
  ArrowLeft,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function GroupMessageArea({ chat, onStartCall }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [error, setError] = useState(null);
  const [isTeacherOrAdmin, setIsTeacherOrAdmin] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const messagesEndRef = useRef(null);
  const channelRef = useRef(null);
  const readChannelRef = useRef(null);

  // Get current user on mount
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);

      // Check if teacher/admin for call button
      const isTA = await classroomService.isTeacherOrAdmin();
      setIsTeacherOrAdmin(isTA);
    };
    fetchUser();
  }, []);

  // Load messages when chat changes
  const loadMessages = useCallback(async () => {
    if (!chat?.id || !currentUser) return;

    setLoading(true);
    setError(null);
    try {
      const data = await classroomService.getGroupMessages(chat.id);
      setMessages(data);

      // Mark all messages as read
      const unreadMessageIds = data
        .filter(m => m.sender_id !== currentUser.id)
        .map(m => m.id);

      if (unreadMessageIds.length > 0) {
        await classroomService.markMessagesRead(unreadMessageIds);
      }
    } catch (err) {
      console.error('Error loading messages:', err);
      setError('Failed to load messages. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [chat?.id, currentUser]);

  useAutoRetry(loadMessages, [chat?.id, currentUser]);

  useEffect(() => {
    if (currentUser) {
      loadMessages();
    }
  }, [loadMessages, currentUser]);

  // Realtime subscription
  useEffect(() => {
    if (!chat?.id || !currentUser) return;

    // Subscribe to new messages
    channelRef.current = classroomService.subscribeToMessages(
      chat.id,
      (newMsg) => {
        setMessages(prev => [...prev, newMsg]);
        // Auto-mark as read if from others
        if (newMsg.sender_id !== currentUser.id) {
          classroomService.markMessageRead(newMsg.id);
        }
      },
      (updatedMsg) => {
        setMessages(prev => prev.map(m => m.id === updatedMsg.id ? { ...m, ...updatedMsg } : m));
      }
    );

    // Subscribe to read count updates
    readChannelRef.current = classroomService.subscribeToReadCounts(
      chat.id,
      (messageId, count) => {
        setMessages(prev => prev.map(m =>
          m.id === messageId ? { ...m, readCount: count } : m
        ));
      }
    );

    return () => {
      classroomService.unsubscribe(channelRef.current);
      classroomService.unsubscribe(readChannelRef.current);
    };
  }, [chat?.id, currentUser]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleRetry = async () => {
    setRetrying(true);
    await loadMessages();
    setRetrying(false);
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || sending || !chat?.id) return;

    setSending(true);
    try {
      await classroomService.sendGroupMessage(chat.id, newMessage);
      setNewMessage('');
    } catch (err) {
      console.error('Failed to send:', err);
      toast.error('Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleAudioSend = async (blob, duration, waveform) => {
    if (!chat?.id) return;
    try {
      const file = new File([blob], 'voice-note.webm', { type: blob.type });
      const { path } = await classroomService.uploadVoiceNote(chat.id, file);
      await classroomService.sendGroupMessage(chat.id, path, 'audio', {
        duration,
        mime_type: blob.type,
        size: blob.size,
        waveform: waveform || []
      });
    } catch (err) {
      console.error('Failed to send voice note:', err);
      toast.error('Failed to send voice note. Please try again.');
    }
  };

  // Group messages by date
  const renderMessages = () => {
    let lastDate = null;
    return messages.map((msg) => {
      const msgDate = new Date(msg.created_at).toDateString();
      const showDate = msgDate !== lastDate;
      lastDate = msgDate;

      return (
        <React.Fragment key={msg.id}>
          {showDate && (
            <div className="flex justify-center my-4">
              <span className="bg-gray-100 dark:bg-zinc-800 text-gray-500 text-xs px-3 py-1 rounded-full">
                {new Date(msg.created_at).toLocaleDateString(undefined, {
                  weekday: 'long',
                  month: 'short',
                  day: 'numeric'
                })}
              </span>
            </div>
          )}
          <GroupMessageBubble
            message={msg}
            isOwnMessage={msg.sender_id === currentUser?.id}
            currentUserId={currentUser?.id}
          />
        </React.Fragment>
      );
    });
  };

  const [isCallActive, setIsCallActive] = useState(chat?.is_call_active || false);
  const [callParticipants, setCallParticipants] = useState([]);
  const [presenceChannel, setPresenceChannel] = useState(null);

  // Sync call status and presence
  useEffect(() => {
    if (!chat?.id || !currentUser) return;
    console.log('[GroupMessageArea] Syncing call status for chat:', chat.id);

    // 1. Listen for Call Status Changes
    const convChannel = classroomService.subscribeToConversation(chat.id, (updatedConv) => {
      console.log('[GroupMessageArea] Received conversation update:', updatedConv);
      setIsCallActive(updatedConv.is_call_active);
    });

    // 2. Listen for Participants (Presence)
    // Pass null for userInfo effectively "watching" without "joining"
    const pChannel = classroomService.subscribeToCallPresence(chat.id, currentUser.id, null, (state) => {
      // Flatten presence state to get list of users
      const users = [];
      Object.keys(state).forEach(key => {
        state[key].forEach(presence => {
          if (presence.nickname) users.push(presence);
        });
      });
      console.log('[GroupMessageArea] Presence update, active users:', users.length);
      setCallParticipants(users);
    });
    setPresenceChannel(pChannel);

    return () => {
      classroomService.unsubscribe(convChannel);
      classroomService.unsubscribe(pChannel);
    };
  }, [chat?.id, currentUser]);

  // No chat selected state
  if (!chat) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 dark:bg-zinc-900 text-gray-400 p-8">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/30 dark:to-teal-900/30 flex items-center justify-center mb-4">
          <Users size={40} className="text-emerald-500" />
        </div>
        <p className="text-center">Select a classroom to start learning together</p>
      </div>
    );
  }


  const handleCallButtonClick = () => {
    // 1. If call is active, anyone can join
    if (isCallActive || callParticipants.length > 0) {
      onStartCall();
      return;
    }

    // 2. If call is NOT active, only Teacher/Admin can start
    if (isTeacherOrAdmin) {
      onStartCall();
    } else {
      toast.error('Only Teacher or Admin can start a group call');
    }
  };

  const renderCallBar = () => {
    const isActive = isCallActive || callParticipants.length > 0;

    return (
      <div className="flex items-center gap-3">
        {/* Active Participants Avatars (Only if active) */}
        {isActive && (
          <div className="hidden md:flex items-center -space-x-2 mr-2">
            {callParticipants.map((p, i) => (
              <div key={i} className="relative group/avatar">
                {p.avatar_url ? (
                  <img src={p.avatar_url} alt={p.nickname} className="w-8 h-8 rounded-full border-2 border-white dark:border-zinc-950 object-cover" />
                ) : (
                  <div className="w-8 h-8 rounded-full border-2 border-white dark:border-zinc-950 bg-gray-300 flex items-center justify-center text-[10px] font-bold">
                    {p.nickname?.[0]}
                  </div>
                )}
                {/* Tooltip */}
                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-black/80 text-white text-xs rounded opacity-0 group-hover/avatar:opacity-100 whitespace-nowrap pointer-events-none">
                  {p.nickname}
                </div>
              </div>
            ))}
            {callParticipants.length === 0 && (
              <span className="text-xs text-emerald-500 animate-pulse font-medium">Call starting...</span>
            )}
            {callParticipants.length > 0 && <span className="text-xs text-gray-500 ml-3">{callParticipants.length} joined</span>}
          </div>
        )}

        <button
          onClick={handleCallButtonClick}
          className={`px-4 py-2 rounded-full transition-all flex items-center gap-2 shadow-lg
            ${isActive
              ? 'bg-blue-600 hover:bg-blue-700 animate-pulse shadow-blue-500/20 text-white'
              : 'bg-emerald-600 hover:bg-emerald-700 text-white'
            }`}
          title={isActive ? "Join Call" : "Start Call"}
        >
          <Phone size={18} className="fill-current" />
          <span className={`font-bold text-sm ${isActive ? '' : 'hidden md:inline'}`}>
            {isActive ? "Join Call" : "Start Call"}
          </span>
        </button>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-white dark:bg-zinc-950">
      {/* Header */}
      <div className="p-3 md:p-4 border-b border-gray-200 dark:border-zinc-800 flex justify-between items-center bg-white dark:bg-zinc-950 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          {/* Back button for mobile */}
          <button
            onClick={() => navigate('/classroom')}
            className="md:hidden p-2 -ml-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} className="text-gray-600 dark:text-gray-400" />
          </button>

          {/* Group Icon */}
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
            <Users size={20} className="text-white" />
          </div>

          <div className="min-w-0">
            <h3 className="font-bold text-gray-900 dark:text-gray-100 truncate text-sm md:text-base">
              {chat.name || 'Academy Class'}
            </h3>
            <p className="text-xs text-emerald-600 font-medium">
              {chat.memberCount || 0} members
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-4 text-gray-400">
          {/* Dynamic Call Bar */}
          {renderCallBar()}

          <button className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors">
            <MoreVertical size={20} className="hover:text-emerald-500 cursor-pointer transition-colors" />
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-3 md:p-4 custom-scrollbar bg-gray-50 dark:bg-zinc-900/50">
        {loading ? (
          <div className="flex justify-center items-center h-full">
            <Loader2 className="animate-spin text-emerald-500" size={32} />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <AlertCircle className="text-red-500" size={48} />
            <p className="text-gray-500">{error}</p>
            <button
              onClick={handleRetry}
              disabled={retrying}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw size={16} className={retrying ? 'animate-spin' : ''} />
              {retrying ? 'Retrying...' : 'Try Again'}
            </button>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          renderMessages()
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 md:p-4 border-t border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
        <form onSubmit={handleSend} className="flex gap-2 items-center">
          <VoiceRecorder onSend={handleAudioSend} onCancel={() => { }} />

          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 p-3 bg-gray-100 dark:bg-zinc-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all border-none text-sm md:text-base"
          />

          <button
            type="submit"
            disabled={!newMessage.trim() || sending}
            className="p-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send size={20} />
          </button>
        </form>
      </div>
    </div>
  );
}
