import React, { useEffect, useState } from 'react';
import { chatService } from '../../services/chatService';
import { supabase } from '../../lib/supabase';
import { X, Search, User, Loader2 } from 'lucide-react';

export default function NewChatModal({ isOpen, onClose, onChatCreated }) {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setCurrentUser(user));
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadUsers();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!users.length) return;

    const term = search.toLowerCase();
    const filtered = users.filter(u =>
      (u.nickname?.toLowerCase().includes(term) || u.email?.toLowerCase().includes(term))
    );
    setFilteredUsers(filtered);
  }, [search, users]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const allUsers = await chatService.getUsers();
      // Filter out:
      // 1. Current user
      // 2. Teachers and Admins (as per requirement)
      const validUsers = allUsers.filter(u => {
        if (currentUser && u.id === currentUser.id) return false;
        if (u.role === 'teacher' || u.role === 'admin') return false;
        return true;
      });
      setUsers(validUsers);
      setFilteredUsers(validUsers);
    } catch (error) {
      console.error("Failed to load users", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUserSelect = async (userId) => {
    if (creating) return;
    setCreating(true);
    try {
      const chatId = await chatService.createDirectChat(userId);
      onChatCreated(chatId);
      onClose();
    } catch (error) {
      console.error("Failed to create chat", error);
    } finally {
      setCreating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[80vh] animate-in fade-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="p-4 border-b border-gray-100 dark:border-zinc-800 flex justify-between items-center">
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">New Message</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search students..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
          {loading ? (
            <div className="h-40 flex justify-center items-center">
              <Loader2 className="animate-spin text-indigo-500" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="h-40 flex flex-col justify-center items-center text-gray-400">
              <User size={32} className="mb-2 opacity-20" />
              <p>No users found</p>
            </div>
          ) : (
            filteredUsers.map(user => (
              <button
                key={user.id}
                onClick={() => handleUserSelect(user.id)}
                disabled={creating}
                className="w-full p-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-zinc-800 rounded-xl transition-colors text-left group"
              >
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900 dark:to-purple-900 flex items-center justify-center text-indigo-600 dark:text-indigo-300 font-bold group-hover:scale-105 transition-transform">
                    {(user.nickname?.[0] || user.email?.[0] || '?').toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-gray-900 dark:text-gray-100 truncate">
                    {user.nickname || user.email}
                  </h4>
                  <p className="text-xs text-indigo-500 font-medium">
                    {user.role || 'Student'}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
