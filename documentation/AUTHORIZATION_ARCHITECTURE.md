# Authorization Architecture - Hybrid Approach

## Overview

This document outlines the hybrid authorization architecture for the task management system. The approach separates routes into two tiers by access level to provide better security, simpler authorization logic, and clearer API boundaries.

## Design Principles

1. **Separation of Concerns**: User routes are ownership-scoped; admin routes have system-wide access with role-appropriate restrictions
2. **Fail-Safe Defaults**: User routes always enforce ownership; no conditional logic that can be bypassed
3. **Clear Role Boundaries**: Each route group has explicit permission requirements enforced at the autohook level
4. **Defense in Depth**: Multiple layers of security (authentication → role verification → operation-specific checks)
5. **Principle of Least Privilege**: Users get minimal necessary permissions; escalation only when needed
6. **Unified Admin Routes**: Single admin route group serves both moderators and admins with operation-level permission checks

## Route Architecture

```
/api/tasks/*        - User routes (ownership-scoped, own tasks only)
/api/admin/tasks/*  - Admin routes (system-wide access, serves both moderators and admins)
```

### Why Two Tiers Instead of Three?

Instead of separate `/api/moderator/tasks/*` routes, admin routes serve both moderators and admins:
- **Autohook**: Requires minimum of `task:assign` permission (moderators and admins)
- **Read Operations** (GET, export): Accessible to both moderators and admins
- **Assignment Operation** (POST assign): Accessible to both moderators and admins
- **Write Operations** (PATCH, DELETE, import): Additional `task:manage` check restricts to admins only

This reduces API duplication while maintaining clear permission boundaries.

---

## User Routes (`/api/tasks/*`)

**Access Level**: Authenticated users with `task:read`, `task:create`, `task:update`, `task:delete` permissions

**Scope**: Always filtered to tasks where user is author OR assignee

**Autohook Protection**:
- Authentication required
- Basic permission check (task:create, task:read, etc.)
- Ownership filtering enforced at route level (not conditional)

### Route Definitions

#### `POST /api/tasks` - Create Task
**Permission**: `task:create`
**Behavior**:
- User can only create tasks for themselves
- `author_id` always set to `session.userId`
- `assigned_user_id` can only be set to `session.userId` or `null`
- Attempting to assign to another user returns 403

**Request Body**:
```typescript
{
  title: string;
  description: string;
  assigned_user_id?: string | null;  // Must be self or null
  status?: TaskStatus;
}
```

**Response**: `201 Created`
```typescript
{ id: number }
```

**Error Cases**:
- `401`: Not authenticated
- `403`: Missing task:create permission
- `403`: Attempting to assign to another user
- `400`: Invalid data (title/description missing)

---

#### `GET /api/tasks` - List My Tasks
**Permission**: `task:read`
**Behavior**:
- Returns only tasks where user is author OR assignee
- Ownership filter ALWAYS applied (forced, not conditional)
- Query parameters for pagination, filtering, ordering

**Query Parameters**:
```typescript
{
  page?: number;           // Default: 1
  limit?: number;          // Default: 10, Max: 100
  order?: 'asc' | 'desc';  // Default: 'desc'
  status?: TaskStatus;     // Optional filter
  search?: string;         // Optional: search in title/description
}
```

**Note**: `author_id` and `assigned_user_id` are NOT accepted as query params (always forced to session.userId)

**Response**: `200 OK`
```typescript
{
  data: Task[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  }
}
```

**Error Cases**:
- `401`: Not authenticated
- `403`: Missing task:read permission

---

#### `GET /api/tasks/:id` - Get My Task
**Permission**: `task:read`
**Behavior**:
- Returns task only if user is author OR assignee
- Returns 404 if task doesn't exist OR user doesn't have access (information hiding)

**Response**: `200 OK`
```typescript
{
  id: number;
  title: string;
  description: string;
  author_id: string;
  assigned_user_id: string | null;
  status: TaskStatus;
  created_at: string;
  updated_at: string;
}
```

