import { betterAuth } from 'better-auth';
import { admin as adminPlugin } from 'better-auth/plugins';
import { Pool } from 'pg';

import { betterAuthConfig as allBetterAuthConfigs } from './configurations/config-loader.js';
import { ac, admin, moderator, user } from './utils/permissions.js';

const { adminOptions, ...betterAuthConfig } = allBetterAuthConfigs;

// Auth api setup done here for better-auth CLI to work
export const auth = betterAuth({
  database: new Pool({
    host: process.env.POSTGRES_HOST,
    port: Number(process.env.POSTGRES_PORT),
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DATABASE,
  }),
  plugins: [
    adminPlugin({
      ...adminOptions,
      ac,
      roles: {
        user,
        moderator,
        admin,
      },
    }),
  ],
  ...betterAuthConfig,
});

export type User = typeof auth.$Infer.Session.user;
export type Session = typeof auth.$Infer.Session;
