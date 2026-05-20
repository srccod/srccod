import { db } from "../connection.ts";
import { and, eq } from "drizzle-orm";
import {
  modules,
  moduleToFile,
  starterFiles,
} from "../schema/module-schema.ts";

const etchDrawText = `# Etch Draw

Build an Etch-a-Sketch style drawing app.`;

const charsContent = `UP_DOWN         = chr(9474)  # Character 9474 is '│'
LEFT_RIGHT      = chr(9472)  # Character 9472 is '─'
DOWN_RIGHT      = chr(9484)  # Character 9484 is '┌'
DOWN_LEFT       = chr(9488)  # Character 9488 is '┐'
UP_RIGHT        = chr(9492)  # Character 9492 is '└'
UP_LEFT         = chr(9496)  # Character 9496 is '┘'
UP_DOWN_RIGHT   = chr(9500)  # Character 9500 is '├'
UP_DOWN_LEFT    = chr(9508)  # Character 9508 is '┤'
DOWN_LEFT_RIGHT = chr(9516)  # Character 9516 is '┬'
UP_LEFT_RIGHT   = chr(9524)  # Character 9524 is '┴'
CROSS           = chr(9532)  # Character 9532 is '┼'
`;

export async function run() {
  console.log("Seeding database...");

  await db
    .insert(modules)
    .values([
      {
        slug: "etch-draw",
        name: "Etch Draw",
        instructions: [
          {
            text: etchDrawText,
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
        .where(eq(modules.slug, "etch-draw"))
        .limit(1)
    )[0],
  ];

  await Promise.all(
    modulesInsert.map(async (mod) => {
      if (!mod) return;

      if (mod.slug === "etch-draw") {
        const files = [
          { name: "draw.py", content: "", sortOrder: 0, isEntryPoint: true },
          {
            name: "CHARS.py",
            content: charsContent,
            sortOrder: 1,
            isEntryPoint: false,
          },
          { name: "pic.txt", content: "", sortOrder: 2, isEntryPoint: false },
        ];

        for (const file of files) {
          let { fileId } =
            (
              await db
                .select({ fileId: starterFiles.id })
                .from(starterFiles)
                .leftJoin(
                  moduleToFile,
                  eq(starterFiles.id, moduleToFile.fileId),
                )
                .where(
                  and(
                    eq(starterFiles.name, file.name),
                    eq(moduleToFile.moduleId, mod.id),
                  ),
                )
                .limit(1)
            )[0] || {};

          if (!fileId) {
            const r = await db
              .insert(starterFiles)
              .values({
                name: file.name,
                content: file.content,
              })
              .returning()
              .then((r) => r[0]);

            fileId = r.id;
          }

          await db
            .insert(moduleToFile)
            .values({
              moduleId: mod.id,
              fileId: fileId,
              sortOrder: file.sortOrder,
              isEntryPoint: file.isEntryPoint,
              isActive: true,
            })
            .onConflictDoNothing();
        }
      }
    }),
  );

  console.log("Seeding completed.");
  Deno.exit();
}