**Error Cases**:
- `401`: Not authenticated
- `403`: Missing task:read permission
- `404`: Task not found OR user doesn't own it (indistinguishable for security)

---

#### `PATCH /api/tasks/:id` - Update My Task
**Permission**: `task:update`
**Behavior**:
- User can only update tasks where they are author OR assignee
- `author_id` cannot be changed (not in schema)
- `assigned_user_id` can only be changed to self or null
- Changing `assigned_user_id` to another user returns 403

**Request Body** (all optional):
```typescript
{
  title?: string;
  description?: string;
  assigned_user_id?: string | null;  // Must be self or null
  status?: TaskStatus;
}
```

**Response**: `200 OK`
```typescript
{
  // Full updated task object
}
```

**Error Cases**:
- `401`: Not authenticated
- `403`: Missing task:update permission
- `403`: User doesn't own task
- `403`: Attempting to assign to another user
- `404`: Task not found

---

#### `DELETE /api/tasks/:id` - Delete My Task
**Permission**: `task:delete`
**Behavior**:
- User can only delete tasks where they are author OR assignee
- Soft delete or hard delete based on repository implementation

**Response**: `204 No Content`

**Error Cases**:
- `401`: Not authenticated
- `403`: Missing task:delete permission
- `403`: User doesn't own task
- `404`: Task not found

---

#### `GET /api/tasks/files/export` - Export My Tasks (CSV)
**Permission**: `task:export`
**Behavior**:
- Exports only tasks where user is author OR assignee
- Returns CSV file with user's tasks
- Ownership filter ALWAYS applied

**Query Parameters**: Same as `GET /api/tasks` (pagination, filtering)

**Response**: `200 OK`
```
Content-Type: text/csv
Content-Disposition: attachment; filename="tasks-export-{timestamp}.csv"

id,title,description,status,author_id,assigned_user_id,created_at,updated_at
1,"Task 1","Description",new,user123,user123,2025-01-01,2025-01-01
```

**Error Cases**:
- `401`: Not authenticated
- `403`: Missing task:export permission

---

#### `POST /api/tasks/files/import` - Import My Tasks (CSV)
**Permission**: `task:import`
**Behavior**:
- Imports tasks from CSV file
- `author_id` and `assigned_user_id` ALWAYS forced to `session.userId`
- Any values in CSV for author_id/assigned_user_id are ignored
- Creates new tasks only (no updates)

**Request**: `multipart/form-data`
```typescript
{
  file: File;  // CSV file
}
```

**Response**: `201 Created`
```typescript
{
  imported: number;
  failed: number;
  errors: Array<{ row: number; message: string }>;
}
```

**Error Cases**:
- `401`: Not authenticated
- `403`: Missing task:import permission
- `400`: Invalid CSV format
- `413`: File too large

---

## Admin Routes (`/api/admin/tasks/*`)

**Access Level**: Users with `task:assign` or `task:manage` permission (moderators and admins)

**Scope**: System-wide access to ALL tasks, no ownership restrictions

**Autohook Protection**:
- Authentication required
- Role verification: `canAssignTasks()` must return true (minimum moderator access)
- No ownership filtering
- Individual routes add additional `canManageTasks()` checks for write operations

**Permission Layers**:
1. **Autohook**: Blocks regular users (requires `task:assign` or `task:manage`)
2. **Route Handler**: Blocks moderators from write operations (requires `task:manage` for update/delete/import)

### Route Definitions

#### `GET /api/admin/tasks` - List All Tasks
**Permission**: `task:assign` (moderators and admins)
**Behavior**:
- Returns ALL tasks in the system
- No ownership filtering
- Accepts `author_id` and `assigned_user_id` as query filters
- Supports same pagination/filtering as user route

**Query Parameters**:
```typescript
{
  page?: number;
  limit?: number;
  order?: 'asc' | 'desc';
  status?: TaskStatus;
  search?: string;
  author_id?: string;        // Filter by author
  assigned_user_id?: string; // Filter by assignee
}
```

