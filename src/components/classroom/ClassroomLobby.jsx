import React, { useEffect, useState } from 'react';
import { classroomService } from '../../services/classroomService';
import { GraduationCap, Users, Loader2, AlertCircle, RefreshCw, Lock } from 'lucide-react';
import { useToast } from '../ui/Toast';

export default function ClassroomLobby({ onSelectChat, selectedChatId }) {
  const toast = useToast();
  const [academyClass, setAcademyClass] = useState(null);
  const [hasAccess, setHasAccess] = useState(null); // null = loading
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retrying, setRetrying] = useState(false);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    checkAccessAndFetch();
  }, []);

  const checkAccessAndFetch = async () => {
    setLoading(true);
    setError(null);
    try {
      // Check access permission (academy/teacher/admin roles)
      const access = await classroomService.hasAcademyAccess();
      setHasAccess(access);

      // Always try to fetch class (it will fallback to preview via RPC if not member)
      const data = await classroomService.getAcademyClass();
      setAcademyClass(data);

    } catch (err) {
      console.error('Error loading classroom:', err);
      // Only show error if we strictly can't load anything.
      // If unauthorized, we might expect null/error, but getAcademyClass handles it.
      if (err.message !== 'Not authenticated') {
        setError('Failed to load classroom. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = async () => {
    setRetrying(true);
    await checkAccessAndFetch();
    setRetrying(false);
  };

  const handleClick = async () => {
    if (!academyClass) return;

    // 1. If unauthorized -> Show Toast
    if (!hasAccess) {
      toast.error("You're not joined Academy Class yet, please contact Admin for more information");
      return;
    }

    // 2. If authorized but preview mode (not member) -> Try to Join
    if (academyClass.isPreview) {
      setJoining(true);
      try {
        const joined = await classroomService.joinAcademyClass(academyClass.id);
        if (joined) {
          toast.success("Joined Academy Class!");
          // Refresh to get full data
          const fullData = await classroomService.getAcademyClass();
          setAcademyClass(fullData);
          onSelectChat(fullData);
        } else {
          // Should not happen if hasAccess is true, but just in case
          toast.error("Failed to join. Permission denied.");
        }
      } catch (err) {
        console.error('Join error:', err);
        toast.error("Error joining class. Please try again.");
      } finally {
        setJoining(false);
      }
      return;
    }

    // 3. Authorized and Member -> Select Chat
    onSelectChat(academyClass);
  };

  // Loading state
  if (loading) {
    return (
      <div className="w-full md:w-80 border-r border-gray-200 bg-white dark:bg-zinc-950 flex flex-col h-full">
        <div className="p-4 border-b border-gray-200 dark:border-zinc-800">
          <h2 className="text-xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
            Classroom
          </h2>
        </div>
        <div className="flex-1 flex justify-center items-center">
          <Loader2 className="animate-spin text-emerald-500" size={32} />
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="w-full md:w-80 border-r border-gray-200 bg-white dark:bg-zinc-950 flex flex-col h-full">
        <div className="p-4 border-b border-gray-200 dark:border-zinc-800">
          <h2 className="text-xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
            Classroom
          </h2>
        </div>
        <div className="flex-1 flex flex-col justify-center items-center p-6 text-center">
          <AlertCircle className="text-red-500 mb-4" size={48} />
          <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
          <button
            onClick={handleRetry}
            disabled={retrying}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw size={16} className={retrying ? 'animate-spin' : ''} />
            {retrying ? 'Retrying...' : 'Try Again'}
          </button>
        </div>
      </div>
    );
  }

  // No Class Found
  if (!academyClass) {
    return (
      <div className="w-full md:w-80 border-r border-gray-200 bg-white dark:bg-zinc-950 flex flex-col h-full">
        <div className="p-4 border-b border-gray-200 dark:border-zinc-800">
          <h2 className="text-xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
            Classroom
          </h2>
        </div>
        <div className="flex-1 flex flex-col justify-center items-center p-6 text-center">
          <p className="text-gray-500">No active class found. Please wait for an admin to create one.</p>
        </div>
      </div>
    );
  }

  // Render Class Card (Visible to ALL)
  const isSelected = selectedChatId === academyClass.id;

  return (
    <div className="w-full md:w-80 border-r border-gray-200 bg-white dark:bg-zinc-950 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 sticky top-0 z-10">
        <h2 className="text-xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
          Classroom
        </h2>
      </div>

      {/* Academy Class Card */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-3">
        <button
          onClick={handleClick}
          disabled={joining}
          className={`w-full p-4 rounded-xl flex items-center gap-4 transition-all duration-200 relative overflow-hidden ${isSelected
            ? 'bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/30 dark:to-teal-900/30 ring-2 ring-emerald-500'
            : 'bg-gray-50 dark:bg-zinc-900 hover:bg-gray-100 dark:hover:bg-zinc-800'
            } ${(!hasAccess || joining) ? 'opacity-90' : ''}`}
        >
          {/* Icon */}
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center flex-shrink-0 shadow-lg">
            {joining ? (
              <Loader2 size={28} className="text-white animate-spin" />
            ) : (
              <GraduationCap size={28} className="text-white" />
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 text-left">
            <h3 className="font-bold text-gray-900 dark:text-gray-100 truncate text-base">
              {academyClass.name}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <Users size={14} className="text-gray-400" />
              <span className="text-sm text-gray-500">
                {academyClass.memberCount} members
              </span>
            </div>
          </div>

          {/* Locked Badge for Unauthorized */}
          {!hasAccess && (
            <div className="absolute top-2 right-2">
              <Lock size={16} className="text-gray-400" />
            </div>
          )}

          {/* Active indicator */}
          {(hasAccess && !academyClass.isPreview) && (
            <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
          )}
        </button>
      </div>
    </div>
  );
}
