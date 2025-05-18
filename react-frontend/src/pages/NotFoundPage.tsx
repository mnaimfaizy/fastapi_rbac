import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button'; // ShadCN Button component

const NotFoundPage: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <h1 className="text-6xl font-bold text-red-500">404</h1>
      <p className="mt-4 text-lg text-gray-600">
        Oops! The page you're looking for doesn't exist.
      </p>
      <Link to="/" className="mt-6">
        <Button variant="default" className="px-6 py-3">
          Go back to Home
        </Button>
      </Link>
    </div>
  );
};

export default NotFoundPage;
