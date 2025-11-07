import { build, createTestUser, randomEmail, signInTestUser } from '../../../helper.js';
import * as assert from 'node:assert';
import { test } from 'node:test';

test('POST /api/auth/sign-up/email - should create a new user', async (t) => {
  const app = await build(t);
  const email = randomEmail();
  const password = 'testpassword123';

  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/sign-up/email',
    payload: {
      email,
      password,
    },
  });

  assert.strictEqual(res.statusCode, 200);
  const data = JSON.parse(res.payload);
  assert.ok(data.user);
  assert.strictEqual(data.user.email, email);
  assert.ok(data.session);
  assert.ok(res.headers['set-cookie']);
});

test('POST /api/auth/sign-up/email - should fail with invalid email', async (t) => {
  const app = await build(t);

  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/sign-up/email',
    payload: {
      email: 'invalid-email',
      password: 'testpassword123',
    },
  });

  assert.strictEqual(res.statusCode, 400);
});

test('POST /api/auth/sign-up/email - should fail with missing password', async (t) => {
  const app = await build(t);

  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/sign-up/email',
    payload: {
      email: randomEmail(),
    },
  });

  assert.strictEqual(res.statusCode, 400);
});

test('POST /api/auth/sign-in/email - should sign in existing user', async (t) => {
  const app = await build(t);
  const email = randomEmail();
  const password = 'testpassword123';

  // Create user first
  await createTestUser(app, email, password);

  // Sign in
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/sign-in/email',
    payload: {
      email,
      password,
    },
  });

  assert.strictEqual(res.statusCode, 200);
  const data = JSON.parse(res.payload);
  assert.ok(data.user);
  assert.strictEqual(data.user.email, email);
  assert.ok(data.session);
  assert.ok(res.headers['set-cookie']);
});

test('POST /api/auth/sign-in/email - should fail with wrong password', async (t) => {
  const app = await build(t);
  const email = randomEmail();
  const password = 'testpassword123';

  // Create user first
  await createTestUser(app, email, password);

  // Try to sign in with wrong password
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/sign-in/email',
    payload: {
      email,
      password: 'wrongpassword',
    },
  });

  assert.notStrictEqual(res.statusCode, 200);
});

test('POST /api/auth/sign-in/email - should fail with non-existent user', async (t) => {
  const app = await build(t);

  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/sign-in/email',
    payload: {
      email: randomEmail(),
      password: 'testpassword123',
    },
  });

  assert.notStrictEqual(res.statusCode, 200);
});

test('GET /api/auth/session - should return session data when authenticated', async (t) => {
  const app = await build(t);
  const email = randomEmail();
  const password = 'testpassword123';

  const { cookie } = await createTestUser(app, email, password);

  const res = await app.inject({
    method: 'GET',
    url: '/api/auth/session',
    headers: {
      cookie,
    },
  });

  assert.strictEqual(res.statusCode, 200);
  const data = JSON.parse(res.payload);
  assert.ok(data.user);
  assert.strictEqual(data.user.email, email);
  assert.ok(data.session);
});

test('GET /api/auth/session - should return null when not authenticated', async (t) => {
  const app = await build(t);

  const res = await app.inject({
    method: 'GET',
    url: '/api/auth/session',
  });

  assert.strictEqual(res.statusCode, 200);
  const data = JSON.parse(res.payload);
  assert.strictEqual(data.session, null);
  assert.strictEqual(data.user, null);
});

test('POST /api/auth/sign-out - should sign out user', async (t) => {
  const app = await build(t);
  const email = randomEmail();
  const password = 'testpassword123';

  const { cookie } = await createTestUser(app, email, password);

  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/sign-out',
    headers: {
      cookie,
    },
  });

  assert.strictEqual(res.statusCode, 200);

  // Verify session is gone
  const sessionRes = await app.inject({
    method: 'GET',
    url: '/api/auth/session',
    headers: {
      cookie,
    },
  });

  const sessionData = JSON.parse(sessionRes.payload);
  assert.strictEqual(sessionData.session, null);
});

test('POST /api/auth/change-password - should change user password', async (t) => {
  const app = await build(t);
  const email = randomEmail();
  const oldPassword = 'oldpassword123';
  const newPassword = 'newpassword456';

  const { cookie } = await createTestUser(app, email, oldPassword);

  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/change-password',
    headers: {
      cookie,
    },
    payload: {
      currentPassword: oldPassword,
      newPassword,
      revokeOtherSessions: false,
    },
  });

  assert.strictEqual(res.statusCode, 200);

  // Sign out
  await app.inject({
    method: 'POST',
    url: '/api/auth/sign-out',
    headers: {
      cookie,
    },
  });

  // Try to sign in with new password
  const signInRes = await signInTestUser(app, email, newPassword);
  assert.ok(signInRes.userId);
});
