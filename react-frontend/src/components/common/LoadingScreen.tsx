import React, { useEffect, useState } from 'react';
import { Meta } from './Meta';
import { cn } from '@/lib/utils';

interface LoadingScreenProps {
  message?: string;
  isVisible?: boolean;
  hideAfterMs?: number;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  message = 'Loading application...',
  isVisible = true,
  hideAfterMs,
}) => {
  const [show, setShow] = useState(isVisible);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    if (hideAfterMs && isVisible) {
      const fadeTimer = setTimeout(() => {
        setFadeOut(true);
      }, hideAfterMs - 300); // Start fade 300ms before hiding

      const hideTimer = setTimeout(() => {
        setShow(false);
      }, hideAfterMs);

      return () => {
        clearTimeout(fadeTimer);
        clearTimeout(hideTimer);
      };
    }

    setShow(isVisible);
  }, [hideAfterMs, isVisible]);

  if (!show) return null;

  return (
    <>
      <Meta title="Loading" description="Application is loading" />
      <div
        className={cn(
          'fixed inset-0 z-50 flex flex-col items-center justify-center bg-background transition-opacity duration-300',
          fadeOut && 'opacity-0'
        )}
      >
        <div className="relative">
          {/* Logo/Branding */}
          <div className="mb-8 flex items-center justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="11" width="5" height="9" rx="1" />
                <rect x="17" y="11" width="5" height="9" rx="1" />
                <rect x="9" y="13" width="6" height="6" rx="1" />
                <circle cx="12" cy="6" r="3" />
              </svg>
            </div>
          </div>

          {/* Loading spinner */}
          <div className="flex flex-col items-center">
            <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
            <p className="text-sm text-muted-foreground">{message}</p>
          </div>

          {/* App version */}
          <div className="absolute bottom-0 left-0 right-0 mt-12 text-center">
            <p className="text-xs text-muted-foreground">
              v{import.meta.env.VITE_APP_VERSION || '1.0.0'}
            </p>
          </div>
        </div>
      </div>
    </>
  );
};
