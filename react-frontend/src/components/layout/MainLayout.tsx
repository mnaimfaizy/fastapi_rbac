import { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { logout } from "../../store/slices/authSlice";

interface MainLayoutProps {
  children: ReactNode;
}

const MainLayout = ({ children }: MainLayoutProps) => {
  const { user } = useAppSelector((state) => state.auth);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const handleLogout = () => {
    dispatch(logout());
    navigate("/login");
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="bg-slate-800 text-white shadow-md">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <Link to="/dashboard" className="text-xl font-bold">
            Auth System
          </Link>
          <div className="flex gap-4 items-center">
            {user && (
              <span className="text-sm">
                Welcome, {user.first_name} {user.last_name}
              </span>
            )}
            <button
              onClick={handleLogout}
              className="px-3 py-1 rounded bg-red-600 hover:bg-red-700 text-white text-sm"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="flex-grow container mx-auto px-4 py-6">{children}</main>

      <footer className="bg-slate-800 text-white py-4 mt-8">
        <div className="container mx-auto px-4 text-center text-sm">
          &copy; {new Date().getFullYear()} Authentication System
        </div>
      </footer>
    </div>
  );
};

export default MainLayout;
