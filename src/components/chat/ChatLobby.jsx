import React, { useEffect, useState } from 'react';
import { chatService } from '../../services/chatService';
import { supabase } from '../../lib/supabase';
import { Plus, Search, Loader2 } from 'lucide-react';

export default function ChatLobby({ onSelectChat, selectedChatId, onOpenNewChat }) {
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch chats on mount
  useEffect(() => {
    fetchChats();

    // Realtime subscription for new messages updating the chat list
    // This is simplified; ideally we listen to 'conversations' and 'messages' tables
    const channel = supabase
      .channel('public:conversations')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => {
        fetchChats();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
        fetchChats();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchChats = async () => {
    try {
      const data = await chatService.getChats();
      setChats(data);
    } catch (error) {
      console.error("Error loading chats:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusText = (chat) => {
    if (!chat.lastMessage) return 'No messages yet';
    if (chat.lastMessage.type === 'audio') return '🎤 Voice Message';
    return chat.lastMessage.content;
  }

  const getTimeDisplay = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString();
  }

  return (
    <div className="w-full md:w-80 border-r border-gray-200 bg-white dark:bg-zinc-950 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-zinc-800 flex justify-between items-center bg-white dark:bg-zinc-950 sticky top-0 z-10">
        <h2 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">Chats</h2>
        <button
          onClick={onOpenNewChat}
          className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors text-indigo-600"
        >
          <Plus size={24} />
        </button>
      </div>

      {/* Search (Visual only for now) */}
      <div className="p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Search messages..."
            className="w-full pl-9 pr-4 py-2 bg-gray-100 dark:bg-zinc-900 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all border-none"
          />
        </div>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {loading ? (
          <div className="flex justify-center items-center h-40">
            <Loader2 className="animate-spin text-indigo-500" />
          </div>
        ) : chats.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">
            No chats yet. Start a new conversation!
          </div>
        ) : (
          chats.map(chat => (
            <button
              key={chat.id}
              onClick={() => onSelectChat(chat)}
              className={`w-full p-4 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-zinc-900 transition-colors relative border-b border-gray-100 dark:border-zinc-900/50 ${selectedChatId === chat.id ? 'bg-indigo-50 dark:bg-zinc-900' : ''}`}
            >
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                {chat.otherUser?.avatar_url ? (
                  <img src={chat.otherUser.avatar_url} alt="User" className="w-12 h-12 rounded-full object-cover" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-400 to-purple-400 flex items-center justify-center text-white font-bold text-lg">
                    {(chat.otherUser?.nickname?.[0] || chat.otherUser?.email?.[0] || '?').toUpperCase()}
                  </div>
                )}
                {/* Online Status (Mock) */}
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-zinc-950 rounded-full"></span>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0 text-left">
                <div className="flex justify-between items-baseline mb-1">
                  <span className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                    {chat.otherUser?.nickname || chat.otherUser?.email || 'Unknown'}
                  </span>
                  <span className="text-xs text-gray-400 whitespace-nowrap ml-2">
                    {chat.lastMessage ? getTimeDisplay(chat.lastMessage.created_at) : ''}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-sm text-gray-500 truncate pr-2">
                    {getStatusText(chat)}
                  </p>
                  {chat.unreadCount > 0 && (
                    <div className="w-5 h-5 bg-indigo-600 rounded-full flex items-center justify-center text-[10px] text-white font-bold flex-shrink-0">
                      {chat.unreadCount}
                    </div>
                  )}
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
