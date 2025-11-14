import type { FastifyInstance } from 'fastify';

// autohooks only apply to child routes NOT sibling files in same directory
export default function (fastify: FastifyInstance) {
  fastify.addHook('onRequest', async (request, reply) => {
    // This code runs on EVERY request before the route handler
    // Skip authentication for auth routes (login, signup, etc.)
    if (request.url.startsWith('/api/auth/')) return;

    // Call the authenticate function
    await fastify.authenticate(request, reply);
  });
}
