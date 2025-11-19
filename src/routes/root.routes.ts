import type { FastifyPluginCallback } from 'fastify';
import fastifyPlugin from 'fastify-plugin';

const root: FastifyPluginCallback = (fastify, _opts): void => {
  fastify.get('/', {
    schema: {
      tags: ['Home'],
    },
    handler: function (request, reply) {
      return 'Welcome to the Fastify Tasks Demo App 😃';
    },
  });
};

export default fastifyPlugin(root);
