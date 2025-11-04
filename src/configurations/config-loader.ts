import environmentVariablesSchema from '../schemas/environment-variables.js';
import fastifyEnv from '@fastify/env';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import type { Static } from '@sinclair/typebox';
import fp from 'fastify-plugin';

// Automatically derive config type from schema
type ConfigType = Static<typeof environmentVariablesSchema> & {
  PORT?: number; // Add any additional properties not in schema
};

// extending the existing FastifyInstance to include a config property
declare module 'fastify' {
  export interface FastifyInstance {
    secrets: ConfigType;
    config: {
      configStatus: boolean;
      postgres: {
        connectionString: string;
        databaseString: string;
      };
      rateLimit: {
        max: number;
        timeWindow: string;
      };
      betterAuth: object;
      swagger: {
        routePrefix: string;
        config: {
          info: {
            title: string;
            description: string;
            version: string;
          };
        };
      };
    };
  }
}

interface BetterAuthConfig {
  adminOptions: {
    defaultRole: string;
    adminRoles: string[];
    adminUserIds: string[];
    impersonationSessionDuration: number; // 1 hour
    schema: {
      user: {
        fields: {
          role: 'roles';
          banReason: 'ban_reason';
          banExpires: 'ban_expires';
        };
      };
    };
  };
  basePath: string;
  trustedOrigins: string[];
  emailAndPassword: {
    enabled: boolean;
    requireEmailVerification: boolean;
  };
  user: {
    modelName: string;
    fields: {
      emailVerified: string;
      createdAt: string;
      updatedAt: string;
    };
  };
  session: {
    modelName: string;
    fields: {
      expiresAt: string;
      createdAt: string;
      updatedAt: string;
      ipAddress: string;
      userAgent: string;
      userId: string;
    };
    expiresIn: number;
    updateAge: number;
    disableSessionRefresh: boolean;
    cookieCache: {
      enabled: boolean;
      maxAge: number;
    };
  };
  account: {
    modelName: string;
    fields: {
      accountId: string;
      providerId: string;
      userId: string;
      accessToken: string;
      refreshToken: string;
      idToken: string;
      createdAt: string;
      updatedAt: string;
      accessTokenExpiresAt: string;
      refreshTokenExpiresAt: string;
    };
  };
  verification: {
    modelName: string;
    fields: {
      expiresAt: string;
      createdAt: string;
      updatedAt: string;
    };
  };
}

export const betterAuthConfig: BetterAuthConfig = {
  adminOptions: {
    defaultRole: 'user',
    adminRoles: ['admin'],
    // adminRoles: ['admin', 'super-admin', 'moderator'],
    // roles: {
    //   user: {
    //     authorize: () => ({ success: true }),
    //     statements: [],
    //   },
    //   admin: {
    //     authorize: () => ({ success: true }),
    //     statements: [],
    //   },
    //   'super-admin': {
    //     authorize: () => ({ success: true }),
    //     statements: [],
    //   },
    //   moderator: {
    //     authorize: () => ({ success: true }),
    //     statements: [],
    //   },
    // },
    adminUserIds: ['jZd5u0aC8i2ugRtBZb4fnsjZl98OSHlT'],
    impersonationSessionDuration: 60 * 60, // 1 hour
    schema: {
      user: {
        fields: {
          role: 'roles',
          banReason: 'ban_reason',
          banExpires: 'ban_expires',
        },
      },
    },
  },
  basePath: '/api/auth',
  trustedOrigins: ['http://localhost:5173'],
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  user: {
    modelName: 'users',
    fields: {
      emailVerified: 'email_verified',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  },
  session: {
    modelName: 'sessions',
    fields: {
      expiresAt: 'expires_at',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      ipAddress: 'ip_address',
      userAgent: 'user_agent',
      userId: 'user_id',
    },
    expiresIn: 604800,
    updateAge: 86400,
    disableSessionRefresh: false,
    cookieCache: {
      enabled: false, // Enable caching session in cookie (default: `false`)
      maxAge: 300, // 5 minutes
    },
  },
  account: {
    modelName: 'accounts',
    fields: {
      accountId: 'account_id',
      providerId: 'provider_id',
      userId: 'user_id',
      accessToken: 'access_token',
      refreshToken: 'refresh_token',
      idToken: 'id_token',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      accessTokenExpiresAt: 'access_token_expires_at',
      refreshTokenExpiresAt: 'refresh_token_expires_at',
    },
  },
  verification: {
    modelName: 'verifications',
    fields: {
      expiresAt: 'expires_at',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  },
};

const configLoader: FastifyPluginAsyncTypebox = async function (fastify, _opts) {
  await fastify.register(fastifyEnv, {
    confKey: 'secrets',
    schema: environmentVariablesSchema,
  });

  fastify.decorate('config', {
    configStatus: true,
    postgres: {
      connectionString: `postgres://${fastify.secrets.POSTGRES_USER}:${fastify.secrets.POSTGRES_PASSWORD}@${fastify.secrets.POSTGRES_HOST}:${fastify.secrets.POSTGRES_PORT}/${fastify.secrets.POSTGRES_DATABASE}`,
      databaseString: 'done ✅',
    },
    rateLimit: {
      max: fastify.secrets.RATE_LIMIT_MAX,
      timeWindow: '1 minute',
    },
    betterAuth: betterAuthConfig,
    swagger: {
      routePrefix: '/documentation',
      config: {
        info: {
          title: 'Todo App API 😅',
          description:
            'A Fastify based backend for managing task / todos, with BetterAuth authentication.',
          version: '0.5.0',
        },
        // consumes: ["application/json"],
        // produces: ["application/json"],
        // tags: [
        //   {
        //     name: "Hello World",
        //     description: "You can use these routes to salute whomever you want.",
        //   },
        // ],
      },
    },
  });
};

export default fp(configLoader, {
  name: 'application-config',
});
