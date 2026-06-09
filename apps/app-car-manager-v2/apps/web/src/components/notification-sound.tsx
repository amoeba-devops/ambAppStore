'use client';

import { useEffect, useRef, useCallback } from 'react';

/**
 * NotificationSound — plays audio when push notifications arrive.
 *
 * This component:
 * 1. Listens for 'message' events from the service worker
 * 2. Plays a notification sound when type === 'NOTIFICATION_RECEIVED'
 *
 * Sound strategy:
 * - Primary: Try to play /sounds/notification.mp3 if it exists
 * - Fallback: Generate a pleasant beep using Web Audio API
 *
 * The service worker already sets `silent: false` which triggers the OS
 * notification sound. This component adds an IN-APP sound for when the
 * app is in the foreground (where OS sounds might be suppressed).
 *
 * Mobile PWA considerations:
 * - iOS requires user interaction before audio can play (unlocked on first tap)
 * - Android Chrome generally allows audio after user grants notification permission
 */
export function NotificationSound() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isUnlockedRef = useRef(false);

  // Unlock audio on first user interaction (required for iOS)
  const unlockAudio = useCallback(() => {
    if (isUnlockedRef.current) return;
    isUnlockedRef.current = true;

    // Create AudioContext on first interaction
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }

    // Resume if suspended (iOS Safari requirement)
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }

    // Pre-load the audio file
    if (!audioRef.current) {
      audioRef.current = new Audio('/sounds/notification.wav');
      audioRef.current.volume = 0.5;
      // Silent play to unlock (will fail silently if file doesn't exist)
      audioRef.current.play().catch(() => {});
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, []);

  // Play notification sound using file or Web Audio API fallback
  const playSound = useCallback(() => {
    // Try playing the audio file first
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {
        // File doesn't exist or can't play, use Web Audio API
        playBeep();
      });
      return;
    }

    // Fallback to Web Audio API beep
    playBeep();
  }, []);

  // Generate a pleasant notification beep using Web Audio API
  const playBeep = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }

    const ctx = audioContextRef.current;
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const now = ctx.currentTime;

    // Create a pleasant two-tone notification sound
    const playTone = (frequency: number, startTime: number, duration: number) => {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;

      // Envelope: quick attack, sustain, quick release
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(0.3, startTime + 0.02);
      gainNode.gain.setValueAtTime(0.3, startTime + duration - 0.05);
      gainNode.gain.linearRampToValueAtTime(0, startTime + duration);

      oscillator.start(startTime);
      oscillator.stop(startTime + duration);
    };

    // Two-tone chime: E5 (659Hz) then G5 (784Hz)
    playTone(659, now, 0.15);
    playTone(784, now + 0.15, 0.2);
  }, []);

  useEffect(() => {
    // Unlock audio on any user interaction
    const events = ['click', 'touchstart', 'keydown'];
    events.forEach((event) => {
      document.addEventListener(event, unlockAudio, { once: true, passive: true });
    });

    // Listen for service worker messages
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'NOTIFICATION_RECEIVED') {
        playSound();
      }
    };

    navigator.serviceWorker?.addEventListener('message', handleMessage);

    return () => {
      events.forEach((event) => {
        document.removeEventListener(event, unlockAudio);
      });
      navigator.serviceWorker?.removeEventListener('message', handleMessage);
    };
  }, [unlockAudio, playSound]);

  // This component renders nothing visible
  return null;
}
