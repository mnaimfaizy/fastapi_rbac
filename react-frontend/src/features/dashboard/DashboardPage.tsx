import { Outlet } from "react-router-dom";

const DashboardPage = () => {
  return (
    <div className="flex-1 space-y-6">
      {/* Render the nested route components via Outlet */}
      <Outlet />
    </div>
  );
};

export default DashboardPage;
