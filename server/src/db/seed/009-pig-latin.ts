import { db } from "../connection.ts";
import { and, eq } from "drizzle-orm";
import {
  modules,
  moduleToFile,
  starterFiles,
} from "../schema/module-schema.ts";

const pigLatinText = `# igPay atinLay

Build a Pig Latin translator. To convert a word to Pig Latin, follow these rules:
- If a word starts with a vowel, add "yay" to the end.
- If a word starts with one or more consonants, move the first consonant cluster to the end and add "ay".`;

export async function run() {
  console.log("Seeding database...");

  await db
    .insert(modules)
    .values([
      {
        slug: "pig-latin",
        name: "igPay atinLay",
        instructions: [
          {
            text: pigLatinText,
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
        .where(eq(modules.slug, "pig-latin"))
        .limit(1)
    )[0],
  ];

  await Promise.all(
    modulesInsert.map(async (mod) => {
      if (!mod) return;

      if (mod.slug === "pig-latin") {
        let { fileId: file1ID } =
          (
            await db
              .select({ fileId: starterFiles.id })
              .from(starterFiles)
              .leftJoin(moduleToFile, eq(starterFiles.id, moduleToFile.fileId))
              .where(
                and(
                  eq(starterFiles.name, "pig_latin.py"),
                  eq(moduleToFile.moduleId, mod.id),
                ),
              )
              .limit(1)
          )[0] || {};
        if (!file1ID) {
          const r = await db
            .insert(starterFiles)
            .values({
              name: "pig_latin.py",
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
    }),
  );

  console.log("Seeding completed.");
  Deno.exit();
}