**Response**: Same as `GET /api/tasks`

**Error Cases**:
- `401`: Not authenticated
- `403`: Missing task:assign permission (not a moderator or admin)

---

#### `GET /api/admin/tasks/:id` - Get Any Task
**Permission**: `task:assign` (moderators and admins)
**Behavior**:
- Returns any task by ID
- No ownership check

**Response**: Same as `GET /api/tasks/:id`

**Error Cases**:
- `401`: Not authenticated
- `403`: Missing task:assign permission (not a moderator or admin)
- `404`: Task not found

---

#### `PATCH /api/admin/tasks/:id` - Update Any Task
**Permission**: `task:manage` (admins only)
**Behavior**:
- Can update any task regardless of ownership
- `author_id` still cannot be changed (immutable)
- Can change `assigned_user_id` to any user
- No assignment validation (admin can assign to anyone)

**Request Body**: Same as `PATCH /api/tasks/:id`

**Response**: `200 OK` with updated task

**Error Cases**:
- `401`: Not authenticated
- `403`: Missing task:assign permission (autohook blocks regular users)
- `403`: Missing task:manage permission (moderators blocked from updates)
- `404`: Task not found

---

#### `DELETE /api/admin/tasks/:id` - Delete Any Task
**Permission**: `task:manage` (admins only)
**Behavior**:
- Can delete any task regardless of ownership

**Response**: `204 No Content`

**Error Cases**:
- `401`: Not authenticated
- `403`: Missing task:assign permission (autohook blocks regular users)
- `403`: Missing task:manage permission (moderators blocked from deletes)
- `404`: Task not found

---

#### `POST /api/admin/tasks/:id/assign` - Assign Task to User
**Permission**: `task:assign` (moderators and admins)
**Behavior**:
- Can assign any task to any user
- Can unassign task (set to null)
- Validates that target user exists
- Does NOT modify any other task properties
- This is the primary operation for moderators

**Request Body**:
```typescript
{
  assigned_user_id: string | null;  // User ID or null to unassign
}
```

**Response**: `200 OK`
```typescript
{
  // Full updated task object
}
```

**Error Cases**:
- `401`: Not authenticated
- `403`: Missing task:assign permission (not a moderator or admin)
- `404`: Task not found
- `400`: Target user doesn't exist

---

#### `GET /api/admin/tasks/files/export` - Export All Tasks (CSV)
**Permission**: `task:assign` (moderators and admins)
**Behavior**:
- Exports ALL tasks in the system
- Accepts author_id/assigned_user_id filters
- No ownership restrictions

**Query Parameters**: Same as `GET /api/admin/tasks`

**Response**: Same as `GET /api/tasks/files/export`

**Error Cases**:
- `401`: Not authenticated
- `403`: Missing task:assign permission (not a moderator or admin)

---

#### `POST /api/admin/tasks/files/import` - Import Tasks for Any User (CSV)
**Permission**: `task:manage` (admins only)
**Behavior**:
- Imports tasks from CSV
- Can set `author_id` and `assigned_user_id` to any user
- Validates that target users exist
- Creates new tasks only

**Request**: Same as `POST /api/tasks/files/import`

**Response**: Same as user import

**Error Cases**:
- `401`: Not authenticated
- `403`: Missing task:assign permission (autohook blocks regular users)
- `403`: Missing task:manage permission (moderators blocked from import)
- `400`: Invalid CSV or target users don't exist

---

## Permission Matrix

