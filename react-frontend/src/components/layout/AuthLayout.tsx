import React from "react";
import { Outlet } from "react-router-dom";

const AuthLayout: React.FC = () => {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      {/* Left Column: Content */}
      <div className="flex flex-col items-center justify-center p-6 md:p-10">
        <Outlet /> {/* LoginPage or SignupPage content will render here */}
      </div>

      {/* Right Column: Image (Hidden on small screens) */}
      <div className="relative hidden bg-muted lg:block">
        {/* TODO: Replace with an actual image relevant to your app */}
        <img
          src="/placeholder.svg" // Using placeholder for now
          alt="Authentication background"
          className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
        />
      </div>
    </div>
  );
};

export default AuthLayout;
