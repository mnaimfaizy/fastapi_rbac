import React, { useEffect, useState } from 'react';
import { Meta } from './Meta';
import { Toaster } from '@/components/ui/sonner';
import { useSelector } from 'react-redux';
import { RootState } from '@/store';
import { useLocation } from 'react-router-dom';

interface AppWrapperProps {
  children: React.ReactNode;
}

export const AppWrapper: React.FC<AppWrapperProps> = ({ children }) => {
  const [, setIsLoading] = useState(true);
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);
  const location = useLocation();

  // Global app metadata
  const appName = import.meta.env.VITE_APP_NAME || 'FastAPI RBAC';
  const appVersion = import.meta.env.VITE_APP_VERSION || '1.0.0';

  // Handle initial loading
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 800); // Show splash screen for at least 800ms

    return () => clearTimeout(timer);
  }, []);

  // Update document metadata when authentication state or route changes
  useEffect(() => {
    const metaTags = document.getElementsByTagName('meta');
    const appStateTag = Array.from(metaTags).find(
      (tag) => tag.name === 'application-state'
    );

    if (!appStateTag) {
      const newTag = document.createElement('meta');
      newTag.name = 'application-state';
      newTag.content = isAuthenticated ? 'authenticated' : 'guest';
      document.head.appendChild(newTag);
    } else {
      appStateTag.content = isAuthenticated ? 'authenticated' : 'guest';
    }

    // Log route changes for analytics (could be replaced with actual analytics)
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Route Change] ${location.pathname}${location.search}`);
    }
  }, [isAuthenticated, location]);

  return (
    <>
      {/* Global metadata */}
      <Meta
        title={`${appName} v${appVersion}`}
        description="A comprehensive role-based access control system built with FastAPI and React"
        author="RBAC Team"
        keywords="RBAC, role-based access control, authentication, authorization, FastAPI, React"
      />

      {/* Toast notifications */}
      <Toaster position="top-right" closeButton richColors />

      {/* Application content */}
      {children}

      {/* Accessibility helper (hidden from view) */}
      <div className="sr-only" aria-live="polite" id="a11y-announcer"></div>
    </>
  );
};
