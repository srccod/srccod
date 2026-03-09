import { db } from "../connection.ts";
import { eq } from "drizzle-orm";
import {
  modules,
  moduleToFile,
  starterFiles,
} from "../schema/module-schema.ts";

const averageListsText = `# Average List 
Write and function called \`average\`. It should: 
  - take one input, a list of integers. 
  - return the average of the integers in the list. 
  
You do not know in advance how long the list is. 
**Do NOT use Python's built-in \`sum\` function to solve the problem.**`;

const average_py = `from test import test_average

def average(nums):
    # TODO: replace pass with function logic
    pass


# Test your implementation
test_average(average)
`;

const test_py = `import random

def test_average(average_fn):
    """Test the average function with 20 random lists."""
    for _ in range(20):
        length = random.randint(1, 50)
        nums = [random.randint(-100, 100) for _ in range(length)]
        
        expected = sum(nums) / len(nums)
        result = average_fn(nums)
        
        if result != expected:
            print(f"Failed: average({nums}) = {result}, expected {expected}")
            return False
    
    print("passed all tests")
    return True


def test_median(median_fn):
    """Test the median function with 20 random lists."""
    for _ in range(20):
        length = random.randint(1, 50)
        nums = [random.randint(-100, 100) for _ in range(length)]
        
        sorted_nums = sorted(nums)
        mid = len(sorted_nums) // 2
        if len(sorted_nums) % 2 == 0:
            expected = (sorted_nums[mid - 1] + sorted_nums[mid]) / 2
        else:
            expected = sorted_nums[mid]
        
        result = median_fn(nums)
        
        if result != expected:
            print(f"Failed: median({nums}) = {result}, expected {expected}")
            return False
    
    print("passed all tests")
    return True


def test_mode(mode_fn):
    """Test the mode function with 20 random lists."""
    for _ in range(20):
        length = random.randint(1, 50)
        nums = [random.randint(-10, 10) for _ in range(length)]
        
        counts = {}
        for num in nums:
            counts[num] = counts.get(num, 0) + 1
        max_count = max(counts.values())
        expected = [k for k, v in counts.items() if v == max_count]
        
        result = mode_fn(nums)
        
        if isinstance(result, list):
            if sorted(result) != sorted(expected):
                print(f"Failed: mode({nums}) = {result}, expected {expected}")
                return False
        else:
            if result not in expected:
                print(f"Failed: mode({nums}) = {result}, expected {expected}")
                return False
    
    print("passed all tests")
    return True
`;

export async function run() {
  console.log("Seeding database...");

  await db
    .insert(modules)
    .values([
      {
        slug: "average-lists",
        name: "Average Lists",
        instructions: [
          {
            text: averageListsText,
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
        .where(eq(modules.slug, "average-lists"))
        .limit(1)
    )[0],
  ];

  await Promise.all(
    modulesInsert.map(async (mod) => {
      if (!mod) return;

      if (mod.slug === "average-lists") {
        let file1 = (
          await db
            .select()
            .from(starterFiles)
            .where(eq(starterFiles.name, "average.py"))
            .limit(1)
        )[0];
        if (!file1) {
          file1 = await db
            .insert(starterFiles)
            .values({
              name: "average.py",
              content: average_py,
            })
            .returning()
            .then((r) => r[0]);
        }

        let file2 = (
          await db
            .select()
            .from(starterFiles)
            .where(eq(starterFiles.name, "test.py"))
            .limit(1)
        )[0];
        if (!file2) {
          file2 = await db
            .insert(starterFiles)
            .values({
              name: "test.py",
              content: test_py,
            })
            .returning()
            .then((r) => r[0]);
        }

        await db
          .insert(moduleToFile)
          .values({
            moduleId: mod.id,
            fileId: file1.id,
            sortOrder: 0,
            isEntryPoint: true,
            isActive: true,
          })
          .onConflictDoNothing();
        await db
          .insert(moduleToFile)
          .values({
            moduleId: mod.id,
            fileId: file2.id,
            sortOrder: 1,
            isEntryPoint: false,
            isActive: true,
          })
          .onConflictDoNothing();
      }
    }),
  );

  console.log("Seeding completed.");
}