| Route | User | Moderator | Admin |
|-------|------|-----------|-------|
| `POST /api/tasks` | ✅ Self-only | ✅ Self-only | ✅ Self-only |
| `GET /api/tasks` | ✅ Own tasks | N/A | N/A |
| `GET /api/tasks/:id` | ✅ Own task | N/A | N/A |
| `PATCH /api/tasks/:id` | ✅ Own task | N/A | N/A |
| `DELETE /api/tasks/:id` | ✅ Own task | N/A | N/A |
| `GET /api/tasks/files/export` | ✅ Own tasks | N/A | N/A |
| `POST /api/tasks/files/import` | ✅ Self-only | N/A | N/A |
| `GET /api/admin/tasks` | ❌ | ✅ All tasks | ✅ All tasks |
| `GET /api/admin/tasks/:id` | ❌ | ✅ Any task | ✅ Any task |
| `POST /api/admin/tasks/:id/assign` | ❌ | ✅ Assign only | ✅ Assign |
| `PATCH /api/admin/tasks/:id` | ❌ | ❌ | ✅ Any task |
| `DELETE /api/admin/tasks/:id` | ❌ | ❌ | ✅ Any task |
| `GET /api/admin/tasks/files/export` | ❌ | ✅ All tasks | ✅ All tasks |
| `POST /api/admin/tasks/files/import` | ❌ | ❌ | ✅ Any user |

**Notes**:
- Moderators and Admins can still use `/api/tasks/*` routes for their own tasks
- Admin routes serve both moderators and admins with operation-level permission checks
- Regular users are blocked by autohook (require `task:assign` minimum)
- Moderators are blocked from write operations by handler-level checks (require `task:manage`)

---

## Security Benefits

### 1. Eliminates IDOR Vulnerabilities
**Before**: User could manipulate query params to see others' tasks
```typescript
GET /api/tasks?author_id=victim-id  // ❌ Bypass via query param
```

**After**: User routes ALWAYS enforce ownership
```typescript
GET /api/tasks  // ✅ Always filtered to session.userId
GET /api/admin/tasks?author_id=victim-id  // ✅ Only admins can access
```

### 2. Simpler Authorization Logic
**Before**: Complex conditionals in every route
```typescript
const canReadAll = await canAssignTasks(fastify, session.userId);
const queryFilters = canReadAll
  ? request.query
  : { ...request.query, author_id: session.userId };  // ❌ Complex, error-prone
```

**After**: Clear, simple, fail-safe
```typescript
// User route - ALWAYS scoped
const queryFilters = {
  ...request.query,
  author_id: session.userId,  // ✅ Always enforced
  assigned_user_id: session.userId,
};

// Admin route - ALWAYS full access
const queryFilters = request.query;  // ✅ No conditionals
```

### 3. Defense in Depth
Two-layer security model:

**User Autohook** (`/api/tasks/autohooks.ts`):
```typescript
// Only authentication required
await fastify.authenticate(request, reply);
```

**Admin Autohook** (`/api/admin/tasks/autohooks.ts`):
```typescript
await fastify.authenticate(request, reply);

// Require minimum moderator access (task:assign)
const canAccess = await canAssignTasks(fastify, request.session!.userId);
if (!canAccess) {
  reply.code(403);
  throw new Error('Admin or moderator access required');
}
```

**Admin Write Operation Handlers** (PATCH, DELETE, import):
```typescript
// Additional check for admin-only operations
const canManage = await canManageTasks(fastify, request.session!.userId);
if (!canManage) {
  reply.code(403);
  return { error: 'Admin access required' };
}
```

This creates a permission hierarchy:
1. **Regular users**: Blocked by admin autohook
2. **Moderators**: Pass autohook, blocked by write operation checks
3. **Admins**: Pass all checks

### 4. No author_id Modification Risk
- `author_id` removed from `UpdateTaskSchema`
- User routes: `author_id` set on creation, immutable
- Admin routes: `author_id` still immutable (audit trail preservation)
- No route allows changing task authorship

### 5. Clear Role Separation
- **Users**: Work on their own tasks
- **Moderators**: Coordinate and assign, cannot modify content (checks and balances)
- **Admins**: Full system access for administration

---

## Implementation Strategy

