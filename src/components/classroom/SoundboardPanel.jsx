import React, { useRef } from 'react';
import {
  Music,
  Upload,
  Play,
  Square,
  Mic,
  Volume2,
  Volume1,
  X
} from 'lucide-react';

export default function SoundboardPanel({
  isOpen,
  onClose,
  audioState
}) {
  const fileInputRef = useRef(null);

  const {
    isReady,
    initAudioContext,
    loadAudioFile,
    playAudio,
    stopAudio,
    isPlaying,
    currentTime,
    duration,
    voiceVolume,
    setVoiceVolume,
    bgmVolume,
    setBgmVolume,
    hearMyVoice,
    toggleHearMyVoice,
    error
  } = audioState;

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      loadAudioFile(file);
    }
  };

  const formatTime = (t) => {
    const mins = Math.floor(t / 60);
    const secs = Math.floor(t % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <div className="bg-zinc-900 border-l border-zinc-800 w-80 flex flex-col h-full shadow-2xl transition-all relative z-40">
      {/* Header */}
      <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50 backdrop-blur-md">
        <div className="flex items-center gap-2 text-white">
          <Music className="text-emerald-500" size={20} />
          <h3 className="font-bold">Soundboard</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-zinc-800 rounded-lg text-gray-400 hover:text-white transition-colors"
        >
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6">

        {/* Initialization Wrapper */}
        {!isReady ? (
          <div className="flex flex-col items-center justify-center py-10 text-center gap-4">
            <p className="text-gray-400 text-sm">
              Initialize the soundboard to start mixing music and voice.
            </p>
            <button
              onClick={initAudioContext}
              className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-emerald-900/20"
            >
              Start Soundboard
            </button>
          </div>
        ) : (
          <>
            {/* File Player Section */}
            <div className="bg-zinc-800/50 rounded-2xl p-4 border border-zinc-700/50">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Music Player</span>
                {duration > 0 && (
                  <span className="text-xs text-emerald-400 font-mono">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                )}
              </div>

              {/* Progress Bar */}
              <div className="h-1.5 bg-zinc-700 rounded-full mb-4 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all duration-100 ease-linear"
                  style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                />
              </div>

              <div className="flex gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="audio/*"
                  onChange={handleFileChange}
                />

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 py-2 px-3 bg-zinc-700 hover:bg-zinc-600 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                >
                  <Upload size={16} />
                  Load Audio
                </button>

                {!isPlaying ? (
                  <button
                    onClick={playAudio}
                    disabled={duration === 0}
                    className="p-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition-colors"
                  >
                    <Play size={20} fill="currentColor" />
                  </button>
                ) : (
                  <button
                    onClick={stopAudio}
                    className="p-2 bg-red-600 hover:bg-red-700 text-white rounded-xl transition-colors"
                  >
                    <Square size={20} fill="currentColor" />
                  </button>
                )}
              </div>

              {error && (
                <p className="text-red-400 text-xs mt-2 text-center">{error}</p>
              )}
            </div>

            {/* Mixer Section */}
            <div className="flex flex-col gap-6">

              {/* Voice Volume */}
              <div className="bg-zinc-800/30 rounded-xl p-3 border border-zinc-700/30">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-gray-300 text-sm font-medium">
                    <Mic size={16} className="text-indigo-400" />
                    Voice Volume
                  </div>
                  <span className="text-xs text-gray-500 font-mono">{(voiceVolume * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1.5"
                  step="0.05"
                  value={voiceVolume}
                  onChange={(e) => setVoiceVolume(parseFloat(e.target.value))}
                  className="w-full accent-indigo-500 h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* BGM Volume */}
              <div className="bg-zinc-800/30 rounded-xl p-3 border border-zinc-700/30">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-gray-300 text-sm font-medium">
                    <Volume2 size={16} className="text-emerald-400" />
                    BGM Volume
                  </div>
                  <span className="text-xs text-gray-500 font-mono">{(bgmVolume * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1.5"
                  step="0.05"
                  value={bgmVolume}
                  onChange={(e) => setBgmVolume(parseFloat(e.target.value))}
                  className="w-full accent-emerald-500 h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
                />
                <p className="text-[10px] text-gray-500 mt-2">
                  *Audio only plays when you start the player.
                </p>
              </div>

              {/* Monitoring Toggle */}
              <div className="bg-zinc-800/30 rounded-xl p-3 border border-zinc-700/30 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 text-gray-300 text-sm font-medium">
                    <Volume1 size={16} className="text-amber-400" />
                    Hear My Voice
                  </div>
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    Monitor mic input (may cause echo without headphones)
                  </p>
                </div>

                <button
                  onClick={() => toggleHearMyVoice(!hearMyVoice)}
                  className={`relative w-11 h-6 rounded-full transition-colors duration-200 ease-in-out focus:outline-none ${hearMyVoice ? 'bg-amber-500' : 'bg-zinc-700'}`}
                >
                  <span
                    className={`inline-block w-4 h-4 transform transition-transform duration-200 ease-in-out bg-white rounded-full ${hearMyVoice ? 'translate-x-6' : 'translate-x-1'}`}
                  />
                </button>
              </div>

            </div>
          </>
        )}

      </div>

      {/* Footer / Status */}
      <div className="p-3 bg-zinc-950 text-[10px] text-zinc-500 text-center border-t border-zinc-800">
        LiveKit Soundboard v1.0 • Low Latency Mode
      </div>
    </div>
  );
}
