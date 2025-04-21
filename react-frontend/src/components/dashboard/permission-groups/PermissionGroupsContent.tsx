import PermissionGroupsDataTable from "./PermissionGroupsDataTable";

export default function PermissionGroupsContent() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Permission Groups</h1>
        <p className="text-gray-500 mt-1">
          Manage permission groups to organize system permissions
        </p>
      </div>
      <PermissionGroupsDataTable />
    </div>
  );
}
