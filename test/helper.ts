// This file contains code that we reuse between our tests.
import * as path from 'node:path';
import * as test from 'node:test';
import { fileURLToPath } from 'node:url';
import type { FastifyInstance } from 'fastify';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const helper = require('fastify-cli/helper.js');

export type TestContext = {
  after: typeof test.after;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const AppPath = path.join(__dirname, '..', 'src', 'app.ts');

// Fill in this config with all the configurations
// needed for testing the application
function config() {
  return {
    skipOverride: true, // Register our application with fastify-plugin
  };
}

// Automatically build and tear down our instance
async function build(t: TestContext) {
  // you can set all the options supported by the fastify CLI command
  const argv = [AppPath];

  // fastify-plugin ensures that all decorators
  // are exposed for testing purposes, this is
  // different from the production setup
  const app = await helper.build(argv, config());

  // Tear down our app after we are done
  // eslint-disable-next-line no-void
  t.after(() => void app.close());

  return app;
}

/**
 * Helper to register a test user
 */
async function createTestUser(
  app: FastifyInstance,
  email: string,
  password: string,
): Promise<{ userId: string; cookie: string }> {
  const signUpResponse = await app.inject({
    method: 'POST',
    url: '/api/auth/sign-up/email',
    payload: {
      email,
      password,
    },
  });

  const cookie = signUpResponse.headers['set-cookie'];
  const userData = JSON.parse(signUpResponse.payload);

  return {
    userId: userData.user.id,
    cookie: Array.isArray(cookie) ? cookie[0] : (cookie ?? ''),
  };
}

/**
 * Helper to sign in a test user
 */
async function signInTestUser(
  app: FastifyInstance,
  email: string,
  password: string,
): Promise<{ userId: string; cookie: string }> {
  const signInResponse = await app.inject({
    method: 'POST',
    url: '/api/auth/sign-in/email',
    payload: {
      email,
      password,
    },
  });

  const cookie = signInResponse.headers['set-cookie'];
  const userData = JSON.parse(signInResponse.payload);

  return {
    userId: userData.user.id,
    cookie: Array.isArray(cookie) ? cookie[0] : (cookie ?? ''),
  };
}

/**
 * Generate a random email for testing
 */
function randomEmail(): string {
  return `test-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`;
}

export { config, build, createTestUser, signInTestUser, randomEmail };
