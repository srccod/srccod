import { relations, sql } from "drizzle-orm";
import {
  pgSchema,
  text,
  timestamp,
  jsonb,
  uuid,
  integer,
  boolean,
  primaryKey,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema.ts";
import { Instruction } from "../../shared-types.ts";

export const modulesSchema = pgSchema("modules");

export const modules = modulesSchema.table("modules", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  instructions: jsonb("instructions")
    .$type<Instruction[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  visible: boolean("visible").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const starterFiles = modulesSchema.table("starter_files", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const userFiles = modulesSchema.table(
  "user_files",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    fileId: uuid("id")
      .notNull()
      .references(() => starterFiles.id, { onDelete: "cascade" }),
    name: text("name"),
    content: text("content"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.fileId] })],
);

export const moduleToFile = modulesSchema.table(
  "module_to_file",
  {
    moduleId: uuid("module_id")
      .notNull()
      .references(() => modules.id, { onDelete: "cascade" }),
    fileId: uuid("file_id")
      .notNull()
      .references(() => starterFiles.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
    isEntryPoint: boolean("is_entry_point").notNull().default(false),
    isActive: boolean("is_active").notNull().default(false),
  },
  (table) => [primaryKey({ columns: [table.moduleId, table.fileId] })],
);

export const userModules = modulesSchema.table("user_modules", {
  id: uuid("id").primaryKey().defaultRandom(),
  moduleId: uuid("module_id")
    .notNull()
    .references(() => modules.id, { onDelete: "cascade" }),
  files: jsonb("files").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const moduleRelations = relations(modules, ({ many }) => ({
  starterFiles: many(moduleToFile),
  userModules: many(userModules),
  userFiles: many(userFiles),
}));

export const starterFileRelations = relations(starterFiles, ({ many }) => ({
  moduleToFiles: many(moduleToFile),
  userFiles: many(userFiles),
}));

export const moduleToFileRelations = relations(moduleToFile, ({ one }) => ({
  module: one(modules, {
    fields: [moduleToFile.moduleId],
    references: [modules.id],
  }),
  file: one(starterFiles, {
    fields: [moduleToFile.fileId],
    references: [starterFiles.id],
  }),
}));

export const userFilesRelations = relations(userFiles, ({ one }) => ({
  user: one(user, {
    fields: [userFiles.userId],
    references: [user.id],
  }),
  file: one(starterFiles, {
    fields: [userFiles.fileId],
    references: [starterFiles.id],
  }),
}));
