import React from 'react';
import { Mic, MicOff } from 'lucide-react';

/**
 * MicBadge Component
 * Renders the microphone icon on the user avatar.
 * 
 * Rules:
 * 1. Teacher/Admin: Always visible.
 * 2. Student: Only visible if given permission (hasPermission = true).
 * 3. Interactable: Only if `canControl` is true (Teacher viewing someone else).
 */
export default function MicBadge({
  isMuted,
  isTeacher,
  hasPermission,
  canControl,
  onClick
}) {
  // Rule: Show if Teacher OR has Permission
  const shouldShow = isTeacher || hasPermission;

  if (!shouldShow) return null;

  return (
    <button
      onClick={(e) => {
        if (canControl && onClick) {
          e.stopPropagation();
          onClick();
        }
      }}
      disabled={!canControl}
      className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center shadow-lg transition-colors border border-zinc-900/50
        ${isMuted
          ? 'bg-red-500 hover:bg-red-600'
          : 'bg-emerald-500 hover:bg-emerald-600'
        } 
        ${!canControl ? 'cursor-default' : 'cursor-pointer hover:scale-110'}
      `}
      title={canControl ? (isMuted ? 'Unmute' : 'Mute') : (isMuted ? 'Muted' : 'Speaking')}
    >
      {isMuted ? (
        <MicOff size={12} className="text-white" />
      ) : (
        <Mic size={12} className="text-white" />
      )}
    </button>
  );
}
