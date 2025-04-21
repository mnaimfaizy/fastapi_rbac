import { useState, useEffect, useCallback, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "../../store";
import { fetchUsers, deleteUser } from "../../store/slices/userSlice";
import { Link } from "react-router-dom";
import { DataTable } from "./users/data-table";
import { createColumns } from "./users/columns";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const UserListContent = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { users, loading, pagination, error } = useSelector(
    (state: RootState) => state.user
  );
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(10);

  // Load users on component mount and when page or search changes
  useEffect(() => {
    dispatch(
      fetchUsers({ page: pagination?.page || 1, limit: pageSize, search })
    );
  }, [dispatch, pagination?.page, pageSize, search]);

  // Handle search input
  const handleSearch = useCallback(
    (value: string) => {
      setSearch(value);
      dispatch(fetchUsers({ page: 1, limit: pageSize, search: value }));
    },
    [dispatch, pageSize]
  );

  // Handle page change
  const handlePageChange = useCallback(
    (page: number) => {
      dispatch(fetchUsers({ page, limit: pageSize, search }));
    },
    [dispatch, pageSize, search]
  );

  // Handle rows per page change
  const handlePageSizeChange = useCallback(
    (size: number) => {
      setPageSize(size);
      dispatch(fetchUsers({ page: 1, limit: size, search }));
    },
    [dispatch, search]
  );

  // Handle delete user action
  const handleDeleteUser = useCallback(
    (userId: string) => {
      if (window.confirm("Are you sure you want to delete this user?")) {
        dispatch(deleteUser(userId)).then(() => {
          dispatch(
            fetchUsers({ page: pagination?.page || 1, limit: pageSize, search })
          );
        });
      }
    },
    [dispatch, pagination?.page, pageSize, search]
  );

  // Create columns with delete handler
  const columns = useMemo(
    () => createColumns(handleDeleteUser),
    [handleDeleteUser]
  );

  return (
    <div className="p-4 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">User Management</h1>
        <Link to="/dashboard/users/create">
          <Button className="flex items-center gap-2">
            <PlusCircle className="h-4 w-4" /> Add New User
          </Button>
        </Link>
      </div>

      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive text-destructive rounded">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
        </CardHeader>
        <CardContent>
          {loading && !users?.length ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={users || []}
              onSearch={handleSearch}
              searchPlaceholder="Search users..."
              onRowsPerPageChange={handlePageSizeChange}
              pagination={
                pagination && {
                  pageIndex: pagination.page,
                  pageSize: pagination.size,
                  pageCount: pagination.pages,
                  onPageChange: handlePageChange,
                }
              }
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default UserListContent;
