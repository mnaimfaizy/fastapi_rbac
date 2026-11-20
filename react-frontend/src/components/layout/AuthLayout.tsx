import { Outlet } from 'react-router-dom';

import { Meta } from '../common/Meta';
import { BrandMark } from '@/features/auth/components/BrandMark';

const AuthLayout = () => {
  return (
    <>
      <Meta
        title="Authentication"
        description="Sign in to access the FastAPI RBAC system"
        keywords="login, signup, authentication, RBAC, access control"
      />
      <div className="bg-background text-foreground flex min-h-svh">
        <div className="flex min-h-svh flex-1 flex-col overflow-y-auto px-6 py-12 sm:px-14">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <BrandMark className="text-primary size-[30px]" />
            <span className="text-[17px] font-semibold tracking-tight">
              FastAPI RBAC
            </span>
          </div>
          <div className="flex flex-1 items-center justify-center">
            <div className="w-full max-w-[400px]">
              <Outlet />
            </div>
          </div>
        </div>
        <aside className="bg-auth-panel text-auth-panel-foreground hidden lg:flex lg:w-1/2 lg:flex-col lg:justify-center lg:px-16">
          <div className="flex items-center gap-2.5">
            <BrandMark />
            <span className="text-lg font-semibold tracking-tight">
              FastAPI RBAC
            </span>
          </div>
          <p className="mt-6 max-w-[440px] text-[32px] leading-tight font-semibold tracking-tight">
            Access control you can reason about.
          </p>
        </aside>
      </div>
    </>
  );
};

export default AuthLayout;
