import React from 'react';
import { supabase } from '../../lib/supabase';
import { Check, CheckCheck, Clock, User, Mic } from 'lucide-react';
import AudioPlayer from '../chat/AudioPlayer';

export default function GroupMessageBubble({ message, isOwnMessage, currentUserId }) {
  const { content, type, created_at, readCount, sender, metadata } = message;

  // Format time
  const time = new Date(created_at).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  });

  const renderReadStatus = () => {
    if (!isOwnMessage) return null;

    if (readCount > 0) {
      return (
        <div className="flex items-center gap-0.5 text-emerald-500" title={`${readCount} read`}>
          <span className="text-[10px] font-medium">{readCount} read</span>
          <CheckCheck size={14} />
        </div>
      );
    }

    return <Check size={14} className="text-gray-400" />;
  };

  const renderContent = () => {
    if (type === 'audio') {
      return (
        <div className="min-w-[200px]">
          <AudioPlayer
            path={content}
            duration={metadata?.duration}
            waveform={metadata?.waveform}
          />
        </div>
      );
    }

    return <p className="text-sm md:text-base break-words whitespace-pre-wrap">{content}</p>;
  };

  const senderName = sender?.nickname || sender?.email?.split('@')[0] || 'Unknown';
  const senderInitial = senderName[0]?.toUpperCase() || '?';

  if (isOwnMessage) {
    return (
      <div className="flex w-full mb-3 justify-end">
        <div className="flex items-end gap-2 max-w-[85%] md:max-w-[75%]">
          {/* Time and Read Count - LEFT side for own messages */}
          <div className="flex flex-col items-end justify-end gap-0.5 pb-1 min-w-[50px]">
            <span className="text-[10px] text-gray-400 whitespace-nowrap">{time}</span>
            {renderReadStatus()}
          </div>

          {/* Message Bubble */}
          <div className="relative px-4 py-2.5 rounded-2xl rounded-br-sm bg-emerald-600 text-white shadow-sm">
            {renderContent()}
          </div>
        </div>
      </div>
    );
  }

  // Other user's message
  return (
    <div className="flex w-full mb-3 justify-start">
      <div className="flex items-end gap-2 max-w-[85%] md:max-w-[75%]">
        {/* Avatar */}
        <div className="relative">
          {sender?.avatar_url ? (
            <img
              src={sender.avatar_url}
              alt={senderName}
              className="w-8 h-8 rounded-full object-cover shadow-sm mb-1"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-400 to-gray-500 flex items-center justify-center text-white text-xs font-bold shadow-sm mb-1">
              {senderInitial}
            </div>
          )}
        </div>

        <div className="flex flex-col">
          {/* Name */}
          <span className="text-[11px] text-gray-500 ml-1 mb-0.5 max-w-[150px] truncate">
            {senderName}
          </span>

          <div className="flex items-end gap-2">
            {/* Message Bubble */}
            <div className={`relative px-4 py-2.5 rounded-2xl rounded-bl-sm shadow-sm ${type === 'audio'
              ? 'bg-white dark:bg-zinc-800 border border-emerald-100 dark:border-emerald-900/30'
              : 'bg-white dark:bg-zinc-800 text-gray-800 dark:text-gray-200'
              }`}>
              {renderContent()}
            </div>

            {/* Time - RIGHT side for others' messages */}
            <span className="text-[10px] text-gray-400 whitespace-nowrap pb-1">
              {time}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
