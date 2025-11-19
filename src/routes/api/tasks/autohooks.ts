import type { FastifyInstance, FastifyPluginOptions } from 'fastify';

/**
 * User Tasks autohook - handles permission checks
 * Parent autohook handles authentication = session is guaranteed to exist
 * Allows regular users to pass through
 * Protects all /api/tasks/* routes
 *
 * @param fastify
 * @param _opts
 */

function tasksAutoHooks(fastify: FastifyInstance, _opts: FastifyPluginOptions) {
  fastify.addHook('onRequest', async (request, reply) => {
    // Determine which permission is needed based on HTTP method
    // Consider centralizing this User Permissions type
    let requiredPermission:
      | 'delete'
      | 'create'
      | 'read'
      | 'update'
      | 'assign'
      | 'manage'
      | 'import'
      | 'export'
      | null = null;

    // Map HTTP methods to required permissions
    if (request.method === 'POST') {
      requiredPermission = 'create';
    } else if (request.method === 'GET') {
      requiredPermission = 'read';
    } else if (request.method === 'PATCH') {
      requiredPermission = 'update';
    } else if (request.method === 'DELETE') {
      requiredPermission = 'delete';
    }

    // If no permission mapping found, let the route handler deal with it
    if (requiredPermission === null) {
      return;
    }

    // Check if user has the required permission
    const hasPermission = await fastify.auth.api.userHasPermission({
      body: {
        userId: request.session?.userId,
        permissions: {
          task: [requiredPermission],
        },
      },
    });

    if (!hasPermission.success) {
      reply.code(403);
      return await reply.send({
        error: "You don't have permission to access this resource",
      });
    }
  });
}

export default tasksAutoHooks;
