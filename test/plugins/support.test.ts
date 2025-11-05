import Support from '../../src/plugins/support.no-load.js';
import Fastify from 'fastify';
import * as assert from 'node:assert';
import { test } from 'node:test';

test('support works standalone', async (t) => {
  const fastify = Fastify();
  // eslint-disable-next-line no-void
  void fastify.register(Support, { description: 'test description' });
  await fastify.ready();

  assert.equal(fastify.someSupport(), 'hugs');
});
