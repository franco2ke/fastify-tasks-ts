import type { FastifyPluginCallback } from 'fastify';

const example: FastifyPluginCallback = (fastify, _opts, done): void => {
  fastify.get('/', {
    schema: {
      tags: ['Home'],
    },
    handler: function (request, reply) {
      reply.send('This is the Fastify Tasks Demo App API 😃');
    },
  });

  done();
};

export default example;
