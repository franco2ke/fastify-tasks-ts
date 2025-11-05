import { build, createTestUser, randomEmail } from '../../../helper.js';
import * as assert from 'node:assert';
import { test } from 'node:test';

test('POST /api/tasks - should create a new task', async (t) => {
  const app = await build(t);
  const email = randomEmail();
  const password = 'testpassword123';

  const { cookie } = await createTestUser(app, email, password);

  const res = await app.inject({
    method: 'POST',
    url: '/api/tasks',
    headers: {
      cookie,
    },
    payload: {
      title: 'Test Task',
      description: 'This is a test task',
    },
  });

  assert.strictEqual(res.statusCode, 201);
  const data = JSON.parse(res.payload);
  assert.ok(data.id);
  assert.strictEqual(typeof data.id, 'number');
});

test('POST /api/tasks - should fail when not authenticated', async (t) => {
  const app = await build(t);

  const res = await app.inject({
    method: 'POST',
    url: '/api/tasks',
    payload: {
      title: 'Test Task',
      description: 'This is a test task',
    },
  });

  assert.strictEqual(res.statusCode, 401);
});

test('POST /api/tasks - should fail with missing title', async (t) => {
  const app = await build(t);
  const email = randomEmail();
  const password = 'testpassword123';

  const { cookie } = await createTestUser(app, email, password);

  const res = await app.inject({
    method: 'POST',
    url: '/api/tasks',
    headers: {
      cookie,
    },
    payload: {
      description: 'This is a test task',
    },
  });

  assert.strictEqual(res.statusCode, 400);
});

test('POST /api/tasks - should fail with missing description', async (t) => {
  const app = await build(t);
  const email = randomEmail();
  const password = 'testpassword123';

  const { cookie } = await createTestUser(app, email, password);

  const res = await app.inject({
    method: 'POST',
    url: '/api/tasks',
    headers: {
      cookie,
    },
    payload: {
      title: 'Test Task',
    },
  });

  assert.strictEqual(res.statusCode, 400);
});

test('GET /api/tasks/:id - should get task by id', async (t) => {
  const app = await build(t);
  const email = randomEmail();
  const password = 'testpassword123';

  const { cookie } = await createTestUser(app, email, password);

  // Create a task first
  const createRes = await app.inject({
    method: 'POST',
    url: '/api/tasks',
    headers: {
      cookie,
    },
    payload: {
      title: 'Test Task',
      description: 'This is a test task',
    },
  });

  const { id } = JSON.parse(createRes.payload);

  // Get the task
  const res = await app.inject({
    method: 'GET',
    url: `/api/tasks/${id}`,
    headers: {
      cookie,
    },
  });

  assert.strictEqual(res.statusCode, 200);
  const data = JSON.parse(res.payload);
  assert.strictEqual(data.id, id);
  assert.strictEqual(data.title, 'Test Task');
  assert.strictEqual(data.description, 'This is a test task');
  assert.strictEqual(data.status, 'new');
});

test('GET /api/tasks/:id - should return 404 for non-existent task', async (t) => {
  const app = await build(t);
  const email = randomEmail();
  const password = 'testpassword123';

  const { cookie } = await createTestUser(app, email, password);

  const res = await app.inject({
    method: 'GET',
    url: '/api/tasks/999999',
    headers: {
      cookie,
    },
  });

  assert.strictEqual(res.statusCode, 404);
});

test('GET /api/tasks/:id - should fail when not authenticated', async (t) => {
  const app = await build(t);

  const res = await app.inject({
    method: 'GET',
    url: '/api/tasks/1',
  });

  assert.strictEqual(res.statusCode, 401);
});

test('GET /api/tasks - should list tasks with pagination', async (t) => {
  const app = await build(t);
  const email = randomEmail();
  const password = 'testpassword123';

  const { cookie } = await createTestUser(app, email, password);

  // Create multiple tasks
  for (let i = 0; i < 5; i++) {
    await app.inject({
      method: 'POST',
      url: '/api/tasks',
      headers: {
        cookie,
      },
      payload: {
        title: `Test Task ${i}`,
        description: `Description ${i}`,
      },
    });
  }

  // Get tasks
  const res = await app.inject({
    method: 'GET',
    url: '/api/tasks?page=1&limit=3',
    headers: {
      cookie,
    },
  });

  assert.strictEqual(res.statusCode, 200);
  const data = JSON.parse(res.payload);
  assert.ok(data.tasks);
  assert.ok(Array.isArray(data.tasks));
  assert.strictEqual(data.tasks.length, 3);
  assert.strictEqual(data.total, 5);
});

test('GET /api/tasks - should filter tasks by status', async (t) => {
  const app = await build(t);
  const email = randomEmail();
  const password = 'testpassword123';

  const { cookie } = await createTestUser(app, email, password);

  // Create a task
  const createRes = await app.inject({
    method: 'POST',
    url: '/api/tasks',
    headers: {
      cookie,
    },
    payload: {
      title: 'Test Task',
      description: 'Description',
    },
  });

  const { id } = JSON.parse(createRes.payload);

  // Update task status
  await app.inject({
    method: 'PATCH',
    url: `/api/tasks/${id}`,
    headers: {
      cookie,
    },
    payload: {
      status: 'completed',
    },
  });

  // Get tasks with status filter
  const res = await app.inject({
    method: 'GET',
    url: '/api/tasks?status=completed',
    headers: {
      cookie,
    },
  });

  assert.strictEqual(res.statusCode, 200);
  const data = JSON.parse(res.payload);
  assert.ok(data.tasks.length > 0);
  data.tasks.forEach((task: any) => {
    assert.strictEqual(task.status, 'completed');
  });
});

