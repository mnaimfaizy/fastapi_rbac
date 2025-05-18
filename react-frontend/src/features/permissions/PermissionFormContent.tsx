import { useParams } from 'react-router-dom';
import PermissionForm from './PermissionForm';

export default function PermissionFormContent() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">
          {isEdit ? 'Edit Permission' : 'Create New Permission'}
        </h1>
        <p className="text-gray-500 mt-1">
          {isEdit
            ? 'Modify an existing permission'
            : 'Add a new permission to the system'}
        </p>
      </div>
      <div className="mt-6">
        <PermissionForm />
      </div>
    </div>
  );
}
