import { canAssignTasks } from '../../../../utils/task-authorization.js';
import type { FastifyInstance, FastifyPluginOptions } from 'fastify';

/**
 * Admin tasks autohook - part of a hierarchical permission model
 * Blocks regular users (only those with task:assign or task:manage permissions pass)
 * Allows moderators and admins to pass through
 * Protects all /api/admin/tasks/* routes
 *
 * @param fastify
 * @param _opts
 */

function adminTaskAutoHooks(fastify: FastifyInstance, _opts: FastifyPluginOptions) {
  fastify.addHook('onRequest', async (request, reply) => {
    // Authentication carried out by parent autohook
    // Only authorization done here

    if (request.session?.userId === undefined) {
      // 401: Who are you?
      reply.code(401);
      return { error: 'You must be logged in to access this resource' };
    }

    const canAccess = await canAssignTasks(fastify, request.session.userId);

    if (!canAccess) {
      // 403: I know who you are, and you dont have permission to do this.
      reply.code(403);
      return await reply.send({
        error: "You don't have permission to access this resource. Admin or moderator required",
      });
    }
  });
}

export default adminTaskAutoHooks;
