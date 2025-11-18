import {
  CreateTaskSchema,
  QueryTaskPaginationSchema,
  TaskPaginationResultSchema,
  TaskSchema,
  UpdateTaskSchema,
} from '../../../schemas/tasks.js';
import { type FastifyPluginCallbackTypebox, Type } from '@fastify/type-provider-typebox';

const plugin: FastifyPluginCallbackTypebox = (fastify, _opts, done) => {
  const { tasksRepository } = fastify;

  // NOTE: Create Task Route
  fastify.post('/', {
    schema: {
      body: CreateTaskSchema,
      response: {
        201: {
          id: Type.Number(),
        },
        400: {
          error: Type.String(),
        },
        401: {
          error: Type.String(),
        },
        403: {
          error: Type.String(),
        },
      },
      tags: ['Tasks'],
    },
    handler: async function (request, reply) {
      const { session } = request;
      if (!session) {
        // 401: Who are you
        reply.code(401);
        return { error: 'You must be logged in to access this resource' };
      }

      if (request.body.title === undefined || request.body.description === undefined) {
        reply.code(400);
        return { error: 'Incorrect task information, fill title / description fields' };
      }

      const id = await tasksRepository.create({
        title: request.body.title,
        description: request.body.description,
        assigned_user_id: session.userId,
        author_id: session.userId,
      });

      reply.code(201);

      return { id };
    },
  });

  // NOTE: Get tasks with pagination, filtering
  fastify.get('/', {
    schema: {
      querystring: QueryTaskPaginationSchema,
      response: {
        200: TaskPaginationResultSchema,
        401: Type.Object({ error: Type.String() }),
        403: Type.Object({ error: Type.String() }),
      },
      tags: ['Tasks'],
    },
    handler: async function (request, reply) {
      const { session } = request;
      if (!session) {
        reply.code(401);
        return { error: 'You must be logged in to access this resource' };
      }

      // NOTE: For SECURITY purposes. Always enforce ownership filtering for user routes
      // Admins/moderators should use /api/admin/tasks for system-wide access
      const queryFilters = {
        ...request.query,
        author_id: session.userId,
        assigned_user_id: session.userId,
      };

      return await tasksRepository.paginate({
        ...queryFilters,
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
      tags: ['Tasks'],
    },
    handler: async function (request, reply) {
      const { session } = request;
      if (!session) {
        reply.code(401);
        return { error: 'You must be logged in to access this resource' };
      }

      const { id } = request.params;

      const task = await tasksRepository.findById(id);
      if (!task) {
        reply.code(404);
        return { message: 'Task not found' };
      }

      // Dont return task if it isn't assigned to current user
      if (task.author_id !== session.userId && task.assigned_user_id !== session.userId) {
        reply.code(404);
        return { message: 'Task not found' };
      }

      return task;
    },
  });

  // NOTE: Update Task Route
  fastify.patch('/:id', {
    schema: {
      params: Type.Object({
        id: Type.Number(),
      }),
      body: UpdateTaskSchema,
      response: {
        200: TaskSchema,
        401: Type.Object({ error: Type.String() }),
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ message: Type.String() }),
      },
      tags: ['Tasks'],
    },
    handler: async function (request, reply) {
      const { session } = request;

      if (!session) {
        reply.code(401);
        return { error: 'You must be logged in to access this resource' };
      }

      const { id } = request.params;

      const updatedTask = await tasksRepository.updateWithOwnershipCheck(
        id,
        session.userId,
        request.body,
      );

      if (!updatedTask) {
        reply.code(404);
        return { message: 'Task not found' };
      }

      return updatedTask;
    },
  });

  // NOTE: Delete Task Route
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
      tags: ['Tasks'],
    },
    handler: async function (request, reply) {
      const { session } = request;
      if (!session) {
        reply.code(401);
        return { error: 'You must be logged in to access this resource' };
      }
      const { id } = request.params;

      const deletedTask = await tasksRepository.deleteWithOwnershipCheck(id, session.userId);

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
