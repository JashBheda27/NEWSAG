import React, { useRef, useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';

interface AudioPlayerProps {
  text: string;
  language: string;
  className?: string;
}

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ text, language, className = '' }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const { getToken } = useAuth();

  // Cleanup audio URL on unmount
  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  const fetchAudio = async () => {
    if (audioUrl) return audioUrl;

    setIsLoading(true);
    setError(null);

    try {
      // Get auth token for authenticated requests
      const token = await getToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${BASE_URL}/api/tts/generate`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ text, language }),
      });

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('Please sign in to use audio');
        }
        throw new Error('Failed to generate audio');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
      return url;
    } catch (err: any) {
      setError(err.message || 'Audio unavailable');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlay = async () => {
    if (isLoading) return;

    // Fetch audio if not already loaded
    const url = await fetchAudio();
    if (!url) return;

    if (audioRef.current) {
      audioRef.current.src = url;
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handlePause = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleStop = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
      setProgress(0);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setProgress(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setProgress(0);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = value;
      setProgress(value);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (error) {
    return (
      <div className={`flex items-center gap-2 text-xs text-slate-500 italic ${className}`}>
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15l-2.293 2.293a1 1 0 001.414 1.414L7 16.414V19a1 1 0 102 0v-4.586l9.293-9.293a1 1 0 00-1.414-1.414L7.586 13H3a1 1 0 100 2h2.586z" />
        </svg>
        <span>{error}</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-3 py-2 ${className}`}>
      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
      />

      {/* Play/Pause Button */}
      <button
        onClick={isPlaying ? handlePause : handlePlay}
        disabled={isLoading}
        className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors disabled:opacity-50"
        title={isPlaying ? 'Pause' : 'Listen to summary'}
        style={{ color: '#333' }}
      >
        {isLoading ? (
          <div className="w-5 h-5 border-2 border-slate-600 border-t-transparent rounded-full animate-spin" />
        ) : isPlaying ? (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 4h4v16H6zm8 0h4v16h-4z" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      {/* Progress Bar */}
      <div className="flex-1 flex items-center gap-2">
        <input
          type="range"
          min={0}
          max={duration || 100}
          value={progress}
          onChange={handleSeek}
          disabled={!audioUrl}
          className="flex-1 h-1 bg-slate-300 dark:bg-slate-600 rounded-lg appearance-none cursor-pointer accent-indigo-600 disabled:opacity-50"
          style={{ accentColor: '#4f46e5' }}
        />
        <span className="text-[10px] font-mono text-slate-500 min-w-[70px] text-right">
          {formatTime(progress)} / {formatTime(duration || 0)}
        </span>
      </div>

      {/* Stop Button */}
      <button
        onClick={handleStop}
        disabled={!audioUrl || (!isPlaying && progress === 0)}
        className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors disabled:opacity-30"
        title="Stop"
        style={{ color: '#333' }}
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <rect x="6" y="6" width="12" height="12" />
        </svg>
      </button>

      {/* Speaker icon */}
      <div className="text-slate-400" title="Text-to-Speech">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
        </svg>
      </div>
    </div>
  );
};
