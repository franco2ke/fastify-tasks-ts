import type { FastifyServerOptions } from 'fastify';

// NOTE: these options are passed to the fastify constructor / factory function
// Used when creating the root application instance, before any plugins load
// Pass '--options' flag via CLI arguments in command to enable these options.
const isDevelopment = Number(process.env.PRODUCTION_LOGGING) === 0;

const options: FastifyServerOptions = {
  logger: isDevelopment
    ? {
        level: 'debug',
        transport: {
          target: 'pino-pretty',
          options: {
            ignore: 'hostname,pid',
            translateTime: 'HH:MM:ss Z',
            colorize: true,
          },
        },
      }
    : {
        // Production: standard JSON logging
        level: 'info',
      },
  ajv: {
    customOptions: {
      // coerceTypes: 'array',
      // removeAdditional: 'all',
    },
  },
};

export default options;
