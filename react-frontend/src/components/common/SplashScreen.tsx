import { useEffect, useState } from 'react';
import { Meta } from './Meta';

interface SplashScreenProps {
  minimumDisplayTime?: number;
}

export const SplashScreen = ({
  minimumDisplayTime = 1000,
}: SplashScreenProps) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
    }, minimumDisplayTime);

    return () => clearTimeout(timer);
  }, [minimumDisplayTime]);

  if (!isVisible) return null;

  return (
    <>
      <Meta title="Loading" description="FastAPI RBAC Application is loading" />
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background">
        <div className="text-4xl font-bold mb-4 flex items-center">
          <div className="size-10 mr-2 rounded-md bg-primary flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-6 text-white"
            >
              <rect x="3" y="11" width="4" height="8" rx="1" />
              <rect x="17" y="11" width="4" height="8" rx="1" />
              <rect x="9" y="13" width="6" height="6" rx="1" />
              <circle cx="12" cy="7" r="3" />
            </svg>
          </div>
          <span>FastAPI RBAC</span>
        </div>
        <div className="flex gap-2">
          <div className="h-2 w-2 rounded-full bg-primary animate-pulse"></div>
          <div className="h-2 w-2 rounded-full bg-primary animate-pulse delay-100"></div>
          <div className="h-2 w-2 rounded-full bg-primary animate-pulse delay-200"></div>
        </div>
      </div>
    </>
  );
};
