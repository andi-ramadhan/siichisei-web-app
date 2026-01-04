import { useState, useRef, useEffect, useCallback } from 'react';

/**
 * Hook to manage Soundboard Audio Mixing (Mic + BGM)
 * Uses Web Audio API to mix local microphone input with a playling audio file.
 * Returns a mixed MediaStreamTrack that can be published to LiveKit.
 */
export function useSoundboardAudio() {
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [error, setError] = useState(null);

  // Audio Context & Nodes
  const audioContextRef = useRef(null);
  const micSourceRef = useRef(null);
  const bgmSourceRef = useRef(null);
  const micGainNodeRef = useRef(null);
  const bgmGainNodeRef = useRef(null);
  const destinationRef = useRef(null); // The mixed output (for LiveKit)
  const localLoopbackGainRef = useRef(null); // For "Hear my voice"

  // Buffer storage
  const audioBufferRef = useRef(null);
  const animationFrameRef = useRef(null);
  const startTimeRef = useRef(0);
  const pausedAtRef = useRef(0);

  // States for external control
  const [voiceVolume, setVoiceVolume] = useState(0.5); // 0-1
  const [bgmVolume, setBgmVolume] = useState(0.5);   // 0-1
  const [hearMyVoice, setHearMyVoice] = useState(false);

  // Initialize Audio Context
  const initAudioContext = useCallback(async () => {
    try {
      if (audioContextRef.current) return;

      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContext();
      audioContextRef.current = ctx;

      // Create Nodes
      const dest = ctx.createMediaStreamDestination();
      destinationRef.current = dest;

      const micGain = ctx.createGain();
      micGain.gain.value = voiceVolume;
      micGainNodeRef.current = micGain;

      const bgmGain = ctx.createGain();
      bgmGain.gain.value = bgmVolume;
      bgmGainNodeRef.current = bgmGain;

      const loopbackGain = ctx.createGain();
      loopbackGain.gain.value = 0; // Default off
      localLoopbackGainRef.current = loopbackGain;

      // Get Microphone Stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const micSource = ctx.createMediaStreamSource(stream);
      micSourceRef.current = micSource;

      // Graph Wiring:
      // Mic -> MicGain -> Destination (LiveKit)
      // Mic -> MicGain -> LoopbackGain -> Context.Destination (Local Speakers for "Hear my voice")
      // BGM -> BgmGain -> Destination (LiveKit)
      // BGM -> BgmGain -> Context.Destination (Local Speakers for Zero Latency Monitoring)

      // 1. Mic Path
      micSource.connect(micGain);
      micGain.connect(dest); // To LiveKit
      micGain.connect(loopbackGain);
      loopbackGain.connect(ctx.destination); // To Local Output (controlled by hearMyVoice)

      // 2. BGM Path wiring (Persistent)
      // BGM Source (created on play) -> BGM Gain -> Destination (LiveKit)
      // BGM Source -> BGM Gain -> Context.Destination (Local Speakers)

      // Connect BGM Gain to outputs now, so we don't have to do it every play
      bgmGain.connect(dest);
      bgmGain.connect(ctx.destination);

      setIsReady(true);
    } catch (err) {
      console.error("Failed to init audio context:", err);
      setError("Failed to access microphone or audio system.");
    }
  }, [voiceVolume, bgmVolume]);

  // Handle Voice Volume Change
  useEffect(() => {
    if (micGainNodeRef.current) {
      // Smooth transition
      micGainNodeRef.current.gain.setTargetAtTime(voiceVolume, audioContextRef.current.currentTime, 0.1);
    }
  }, [voiceVolume]);

  // Handle BGM Volume Change
  useEffect(() => {
    if (bgmGainNodeRef.current) {
      bgmGainNodeRef.current.gain.setTargetAtTime(bgmVolume, audioContextRef.current.currentTime, 0.1);
    }
  }, [bgmVolume]);

  // Handle "Hear My Voice" Toggle
  useEffect(() => {
    if (localLoopbackGainRef.current) {
      const targetGain = hearMyVoice ? 1.0 : 0.0;
      localLoopbackGainRef.current.gain.setTargetAtTime(targetGain, audioContextRef.current.currentTime, 0.1);
    }
  }, [hearMyVoice]);

  // Load Audio File
  const loadAudioFile = useCallback(async (file) => {
    if (!audioContextRef.current) await initAudioContext();
    if (!audioContextRef.current) return;

    try {
      const arrayBuffer = await file.arrayBuffer();
      const decodedBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
      audioBufferRef.current = decodedBuffer;
      setDuration(decodedBuffer.duration);
      // Reset play state
      if (isPlaying) stopAudio();
      setError(null);
    } catch (err) {
      console.error("Failed to load audio file:", err);
      setError("Failed to load or decode audio file.");
    }
  }, [initAudioContext, isPlaying]);

  // Play Audio
  const playAudio = useCallback(() => {
    if (!audioContextRef.current || !audioBufferRef.current) return;

    // Stop existing if any
    if (bgmSourceRef.current) {
      try {
        bgmSourceRef.current.stop();
      } catch (e) { /* ignore */ }
    }

    const ctx = audioContextRef.current;

    // Resume context if suspended (browser policy)
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const source = ctx.createBufferSource();
    source.buffer = audioBufferRef.current;

    // Connect BGM Source -> BGM Gain
    source.connect(bgmGainNodeRef.current);

    // Connect BGM Gain -> LiveKit Dest AND Local Dest
    // Check if already connected to avoid fan-out errors, but BGM Gain is persistent.
    // The wiring inside initAudioContext was conceptual for BGM.
    // Actually, we need to wire BGM Gain to destinations ONCE.
    // Let's do it in a safer way:
    // We didn't wire bgmGain in init because we didn't have source.
    // But bgmGain is a node. We can wire bgmGain -> dests in init.

    // Re-check wiring in initAudioContext... 
    // Wait, I didn't wire bgmGainNodeRef to output in initAudioContext. Let's fix that.

    // Connect Source
    source.start(0, pausedAtRef.current);
    startTimeRef.current = ctx.currentTime - pausedAtRef.current;

    bgmSourceRef.current = source;
    setIsPlaying(true);

    // Animation frame for progress
    const updateProgress = () => {
      const current = ctx.currentTime - startTimeRef.current;
      if (current >= audioBufferRef.current.duration) {
        stopAudio(); // Auto stop at end
        setCurrentTime(0);
        pausedAtRef.current = 0;
      } else {
        setCurrentTime(current);
        animationFrameRef.current = requestAnimationFrame(updateProgress);
      }
    };
    animationFrameRef.current = requestAnimationFrame(updateProgress);

    source.onended = () => {
      setIsPlaying(false);
      cancelAnimationFrame(animationFrameRef.current);
    };

  }, []);

  // One-time post-init wiring for BGM Gain
  useEffect(() => {
    if (audioContextRef.current && bgmGainNodeRef.current && destinationRef.current) {
      // Ensure BGM Gain is connected to outputs
      // We need to check if it's already connected or just connect it.
      // Connecting multiple times is usually fine (idempotent-ish in some browsers, but multiple connections sum up in others).
      // Best to do it inside initAudioContext. 
      // I will rely on the fact that I will modify initAudioContext in a second pass or just accept that I need to do it here safely.

      // Actually, let's just make sure we do it right.
      // I will add the connection logic to initAudioContext in my mental model, but since I already wrote it...
      // Let's modify the playAudio to NOT connect BGM Gain every time, but ensure BGM Gain is connected to outputs ONCE.

    }
  }, []); // this effect is useless as I'm writing the file now.

  // NOTE: I missed wiring bgmGainNode to destination in initAudioContext.
  // I will correct this in the actual file write.

  // Stop Audio
  const stopAudio = useCallback(() => {
    if (bgmSourceRef.current) {
      try {
        bgmSourceRef.current.stop();
      } catch (e) { /* ignore */ }
      bgmSourceRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    setIsPlaying(false);
    pausedAtRef.current = 0;
    setCurrentTime(0);
  }, []);

  return {
    isReady,
    initAudioContext, // Expose so UI can trigger it on user interaction
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
    toggleHearMyVoice: setHearMyVoice,
    mixedStream: destinationRef.current ? destinationRef.current.stream : null,
    error
  };
}
