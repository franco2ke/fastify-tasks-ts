import { build, createTestUser, randomEmail } from '../../../helper.js';
import * as assert from 'node:assert';
import { test } from 'node:test';

test('GET /api/protected - should return user data when authenticated', async (t) => {
  const app = await build(t);
  const email = randomEmail();
  const password = 'testpassword123';

  const { userId, cookie } = await createTestUser(app, email, password);

  const res = await app.inject({
    method: 'GET',
    url: '/api/protected',
    headers: {
      cookie,
    },
  });

  assert.strictEqual(res.statusCode, 200);
  const data = JSON.parse(res.payload);
  assert.strictEqual(data.description, 'This is a protected route 🔐');
  assert.ok(data.user);
  assert.strictEqual(data.user.id, userId);
  assert.strictEqual(data.user.email, email);
  assert.ok(data.session);
});

test('GET /api/protected - should return 401 when not authenticated', async (t) => {
  const app = await build(t);

  const res = await app.inject({
    method: 'GET',
    url: '/api/protected',
  });

  assert.strictEqual(res.statusCode, 401);
});
