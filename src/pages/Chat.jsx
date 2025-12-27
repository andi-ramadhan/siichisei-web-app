import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ChatLobby from '../components/chat/ChatLobby';
import MessageArea from '../components/chat/MessageArea';
import NewChatModal from '../components/chat/NewChatModal';
import { chatService } from '../services/chatService';

export default function Chat() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const [selectedChat, setSelectedChat] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Resize handler
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fetch full chat details when URL chatId changes
  useEffect(() => {
    if (chatId) {
      // We need to get the chat object to pass to MessageArea
      // Optimization: ChatLobby usually fetches fetching all chats. 
      // We can iterate calls or just fetch single here.
      // For reliability, let's fetch single or find from cache if we had a global store.
      // Since we don't have Redux/Context, let's fetch the list again or just rely on ChatLobby passing it? 
      // Problem: ChatLobby is sibling. 
      // Better: Fetch single chat details here or filter from a "chats" state if we hoisted it.
      // Simplest for now: load the specific chat or let MessageArea handle ID.

      // Actually, MessageArea receives a 'chat' OBJECT (with otherUser etc).
      // We need to reconstruct that object if we just have ID.
      // Let's assume for now we need to fetch it.

      loadChatDetails(chatId);
    } else {
      setSelectedChat(null);
    }
  }, [chatId]);

  const loadChatDetails = async (id) => {
    // Temporary solution: Fetch all chats and find matching ID. 
    // Ideally backend endpoint for single chat.
    try {
      // Verify if we already have it? No state here.
      // Let's just re-use chatService.getChats() for now as it's not too heavy yet
      const chats = await chatService.getChats();
      const chat = chats.find(c => c.id === id);
      if (chat) {
        setSelectedChat(chat);
      } else {
        // Handle not found / access denied
        navigate('/chat');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleChatSelect = (chat) => {
    navigate(`/chat/${chat.id}`);
  };

  const handleChatCreated = (newChatId) => {
    navigate(`/chat/${newChatId}`);
  };

  return (
    <div className="flex h-full overflow-hidden bg-gray-50 dark:bg-zinc-900 border-t border-gray-200 dark:border-zinc-800 relative">

      {/* Lobby - Hidden on mobile if chat selected (URL has ID) */}
      <div className={`${isMobile && chatId ? 'hidden' : 'block'} w-full md:w-auto h-full`}>
        <ChatLobby
          onSelectChat={handleChatSelect}
          selectedChatId={chatId}
          onOpenNewChat={() => setIsModalOpen(true)}
        />
      </div>

      {/* Message Area - Hidden on mobile if no chat selected */}
      <div className={`${isMobile && !chatId ? 'hidden' : 'block'} flex-1 h-full relative`}>
        <MessageArea chat={selectedChat} />
      </div>

      <NewChatModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onChatCreated={handleChatCreated}
      />
    </div>
  );
}
