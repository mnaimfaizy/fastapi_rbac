import { useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "../../store";
import { fetchUserById, deleteUser } from "../../store/slices/userSlice";

const UserDetailContent = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const { selectedUser, loading, error } = useSelector(
    (state: RootState) => state.user
  );

  useEffect(() => {
    if (userId) {
      dispatch(fetchUserById(userId));
    }
  }, [dispatch, userId]);

  const handleDelete = async () => {
    if (
      userId &&
      window.confirm("Are you sure you want to delete this user?")
    ) {
      await dispatch(deleteUser(userId));
      navigate("/dashboard/users");
    }
  };

  if (loading) {
    return <div className="p-4">Loading user details...</div>;
  }

  if (error) {
    return (
      <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded">
        Error: {error}
      </div>
    );
  }

  if (!selectedUser) {
    return <div className="p-4">User not found</div>;
  }

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">User Details</h1>
        <div className="flex space-x-2">
          <Link
            to="/dashboard/users"
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            Back to List
          </Link>
          <Link
            to={`/dashboard/users/edit/${userId}`}
            className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
          >
            Edit User
          </Link>
          <button
            onClick={handleDelete}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Delete User
          </button>
        </div>
      </div>

      <div className="bg-white shadow-md rounded-lg p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h2 className="text-lg font-semibold mb-4">Basic Information</h2>
            <table className="w-full">
              <tbody>
                <tr>
                  <td className="py-2 font-medium text-gray-600">Full Name</td>
                  <td className="py-2">
                    {selectedUser.first_name} {selectedUser.last_name}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 font-medium text-gray-600">Email</td>
                  <td className="py-2">{selectedUser.email}</td>
                </tr>
                <tr>
                  <td className="py-2 font-medium text-gray-600">Status</td>
                  <td className="py-2">
                    <span
                      className={`inline-block px-2 py-1 rounded text-sm ${
                        selectedUser.is_active
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {selectedUser.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                </tr>
                <tr>
                  <td className="py-2 font-medium text-gray-600">
                    Administrator
                  </td>
                  <td className="py-2">
                    <span
                      className={`inline-block px-2 py-1 rounded text-sm ${
                        selectedUser.is_superuser
                          ? "bg-purple-100 text-purple-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {selectedUser.is_superuser ? "Yes" : "No"}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-4">Roles & Permissions</h2>
            {selectedUser.roles && selectedUser.roles.length > 0 ? (
              <div>
                <h3 className="font-medium text-gray-600 mb-2">
                  Assigned Roles:
                </h3>
                <div className="flex flex-wrap gap-2 mb-4">
                  {selectedUser.roles.map((role) => (
                    <span
                      key={role.id}
                      className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                    >
                      {role.name}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-gray-500">No roles assigned</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserDetailContent;
