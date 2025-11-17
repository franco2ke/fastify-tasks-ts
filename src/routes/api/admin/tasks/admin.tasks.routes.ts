import {
  AdminQueryTaskPaginationSchema,
  AdminUpdateTaskSchema,
  TaskPaginationResultSchema,
  TaskSchema,
} from '../../../../schemas/tasks.js';
import { type FastifyPluginCallbackTypebox, Type } from '@fastify/type-provider-typebox';

/**
 * Admin task routes - system-wide access
 * Autohook enforces minimum moderator access (task:assign)
 * Individual routes add admin-only checks (task:manage) where needed
 */

const plugin: FastifyPluginCallbackTypebox = (fastify, _opts, done) => {
  const { tasksRepository } = fastify;
  // NOTE: Permission Authorization, partially handled by autohook

  // NOTE: Create Task Route does not exist
  // Admins / Moderators to use assignment instead
  // Create task via POST /api/tasks (they're the author)
  // Assign it to another via POST /api/admin/tasks/:id/assign
  // author_id is immutable, does not change after creation

  // NOTE GET /api/admin/tasks - List all tasks (moderators and admins)
  fastify.get('/', {
    schema: {
      querystring: AdminQueryTaskPaginationSchema,
      response: {
        200: TaskPaginationResultSchema,
        401: Type.Object({ error: Type.String() }),
        403: Type.Object({ error: Type.String() }),
      },
      tags: ['Admin - Tasks'],
    },
    handler: async function (request, reply) {
      // query parameters use as is, including author_id/assigned_user_id filters if provided
      return await tasksRepository.paginate({
        ...request.query,
        page: request.query.page ?? 1,
        limit: request.query.limit ?? 10,
        order: request.query.order ?? 'desc',
      });
    },
  });

  // NOTE: Get Task by ID Route
  fastify.get('/:id', {
    schema: {
      params: Type.Object({
        id: Type.Number(),
      }),
      response: {
        200: TaskSchema,
        401: Type.Object({ error: Type.String() }),
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ message: Type.String() }),
      },
      tags: ['Admin - Tasks'],
    },
    handler: async function (request, reply) {
      const { id } = request.params;

      const task = await tasksRepository.findById(id);
      if (!task) {
        reply.code(404);
        return { message: 'Task not found' };
      }

      // No ownership check - autohook alread verified admin/moderator access
      return task;
    },
  });

  // NOTE: Update
  fastify.patch('/:id', {
    schema: {
      params: Type.Object({
        id: Type.Number(),
      }),
      body: AdminUpdateTaskSchema,
      response: {
        200: TaskSchema,
        401: Type.Object({ error: Type.String() }),
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ message: Type.String() }),
      },
      tags: ['Admin - Tasks'],
    },
    handler: async function (request, reply) {
      const { id } = request.params;

      const updatedTask = await tasksRepository.update(id, request.body);

      if (!updatedTask) {
        reply.code(404);
        return { message: 'Task not found' };
      }

      return updatedTask;
    },
  });

  // NOTE: DELETE /api/admin/tasks/:id - Delete any task (admins only)
  fastify.delete('/:id', {
    schema: {
      params: Type.Object({
        id: Type.Number(),
      }),
      response: {
        200: TaskSchema,
        401: Type.Object({ error: Type.String() }),
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ message: Type.String() }),
      },
      tags: ['Admin - Tasks'],
    },
    handler: async function (request, reply) {
      const { session } = request;

      if (!session) {
        reply.code(401);
        return { error: 'You must be logged in to access this resource' };
      }

      // Check permission
      const hasPermission = await fastify.auth.api.userHasPermission({
        body: {
          userId: session.userId,
          permissions: {
            task: ['manage'],
          },
        },
      });

      if (!hasPermission.success) {
        reply.code(403);
        return { error: "You don't have permission to access this resource" };
      }

      const { id } = request.params;

      const deletedTask = await tasksRepository.delete(id);

      if (!deletedTask) {
        reply.code(404);
        return { message: 'Task not found' };
      }

      return deletedTask;
    },
  });

  done();
};

export default plugin;
