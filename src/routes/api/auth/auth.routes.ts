import { fastifyHeadersToStandardHeaders } from '../../../utils/headers-converter.js';
import { type FastifyPluginCallbackTypebox, Type } from '@fastify/type-provider-typebox';
import type { FastifyReply, FastifyRequest } from 'fastify';

const authenticationPlugin: FastifyPluginCallbackTypebox = (fastify, _opts, done) => {
  /**
   * Sets authentication headers on the reply and retrieves session data
   * @param headers - Response headers from auth API call
   * @param reply - Fastify reply object
   * @returns Session data for the authenticated user
   */
  async function setAuthHeadersAndGetSession(headers: Headers, reply: FastifyReply) {
    // add obtained headers (including Cookie) to the reply headers object
    headers.forEach((value, key) => {
      reply.header(key, value);
    });

    // Extract the session cookie from received response headers
    // Better Auth uses 'better-auth.session_token' as the cookie name by default
    const cookieHeaderValue = headers.get('set-cookie');

    // Create new request headers that include the session cookie for getSession api call
    // Cookie identifies user, allowing better-auth to retrieve their session data
    const sessionHeaders = new Headers();
    if (cookieHeaderValue !== null) {
      sessionHeaders.set('cookie', cookieHeaderValue);
    }

    // Get session data using the new session cookie
    const sessionData = await fastify.auth.api.getSession({
      headers: sessionHeaders,
    });

    return sessionData;
  }

  async function authHandler(request: FastifyRequest, reply: FastifyReply) {
    try {
      const url = new URL(request.url, `http://${request.headers.host}`);

      // Convert Fastify headers to standard Headers object
      const headers = fastifyHeadersToStandardHeaders(request);

      const getRequestBody = (method: string, body: unknown) => {
        // GET requests shouldn't have bodies
        if (method === 'GET' || method === 'HEAD') return null;

        // Handle different body types
        if (body === null || body === undefined) return null;
        if (typeof body === 'string') return body;

        return JSON.stringify(body);
      };

      // Create Fetch API-compatible request
      const req = new Request(url.toString(), {
        method: request.method,
        headers,
        body: getRequestBody(request.method, request.body),
      });

      // Process authentication request
      const response = await fastify.auth.handler(req);

      // Forward response to client
      reply.status(response.status);
      response.headers.forEach((value, key) => {
        reply.header(key, value);
      });
      reply.send(response.body ? await response.text() : null);
    } catch (error) {
      fastify.log.error(error, '❌ Authentication Error:');
      reply.status(500).send({
        error: 'Internal authentication error',
        code: 'AUTH_FAILURE',
      });
    }
  }

  fastify.post('/sign-out', {
    handler: authHandler,
  });

  fastify.post('/forget-password', {
    handler: authHandler, //✅
  });

  fastify.post('/reset-password', {
    handler: authHandler, //✅
  });

  fastify.post('/verify-email', {
    handler: authHandler, // ❌
  });

  fastify.get('/list-sessions', {
    handler: authHandler, // ❌
  });

  fastify.post('/revoke-session', {
    handler: authHandler, // ✅
  });

  fastify.post('/revoke-sessions', {
    handler: authHandler, // ✅
  });

  // fastify.post("/two-factor/enable", {
  //   handler: authHandler,
  // });

  // fastify.post("/two-factor/disable", {
  //   handler: authHandler,
  // });

  // fastify.post("/two-factor/verify", {
  //   handler: authHandler,
  // });

  fastify.post('/change-email', {
    handler: authHandler, // ✅
  });

  fastify.post('/change-password', {
    handler: authHandler, // ✅
  });

  fastify.post('/update-user', {
    handler: authHandler, // ✅
  });

  fastify.delete('/delete-user', {
    handler: authHandler, // ❌
  });

  fastify.post('/sign-up/email', {
    schema: {
      body: Type.Object({
        email: Type.String({
          format: 'email',
          minLength: 1,
          maxLength: 255,
        }),
        password: Type.String({
          minLength: 1,
          maxLength: 255,
        }),
      }),
    },
    handler: async function signUpHandler(request, reply) {
      const { headers } = await fastify.auth.api.signUpEmail({
        returnHeaders: true,
        body: {
          name: '', // required
          email: request.body.email, // required
          password: request.body.password, // required
        },
      });

      return await setAuthHeadersAndGetSession(headers, reply);
    },
  });

  fastify.post('/sign-in/email', {
    schema: {
      body: Type.Object({
        email: Type.String({
          format: 'email',
          minLength: 1,
          maxLength: 255,
        }),
        password: Type.String({
          minLength: 1,
          maxLength: 255,
        }),
      }),
    },

    handler: async function signInHandler(request, reply) {
      const requestHeaders = fastifyHeadersToStandardHeaders(request);
      const { headers } = await fastify.auth.api.signInEmail({
        returnHeaders: true,
        body: {
          email: request.body.email, // required
          password: request.body.password, // required
          rememberMe: true,
          callbackURL: 'https://example.com/callback',
        },
        // This endpoint requires session cookies.
        headers: requestHeaders,
      });

      return await setAuthHeadersAndGetSession(headers, reply);
    },
  });

  fastify.get('/session', {
    handler: async function getSessionHandler(request, reply) {
      const requestHeaders = fastifyHeadersToStandardHeaders(request);

      const userData = await fastify.auth.api.getSession({
        headers: requestHeaders,
      });

      return userData;
    },
  });

  done();
};

export default authenticationPlugin;
