# React state management

Redux Toolkit is the global state layer for the React SPA.

Related: [Architecture](./architecture.md), [Authentication](./auth.md).

## Store layout

```
src/store/
├── index.ts              # store + middleware
├── hooks.ts              # useAppDispatch, useAppSelector
└── slices/
    ├── authSlice.ts
    ├── userSlice.ts
    ├── roleSlice.ts
    ├── roleGroupSlice.ts
    ├── permissionSlice.ts
    ├── permissionGroupSlice.ts
    └── dashboardSlice.ts
```

Wrap the app with the Redux `Provider` in `main.tsx` / `App` bootstrap. Access tokens live in the auth slice (memory only) — a full page reload clears them; refresh tokens remain in `localStorage` until logout.

## Patterns

### Typed hooks

```typescript
import { useAppDispatch, useAppSelector } from "../store/hooks";
```

Avoid untyped `useDispatch` / `useSelector` in feature code.

### Feature slices

Each domain area owns a slice with:

- synchronous reducers for UI/local state
- `createAsyncThunk` for API calls via `src/services/*`

Example thunk shape:

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

### Loading and errors

Surface `loading` / `error` fields from the slice in the UI. Prefer user-safe messages; log details for developers only.

## What not to put in Redux

- Large ephemeral form drafts better kept in local component state
- Derived values that can be computed with selectors or memoization
- Secrets other than the short-lived access token already held in memory

## Debugging

Use Redux DevTools to inspect slices after login/logout and CRUD actions. If auth appears “lost” after refresh, confirm that is expected for the in-memory access token and that refresh/login restores it.
