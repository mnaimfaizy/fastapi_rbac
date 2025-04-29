import { useParams } from "react-router-dom";
import PermissionGroupForm from "./PermissionGroupForm";

export default function PermissionGroupFormContent() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">
          {isEdit ? "Edit Permission Group" : "Create New Permission Group"}
        </h1>
        <p className="text-gray-500 mt-1">
          {isEdit
            ? "Modify an existing permission group"
            : "Create a new permission group for organizing permissions"}
        </p>
      </div>
      <div className="mt-6">
        <PermissionGroupForm id={id} isEdit={isEdit} />
      </div>
    </div>
  );
}
