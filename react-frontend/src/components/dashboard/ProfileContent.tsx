import { useAppSelector } from '../../store/hooks';
import { Avatar } from '@/components/ui/avatar';

const ProfileContent = () => {
  const { user } = useAppSelector((state) => state.auth);

  if (!user) {
    return (
      <div className="text-center py-10">No user information available.</div>
    );
  }

  // Generate initials for avatar
  const getInitials = () => {
    const firstInitial = user.first_name?.charAt(0) || '';
    const lastInitial = user.last_name?.charAt(0) || '';
    return (firstInitial + lastInitial).toUpperCase();
  };

  return (
    <div>
      <h2 className="text-3xl font-bold tracking-tight mb-6">Your Profile</h2>

      <div className="max-w-2xl bg-white rounded-lg shadow-md p-6">
        <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
          <div className="flex justify-center">
            <Avatar className="h-24 w-24 bg-indigo-600 text-xl">
              <span>{getInitials()}</span>
            </Avatar>
          </div>

          <div className="flex-1 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  First Name
                </label>
                <div className="p-2 border border-gray-300 rounded-md bg-gray-50">
                  {user.first_name}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Last Name
                </label>
                <div className="p-2 border border-gray-300 rounded-md bg-gray-50">
                  {user.last_name}
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <div className="p-2 border border-gray-300 rounded-md bg-gray-50">
                  {user.email}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Account Status
                </label>
                <div className="p-2 border border-gray-300 rounded-md bg-gray-50 flex items-center">
                  <span
                    className={`inline-block w-3 h-3 rounded-full mr-2 ${
                      user.is_active ? 'bg-green-500' : 'bg-red-500'
                    }`}
                  ></span>
                  {user.is_active ? 'Active' : 'Inactive'}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Account Type
                </label>
                <div className="p-2 border border-gray-300 rounded-md bg-gray-50">
                  {user.is_superuser ? 'Administrator' : 'Regular User'}
                </div>
              </div>
            </div>

            {user.roles && user.roles.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Assigned Roles
                </label>
                <div className="p-2 border border-gray-300 rounded-md bg-gray-50">
                  <div className="flex flex-wrap gap-2">
                    {user.roles.map((role) => (
                      <span
                        key={role.id}
                        className="inline-block px-2 py-1 text-xs bg-indigo-100 text-indigo-800 rounded-md"
                      >
                        {role.name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileContent;
