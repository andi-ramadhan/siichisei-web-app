import React from 'react';
import MicBadge from './MicBadge';
import { Crown, Hand } from 'lucide-react';

export default function StageParticipant({
  user,
  isSpeaking = false,
  isMuted = true,
  isOnStage = false,
  isTeacher = false,
  hasRaisedHand = false,
  hasMicPermission = false,
  isCurrentUser = false,
  canControlMic = false,
  onToggleMic = () => { },
  size = 'normal' // 'normal' | 'small'
}) {
  const displayName = user?.nickname || user?.email?.split('@')[0] || 'Unknown';
  const initial = displayName[0]?.toUpperCase() || '?';

  const sizeClasses = {
    normal: {
      container: 'w-28 h-28 md:w-36 md:h-36',
      avatar: 'w-16 h-16 md:w-20 md:h-20',
      text: 'text-sm md:text-base',
      icon: 20
    },
    small: {
      container: 'w-16 h-16 md:w-20 md:h-20',
      avatar: 'w-10 h-10 md:w-12 md:h-12',
      text: 'text-xs',
      icon: 14
    }
  };

  const sizes = sizeClasses[size];

  // Determine ring color based on state
  let ringClass = 'ring-transparent';
  if (isSpeaking) {
    ringClass = 'ring-4 ring-emerald-400 animate-pulse';
  } else if (hasRaisedHand) {
    ringClass = 'ring-4 ring-amber-400';
  }

  // Handle click on avatar for controls (Teacher can click student)
  const isInteractable = canControlMic && !isCurrentUser;

  return (
    <div
      onClick={isInteractable ? onToggleMic : undefined}
      className={`${sizes.container} flex flex-col items-center justify-center gap-2 p-2 rounded-xl bg-zinc-800/50 backdrop-blur-sm transition-all duration-200 ${isOnStage ? 'bg-gradient-to-br from-emerald-900/30 to-teal-900/30' : ''
        } ${isInteractable ? 'cursor-pointer hover:bg-zinc-700/50' : ''}`}
    >
      {/* Avatar */}
      <div className={`relative ${ringClass} rounded-full transition-all duration-200`}>
        {user?.avatar_url ? (
          <img
            src={user.avatar_url}
            alt={displayName}
            className={`${sizes.avatar} rounded-full object-cover`}
          />
        ) : (
          <div
            className={`${sizes.avatar} rounded-full flex items-center justify-center text-white font-bold ${isTeacher
              ? 'bg-gradient-to-br from-amber-500 to-orange-500'
              : 'bg-gradient-to-br from-emerald-500 to-teal-500'
              }`}
            style={{ fontSize: size === 'small' ? '0.75rem' : '1.25rem' }}
          >
            {initial}
          </div>
        )}

        {/* Teacher Crown Badge */}
        {isTeacher && (
          <div className="absolute -top-1 -right-1 w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center shadow-lg">
            <Crown size={14} className="text-white" />
          </div>
        )}

        {/* Raised Hand Badge */}
        {hasRaisedHand && !isTeacher && (
          <div className="absolute -top-1 -right-1 w-6 h-6 bg-amber-400 rounded-full flex items-center justify-center shadow-lg animate-bounce">
            <Hand size={14} className="text-white" />
          </div>
        )}

        {/* Mic Badge (External Component) */}
        <MicBadge
          isMuted={isMuted}
          isTeacher={isTeacher}
          hasPermission={hasMicPermission}
          canControl={canControlMic}
          onClick={onToggleMic}
        />
      </div>

      {/* Name */}
      <span className={`${sizes.text} text-white font-medium truncate max-w-full px-1`}>
        {isCurrentUser ? 'You' : displayName}
      </span>
    </div>
  );
}
