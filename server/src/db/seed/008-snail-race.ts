import { db } from "../connection.ts";
import { and, eq } from "drizzle-orm";
import {
  modules,
  moduleToFile,
  starterFiles,
} from "../schema/module-schema.ts";

const snailRaceText = `# The Great Snail Race

If you know enough Python, you can make snails sprint.`;

export async function run() {
  console.log("Seeding database...");

  await db
    .insert(modules)
    .values([
      {
        slug: "snail-race",
        name: "The Great Snail Race",
        instructions: [
          {
            text: snailRaceText,
          },
        ],
      },
    ])
    .onConflictDoNothing();

  const modulesInsert = [
    (
      await db
        .select()
        .from(modules)
        .where(eq(modules.slug, "snail-race"))
        .limit(1)
    )[0],
  ];

  await Promise.all(
    modulesInsert.map(async (mod) => {
      if (!mod) return;

      if (mod.slug === "snail-race") {
        let { fileId: file1ID } =
          (
            await db
              .select({ fileId: starterFiles.id })
              .from(starterFiles)
              .leftJoin(moduleToFile, eq(starterFiles.id, moduleToFile.fileId))
              .where(
                and(
                  eq(starterFiles.name, "snail_race.py"),
                  eq(moduleToFile.moduleId, mod.id),
                ),
              )
              .limit(1)
          )[0] || {};
        if (!file1ID) {
          const r = await db
            .insert(starterFiles)
            .values({
              name: "snail_race.py",
              content: "",
            })
            .returning()
            .then((r) => r[0]);

          file1ID = r.id;
        }

        await db
          .insert(moduleToFile)
          .values({
            moduleId: mod.id,
            fileId: file1ID,
            sortOrder: 0,
            isEntryPoint: true,
            isActive: true,
          })
          .onConflictDoNothing();
      }
    })
  );

  console.log("Seeding completed.");
  Deno.exit();
}