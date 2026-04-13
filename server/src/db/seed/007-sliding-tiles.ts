import { db } from "../connection.ts";
import { and, eq } from "drizzle-orm";
import {
  modules,
  moduleToFile,
  starterFiles,
} from "../schema/module-schema.ts";

const slidingTilesText = `# Sliding Tiles

A classic puzzle game where you arrange numbered tiles in order by sliding them into an empty space.`;

export async function run() {
  console.log("Seeding database...");

  await db
    .insert(modules)
    .values([
      {
        slug: "sliding-tiles",
        name: "Sliding Tiles",
        instructions: [
          {
            text: slidingTilesText,
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
        .where(eq(modules.slug, "sliding-tiles"))
        .limit(1)
    )[0],
  ];

  await Promise.all(
    modulesInsert.map(async (mod) => {
      if (!mod) return;

      if (mod.slug === "sliding-tiles") {
        let { fileId: file1ID } =
          (
            await db
              .select({ fileId: starterFiles.id })
              .from(starterFiles)
              .leftJoin(moduleToFile, eq(starterFiles.id, moduleToFile.fileId))
              .where(
                and(
                  eq(starterFiles.name, "game.py"),
                  eq(moduleToFile.moduleId, mod.id),
                ),
              )
              .limit(1)
          )[0] || {};
        let { fileId: file2ID } =
          (
            await db
              .select({ fileId: starterFiles.id })
              .from(starterFiles)
              .leftJoin(moduleToFile, eq(starterFiles.id, moduleToFile.fileId))
              .where(
                and(
                  eq(starterFiles.name, "utils.py"),
                  eq(moduleToFile.moduleId, mod.id),
                ),
              )
              .limit(1)
          )[0] || {};
        if (!file1ID) {
          const r = await db
            .insert(starterFiles)
            .values({
              name: "game.py",
              content: "",
            })
            .returning()
            .then((r) => r[0]);

          file1ID = r.id;
        }
        if (!file2ID) {
          const r = await db
            .insert(starterFiles)
            .values({
              name: "utils.py",
              content: `def printInstructions():
    print("""Use the WASD keys to move the tiles
    back into their original order:
           1   2   3   4
           5   6   7   8
           9   10  11  12
           13  14  15   """)


def displayBoard(board):
    """Display the given board on the screen."""
    labels = [
        board[0][0],
        board[0][1],
        board[0][2],
        board[0][3],
        board[1][0],
        board[1][1],
        board[1][2],
        board[1][3],
        board[2][0],
        board[2][1],
        board[2][2],
        board[2][3],
        board[3][0],
        board[3][1],
        board[3][2],
        board[3][3],
    ]
    boardToDraw = """
+------+------+------+------+
|      |      |      |      |
|  {}  |  {}  |  {}  |  {}  |
|      |      |      |      |
+------+------+------+------+
|      |      |      |      |
|  {}  |  {}  |  {}  |  {}  |
|      |      |      |      |
+------+------+------+------+
|      |      |      |      |
|  {}  |  {}  |  {}  |  {}  |
|      |      |      |      |
+------+------+------+------+
|      |      |      |      |
|  {}  |  {}  |  {}  |  {}  |
|      |      |      |      |
+------+------+------+------+
""".format(*labels)
    print(boardToDraw)
`,
            })
            .returning()
            .then((r) => r[0]);

          file2ID = r.id;
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
        await db
          .insert(moduleToFile)
          .values({
            moduleId: mod.id,
            fileId: file2ID,
            sortOrder: 1,
            isEntryPoint: false,
            isActive: false,
          })
          .onConflictDoNothing();
      }
    })
  );

  console.log("Seeding completed.");
  Deno.exit();
}