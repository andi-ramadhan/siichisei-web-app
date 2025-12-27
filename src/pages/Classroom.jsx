import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ClassroomLobby from '../components/classroom/ClassroomLobby';
import GroupMessageArea from '../components/classroom/GroupMessageArea';
import GroupCallStage from '../components/classroom/GroupCallStage';
import { Menu } from 'lucide-react';

export default function Classroom() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const [selectedChat, setSelectedChat] = useState(null);
  const [showMobileLobby, setShowMobileLobby] = useState(!chatId);
  const [inCall, setInCall] = useState(false);

  // Sync state with URL
  useEffect(() => {
    if (chatId) {
      setShowMobileLobby(false);
      // If we don't have the chat data yet, the MessageArea will handle loading it
      // or we could fetch it here. For now, we'll optimistically set the ID
      if (!selectedChat || selectedChat.id !== chatId) {
        setSelectedChat({ id: chatId });
      }
    } else {
      setShowMobileLobby(true);
      setSelectedChat(null);
    }
  }, [chatId]);

  const handleChatSelect = (chat) => {
    setSelectedChat(chat);
    navigate(`/classroom/${chat.id}`);
  };

  const handleStartCall = () => {
    setInCall(true);
  };

  const handleEndCall = () => {
    setInCall(false);
  };

  if (inCall && selectedChat) {
    return (
      <GroupCallStage
        chat={selectedChat}
        onEndCall={handleEndCall}
      />
    );
  }

  return (
    <div className="flex h-[calc(100vh-64px)] md:h-screen w-full bg-white dark:bg-zinc-950 overflow-hidden relative">
      {/* Mobile Lobby Toggle */}
      <div className={`
        absolute inset-0 z-20 md:static md:z-0 md:block
        ${showMobileLobby ? 'block' : 'hidden'}
        md:w-80 w-full
      `}>
        <ClassroomLobby
          onSelectChat={handleChatSelect}
          selectedChatId={selectedChat?.id}
        />
      </div>

      {/* Message Area */}
      <div className={`
        flex-1 flex flex-col w-full h-full
        ${showMobileLobby ? 'hidden md:flex' : 'flex'}
      `}>
        <GroupMessageArea
          chat={selectedChat}
          onStartCall={handleStartCall}
        />
      </div>
    </div>
  );
}