test('PATCH /api/tasks/:id - should update task', async (t) => {
  const app = await build(t);
  const email = randomEmail();
  const password = 'testpassword123';

  const { cookie } = await createTestUser(app, email, password);

  // Create a task
  const createRes = await app.inject({
    method: 'POST',
    url: '/api/tasks',
    headers: {
      cookie,
    },
    payload: {
      title: 'Original Title',
      description: 'Original Description',
    },
  });

  const { id } = JSON.parse(createRes.payload);

  // Update the task
  const res = await app.inject({
    method: 'PATCH',
    url: `/api/tasks/${id}`,
    headers: {
      cookie,
    },
    payload: {
      title: 'Updated Title',
      status: 'in-progress',
    },
  });

  assert.strictEqual(res.statusCode, 200);
  const data = JSON.parse(res.payload);
  assert.strictEqual(data.id, id);
  assert.strictEqual(data.title, 'Updated Title');
  assert.strictEqual(data.status, 'in-progress');
  assert.strictEqual(data.description, 'Original Description'); // Should remain unchanged
});

test('PATCH /api/tasks/:id - should return 404 for non-existent task', async (t) => {
  const app = await build(t);
  const email = randomEmail();
  const password = 'testpassword123';

  const { cookie } = await createTestUser(app, email, password);

  const res = await app.inject({
    method: 'PATCH',
    url: '/api/tasks/999999',
    headers: {
      cookie,
    },
    payload: {
      title: 'Updated Title',
    },
  });

  assert.strictEqual(res.statusCode, 404);
});

test('PATCH /api/tasks/:id - should fail when not authenticated', async (t) => {
  const app = await build(t);

  const res = await app.inject({
    method: 'PATCH',
    url: '/api/tasks/1',
    payload: {
      title: 'Updated Title',
    },
  });

  assert.strictEqual(res.statusCode, 401);
});

test('DELETE /api/tasks/:id - should delete task', async (t) => {
  const app = await build(t);
  const email = randomEmail();
  const password = 'testpassword123';

  const { cookie } = await createTestUser(app, email, password);

  // Create a task
  const createRes = await app.inject({
    method: 'POST',
    url: '/api/tasks',
    headers: {
      cookie,
    },
    payload: {
      title: 'Task to Delete',
      description: 'This task will be deleted',
    },
  });

  const { id } = JSON.parse(createRes.payload);

  // Delete the task
  const res = await app.inject({
    method: 'DELETE',
    url: `/api/tasks/${id}`,
    headers: {
      cookie,
    },
  });

  assert.strictEqual(res.statusCode, 204);

  // Verify task is deleted
  const getRes = await app.inject({
    method: 'GET',
    url: `/api/tasks/${id}`,
    headers: {
      cookie,
    },
  });

  assert.strictEqual(getRes.statusCode, 404);
});

test('DELETE /api/tasks/:id - should return 404 for non-existent task', async (t) => {
  const app = await build(t);
  const email = randomEmail();
  const password = 'testpassword123';

  const { cookie } = await createTestUser(app, email, password);

  const res = await app.inject({
    method: 'DELETE',
    url: '/api/tasks/999999',
    headers: {
      cookie,
    },
  });

  assert.strictEqual(res.statusCode, 404);
});

test('DELETE /api/tasks/:id - should fail when not authenticated', async (t) => {
  const app = await build(t);

  const res = await app.inject({
    method: 'DELETE',
    url: '/api/tasks/1',
  });

  assert.strictEqual(res.statusCode, 401);
});

test('DELETE /api/tasks/:id - should prevent deleting other users tasks', async (t) => {
  const app = await build(t);
  const email1 = randomEmail();
  const email2 = randomEmail();
  const password = 'testpassword123';

  // Create two users
  const { cookie: cookie1 } = await createTestUser(app, email1, password);
  const { cookie: cookie2 } = await createTestUser(app, email2, password);

  // User 1 creates a task
  const createRes = await app.inject({
    method: 'POST',
    url: '/api/tasks',
    headers: {
      cookie: cookie1,
    },
    payload: {
      title: 'User 1 Task',
      description: 'This belongs to user 1',
    },
  });

  const { id } = JSON.parse(createRes.payload);

  // User 2 tries to delete User 1's task
  const res = await app.inject({
    method: 'DELETE',
    url: `/api/tasks/${id}`,
    headers: {
      cookie: cookie2,
    },
  });

  assert.strictEqual(res.statusCode, 403);
});

test('PATCH /api/tasks/:id - should prevent updating other users tasks', async (t) => {
  const app = await build(t);
  const email1 = randomEmail();
  const email2 = randomEmail();
  const password = 'testpassword123';

  // Create two users
  const { cookie: cookie1 } = await createTestUser(app, email1, password);
  const { cookie: cookie2 } = await createTestUser(app, email2, password);

  // User 1 creates a task
  const createRes = await app.inject({
    method: 'POST',
    url: '/api/tasks',
    headers: {
      cookie: cookie1,
    },
    payload: {
      title: 'User 1 Task',
      description: 'This belongs to user 1',
    },
  });

  const { id } = JSON.parse(createRes.payload);

  // User 2 tries to update User 1's task
  const res = await app.inject({
    method: 'PATCH',
    url: `/api/tasks/${id}`,
    headers: {
      cookie: cookie2,
    },
    payload: {
      title: 'Hacked Title',
    },
  });

  assert.strictEqual(res.statusCode, 403);
});
