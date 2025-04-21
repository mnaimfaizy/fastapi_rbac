import PermissionsDataTable from "./PermissionsDataTable";

export default function PermissionsContent() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Permissions</h1>
        <p className="text-gray-500 mt-1">Manage system permissions</p>
      </div>
      <PermissionsDataTable />
    </div>
  );
}
