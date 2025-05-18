import { ColumnDef } from '@tanstack/react-table';
import { User } from '@/models/user';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  MoreHorizontal,
  AlertTriangle,
  Shield,
  Lock,
  CheckCircle,
  User as UserIcon,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Link } from 'react-router-dom';
import { DataTableColumnHeader } from '@/components/dashboard/users/data-table-column-header';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { formatDate } from '@/lib/utils';

export const columns: ColumnDef<User>[] = [
  {
    accessorKey: 'name',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Name" />
    ),
    cell: ({ row }) => {
      const fullName = `${row.original.first_name} ${row.original.last_name}`;
      const email = row.original.email;
      const initials = `${row.original.first_name?.[0] || ''}${
        row.original.last_name?.[0] || ''
      }`;

      return (
        <div className="flex items-center gap-3">
          <Avatar>
            <AvatarFallback>
              {initials || <UserIcon className="h-4 w-4" />}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="font-medium">{fullName}</span>
            <span className="text-sm text-muted-foreground">{email}</span>
          </div>
        </div>
      );
    },
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const user = row.original;
      return (
        <div className="flex flex-wrap gap-1">
          <Badge
            variant={user.is_active ? 'success' : 'destructive'}
            className="whitespace-nowrap"
          >
            {user.is_active ? 'Active' : 'Inactive'}
          </Badge>
          {user.is_locked && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Badge variant="destructive" className="whitespace-nowrap">
                    <Lock className="mr-1 h-3 w-3" />
                    Locked
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  {user.locked_until
                    ? `Locked until ${formatDate(user.locked_until)}`
                    : 'Account is locked'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {user.needs_to_change_password && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Badge variant="warning" className="whitespace-nowrap">
                    <AlertTriangle className="mr-1 h-3 w-3" />
                    Password Change Required
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  User needs to change their password
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {user.verified && (
            <Badge variant="outline" className="whitespace-nowrap">
              <CheckCircle className="mr-1 h-3 w-3" />
              Verified
            </Badge>
          )}
          {user.is_superuser && (
            <Badge variant="purple" className="whitespace-nowrap">
              <Shield className="mr-1 h-3 w-3" />
              Admin
            </Badge>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: 'roles',
    header: 'Roles',
    cell: ({ row }) => {
      const roles = row.original.roles || [];
      return (
        <div className="flex flex-wrap gap-1">
          {roles.map((role) => (
            <Badge key={role.id} variant="secondary">
              {role.name}
            </Badge>
          ))}
        </div>
      );
    },
  },
  {
    accessorKey: 'contact',
    header: 'Contact Info',
    cell: ({ row }) => {
      const user = row.original;
      return (
        <div className="flex flex-col">
          <span>{user.email}</span>
          {user.contact_phone && (
            <span className="text-sm text-muted-foreground">
              {user.contact_phone}
            </span>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: 'security',
    header: 'Security Info',
    cell: ({ row }) => {
      const user = row.original;
      return (
        <div className="space-y-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger className="flex items-center text-sm">
                <span className="text-muted-foreground">Failed attempts:</span>
                <Badge
                  variant={
                    (user.number_of_failed_attempts || 0) > 3
                      ? 'destructive'
                      : 'secondary'
                  }
                  className="ml-1"
                >
                  {user.number_of_failed_attempts || 0}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>Number of failed login attempts</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {user.last_changed_password_date && (
            <div className="text-xs text-muted-foreground">
              Password changed: {formatDate(user.last_changed_password_date)}
            </div>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: 'dates',
    header: 'Important Dates',
    cell: ({ row }) => {
      const user = row.original;
      return (
        <div className="space-y-1 text-sm">
          <div>Created: {formatDate(user.created_at)}</div>
          {user.expiry_date && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger className="flex items-center">
                  <span className="text-muted-foreground">Expires:</span>
                  <Badge
                    variant={
                      new Date(user.expiry_date) < new Date()
                        ? 'destructive'
                        : 'secondary'
                    }
                    className="ml-1"
                  >
                    {formatDate(user.expiry_date)}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>Account expiration date</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: 'updated_at',
    header: 'Updated At',
    cell: ({ row }) => {
      const date = row.getValue('updated_at');
      if (!date) return '-';
      try {
        return formatDate(String(date)); // Ensure date is a string
      } catch (error) {
        return '-';
      }
    },
  },
  {
    id: 'actions',
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
            {user.is_locked && (
              <DropdownMenuItem className="text-green-600">
                Unlock account
              </DropdownMenuItem>
            )}
            {!user.verified && (
              <DropdownMenuItem className="text-blue-600">
                Resend verification
              </DropdownMenuItem>
            )}
            <DropdownMenuItem className="text-destructive">
              Delete user
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
