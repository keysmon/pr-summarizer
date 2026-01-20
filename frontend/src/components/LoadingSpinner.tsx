'use client';

import { useEffect, useState } from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
  showProgress?: boolean;
}

export default function LoadingSpinner({ size = 'md', text, showProgress = true }: LoadingSpinnerProps) {
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState(0);

  const stages = [
    'Connecting to GitHub...',
    'Fetching repository data...',
    'Analyzing with AI...',
    'Generating summaries...',
    'Almost done...',
  ];

  useEffect(() => {
    if (!showProgress) return;

    // Simulate progress
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 95) return prev;
        // Slow down as we get higher
        const increment = prev < 30 ? 3 : prev < 60 ? 2 : prev < 80 ? 1 : 0.5;
        return Math.min(prev + increment, 95);
      });
    }, 200);

    // Update stage based on progress
    const stageInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev < 20) setStage(0);
        else if (prev < 40) setStage(1);
        else if (prev < 60) setStage(2);
        else if (prev < 80) setStage(3);
        else setStage(4);
        return prev;
      });
    }, 500);

    return () => {
      clearInterval(progressInterval);
      clearInterval(stageInterval);
    };
  }, [showProgress]);

  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-10 h-10',
  };

  return (
    <div className="flex flex-col items-center justify-center gap-4 w-full max-w-md mx-auto">
      {/* Spinner */}
      <div className="relative">
        <div
          className={`${sizeClasses[size]} border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin`}
        />
      </div>

      {/* Progress bar */}
      {showProgress && (
        <div className="w-full">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>{stages[stage]}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Text */}
      {text && <p className="text-sm font-medium text-gray-700">{text}</p>}

      {/* Animated dots */}
      <div className="flex items-center gap-1">
        <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  );
}
