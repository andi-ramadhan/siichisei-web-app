import React from 'react';
import { Clock, Check, Eye } from 'lucide-react';
import AudioPlayer from './AudioPlayer';

export default function MessageBubble({ message, isOwnMessage }) {
  const time = new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const renderContent = () => {
    if (message.type === 'audio') {
      return (
        <AudioPlayer
          path={message.content}
          duration={message.metadata?.duration}
          waveform={message.metadata?.waveform}
        />
      );
    }
    return <p className="whitespace-pre-wrap break-words leading-relaxed">{message.content}</p>;
  };

  const renderStatus = () => {
    if (!isOwnMessage) return null;

    // Status Logic
    // 'sending' is not in DB enum but handled optimistically in UI usually
    if (message.status === 'sending') return <Clock size={12} className="text-gray-400" />;

    // Schema enum: 'sent', 'delivered', 'read'
    if (message.status === 'sent') return <Check size={12} className="text-gray-400" />;
    if (message.status === 'delivered') return <div className="flex"><Check size={12} className="text-gray-400" /><Check size={12} className="text-gray-400 -ml-1" /></div>; // Simulate double check
    if (message.status === 'read') return <Eye size={14} className="text-indigo-300" />;

    return <Check size={12} className="text-gray-400" />; // Default
  };

  return (
    <div className={`flex w-full mb-4 ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`relative max-w-[75%] px-4 py-2 rounded-2xl shadow-sm text-sm ${isOwnMessage
          ? 'bg-indigo-600 text-white rounded-br-none'
          : 'bg-white dark:bg-zinc-800 text-gray-800 dark:text-gray-200 rounded-bl-none border border-gray-100 dark:border-zinc-700'
          }`}
      >
        {renderContent()}
        <div className={`flex items-center gap-1 mt-1 text-[10px] ${isOwnMessage ? 'justify-end text-indigo-200' : 'text-gray-400'}`}>
          <span>{time}</span>
          {renderStatus()}
        </div>
      </div>
    </div>
  );
}
