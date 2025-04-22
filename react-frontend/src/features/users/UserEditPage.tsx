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
    // Navigate to user list after successful operation
    setTimeout(() => {
      navigate("/dashboard/users");
    }, 2000);
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-6">
        {userId ? "Edit User" : "Add New User"}
      </h1>

      <div className="mt-4">
        <UserEditForm userId={userId} onSuccess={handleSuccess} />
      </div>
    </div>
  );
};

export default UserEditPage;
