import type { FastifyInstance } from 'fastify';

export default function (fastify: FastifyInstance) {
  fastify.addHook('onRequest', async (request, reply) => {
    // Parent autohooks already performed authentication
    // Just check specific permissions here
    const hasPermission = await fastify.auth.api.userHasPermission({
      body: {
        userId: request.session?.userId,
        // permission: { resource: ['permission/action']}
        permission: { user: ['create'] },
      },
    });

    if (!hasPermission.success) {
      reply.code(403);
      return await reply.send({
        error: "You don't have permission to access this resource: Admin access required",
      });
    }
  });
}
