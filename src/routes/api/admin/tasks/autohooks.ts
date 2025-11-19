import type { FastifyInstance, FastifyPluginOptions } from 'fastify';

/**
 * Admin tasks autohook - part of a hierarchical permission model
 * - GET routes: Require task:assign permission (moderators can read all tasks)
 * - Write routes (PATCH, DELETE, POST): Require task:manage permission (only admins can modify)
 * - Exception: POST /api/admin/tasks/:id/assign requires task:assign permission (moderators can assign)
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

    // Determine route type
    const isAssignRoute =
      request.method === 'POST' && /^\/api\/admin\/tasks\/\d+\/assign$/.test(request.url);
    const isReadOperation = request.method === 'GET';
    const isWriteOperation = ['PATCH', 'DELETE', 'POST'].includes(request.method);

    // Check assign permission for GET routes and assign route
    if (isReadOperation || isAssignRoute) {
      const hasAssignPermission = await fastify.auth.api.userHasPermission({
        body: {
          userId: request.session.userId,
          permissions: {
            task: ['assign'],
          },
        },
      });

      if (!hasAssignPermission.success) {
        reply.code(403);
        return await reply.send({
          error: "You don't have permission to access this resource. Admin or moderator required",
        });
      }

      return; // Permission granted
    }

    // Check manage permission for other write operations
    if (isWriteOperation) {
      const hasManagePermission = await fastify.auth.api.userHasPermission({
        body: {
          userId: request.session.userId,
          permissions: {
            task: ['manage'],
          },
        },
      });

      if (!hasManagePermission.success) {
        reply.code(403);
        return await reply.send({
          error: "You don't have permission to access this resource. Admin required",
        });
      }
    }
  });
}

export default adminTaskAutoHooks;
