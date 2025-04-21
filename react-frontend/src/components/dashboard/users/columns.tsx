"use client";

import { ColumnDef } from "@tanstack/react-table";
import { User } from "../../../models/user";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "react-router-dom";
import { DataTableColumnHeader } from "./data-table-column-header";

// Define a function to create columns with the delete handler
export const createColumns = (
  onDelete?: (userId: string) => void
): ColumnDef<User>[] => [
  {
    accessorKey: "name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Name" />
    ),
    cell: ({ row }) => {
      const firstName = row.original.first_name;
      const lastName = row.original.last_name;
      const fullName = `${firstName} ${lastName}`;

      return <div>{fullName}</div>;
    },
  },
  {
    accessorKey: "email",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Email" />
    ),
  },
  {
    accessorKey: "is_active",
    header: "Status",
    cell: ({ row }) => {
      const isActive = row.original.is_active;

      return (
        <Badge
          className={
            isActive
              ? "bg-green-100 text-green-800 hover:bg-green-200"
              : "bg-red-100 text-red-800 hover:bg-red-200"
          }
          variant="outline"
        >
          {isActive ? "Active" : "Inactive"}
        </Badge>
      );
    },
  },
  {
    accessorKey: "is_superuser",
    header: "Admin",
    cell: ({ row }) => {
      const isSuperuser = row.original.is_superuser;

      return (
        <Badge
          className={
            isSuperuser
              ? "bg-purple-100 text-purple-800 hover:bg-purple-200"
              : "bg-gray-100 text-gray-800 hover:bg-gray-200"
          }
          variant="outline"
        >
          {isSuperuser ? "Yes" : "No"}
        </Badge>
      );
    },
  },
  {
    accessorKey: "verified",
    header: "Verified",
    cell: ({ row }) => {
      const isVerified = row.original.verified;

      return (
        <Badge
          className={
            isVerified
              ? "bg-blue-100 text-blue-800 hover:bg-blue-200"
              : "bg-yellow-100 text-yellow-800 hover:bg-yellow-200"
          }
          variant="outline"
        >
          {isVerified ? "Verified" : "Unverified"}
        </Badge>
      );
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const user = row.original;

      return (
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
            <DropdownMenuItem asChild>
              <Link to={`/dashboard/users/${user.id}`}>View details</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to={`/dashboard/users/edit/${user.id}`}>Edit user</Link>
            </DropdownMenuItem>
            {onDelete && (
              <DropdownMenuItem
                onClick={() => onDelete(user.id)}
                className="text-red-600 focus:text-red-600"
              >
                Delete user
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];

// For backward compatibility and simpler usage
export const columns = createColumns();
