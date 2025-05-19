import PermissionForm from './PermissionForm';

export default function PermissionFormContent() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Create New Permission</h1>
        <p className="text-gray-500 mt-1">Add a new permission to the system</p>
      </div>
      <div className="mt-6">
        <PermissionForm />
      </div>
    </div>
  );
}
