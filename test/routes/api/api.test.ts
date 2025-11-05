import { build } from '../../helper.js';
import * as assert from 'node:assert';
import { test } from 'node:test';

test('GET /api returns API status message', async (t) => {
  const app = await build(t);

  const res = await app.inject({
    method: 'GET',
    url: '/api',
  });

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.payload, 'This is the Fastify Tasks Demo App API 😃');
});
