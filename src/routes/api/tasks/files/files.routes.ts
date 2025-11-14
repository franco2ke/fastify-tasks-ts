import type { UploadTask } from '../../../../plugins/tasks/tasks-repository.js';
import { QueryTaskPaginationSchema } from '../../../../schemas/tasks.js';
import fastifyMultipart, { type MultipartFile } from '@fastify/multipart';
import { type FastifyPluginAsyncTypebox, Type } from '@fastify/type-provider-typebox';
import { parse as csvParse } from 'csv-parse';
import { stringify as csvStringify } from 'csv-stringify';
import { Readable } from 'node:stream';

// Type for CSV row data
interface CSVRow {
  title: string;
  description: string;
  status?: string;
}

// Extend MultipartFile interface to include parsed CSV data
interface CustomMultipartFile extends MultipartFile {
  value?: Array<Omit<UploadTask, 'author_id'>>;
}

// import { stringify as csvStringify } from 'csv-stringify';

const fileTasksRoutes: FastifyPluginAsyncTypebox = async function (fastify, _opts) {
  // use multipart to provide access to the lines array created from request.body.todoListFile
  await fastify.register(fastifyMultipart, {
    // add only keyValues to body not entire parsed multipart object
    attachFieldsToBody: 'keyValues',
    // file processing on receiving uploaded file
    onFile: async function (uploadedFile: CustomMultipartFile) {
      const rows: CSVRow[] = [];

      const parser = uploadedFile.file.pipe(
        csvParse<CSVRow>({
          bom: true,
          skip_empty_lines: true,
          trim: true,
          columns: true,
        }),
      );

      // BUG
      // TypeScript doesnt know the exact type of objects coming from the loop (async iterator)
      // Even though the parser is typed the (for... await ... of) loop loses that type information
      for await (const row of parser as AsyncIterable<CSVRow>) {
        rows.push({
          title: row.title,
          description: row.description,
          status: row.status,
        });
      }

      Object.assign(uploadedFile, { value: rows });
    },
    // prevent abouse by limiting file sizes and numbers of uploads
    limits: {
      fieldNameSize: 50,
      fieldSize: 255,
      fields: 10,
      fileSize: 1_000_000,
      files: 1,
    },
  });

  // upload multiple Tasks as .csv file
  fastify.route({
    method: 'POST',
    url: '/import',
    schema: {
      body: Type.Object(
        {
          taskListFile: Type.Array(
            Type.Object({
              title: Type.String(),
              description: Type.String(),
              status: Type.Optional(Type.String()),
            }),
          ),
        },
        {
          description:
            'Import a tasks list from a CSV file with the following format: title, description, status',
        },
      ),
      response: {
        201: Type.Array(
          Type.Object({
            id: Type.Integer(),
          }),
        ),
        400: Type.Object({
          error: Type.String(),
        }),
        401: Type.Object({
          error: Type.String(),
        }),
        403: Type.Object({
          error: Type.String(),
        }),
        500: Type.Object({
          error: Type.String(),
        }),
      },
      tags: ['Task Imports & Exports'],
    },
    onRequest: [fastify.authenticate.bind(fastify)],
    handler: async function createTasks(request, reply) {
      const { session } = request;
      // Early null check, as TS cannot infer that the authentication hook guarantees session will be there
      if (!session) {
        reply.code(401);
        return { error: 'Authentication required' };
      }

      // Check import permission
      const hasPermission = await fastify.auth.api.userHasPermission({
        body: {
          userId: session.userId,
          permissions: {
            task: ['import'],
          },
        },
      });

      if (!hasPermission.success) {
        reply.code(403);
        return { error: 'Forbidden' };
      }

      const parsedTasks = request.body.taskListFile;

      if (parsedTasks.length === 0) {
        reply.code(400);
        return { error: 'Empty CSV file uploaded, Upload a populated file' };
      }

      // Users can only import tasks for themselves (security: scoped to own account)
      const normalizedTasks: UploadTask[] = parsedTasks.map((task) => ({
        ...task,
        author_id: session.userId,
        assigned_user_id: session.userId,
      }));
      // console.log(JSON.stringify(normalizedTasks));

      const createdTaskIds = await fastify.tasksRepository.createMany(normalizedTasks);
      reply.code(201);
      return createdTaskIds.map((id) => ({ id }));
    },
  });

  // Download tasks as .csv
  fastify.route({
    method: 'GET',
    url: '/export',
    schema: {
      querystring: QueryTaskPaginationSchema,
      tags: ['Task Imports & Exports'],
    },
    onRequest: [fastify.authenticate.bind(fastify)],
    handler: async function exportTasks(request, reply) {
      const { session } = request;
      if (!session) {
        reply.code(401);
        return { error: 'Authentication required' };
      }

      // Check export permission
      const hasPermission = await fastify.auth.api.userHasPermission({
        body: {
          userId: session.userId,
          permissions: {
            task: ['export'],
          },
        },
      });

      if (!hasPermission.success) {
        reply.code(403);
        return { error: 'Forbidden' };
      }

      // Check if user can export all tasks (moderators/admins)
      const canExportAll = await fastify.auth.api.userHasPermission({
        body: {
          userId: session.userId,
          permissions: {
            task: ['assign'], // Moderators/admins have assign permission
          },
        },
      });

      // Filter by ownership for regular users
      const queryFilters = canExportAll.success
        ? request.query
        : {
            ...request.query,
            author_id: session.userId,
            assigned_user_id: session.userId,
          };

      const { tasks } = await this.tasksRepository.paginate({
        ...queryFilters,
        page: request.query.page ?? 1,
        limit: request.query.limit ?? 10,
        order: request.query.order ?? 'desc',
      });

      // Create readable stream from tasks array
      const tasksStream = Readable.from(tasks);

      // Set response headers for CSV download
      reply.header('content-disposition', 'attachment; filename="task-list.csv"');
      reply.type('text/csv');

      // Pipe tasks through CSV stringifier and return the stream
      return tasksStream.pipe(
        csvStringify({
          header: true,
          columns: [
            'id',
            'title',
            'description',
            'status',
            'author_id',
            'assigned_user_id',
            'created_at',
            'updated_at',
          ],
          cast: {
            date: (value) => value.toISOString(),
          },
        }),
      );
    },
  });
};

export default fileTasksRoutes;