### Phase 1: Fix Critical Vulnerabilities in Current Routes
1. Fix IDOR in `GET /api/tasks` - force ownership filters
2. Remove `author_id` from `UpdateTaskSchema`
3. Add banned user check to authentication plugin
4. Add validation to assignment endpoint

### Phase 2: Create Admin Routes
1. Create `/api/admin/tasks/` directory
2. Implement admin autohook with `canAssignTasks()` check (minimum moderator access)
3. Implement admin routes:
   - **Read operations** (list, get, export): Accessible to moderators and admins
   - **Assignment operation** (assign): Accessible to moderators and admins
   - **Write operations** (update, delete, import): Additional `canManageTasks()` check for admins only
4. No ownership filtering in admin routes

### Phase 3: Simplify User Routes
1. Remove all `canReadAll`, `canManageTasks()` conditionals
2. ALWAYS enforce ownership filtering
3. Simplify authorization logic
4. Add clear comments about ownership enforcement

### Phase 4: Update Documentation
1. Update API documentation
2. Update OpenAPI/Swagger specs
3. Add migration guide for API consumers
4. Update client libraries if applicable

---

## Migration Notes

### Breaking Changes
- Admin/moderator users must use `/api/admin/tasks/*` routes for system-wide operations
- Query parameters `author_id` and `assigned_user_id` no longer accepted in user routes
- `/api/tasks/:id/assign` endpoint moved to `/api/admin/tasks/:id/assign`

### Backward Compatibility Strategy
1. Keep old routes active with deprecation warnings (6 months)
2. Add `X-Deprecated: true` header to old routes
3. Log usage of deprecated routes for monitoring
4. Provide clear migration path in API responses

### Client Migration
**Before**:
```typescript
// User checking if they can see all tasks
const response = await fetch('/api/tasks?author_id=some-user-id');
```

**After**:
```typescript
// Regular user - always sees own tasks
const response = await fetch('/api/tasks');

// Admin - explicitly uses admin route
const response = await fetch('/api/admin/tasks?author_id=some-user-id');
```

---

## Testing Strategy

### Unit Tests
- Test each route with user/moderator/admin roles
- Verify ownership filtering in user routes
- Verify no ownership filtering in admin routes
- Test permission checks in autohooks

### Integration Tests
- Test cross-role scenarios
- Verify moderators cannot modify content
- Verify users cannot access admin routes
- Test assignment validation

### Security Tests
- Attempt IDOR attacks on user routes
- Attempt privilege escalation
- Verify banned users cannot access any routes
- Test author_id modification attempts
- Fuzz testing on query parameters

---

## Monitoring & Audit

### Metrics to Track
- Authorization failures by route
- Admin route usage frequency
- Moderator assignment operations
- Failed assignment attempts
- Query parameter manipulation attempts

### Audit Logging
Log all admin operations:
```typescript
{
  timestamp: '2025-01-13T10:30:00Z',
  userId: 'admin-123',
  action: 'admin.task.update',
  taskId: 456,
  changes: { status: 'new' → 'completed' },
  ip: '192.168.1.1'
}
```

---

## Future Enhancements

1. **Field-Level Authorization**: Different permissions for different task fields
2. **Task Visibility Levels**: Public/private/team visibility settings
3. **Delegation**: Allow users to delegate tasks to others with approval workflow
4. **Audit Trail UI**: Admin dashboard showing all system-wide operations
5. **Rate Limiting**: Per-role rate limits (stricter for admin operations)
6. **IP Whitelisting**: Restrict admin routes to specific IPs
7. **MFA Requirement**: Require MFA for admin/moderator routes

---

## Conclusion

The hybrid approach provides:
- **Better Security**: Eliminates IDOR and reduces attack surface
- **Simpler Code**: No complex conditionals, clear authorization logic
- **Better Performance**: Fewer permission checks, clearer database queries
- **Clearer Intent**: Route structure reflects permission model
- **Easier Auditing**: Clear separation of user vs admin operations

This architecture is production-ready and provides a solid foundation for future enhancements.
