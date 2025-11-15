import { type Static, Type } from '@sinclair/typebox';

import { DateTimeSchema, IdSchema, StringSchema } from './common.js';

// Valid task states
export const TaskStatusEnum = {
  New: 'new',
  InProgress: 'in-progress',
  OnHold: 'on-hold',
  Completed: 'completed',
  Canceled: 'canceled',
  Archived: 'archived',
} as const; // to allow typeof to infer literal types e.g 'new','in-progress' and not 'string'

// returns "new" | "in-progress" | "on-hold" | "completed" | "canceled" | "archived"
// indexed access types used: T[K]
export type TaskStatusType = (typeof TaskStatusEnum)[keyof typeof TaskStatusEnum];

// Static converts a Typebox Schema into a regular TypeScript type
export interface Task extends Static<typeof TaskSchema> {
  filename?: string | null;
}

const TaskStatusSchema = Type.Union([
  Type.Literal('new'),
  Type.Literal('in-progress'),
  Type.Literal('on-hold'),
  Type.Literal('completed'),
  Type.Literal('canceled'),
  Type.Literal('archived'),
]);

// Full task structure
export const TaskSchema = Type.Object({
  id: IdSchema,
  title: StringSchema,
  description: StringSchema,
  author_id: IdSchema,
  assigned_user_id: Type.Optional(IdSchema),
  status: TaskStatusSchema,
  created_at: DateTimeSchema,
  updated_at: DateTimeSchema,
});

// Input validation for new tasks (only name and optional assigned_user_id)
export const CreateTaskSchema = Type.Object({
  title: StringSchema,
  description: StringSchema,
  assigned_user_id: Type.Optional(IdSchema),
});

// update validation
export const UpdateTaskSchema = Type.Object({
  title: Type.Optional(StringSchema),
  description: Type.Optional(StringSchema),
  author_id: Type.Optional(IdSchema),
  assigned_user_id: Type.Optional(IdSchema),
  status: Type.Optional(TaskStatusSchema),
});

// Search and pagination parameters
export const QueryTaskPaginationSchema = Type.Object({
  page: Type.Integer({ minimum: 1, default: 1 }),
  limit: Type.Integer({ minimum: 1, maximum: 100, default: 10 }),
  author_id: Type.Optional(IdSchema),
  assigned_user_id: Type.Optional(IdSchema),
  status: Type.Optional(TaskStatusSchema),
  order: Type.Union([Type.Literal('asc'), Type.Literal('desc')], { default: 'desc' }),
});

export const TaskPaginationResultSchema = Type.Object({
  total: Type.Integer({ minimum: 0, default: 0 }),
  tasks: Type.Array(TaskSchema),
});
