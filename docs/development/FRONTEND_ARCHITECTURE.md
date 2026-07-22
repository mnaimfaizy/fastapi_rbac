# Frontend Architecture

Canonical React / TypeScript architecture and coding patterns for FastAPI RBAC. Prefer this page over duplicating long frontend manuals in AI harness files.

Related: [System Architecture](../reference/architecture.md), [Project Overview](../getting-started/PROJECT_OVERVIEW.md).

## Key decisions

1. **Token security** — access token in memory (Redux); refresh token in localStorage; Axios interceptors refresh on 401.
2. **State** — Redux Toolkit with feature slices (`auth`, `user`, `role`, …) and async thunks for API calls.
3. **Components** — feature modules under `src/features/`; shared ShadCN UI under `src/components/ui/`; layouts under `src/components/layout/`.
4. **Type safety** — TypeScript models in `src/models/`; typed Redux hooks.

## Core patterns

### Auth hook

```typescript
const { user, isAuthenticated, hasPermission } = useAuth();
```

### Protected routes

```tsx
<ProtectedRoute
  requiredRoles={["admin"]}
  requiredPermissions={["user.read"]}
>
  <UserManagement />
</ProtectedRoute>
```

### Permission checks

```tsx
const { hasPermission } = usePermissions();
{hasPermission("user.create") && <CreateUserButton />}
```

### Service layer

```typescript
export const userService = {
  getAll: () => api.get("/api/v1/users"),
  create: (data) => api.post("/api/v1/users", data),
};
```

### Async thunks

```typescript
export const fetchUsers = createAsyncThunk(
  "users/fetchAll",
  async (_, { rejectWithValue }) => {
    try {
      return await userService.getAll();
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);
```

## Feature layout

```
src/features/
├── auth/
├── users/
├── roles/
├── permissions/
├── role-groups/
├── permission-groups/
└── dashboard/
```

Naming:

- Pages: `LoginPage.tsx`, `UsersList.tsx`
- Layout: `MainLayout.tsx`, `AuthLayout.tsx`
- UI primitives: ShadCN-style lowercase hyphen files under `components/ui/`

## Conventions worth enforcing

- Keep backend Pydantic schemas and frontend TypeScript interfaces aligned.
- Prefer feature-local components; promote to `components/` only when reused.
- Use typed `useAppDispatch` / `useAppSelector`.
- Handle API errors in thunks/services; surface user-facing messages without leaking internals.
- Clean up subscriptions and in-flight requests on unmount.

## Troubleshooting

See [Frontend Issues](../troubleshooting/frontend-issues.md).
