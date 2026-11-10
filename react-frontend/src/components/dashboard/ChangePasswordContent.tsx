import { ChangePasswordForm } from '@/components/auth/ChangePasswordForm';

const ChangePasswordContent = () => {
  return (
    <div>
      <h2 className="text-3xl font-bold tracking-tight mb-6">
        Change Password
      </h2>

      <div className="max-w-xl bg-white rounded-lg shadow-md p-6">
        <ChangePasswordForm />
      </div>
    </div>
  );
};

export default ChangePasswordContent;
