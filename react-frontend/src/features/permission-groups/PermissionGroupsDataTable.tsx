import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../../hooks/redux";
import {
  fetchPermissionGroups,
  deletePermissionGroup,
  setPage,
  setPageSize,
} from "../../store/slices/permissionGroupSlice";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoreHorizontal, ChevronDown, Plus } from "lucide-react";
import { PermissionGroup } from "../../models/permission";
import { RootState } from "../../store";

interface SortState {
  column: string | null;
  direction: "asc" | "desc";
}

export default function PermissionGroupsDataTable() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { permissionGroups, isLoading, totalItems, page, pageSize } =
    useAppSelector((state: RootState) => state.permissionGroup);

  const [searchTerm, setSearchTerm] = useState("");
  const [sort, setSort] = useState<SortState>({
    column: null,
    direction: "asc",
  });

  useEffect(() => {
    dispatch(fetchPermissionGroups({ page, pageSize }));
  }, [dispatch, page, pageSize]);

  const handleSort = (column: string) => {
    setSort((prev) => ({
      column,
      direction:
        prev.column === column && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const handlePageChange = (newPage: number) => {
    dispatch(setPage(newPage));
  };

  const handlePageSizeChange = (newSize: number) => {
    dispatch(setPageSize(newSize));
    dispatch(setPage(1)); // Reset to first page when changing page size
  };

  const handleEdit = (id: string) => {
    navigate(`/dashboard/permission-groups/edit/${id}`);
  };

  const handleView = (id: string) => {
    navigate(`/dashboard/permission-groups/${id}`);
  };

  const handleDelete = async (id: string) => {
    if (
      window.confirm("Are you sure you want to delete this permission group?")
    ) {
      await dispatch(deletePermissionGroup(id));
      dispatch(fetchPermissionGroups({ page, pageSize }));
    }
  };

  const handleAddNew = () => {
    navigate("/dashboard/permission-groups/new");
  };

  // Filter permission groups based on search term
  const filteredGroups = permissionGroups.filter((group: PermissionGroup) =>
    group.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Sort permission groups
  const sortedGroups = [...filteredGroups].sort((a, b) => {
    if (!sort.column) return 0;

    const aValue = a[sort.column as keyof PermissionGroup];
    const bValue = b[sort.column as keyof PermissionGroup];

    if (typeof aValue === "string" && typeof bValue === "string") {
      return sort.direction === "asc"
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    }

    // For non-string values or if values are undefined
    if (aValue === bValue) return 0;
    if (aValue === undefined) return 1;
    if (bValue === undefined) return -1;

    return sort.direction === "asc"
      ? aValue < bValue
        ? -1
        : 1
      : aValue > bValue
      ? -1
      : 1;
  });

  // Calculate pagination values
  const totalPages = Math.ceil(totalItems / pageSize);
  const startItem = (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, totalItems);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Input
            placeholder="Search permission groups..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
          />
        </div>
        <Button onClick={handleAddNew} className="flex items-center gap-1">
          <Plus className="h-4 w-4" /> Add Permission Group
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[300px]">
                <Button
                  variant="ghost"
                  onClick={() => handleSort("name")}
                  className="flex items-center gap-1 p-0 hover:bg-transparent"
                >
                  Name
                  {sort.column === "name" && (
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${
                        sort.direction === "desc" ? "rotate-180" : ""
                      }`}
                    />
                  )}
                </Button>
              </TableHead>
              <TableHead>Parent Group</TableHead>
              <TableHead>Permissions Count</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center">
                  Loading permission groups...
                </TableCell>
              </TableRow>
            ) : sortedGroups.length > 0 ? (
              sortedGroups.map((group) => (
                <TableRow key={group.id}>
                  <TableCell className="font-medium">{group.name}</TableCell>
                  <TableCell>{group.permission_group_id || "None"}</TableCell>
                  <TableCell>{group.permissions?.length || 0}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleEdit(group.id)}>
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleView(group.id)}>
                          View details
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDelete(group.id)}
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center">
                  No permission groups found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500">
          Showing {totalItems > 0 ? startItem : 0} to {endItem} of {totalItems}{" "}
          permission groups
        </div>
        <div className="flex items-center gap-2">
          <select
            value={pageSize}
            onChange={(e) => handlePageSizeChange(parseInt(e.target.value))}
            className="border p-1 rounded text-sm"
          >
            <option value={5}>5 per page</option>
            <option value={10}>10 per page</option>
            <option value={20}>20 per page</option>
            <option value={50}>50 per page</option>
          </select>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(page - 1)}
              disabled={page === 1}
            >
              Previous
            </Button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(
                (p) => Math.abs(p - page) < 3 || p === 1 || p === totalPages
              )
              .map((p) => (
                <Button
                  key={p}
                  variant={p === page ? "default" : "outline"}
                  size="sm"
                  onClick={() => handlePageChange(p)}
                >
                  {p}
                </Button>
              ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(page + 1)}
              disabled={page === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
