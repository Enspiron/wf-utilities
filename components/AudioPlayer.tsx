'use client';

import { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';

interface AudioPlayerProps {
  src: string;
  onError?: () => void;
  compact?: boolean;
}

// Singleton to ensure only one audio plays at a time
let currentPlayingAudio: HTMLAudioElement | null = null;

export default function AudioPlayer({ src, onError, compact = false }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Set audio src when component mounts or src changes
  useEffect(() => {
    if (audioRef.current && src) {
      audioRef.current.src = src;
      audioRef.current.load();
    }
  }, [src]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || (compact && !isLoaded)) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleDurationChange = () => setDuration(audio.duration);
    const handleEnded = () => setIsPlaying(false);
    const handleError = () => {
      setIsPlaying(false);
      onError?.();
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('durationchange', handleDurationChange);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('durationchange', handleDurationChange);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, [onError, compact, isLoaded]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  // Cleanup: pause audio when component unmounts
  useEffect(() => {
    const audio = audioRef.current;
    return () => {
      if (audio) {
        audio.pause();
        audio.src = '';
      }
    };
  }, []);

  const tryPlay = async (audio: HTMLAudioElement) => {
    try {
      await audio.play();
      setIsPlaying(true);
    } catch {
      setIsPlaying(false);
      onError?.();
    }
  };

  const togglePlay = () => {
    if (!audioRef.current) return;

    // In compact mode, load on first play
    if (compact && !isLoaded) {
      setIsLoaded(true);
      // Small delay to let audio element load
      setTimeout(() => {
        if (audioRef.current) {
          // Stop any other playing audio
          if (currentPlayingAudio && currentPlayingAudio !== audioRef.current) {
            currentPlayingAudio.pause();
          }
          currentPlayingAudio = audioRef.current;
          void tryPlay(audioRef.current);
        }
      }, 100);
      return;
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      if (currentPlayingAudio === audioRef.current) {
        currentPlayingAudio = null;
      }
    } else {
      // Stop any other playing audio
      if (currentPlayingAudio && currentPlayingAudio !== audioRef.current) {
        currentPlayingAudio.pause();
      }
      currentPlayingAudio = audioRef.current;
      void tryPlay(audioRef.current);
    }
  };

  const handleSeek = (value: number[]) => {
    if (!audioRef.current) return;
    const newTime = value[0];
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0];
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };

  const toggleMute = () => {
    if (isMuted) {
      setVolume(1);
      setIsMuted(false);
    } else {
      setVolume(0);
      setIsMuted(true);
    }
  };

  const formatTime = (seconds: number) => {
    if (!isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Compact mode: simplified UI with play button only
  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <audio ref={audioRef} preload="none" />
        <Button
          variant="outline"
          size="sm"
          onClick={togglePlay}
          className="shrink-0"
        >
          {isPlaying ? (
            <Pause className="h-3 w-3" />
          ) : (
            <Play className="h-3 w-3" />
          )}
        </Button>
        {isLoaded && (
          <span className="text-xs text-muted-foreground">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        )}
      </div>
    );
  }

  // Full mode: complete controls
  return (
    <div className="space-y-3 w-full">
      <audio ref={audioRef} preload="metadata" />

      {/* Progress Bar */}
      <div className="space-y-1">
        <Slider
          value={[currentTime]}
          max={duration || 100}
          step={0.1}
          onValueChange={handleSeek}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2">
        {/* Play/Pause Button */}
        <Button
          variant="outline"
          size="default"
          onClick={togglePlay}
          className="shrink-0"
        >
          {isPlaying ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </Button>

        {/* Volume Control */}
        <div className="flex items-center gap-2 flex-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleMute}
            className="shrink-0"
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="h-4 w-4" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
          </Button>
          <Slider
            value={[volume]}
            max={1}
            step={0.01}
            onValueChange={handleVolumeChange}
            className="w-24"
          />
        </div>
      </div>
    </div>
  );
}
