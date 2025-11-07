import {
  CreateTaskSchema,
  QueryTaskPaginationSchema,
  TaskPaginationResultSchema,
  TaskSchema,
  UpdateTaskSchema,
} from '../../../schemas/tasks.js';
import { type FastifyPluginCallbackTypebox, Type } from '@fastify/type-provider-typebox';

const plugin: FastifyPluginCallbackTypebox = (fastify, _opts, done) => {
  // NOTE: Create Task Route
  const { tasksRepository } = fastify;
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
    onRequest: [fastify.authenticate.bind(fastify)],
    handler: async function (request, reply) {
      if (!request.session) {
        reply.code(401);
        return { error: 'Unauthorized' };
      }

      // Check permission
      const hasPermission = await fastify.auth.api.userHasPermission({
        body: {
          userId: request.session.userId,
          permissions: {
            task: ['create'],
          },
        },
      });

      // console.log('😇', 'the user has permissions to create tasks', '🤓');

      if (!hasPermission.success) {
        reply.code(403);
        return { error: 'Forbidden' };
      }

      if (request.body.title === undefined || request.body.description === undefined) {
        reply.code(400);
        return { error: 'Incorrect task information, fill title / description fields' };
      }

      const id = await tasksRepository.create({
        title: request.body.title,
        description: request.body.description,
        assigned_user_id: request.body.assigned_user_id,
        author_id: request.session.userId,
      });

      reply.code(201);

      return { id };
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
    onRequest: [fastify.authenticate.bind(fastify)],
    handler: async function (request, reply) {
      const { session } = request;
      if (!session) {
        reply.code(401);
        return { error: 'Unauthorized' };
      }

      // Check permission
      const hasPermission = await fastify.auth.api.userHasPermission({
        body: {
          userId: session.userId,
          permissions: {
            task: ['read'],
          },
        },
      });

      if (!hasPermission.success) {
        reply.code(403);
        return { error: 'Forbidden' };
      }

      const { id } = request.params;

      const task = await tasksRepository.findById(id);
      if (!task) {
        reply.code(404);
        return { message: 'Task not found' };
      }

      // Check ownership for non-privileged users
      const canReadAll = await fastify.auth.api.userHasPermission({
        body: {
          userId: session.userId,
          permissions: {
            task: ['assign'], // Moderators/admins have assign permission
          },
        },
      });

      if (
        !canReadAll.success &&
        task.author_id !== session.userId &&
        task.assigned_user_id !== session.userId
      ) {
        reply.code(403);
        return { error: 'Forbidden' };
      }

      return task;
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
    onRequest: [fastify.authenticate.bind(fastify)],
    handler: async function (request, reply) {
      const { session } = request;
      if (!session) {
        reply.code(401);
        return { error: 'Unauthorized' };
      }

      // Check permission
      const hasPermission = await fastify.auth.api.userHasPermission({
        body: {
          userId: session.userId,
          permissions: {
            task: ['read'],
          },
        },
      });

      if (!hasPermission.success) {
        reply.code(403);
        return { error: 'Forbidden' };
      }

      // Check if user can read all tasks (moderators/admins)
      const canReadAll = await fastify.auth.api.userHasPermission({
        body: {
          userId: session.userId,
          permissions: {
            task: ['assign'], // Moderators/admins have assign permission
          },
        },
      });

      // Filter by ownership for regular users
      const queryFilters = canReadAll.success
        ? request.query
        : {
            ...request.query,
            author_id: request.query.author_id ?? session.userId,
            assigned_user_id: request.query.assigned_user_id ?? session.userId,
          };

      return await tasksRepository.paginate({
        ...queryFilters,
        page: request.query.page ?? 1,
        limit: request.query.limit ?? 10,
        order: request.query.order ?? 'desc',
      });
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
    onRequest: [fastify.authenticate.bind(fastify)],
    handler: async function (request, reply) {
      const { session } = request;
      if (!session) {
        reply.code(401);
        return { error: 'Unauthorized' };
      }

      // Check permission
      const hasPermission = await fastify.auth.api.userHasPermission({
        body: {
          userId: session.userId,
          permissions: {
            task: ['update'],
          },
        },
      });

      if (!hasPermission.success) {
        reply.code(403);
        return { error: 'Forbidden' };
      }

      const { id } = request.params;

      // Fetch task to check ownership
      const task = await tasksRepository.findById(id);
      if (!task) {
        reply.code(404);
        return { message: 'Task not found' };
      }

      // Check ownership for non-admins
      const canUpdateAll = await fastify.auth.api.userHasPermission({
        body: {
          userId: session.userId,
          permissions: {
            task: ['assign'], // Admins have assign permission, moderators shouldn't reach here
          },
        },
      });

      if (
        !canUpdateAll.success &&
        task.author_id !== session.userId &&
        task.assigned_user_id !== session.userId
      ) {
        reply.code(403);
        return { error: 'Forbidden' };
      }

      const updatedTask = await tasksRepository.update(id, request.body);

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
        204: Type.Null(),
        401: Type.Object({ error: Type.String() }),
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ message: Type.String() }),
      },
      tags: ['Tasks'],
    },
    onRequest: [fastify.authenticate.bind(fastify)],
    handler: async function (request, reply) {
      const { session } = request;
      if (!session) {
        reply.code(401);
        return { error: 'Unauthorized' };
      }

      // Check permission
      const hasPermission = await fastify.auth.api.userHasPermission({
        body: {
          userId: session.userId,
          permissions: {
            task: ['delete'],
          },
        },
      });

      if (!hasPermission.success) {
        reply.code(403);
        return { error: 'Forbidden' };
      }

      const { id } = request.params;

      // Fetch task to check ownership
      const task = await tasksRepository.findById(id);
      if (!task) {
        reply.code(404);
        return { message: 'Task not found' };
      }

      // Check ownership for non-admins
      const canDeleteAll = await fastify.auth.api.userHasPermission({
        body: {
          userId: session.userId,
          permissions: {
            task: ['assign'], // Admins have assign permission
          },
        },
      });

      if (
        !canDeleteAll.success &&
        task.author_id !== session.userId &&
        task.assigned_user_id !== session.userId
      ) {
        reply.code(403);
        return { error: 'Forbidden' };
      }

      const deleted = await tasksRepository.delete(id);

      if (!deleted) {
        reply.code(404);
        return { message: 'Task not found' };
      }

      reply.code(204);
      return null;
    },
  });

  // NOTE: Assign/Unassign Task Route (Moderator/Admin-only)
  fastify.post('/:id/assign', {
    schema: {
      params: Type.Object({
        id: Type.Number(),
      }),
      body: Type.Object({
        assigned_user_id: Type.Union([Type.String(), Type.Null()]),
      }),
      response: {
        200: TaskSchema,
        401: Type.Object({ error: Type.String() }),
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ message: Type.String() }),
      },
      tags: ['Tasks'],
    },
    onRequest: [fastify.authenticate.bind(fastify)],
    handler: async function (request, reply) {
      const { session } = request;
      if (!session) {
        reply.code(401);
        return { error: 'Authentication required' };
      }

      // Check assign permission (only moderators and admins)
      const hasPermission = await fastify.auth.api.userHasPermission({
        body: {
          userId: session.userId,
          permissions: {
            task: ['assign'],
          },
        },
      });

      if (!hasPermission.success) {
        reply.code(403);
        return { error: 'Moderator or admin access required' };
      }

      const { id } = request.params;
      const assignedUserId = request.body.assigned_user_id;

      const updatedTask = await tasksRepository.update(id, {
        assigned_user_id: assignedUserId ?? undefined,
      });

      if (!updatedTask) {
        reply.code(404);
        return { message: 'Task not found' };
      }

      return updatedTask;
    },
  });

  done();
};

export default plugin;
