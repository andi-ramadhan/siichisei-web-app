import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { classroomService } from '../../services/classroomService';
import StageParticipant from './StageParticipant';
import RaiseHandButton from './RaiseHandButton';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  ControlBar,
  useTracks,
  useParticipants,
  useRoomContext,
  useLocalParticipant
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import '@livekit/components-styles'; // Import default styles if needed, or override

import {
  PhoneOff,
  Monitor,
  MonitorOff,
  Mic,
  MicOff,
  Loader2,
  AlertCircle,
  RefreshCw,
  Users,
  X
} from 'lucide-react';

export default function GroupCallStage({ chat, onEndCall }) {
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [isTeacherOrAdmin, setIsTeacherOrAdmin] = useState(false);

  // LiveKit URL from env
  const liveKitUrl = import.meta.env.VITE_LIVEKIT_URL;

  useEffect(() => {
    init();
  }, [chat?.id]);

  const init = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      setCurrentUser(user);

      const isTA = await classroomService.isTeacherOrAdmin();
      setIsTeacherOrAdmin(isTA);

      const roomName = `classroom-${chat.id}`;
      // Use nickname or email part as name
      const participantName = user.user_metadata?.nickname || user.email?.split('@')[0] || 'User';

      const { token } = await classroomService.getLiveKitToken(
        roomName,
        participantName,
        user.id,
        isTA
      );

      setToken(token);
    } catch (err) {
      console.error("Failed to connect to LiveKit:", err);
      setError(err.message || 'Failed to join call');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-zinc-900 flex flex-col items-center justify-center z-50">
        <Loader2 className="animate-spin text-emerald-500 mb-4" size={48} />
        <p className="text-white text-lg">Connecting to Classroom...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-zinc-900 flex flex-col items-center justify-center z-50 p-4">
        <AlertCircle className="text-red-500 mb-4" size={48} />
        <p className="text-white text-lg mb-2">Connection Error</p>
        <p className="text-gray-400 text-center mb-6">{error}</p>
        <button onClick={onEndCall} className="px-6 py-3 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg">
          Close
        </button>
      </div>
    );
  }

  return (
    <LiveKitRoom
      video={false}
      audio={isTeacherOrAdmin} // Only Teachers auto-publish audio on join
      token={token}
      serverUrl={liveKitUrl}
      data-lk-theme="default"
      className="fixed inset-0 z-50 flex flex-col bg-zinc-950"
      onDisconnected={onEndCall}
    >
      <ActiveCallRoom
        chat={chat}
        currentUser={currentUser}
        isTeacherOrAdmin={isTeacherOrAdmin}
        onEndCall={onEndCall}
      />
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}

