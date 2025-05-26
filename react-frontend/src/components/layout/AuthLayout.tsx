import React from 'react';
import { Outlet } from 'react-router-dom';
import { Meta } from '../common/Meta';
import authBackgroundImage from '../../assets/images/login_signup_bg_image.png';

const AuthLayout: React.FC = () => {
  return (
    <>
      <Meta
        title="Authentication"
        description="Sign in to access the FastAPI RBAC system"
        keywords="login, signup, authentication, RBAC, access control"
      />
      <div className="grid lg:grid-cols-2 max-h-screen">
        {/* Left Column: Content */}
        <div className="flex flex-col items-center justify-center p-6 md:p-10">
          <Outlet /> {/* LoginPage or SignupPage content will render here */}
        </div>

        {/* Right Column: Image (Hidden on small screens) */}
        <div className="relative hidden bg-muted lg:block max-h-screen">
          <img
            src={authBackgroundImage}
            alt="Authentication background"
            className="inset-0 h-full w-full object-fill dark:brightness-[0.2] dark:grayscale"
          />
        </div>
      </div>
    </>
  );
};

export default AuthLayout;
