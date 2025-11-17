import type {
  AdminQueryTaskPaginationSchema,
  AdminUpdateTaskSchema,
  CreateTaskSchema,
  Task,
} from '../../schemas/tasks.js';
import type { ReturnType, Static } from '@sinclair/typebox';
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import type { PoolClient } from 'pg';

declare module 'fastify' {
  export interface FastifyInstance {
    tasksRepository: ReturnType<typeof createRepository>;
  }
}

// Derived Types
type CreateTask = Static<typeof CreateTaskSchema> & { author_id: string };
type TaskQuery = Static<typeof AdminQueryTaskPaginationSchema>;
type UpdateTask = Static<typeof AdminUpdateTaskSchema>;
export type UploadTask = CreateTask & { status?: string };

function createRepository(fastify: FastifyInstance) {
  return {
    async create(newTask: CreateTask) {
      const client = await fastify.pg.connect();

      try {
        const result = await client.query<{ id: number }>(
          `INSERT INTO tasks (title, description, assigned_user_id, author_id, status, created_at, updated_at)
           VALUES ($1, $2, $3, $4, 'new', NOW(), NOW())
           RETURNING id`,
          [
            newTask.title,
            newTask.description,
            newTask.assigned_user_id ?? newTask.author_id,
            newTask.author_id,
          ],
        );
        return result.rows[0].id;
      } finally {
        client.release();
      }
    },

    async createMany(newTasks: UploadTask[]) {
      if (newTasks.length === 0) return [];

      const client = await fastify.pg.connect();

      try {
        const values = newTasks
          .map((_, index) => {
            const baseIndex = index * 5 + 1;
            return `($${baseIndex}, $${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, NOW(), NOW())`;
          })
          .join(', ');

        const params = newTasks.flatMap((task) => [
          task.title,
          task.description,
          task.assigned_user_id ?? task.author_id,
          task.author_id,
          task.status ?? 'new',
        ]);

        const result = await client.query<{ id: number }>(
          `INSERT INTO tasks (title, description, assigned_user_id, author_id, status, created_at, updated_at)
           VALUES ${values}
           RETURNING id`,
          params,
        );

        return result.rows.map((row) => row.id);
      } finally {
        client.release();
      }
    },

    // client added to allow reusing if called from an existing transaction
    async findById(id: number, databaseClient?: PoolClient): Promise<Task | null> {
      const shouldRelease = !databaseClient;

      const client = databaseClient ?? (await fastify.pg.connect());

      try {
        const result = await client.query<Task>('SELECT * FROM tasks WHERE id = $1', [id]);
        return result.rows[0] ?? null; // result.rows[0] returns a row || undefined
      } finally {
        if (shouldRelease) {
          client.release();
        }
      }
    },

    async paginate(q: TaskQuery) {
      // console.log('🎃', JSON.stringify(q), '🫠');
      const offset = (q.page - 1) * q.limit;
      const client = await fastify.pg.connect();

      try {
        // Build dynamic WHERE clause for db query
        const whereConditions: string[] = [];
        const queryParams: Array<string | number> = [];
        let paramIndex = 1;

        // add author_id filter
        if (q.author_id !== undefined) {
          whereConditions.push(`author_id = $${paramIndex}`);
          queryParams.push(q.author_id);
          paramIndex += 1;
        }

        // add assigned_user_id filter
        if (q.assigned_user_id !== undefined) {
          whereConditions.push(`assigned_user_id = $${paramIndex}`);
          queryParams.push(q.assigned_user_id);
          paramIndex += 1;
        }

        if (q.status !== undefined) {
          whereConditions.push(`status = $${paramIndex}`);
          queryParams.push(q.status);
          paramIndex += 1;
        }

        queryParams.push(q.limit, offset);

        const whereClause =
          whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

        const query = `
          SELECT *, COUNT(*) OVER() as total
          FROM tasks
          ${whereClause}
          ORDER BY created_at ${q.order}
          LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `;

        // total returned on every row, so taking it from first row
        // more efficient than tow separate queries
        const result = await client.query<Task & { total: string }>(query, queryParams);

        return {
          tasks: result.rows,
          // handle situation where no rows are returned
          total: Number(result.rows[0]?.total) || 0,
        };
      } finally {
        client.release();
      }
    },

    async update(id: number, changes: UpdateTask, databaseClient?: PoolClient) {
      const shouldRelease = !databaseClient;

      const client = databaseClient ?? (await fastify.pg.connect());

      try {
        const setClauses: string[] = [];
        const queryParams: Array<string | number> = [];
        let paramIndex = 1;

        if (changes.title !== undefined) {
          setClauses.push(`title = $${paramIndex}`);
          queryParams.push(changes.title);
          paramIndex += 1;
        }

        if (changes.description !== undefined) {
          setClauses.push(`description = $${paramIndex}`);
          queryParams.push(changes.description);
          paramIndex += 1;
        }

        if (changes.assigned_user_id !== undefined) {
          setClauses.push(`assigned_user_id = $${paramIndex}`);
          queryParams.push(changes.assigned_user_id);
          paramIndex += 1;
        }

        if (changes.author_id !== undefined) {
          setClauses.push(`author_id = $${paramIndex}`);
          queryParams.push(changes.author_id);
          paramIndex += 1;
        }

        if (changes.status !== undefined) {
          setClauses.push(`status = $${paramIndex}`);
          queryParams.push(changes.status);
          paramIndex += 1;
        }

        if (setClauses.length === 0) {
          return await this.findById(id, databaseClient);
        }

        setClauses.push(`updated_at = NOW()`);
        queryParams.push(id);

        const query = `
          UPDATE tasks
          SET ${setClauses.join(', ')}
          WHERE id = $${paramIndex}
          `;

        const result = await client.query(query, queryParams);

        if (result.rowCount === 0) {
          return null;
        }

        return await this.findById(id, databaseClient);
      } finally {
        if (shouldRelease) {
          client.release();
        }
      }
    },

    async updateWithOwnershipCheck(
      id: number,
      userId: string,
      changes: UpdateTask,
    ): Promise<Task | null> {
      const client = await fastify.pg.connect();

      try {
        const setClauses: string[] = [];
        const queryParams: Array<string | number> = [];
        let paramIndex = 1;

        // Build SET clauses
        if (changes.title !== undefined) {
          setClauses.push(`title = $${paramIndex}`);
          queryParams.push(changes.title);
          paramIndex += 1;
        }

        if (changes.description !== undefined) {
          setClauses.push(`description = $${paramIndex}`);
          queryParams.push(changes.description);
          paramIndex += 1;
        }

        if (changes.status !== undefined) {
          setClauses.push(`status = $${paramIndex}`);
          queryParams.push(changes.status);
          paramIndex += 1;
        }

        // Edge case: If no fields to update, just verify ownership and return existing task
        if (setClauses.length === 0) {
          const task = await this.findById(id, client);
          // Return task only if user owns it or is assigned to it
          return task?.author_id === userId || task?.assigned_user_id === userId ? task : null;
        }

        // Update timestamp
        setClauses.push(`updated_at = NOW()`);
        // Add WHERE clause parameters
        queryParams.push(id, userId, userId);

        // one query, to check ownership, update task and return updated task immediately, instead of three queries.
        const query = `
          UPDATE tasks
          SET ${setClauses.join(', ')}
          WHERE id = $${paramIndex} 
          AND (author_id = $${paramIndex + 1} OR assigned_user_id = $${paramIndex + 2})
          RETURNING *
        `;

        const result = await client.query<Task>(query, queryParams);
        // Returns null if either: (attackers cant discover which task IDs exist)
        // - Task doesn't exist, OR
        // - User doesn't own/isn't assigned to the task
        return result.rows[0] ?? null;
      } finally {
        client.release();
      }
    },

    async delete(id: number) {
      const client = await fastify.pg.connect();

      try {
        const result = await client.query('DELETE FROM tasks WHERE id = $1', [id]);
        return (result.rowCount ?? 0) > 0;
      } finally {
        client.release();
      }
    },
  };
}

export default fp(
  function (fastify) {
    fastify.decorate('tasksRepository', createRepository(fastify));
  },
  {
    name: 'tasks-repository',
    dependencies: ['postgres-connector'],
  },
);
