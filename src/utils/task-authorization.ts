import type { FastifyInstance } from 'fastify';

/**
 * Checks if a user has permission to manage all tasks (admin-level access).
 *
 * Users with 'manage' permission can:
 * - Update any task regardless of ownership
 * - Delete any task regardless of ownership
 * - Bypass all ownership restrictions
 *
 * @param fastify - Fastify instance with auth plugin
 * @param userId - ID of the user to check
 * @returns True if user has manage permission
 */
export async function canManageTasks(fastify: FastifyInstance, userId: string): Promise<boolean> {
  const hasManagePermission = await fastify.auth.api.userHasPermission({
    body: {
      userId,
      permissions: {
        task: ['manage'],
      },
    },
  });

  return hasManagePermission.success;
}

/**
 * Checks if a user has permission to assign tasks to others.
 *
 * Permission Hierarchy:
 * - 'manage' permission includes assignment capabilities (admins)
 * - 'assign' permission allows coordination without modification (moderators)
 *
 * @param fastify - Fastify instance with auth plugin
 * @param userId - ID of the user to check
 * @returns True if user has assign or manage permission
 */
export async function canAssignTasks(fastify: FastifyInstance, userId: string): Promise<boolean> {
  // Check for assign permission (moderators)
  const hasAssignPermission = await fastify.auth.api.userHasPermission({
    body: {
      userId,
      permissions: {
        task: ['assign'],
      },
    },
  });

  if (hasAssignPermission.success) return true;

  // Check for manage permission (admins - includes assign capabilities)
  const hasManagePermission = await fastify.auth.api.userHasPermission({
    body: {
      userId,
      permissions: {
        task: ['manage'],
      },
    },
  });

  return hasManagePermission.success;
}

/**
 * Checks if a user can assign a task to a specific user.
 *
 * Authorization Rules:
 * - Users can always leave tasks unassigned (assignedUserId is null/undefined)
 * - Users can always assign tasks to themselves
 * - Only users with 'task:assign' or 'task:manage' permission can assign to others
 *
 * @param fastify - Fastify instance with auth plugin
 * @param userId - ID of the user attempting the assignment
 * @param assignedUserId - ID of the user to assign the task to (or null/undefined)
 * @returns True if the assignment is allowed, false otherwise
 */
export async function canAssignTaskTo(
  fastify: FastifyInstance,
  userId: string,
  assignedUserId: string | null | undefined,
): Promise<boolean> {
  // Allow if not assigning or self-assigning
  if (assignedUserId === null || assignedUserId === undefined || assignedUserId === userId) {
    return true;
  }

  // Check if user has permission to assign to others
  return await canAssignTasks(fastify, userId);
}
