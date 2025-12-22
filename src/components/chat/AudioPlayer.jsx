import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, Loader2 } from 'lucide-react';
import { chatService } from '../../services/chatService';

export default function AudioPlayer({ path, duration: propDuration, waveform }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [audioDuration, setAudioDuration] = useState(propDuration || 0);

  // Web Audio API Refs
  const audioContextRef = useRef(null);
  const audioBufferRef = useRef(null);
  const sourceNodeRef = useRef(null);
  const startTimeRef = useRef(0); // AudioContext time when playback started
  const offsetRef = useRef(0);    // User's seek offset in seconds
  const animationFrameRef = useRef(null);

  // Load audio buffer on mount
  useEffect(() => {
    let mounted = true;

    const loadAudio = async () => {
      if (!path) return;

      setLoading(true);
      setError(false);

      try {
        // Get URL (signed or public)
        let url = path;
        if (!path.startsWith('http')) {
          url = await chatService.getVoiceNoteUrl(path);
          if (!url) throw new Error('Failed to get audio URL');
        }

        // Fetch audio data as ArrayBuffer
        const response = await fetch(url);
        if (!response.ok) throw new Error('Network response was not ok');
        const arrayBuffer = await response.arrayBuffer();

        // Create AudioContext if not exists
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
        }

        // Decode audio data into AudioBuffer
        const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);

        if (mounted) {
          audioBufferRef.current = audioBuffer;
          setAudioDuration(audioBuffer.duration);
          setLoading(false);
        }
      } catch (e) {
        console.error('Failed to load audio:', e);
        if (mounted) {
          setError(true);
          setLoading(false);
        }
      }
    };

    loadAudio();

    return () => {
      mounted = false;
      stopPlayback();
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [path]);

  // Update progress during playback
  const updateProgress = useCallback(() => {
    if (!audioContextRef.current || !isPlaying || !audioBufferRef.current) return;

    const elapsed = audioContextRef.current.currentTime - startTimeRef.current + offsetRef.current;
    const total = audioBufferRef.current.duration;

    if (elapsed >= total) {
      // Playback ended
      setIsPlaying(false);
      setProgress(100);
      setCurrentTime(total);
      offsetRef.current = 0;
      return;
    }

    setCurrentTime(elapsed);
    setProgress((elapsed / total) * 100);
    animationFrameRef.current = requestAnimationFrame(updateProgress);
  }, [isPlaying]);

  useEffect(() => {
    if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(updateProgress);
    } else {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    }
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isPlaying, updateProgress]);

  const stopPlayback = () => {
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop();
        sourceNodeRef.current.disconnect();
      } catch (e) { /* ignore */ }
      sourceNodeRef.current = null;
    }
  };

  const playFromOffset = (offset) => {
    if (!audioContextRef.current || !audioBufferRef.current) return;

    // Resume context if suspended (browser autoplay policy)
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }

    stopPlayback();

    const source = audioContextRef.current.createBufferSource();
    source.buffer = audioBufferRef.current;
    source.connect(audioContextRef.current.destination);

    source.onended = () => {
      if (isPlaying) {
        setIsPlaying(false);
        setProgress(100);
        setCurrentTime(audioBufferRef.current.duration);
        offsetRef.current = 0;
      }
    };

    sourceNodeRef.current = source;
    startTimeRef.current = audioContextRef.current.currentTime;
    offsetRef.current = offset;

    source.start(0, offset);
    setIsPlaying(true);
  };

  const togglePlay = () => {
    if (loading || !audioBufferRef.current) return;

    if (isPlaying) {
      // Pause: save current offset
      const elapsed = audioContextRef.current.currentTime - startTimeRef.current + offsetRef.current;
      offsetRef.current = elapsed;
      stopPlayback();
      setIsPlaying(false);
    } else {
      // Play from current offset
      playFromOffset(offsetRef.current);
    }
  };

  const handleSeek = (e) => {
    if (!audioBufferRef.current) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = Math.max(0, Math.min(x / rect.width, 1));
    const newTime = audioBufferRef.current.duration * percent;

    offsetRef.current = newTime;
    setCurrentTime(newTime);
    setProgress(percent * 100);

    // If currently playing, restart from new position
    if (isPlaying) {
      playFromOffset(newTime);
    }
  };

  const formatTime = (seconds) => {
    if (!seconds || !isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 p-2 rounded-lg text-xs text-red-500">
        Audio unavailable
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 bg-gray-100 dark:bg-zinc-800/50 p-2 px-3 rounded-2xl w-full sm:w-[280px] md:w-[320px] border border-gray-200 dark:border-zinc-700/50 shadow-sm">
      <button
        onClick={togglePlay}
        disabled={loading}
        className="w-10 h-10 flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white rounded-full transition-all shadow-md shadow-indigo-600/20 disabled:opacity-50 flex-shrink-0"
      >
        {loading ? (
          <Loader2 size={16} className="animate-spin" />
        ) : isPlaying ? (
          <Pause size={18} fill="currentColor" />
        ) : (
          <Play size={18} fill="currentColor" className="ml-1" />
        )}
      </button>

      <div className="flex-1 flex flex-col gap-1 min-w-[160px] w-full">
        {/* Interactive Seek Bar */}
        <div
          className="group relative flex items-center h-10 w-full cursor-pointer"
          onClick={handleSeek}
        >
          {/* Waveform Visualization */}
          <div className="absolute inset-0 flex items-center gap-[2px] h-full w-full px-1 pointer-events-none">
            {(() => {
              // Use real waveform or generate a static deterministic pattern
              const points = (waveform && waveform.length > 0) ? waveform : Array.from({ length: 40 }, (_, i) => {
                const seed = (path || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0) + i;
                return 30 + (Math.sin(seed) * 20) + (Math.cos(seed * 2) * 20);
              });

              return points.map((val, i, arr) => {
                const barHeight = typeof val === 'number' ? Math.max(10, Math.min(100, val)) : 30;
                const isPassed = (i / arr.length * 100) < progress;

                return (
                  <div
                    key={i}
                    className={`flex-1 rounded-full transition-colors duration-75 ${isPassed ? 'bg-indigo-500' : 'bg-gray-300 dark:bg-zinc-700'}`}
                    style={{
                      height: `${barHeight}%`,
                      minHeight: '4px'
                    }}
                  />
                );
              });
            })()}
          </div>
        </div>

        <div className="flex justify-between text-[10px] text-gray-500 font-medium select-none">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(audioDuration)}</span>
        </div>
      </div>
    </div>
  );
}
