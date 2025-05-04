import { useParams, useNavigate } from "react-router-dom";
import UserEditForm from "./UserEditForm";

/**
 * User Edit Page component
 * Renders the user edit form with user ID from URL params
 */
const UserEditPage = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();

  // Handle successful submission
  const handleSuccess = () => {
    // Give time for the success message to be visible
    setTimeout(() => {
      navigate("/dashboard/users");
    }, 1500); // 1.5 seconds delay for user to see the success message
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">
          {userId ? "Edit User" : "Add New User"}
        </h1>
      </div>

      <div className="mt-4">
        <UserEditForm userId={userId} onSuccess={handleSuccess} />
      </div>
    </div>
  );
};

export default UserEditPage;
