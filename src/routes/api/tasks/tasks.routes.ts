import {
  CreateTaskSchema,
  QueryTaskPaginationSchema,
  TaskPaginationResultSchema,
  TaskSchema,
  UpdateTaskSchema,
} from '../../../schemas/tasks.js';
import {
  canAssignTaskTo,
  canAssignTasks,
  canManageTasks,
} from '../../../utils/task-authorization.js';
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

      //
      const canAssign = await canAssignTaskTo(
        fastify,
        session.userId,
        request.body.assigned_user_id,
      );

      if (!canAssign) {
        reply.code(403);
        return { error: 'Regular users can only assign tasks to themselves' };
      }

      const id = await tasksRepository.create({
        title: request.body.title,
        description: request.body.description,
        assigned_user_id: request.body.assigned_user_id,
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
        return { error: "You don't have permission to access this resource" };
      }

      const { id } = request.params;

      // Fetch task to check ownership
      const task = await tasksRepository.findById(id);
      if (!task) {
        reply.code(404);
        return { message: 'Task not found' };
      }

      // Check ownership for non-admins
      // Users with manage permission can update all tasks
      const canUpdateAll = await canManageTasks(fastify, session.userId);

      if (
        !canUpdateAll &&
        task.author_id !== session.userId &&
        task.assigned_user_id !== session.userId
      ) {
        reply.code(403);
        return { error: "You don't have permission to access this resource" };
      }

      // Validate assignment changes if assigned_user_id is being updated
      if (request.body.assigned_user_id !== undefined) {
        const canAssign = await canAssignTaskTo(
          fastify,
          session.userId,
          request.body.assigned_user_id,
        );

        if (!canAssign) {
          reply.code(403);
          return { error: 'Regular users can only assign tasks to themselves' };
        }
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
            task: ['delete'],
          },
        },
      });

      if (!hasPermission.success) {
        reply.code(403);
        return { error: "You don't have permission to access this resource" };
      }

      const { id } = request.params;

      // Fetch task to check ownership
      const task = await tasksRepository.findById(id);
      if (!task) {
        reply.code(404);
        return { message: 'Task not found' };
      }

      // Check ownership for non-admins
      // Users with manage permission can delete all tasks
      const canDeleteAll = await canManageTasks(fastify, session.userId);

      if (
        !canDeleteAll &&
        task.author_id !== session.userId &&
        task.assigned_user_id !== session.userId
      ) {
        reply.code(403);
        return { error: "You don't have permission to access this resource" };
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
    handler: async function (request, reply) {
      const { session } = request;
      if (!session) {
        reply.code(401);
        return { error: 'You must be logged in to access this resource' };
      }

      // Check assign permission (moderators and admins)
      // Both 'assign' and 'manage' permissions allow task assignment
      const canAssign = await canAssignTasks(fastify, session.userId);

      if (!canAssign) {
        reply.code(403);
        return { error: "You don't have permission to access this resource" };
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
