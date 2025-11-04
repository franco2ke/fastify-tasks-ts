import type { FastifyRequest } from 'fastify';

/**
 * Converts Fastify request headers to standard Headers object for better-auth API calls
 * @param request - Fastify request object
 * @returns Headers object with all request headers
 */
export function fastifyHeadersToStandardHeaders(request: FastifyRequest): Headers {
  const headers = new Headers();
  Object.entries(request.headers).forEach(([key, value]) => {
    if (value !== undefined) {
      headers.append(key, value.toString());
    }
  });
  return headers;
}
