import { type Session, type User, auth } from '../auth.js';
import type { FastifyInstance, FastifyPluginOptions, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

// module augmentation to extend the existing types
declare module 'fastify' {
  export interface FastifyInstance {
    auth: typeof auth;
    authenticate(request: FastifyRequest, reply: FastifyReply): Promise<{ authenticated: string }>;
  }

  export interface FastifyRequest {
    session: Session['session'] | null;
    user: User | null;
  }
}

function authenticationPlugin(fastify: FastifyInstance, opts: FastifyPluginOptions): void {
  fastify.decorate('auth', auth);
  fastify.decorateRequest('session', null);
  fastify.decorateRequest('user', null);

  fastify.decorate(
    'authenticate',
    async function authenticate(request: FastifyRequest, reply: FastifyReply) {
      // Convert Fastify's IncomingHttpHeaders to HeadersInit format/type
      // Problem: IncomingHttpHeaders object has values of type: string | string[] | undefined
      // Solution: Headers constructor needs Record<string, string> (no undefined, no arrays)
      const requestHeaders: Record<string, string> = {};

      for (const [key, value] of Object.entries(request.headers)) {
        if (value !== undefined) {
          requestHeaders[key] = Array.isArray(value) ? value.join(', ') : value;
        }
      }

      const sessionData = await fastify.auth.api.getSession({
        // Headers() constructor comes from the Web Standards API
        headers: new Headers(requestHeaders),
      });

      if (!sessionData?.session) {
        reply.code(401);
        return await reply.send({ error: 'You must be logged in to access this resource.' });
      }

      request.setDecorator('session', sessionData.session);
      request.setDecorator('user', sessionData.user);

      return { authenticated: 'true' };
    },
  );
}

export default fp(authenticationPlugin, {
  name: 'authentication',
});
