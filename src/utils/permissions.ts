import { createAccessControl } from 'better-auth/plugins/access';
import { adminAc, defaultStatements, userAc } from 'better-auth/plugins/admin/access';

/**
 * Access Control Security Model
 *
 * PRINCIPLE: Separation of duties with least privilege
 *
 * This access control system implements checks and balances to ensure accountability
 * and prevent conflicts of interest in task management.
 *
 * ROLES & PERMISSIONS:
 *
 * 1. USER (Basic authenticated users)
 *    - Can manage their own tasks: create, read, update, delete
 *    - Can export and import their own task data
 *    - Cannot assign tasks to others (prevents unauthorized delegation)
 *    - Import scope limited to self (can only create tasks authored/assigned to themselves)
 *
 * 2. MODERATOR (Work coordinators)
 *    - Can assign tasks to any user (coordination role)
 *    - Can read all tasks and export data (oversight)
 *    - CANNOT update, delete, or import tasks (maintains checks & balances)
 *    - Can ban/unban users (user moderation)
 *    - Rationale: Moderators coordinate work but cannot modify task content to:
 *      * Prevent conflict of interest (can't mark assigned tasks complete)
 *      * Preserve accountability (only authors/assignees modify content)
 *      * Maintain audit trail integrity
 *      * Prevent bulk modification via CSV import loophole
 *
 * 3. ADMIN (Full system access)
 *    - Complete access to all task operations
 *    - Inherits all user management permissions from adminAc
 *    - Serves as escalation path when moderators need corrections
 *
 * OWNERSHIP ENFORCEMENT:
 * Permission checks are enforced in route handlers with ownership validation:
 * - Users can only update/delete tasks they authored or are assigned to
 * - Moderators can assign but not modify task details
 * - Admins bypass ownership restrictions
 *
 * NOTE: better-auth 'ban' permission includes both ban and unban capabilities
 */

// 1. Define the resource name, and available actions,permissions via the statement object.
const statement = {
  ...defaultStatements,
  task: ['create', 'read', 'update', 'delete', 'assign', 'import', 'export'],
} as const;

// 2. Create the access controller, passing in the resource, available permissions via the statement object
export const ac = createAccessControl(statement);

// 3. Create roles with the permissions/actions you've defined
// 4. Integrate pre-existing resources, and role permissions

// USER: Can manage their own tasks with full CRUD + export + import
export const user = ac.newRole({
  task: ['create', 'read', 'update', 'delete', 'export', 'import'],
});

// ADMIN: Full access to all resources and task operations
export const admin = ac.newRole({
  ...adminAc.statements,
  task: ['create', 'read', 'update', 'delete', 'assign', 'import', 'export'],
});

// MODERATOR: Coordinates work (assign) but cannot modify task content (checks & balances)
export const moderator = ac.newRole({
  ...userAc.statements,
  task: ['create', 'read', 'assign', 'export'],
  user: ['ban'], // Includes unban capability
});

// 5. Pass Roles to the admin Plugin via the Plugin options
