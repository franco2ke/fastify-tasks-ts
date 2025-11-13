import fastifyRateLimit, { type RateLimitPluginOptions } from '@fastify/rate-limit';
import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import fp from 'fastify-plugin';

interface PluginOptions extends FastifyPluginOptions {
  rateLimit: RateLimitPluginOptions;
}

async function rateLimiter(fastify: FastifyInstance, opts: PluginOptions) {
  await fastify.register(fastifyRateLimit, {
    ...opts.rateLimit,
  });
}
export default fp(rateLimiter);
