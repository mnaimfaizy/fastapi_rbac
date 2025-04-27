import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "../../store";
import {
  fetchRoleGroups,
  deleteRoleGroup,
} from "../../store/slices/roleGroupSlice";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useNavigate } from "react-router-dom";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Edit, Trash2 } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { PaginationParams } from "@/models/pagination";
import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

const RoleGroupList: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { roleGroups, pagination, loading, error } = useSelector(
    (state: RootState) => state.roleGroup
  );
  const [search, setSearch] = useState("");

  useEffect(() => {
    // Load role groups when component mounts
    dispatch(fetchRoleGroups());
  }, [dispatch]);

  const handlePageChange = (page: number) => {
    dispatch(fetchRoleGroups({ page, size: pagination.size }));
  };

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    // You can implement search functionality here if the backend supports it
    // For now, just do a client-side filter
    dispatch(fetchRoleGroups());
  };

  const handleDeleteRoleGroup = async (groupId: string) => {
    await dispatch(deleteRoleGroup(groupId));
    dispatch(fetchRoleGroups({ page: pagination.page, size: pagination.size }));
  };

  const handleEditRoleGroup = (groupId: string) => {
    navigate(`/dashboard/role-groups/edit/${groupId}`);
  };

  const handleViewRoleGroup = (groupId: string) => {
    navigate(`/dashboard/role-groups/${groupId}`);
  };

  if (loading && !roleGroups.length) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive text-destructive rounded">
          {error}
        </div>
      )}

      <div className="flex justify-between items-center">
        <form onSubmit={handleSearch} className="w-full max-w-sm">
          <div className="relative">
            <Input
              type="text"
              placeholder="Search role groups..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pr-10"
            />
            <Button
              type="submit"
              size="sm"
              variant="ghost"
              className="absolute right-0 top-0 h-full px-3"
            >
              Search
            </Button>
          </div>
        </form>
      </div>

      <div className="border rounded-md overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40%]">Name</TableHead>
              <TableHead>Created At</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {roleGroups.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={3}
                  className="text-center py-8 text-gray-500"
                >
                  No role groups found
                </TableCell>
              </TableRow>
            ) : (
              roleGroups.map((group) => (
                <TableRow key={group.id}>
                  <TableCell className="font-medium">
                    <button
                      onClick={() => handleViewRoleGroup(group.id)}
                      className="text-left hover:underline focus:outline-none focus:text-primary"
                    >
                      {group.name}
                    </button>
                  </TableCell>
                  <TableCell>
                    {group.created_at ? formatDate(group.created_at) : "N/A"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditRoleGroup(group.id)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              Delete role group
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete this role group?
                              This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              onClick={() => handleDeleteRoleGroup(group.id)}
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {!loading && pagination.pages > 1 && (
        <Pagination>
          <PaginationContent>
            {pagination.page > 1 && (
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => handlePageChange(pagination.page - 1)}
                />
              </PaginationItem>
            )}

            {[...Array(pagination.pages)].map((_, i) => {
              const pageNumber = i + 1;
              // Show first page, last page, current page, and one page before and after current page
              if (
                pageNumber === 1 ||
                pageNumber === pagination.pages ||
                pageNumber === pagination.page ||
                pageNumber === pagination.page - 1 ||
                pageNumber === pagination.page + 1
              ) {
                return (
                  <PaginationItem key={pageNumber}>
                    <PaginationLink
                      isActive={pageNumber === pagination.page}
                      onClick={() => handlePageChange(pageNumber)}
                    >
                      {pageNumber}
                    </PaginationLink>
                  </PaginationItem>
                );
              } else if (
                (pageNumber === pagination.page - 2 && pagination.page > 3) ||
                (pageNumber === pagination.page + 2 &&
                  pagination.page < pagination.pages - 2)
              ) {
                return (
                  <PaginationItem key={pageNumber}>
                    <PaginationEllipsis />
                  </PaginationItem>
                );
              }
              return null;
            })}

            {pagination.page < pagination.pages && (
              <PaginationItem>
                <PaginationNext
                  onClick={() => handlePageChange(pagination.page + 1)}
                />
              </PaginationItem>
            )}
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
};

export default RoleGroupList;
