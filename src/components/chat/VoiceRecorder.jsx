import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Trash2, Send, Loader2 } from 'lucide-react';

export default function VoiceRecorder({ onSend, onCancel, onRecordingStart }) {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const mediaRecorderRef = useRef(null);
  const timerRef = useRef(null);
  const chunksRef = useRef([]);

  // High Fidelity Constraints for Singing/Music
  // High Fidelity Constraints for Singing/Music
  const audioConstraints = {
    audio: {
      // Core Constraints
      echoCancellation: false,
      autoGainControl: false,
      noiseSuppression: false,

      // Advanced / Vendor Specific to force "Music Mode"
      channelCount: 2, // Stereo often prevents mono-optimized voice processing
      sampleRate: 48000,
      sampleSize: 16,

      // Chrome/Webkit specific
      googEchoCancellation: false,
      googAutoGainControl: false,
      googNoiseSuppression: false,
      googHighpassFilter: false,
      googAudioMirroring: false,

      // Firefox specific
      mozAutoGainControl: false,
      mozNoiseSuppression: false,
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(audioConstraints);

      const options = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? { mimeType: 'audio/webm;codecs=opus' }
        : { mimeType: 'audio/mp4' }; // Fallback for Safari

      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const mimeType = options.mimeType;
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setAudioBlob(blob);

        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start(100); // Collect 100ms chunks
      setIsRecording(true);

      // Start timer
      timerRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error("Error accessing microphone:", err);
      // Ideally trigger a toast or error callback here
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  };

  const handleCancel = () => {
    stopRecording();
    setAudioBlob(null);
    setDuration(0);
    onCancel();
  };

  const handleSend = async () => {
    if (!audioBlob) return;

    setIsProcessing(true);
    try {
      await onSend(audioBlob, duration);
      // Reset after sending to clear UI
      setAudioBlob(null);
      setDuration(0);
      setIsRecording(false);
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.stream) {
        mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isProcessing) {
    return (
      <div className="flex items-center gap-3 p-3 bg-gray-100 dark:bg-zinc-900 rounded-xl w-full">
        <Loader2 className="animate-spin text-indigo-600" size={20} />
        <span className="text-sm text-gray-500">Processing audio...</span>
      </div>
    );
  }

  // Preview Mode selection
  if (audioBlob && !isRecording) {
    return (
      <div className="flex items-center gap-2 p-1 pl-2 bg-indigo-50 dark:bg-zinc-900/50 rounded-3xl w-full border border-indigo-100 dark:border-zinc-800 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-200">
        <button
          type="button"
          onClick={handleCancel}
          className="p-2 text-red-500 hover:bg-red-100 dark:hover:bg-red-500/20 rounded-full transition-colors flex-shrink-0"
          title="Discard"
        >
          <Trash2 size={18} />
        </button>

        <div className="flex-1 flex items-center gap-2 overflow-hidden px-2">
          {/* Play Preview Button */}
          <button
            type="button"
            onClick={() => {
              const url = URL.createObjectURL(audioBlob);
              const audio = new Audio(url);
              audio.play();
            }}
            className="p-1.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full hover:bg-indigo-200 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="ml-0.5"><path d="M8 5v14l11-7z" /></svg>
          </button>

          <div className="h-6 flex-1 bg-gray-200 dark:bg-zinc-800 rounded-full overflow-hidden flex items-center relative">
            {/* Visual bar */}
            <div className="absolute inset-0 bg-indigo-100 dark:bg-indigo-900/20 w-full" />
            <div className="relative z-10 w-full flex justify-center gap-0.5 px-2">
              {[...Array(15)].map((_, i) => (
                <div key={i} className="w-1 bg-indigo-400 rounded-full opacity-60" style={{ height: `${20 + Math.random() * 60}%` }}></div>
              ))}
            </div>
          </div>
          <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold min-w-[2.5rem] text-right">{formatTime(duration)}</span>
        </div>

        <button
          type="button"
          onClick={handleSend}
          className="p-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full transition-all shadow-md shadow-indigo-600/20 flex-shrink-0 hover:scale-105 active:scale-95"
        >
          <Send size={18} fill="currentColor" className="opacity-90" />
        </button>
      </div>
    )
  }

  return (
    <div className={`flex items-center gap-2 transition-all duration-300 ease-in-out ${isRecording ? 'w-full' : ''}`}>
      {isRecording ? (
        <div className="flex-1 flex items-center gap-2 bg-red-50 dark:bg-red-900/10 p-1.5 pl-3 rounded-full border border-red-100 dark:border-red-900/20 animate-pulse">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-bounce"></div>
          <span className="font-mono text-xs text-red-600 dark:text-red-400 font-bold min-w-[2.5rem]">{formatTime(duration)}</span>
          <span className="text-[10px] text-red-400 uppercase tracking-wider font-semibold flex-1 text-center truncate">Recording</span>
          <button
            type="button"
            onClick={stopRecording}
            className="p-2 bg-white dark:bg-zinc-800 text-red-500 rounded-full shadow-sm hover:scale-105 transition-transform"
          >
            <Square size={16} fill="currentColor" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={startRecording}
          className="p-3 text-gray-500 hover:text-indigo-600 bg-gray-100 hover:bg-indigo-50 dark:bg-zinc-900 dark:hover:bg-zinc-800 rounded-full transition-all active:scale-95"
          title="Record Voice Note"
        >
          <Mic size={20} />
        </button>
      )}
    </div>
  );
}
