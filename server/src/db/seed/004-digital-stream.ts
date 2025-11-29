import { db } from "../connection.ts";
import { eq } from "drizzle-orm";
import {
  modules,
  moduleToFile,
  starterFiles,
} from "../schema/module-schema.ts";

const digital_stream_text = `# Digital Stream

Build a program to randomly generate a stream of 0s and 1s. Change the constants and see how it affects the stream.
`;

const digital_stream_py = `import random, time

# Set up the constants:
MIN_STREAM_LENGTH = 6  # try changing this to 1 or 50.
MAX_STREAM_LENGTH = 14  # try changing this to 100.
PAUSE = 0.1  # try changing this to 0.0 or 2.0.
STREAM_CHARS = ['0', '1']  # try changing this to other characters.

# Density can range from 0.0 to 1.0:
DENSITY = 0.02  # try changing this to 0.10 or 0.30.

# Set the width of the stream:
WIDTH = 80`;

export async function run() {
  console.log("Seeding database...");

  // Insert modules but ignore if the slug already exists.
  await db
    .insert(modules)
    .values([
      {
        slug: "digital-stream",
        name: "Digital Stream",
        instructions: [
          {
            text: digital_stream_text,
          },
        ],
      },
    ])
    .onConflictDoNothing();

  // Now fetch the modules (whether newly created or pre-existing).
  const modulesInsert = [
    (
      await db
        .select()
        .from(modules)
        .where(eq(modules.slug, "digital-stream"))
        .limit(1)
    )[0],
  ];

  await Promise.all(
    modulesInsert.map(async (mod) => {
      if (!mod) return;

      if (mod.slug === "digital-stream") {
        // Ensure a starter file exists with this name. Try to find first to avoid duplicates.
        let file1 = (
          await db
            .select()
            .from(starterFiles)
            .where(eq(starterFiles.name, "digital_stream.py"))
            .limit(1)
        )[0];
        if (!file1) {
          file1 = await db
            .insert(starterFiles)
            .values({
              name: "digital_stream.py",
              content: digital_stream_py,
            })
            .returning()
            .then((r) => r[0]);
        }

        // Link module to file, but ignore if the (moduleId,fileId) PK already exists.
        await db
          .insert(moduleToFile)
          .values([
            {
              moduleId: mod.id,
              fileId: file1.id,
              sortOrder: 0,
              isEntryPoint: true,
              isActive: true,
            },
          ])
          .onConflictDoNothing();
      }
    }),
  );

  console.log("Seeding completed.");
}
