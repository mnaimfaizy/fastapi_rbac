import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button'; // ShadCN Button component
import { Meta } from '@/components/common/Meta';

const NotFoundPage: React.FC = () => {
  return (
    <>
      <Meta
        title="Page Not Found"
        description="The page you're looking for doesn't exist."
        keywords="404, not found, error, page not found"
      />
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
        <h1 className="text-6xl font-bold text-red-500">404</h1>
        <p className="mt-4 text-lg text-gray-600">
          Oops! The page you&apos;re looking for doesn&apos;t exist.
        </p>
        <Link to="/" className="mt-6">
          <Button variant="default" className="px-6 py-3">
            Go back to Home
          </Button>
        </Link>
      </div>
    </>
  );
};

export default NotFoundPage;