// Internal component that has access to Room Context
function ActiveCallRoom({ chat, currentUser, isTeacherOrAdmin, onEndCall }) {
  const room = useRoomContext();
  const participants = useParticipants(); // All participants
  const { localParticipant } = useLocalParticipant();

  // Custom states
  const [raisedHands, setRaisedHands] = useState(new Set());

  // Join Call Presence & Manage Status
  useEffect(() => {
    if (!chat?.id || !currentUser) return;

    // 1. If Teacher, mark call as Active
    if (isTeacherOrAdmin) {
      classroomService.updateCallStatus(chat.id, true);
    }

    // 2. Broadcast Presence ("I am here")
    // This allows the GroupMessageArea to show who is in the call
    const presenceChannel = classroomService.subscribeToCallPresence(
      chat.id,
      currentUser.id,
      {
        id: currentUser.id,
        nickname: currentUser.user_metadata?.nickname || currentUser.email?.split('@')[0],
        avatar_url: currentUser.user_metadata?.avatar_url,
        role: isTeacherOrAdmin ? 'teacher' : 'student'
      },
      (state) => { /* We don't need to consume state here, we just track */ }
    );

    return () => {
      classroomService.unsubscribe(presenceChannel);

      // If Teacher leaves/ends call, mark as inactive
      // NOTE: Ideally we check if any other teachers are left, but for now simple toggle.
      // If we simply close the window, this might not fire reliably.
      // The onEndCall prop handled by explicit button is safer for "Ending" the call.
    };
  }, [chat.id, currentUser, isTeacherOrAdmin]);

  // Mic Control Confirmation State
  const [micConfirmation, setMicConfirmation] = useState(null); // { studentId, name }

  // Shared Mic Permissions Map: { [userId]: boolean }
  // This is synced across all clients via Supabase broadcast
  const [micPermissionsMap, setMicPermissionsMap] = useState({});

  // Permissions: Can the user control their own mic?
  // Teacher/Admin: Always Yes
  // Student: No by default, Yes if Teacher unmutes them
  const [canSpeak, setCanSpeak] = useState(isTeacherOrAdmin);

  // Update canSpeak when role changes (rare but good for consistency)
  useEffect(() => {
    if (isTeacherOrAdmin) setCanSpeak(true);
  }, [isTeacherOrAdmin]);

  // Realtime Events (Raise Hand, Mic Control, Force End)
  useEffect(() => {
    const channel = supabase
      .channel(`call:${chat.id}`)
      .on('broadcast', { event: 'raise_hand' }, ({ payload }) => {
        if (payload.raised) {
          setRaisedHands(prev => new Set([...prev, payload.userId]));
        } else {
          setRaisedHands(prev => {
            const next = new Set(prev);
            next.delete(payload.userId);
            return next;
          });
        }
      })
      .on('broadcast', { event: 'mic_control' }, async ({ payload }) => {
        // Update shared permissions map for ALL clients
        setMicPermissionsMap(prev => ({
          ...prev,
          [payload.targetUserId]: payload.unmute
        }));

        // If this is the targeted user, also toggle their local mic
        if (payload.targetUserId === currentUser?.id) {
          if (payload.unmute) {
            setCanSpeak(true);
            await localParticipant.setMicrophoneEnabled(true);
          } else {
            setCanSpeak(false);
            await localParticipant.setMicrophoneEnabled(false);
          }
        }
      })
      .on('broadcast', { event: 'end_call' }, () => {
        // Force disconnect for everyone when teacher ends call
        room.disconnect();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chat.id, currentUser, localParticipant, room, isTeacherOrAdmin]);

  // --- Helper for safe JSON parsing ---
  const safeParse = (str) => { try { return str ? JSON.parse(str) : {}; } catch (e) { return {}; } };

  // --- Segregate Participants ---
  // A participant is on 'Stage' if:
  // 1. They are a Teacher
  // 2. OR they have mic permission (from shared permissions map)
  const stageParticipants = participants.filter(p => {
    const meta = safeParse(p.metadata);
    const isTeacher = meta.role === 'teacher';
    const hasPermission = !!micPermissionsMap[p.identity];
    return isTeacher || hasPermission;
  });

  const audienceParticipants = participants.filter(p => !stageParticipants.includes(p));

  // --- Actions ---
  const toggleRaiseHand = async () => {
    const amRaised = raisedHands.has(currentUser.id);
    const newState = !amRaised;
    if (newState) setRaisedHands(prev => new Set([...prev, currentUser.id]));
    else setRaisedHands(prev => { const n = new Set(prev); n.delete(currentUser.id); return n; });

    await supabase.channel(`call:${chat.id}`).send({
      type: 'broadcast',
      event: 'raise_hand',
      payload: { userId: currentUser.id, raised: newState }
    });
  };

  const toggleMic = async () => {
    const current = localParticipant.isMicrophoneEnabled;
    await localParticipant.setMicrophoneEnabled(!current);
  };

  const initiateMicControl = (studentId, studentName) => {
    if (!isTeacherOrAdmin) return;
    setMicConfirmation({ studentId, name: studentName });
  };

  const executeMicControl = async (unmute) => {
    if (!micConfirmation) return;
    const { studentId } = micConfirmation;

    // Update local state immediately (sender won't receive their own broadcast)
    setMicPermissionsMap(prev => ({
      ...prev,
      [studentId]: unmute
    }));

    // Broadcast to all other clients
    await supabase.channel(`call:${chat.id}`).send({
      type: 'broadcast',
      event: 'mic_control',
      payload: { targetUserId: studentId, unmute }
    });
    setMicConfirmation(null);
  };

  const handleEndCallAction = async () => {
    if (isTeacherOrAdmin) {
      classroomService.updateCallStatus(chat.id, false);
      await supabase.channel(`call:${chat.id}`).send({
        type: 'broadcast',
        event: 'end_call',
        payload: {}
      });
    }
    room.disconnect();
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-zinc-900 to-zinc-950 relative">
      {/* Confirmation Modal */}
      {micConfirmation && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-zinc-800 p-6 rounded-2xl max-w-sm w-full border border-zinc-700 shadow-xl">
            <h3 className="text-lg font-bold text-white mb-2">Manage Mic for {micConfirmation.name}</h3>
            <p className="text-gray-300 mb-6 text-sm">
              Choose an action for this user. You can grant them permission to speak or revoke it.
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => executeMicControl(true)} // Give Mic
                className="w-full px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center justify-center gap-2"
              >
                <Mic size={18} />
                Give the MIC
              </button>
              <button
                onClick={() => executeMicControl(false)} // Take Mic
                className="w-full px-4 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold flex items-center justify-center gap-2"
              >
                <MicOff size={18} />
                Take the MIC
              </button>
              <button
                onClick={() => setMicConfirmation(null)}
                className="w-full px-4 py-2 rounded-xl bg-zinc-700 hover:bg-zinc-600 text-white text-sm mt-2"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
            <Users size={20} className="text-white" />
          </div>
          <div>
            <h2 className="text-white font-bold text-lg">{chat?.name || 'Academy Class'}</h2>
            <p className="text-emerald-400 text-sm">
              {participants.length} in call
            </p>
          </div>
        </div>
        <button onClick={handleEndCallAction} className="p-3 bg-red-600 hover:bg-red-700 text-white rounded-full transition-colors">
          <PhoneOff size={24} />
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-4 flex flex-col gap-6">

        {/* Stage */}
        <div className="bg-zinc-800/50 rounded-2xl p-4 md:p-6 min-h-[200px]">
          <h3 className="text-white text-sm font-medium mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Stage
          </h3>
          <div className="flex flex-wrap gap-4 justify-center">
            {stageParticipants.length === 0 ? (
              <p className="text-gray-500 text-sm w-full text-center py-8">No one on stage</p>
            ) : (
              stageParticipants.map(participant => {
                const meta = safeParse(participant.metadata);
                const isTeacher = meta.role === 'teacher';
                const hasMicPermission = isTeacher || !!micPermissionsMap[participant.identity];

                return (
                  <StageParticipant
                    key={participant.identity}
                    user={{
                      id: participant.identity,
                      nickname: participant.name,
                      avatar_url: null
                    }}
                    isMuted={!participant.isMicrophoneEnabled}
                    isOnStage={true}
                    isTeacher={isTeacher}
                    hasRaisedHand={raisedHands.has(participant.identity)}
                    isCurrentUser={participant.identity === currentUser.id}
                    canControlMic={isTeacherOrAdmin}
                    hasMicPermission={hasMicPermission}
                    onToggleMic={() => {
                      if ((!participant.isLocal || participant.identity !== currentUser.id) && isTeacherOrAdmin) {
                        initiateMicControl(participant.identity, participant.name);
                      } else if (participant.isLocal) {
                        toggleMic();
                      }
                    }}
                    size="normal"
                  />
                );
              })
            )}
          </div>
        </div>

        {/* Audience */}
        <div className="bg-zinc-800/30 rounded-2xl p-4 md:p-6 flex-1">
          <h3 className="text-gray-400 text-sm font-medium mb-4">
            Audience ({audienceParticipants.length})
          </h3>
          <div className="flex flex-wrap gap-3 justify-center md:justify-start">
            {audienceParticipants.map(participant => {
              const meta = safeParse(participant.metadata);
              const isTeacher = meta.role === 'teacher';
              const hasMicPermission = isTeacher || !!micPermissionsMap[participant.identity];

              return (
                <StageParticipant
                  key={participant.identity}
                  user={{
                    id: participant.identity,
                    nickname: participant.name,
                  }}
                  isMuted={!participant.isMicrophoneEnabled}
                  isOnStage={false}
                  isTeacher={false}
                  hasRaisedHand={raisedHands.has(participant.identity)}
                  isCurrentUser={participant.identity === currentUser.id}
                  canControlMic={isTeacherOrAdmin}
                  hasMicPermission={hasMicPermission}
                  onToggleMic={() => {
                    if (isTeacherOrAdmin) {
                      initiateMicControl(participant.identity, participant.name);
                    }
                  }}
                  size="small"
                />
              );
            })}
          </div>
        </div>

      </div>

      {/* Controls */}
      <div className="border-t border-zinc-800 p-4 flex items-center justify-center gap-4 shrink-0">

        {/* Mic Toggle (Universal - Controlled by Permission) */}
        {canSpeak && (
          <button
            onClick={toggleMic}
            className={`p-4 rounded-full transition-colors ${localParticipant?.isMicrophoneEnabled
              ? 'bg-zinc-700 hover:bg-zinc-600'
              : 'bg-red-600 hover:bg-red-700'
              }`}
          >
            {localParticipant?.isMicrophoneEnabled ? (
              <Mic size={24} className="text-white" />
            ) : (
              <MicOff size={24} className="text-white" />
            )}
          </button>
        )}

        {!isTeacherOrAdmin && (
          <RaiseHandButton
            isRaised={raisedHands.has(currentUser.id)}
            onToggle={toggleRaiseHand}
          />
        )}

        <button
          onClick={handleEndCallAction}
          className="p-4 rounded-full bg-red-600 hover:bg-red-700 transition-colors"
        >
          <PhoneOff size={24} className="text-white" />
        </button>
      </div>
    </div>
  );
}
