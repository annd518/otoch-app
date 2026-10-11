import { readFile } from "node:fs/promises";
import { importContent } from "../src/services/contentImport";
import prisma from "../src/db/db.config";
async function main() {
  const args = process.argv.slice(2);
  if (
    args.length < 1 ||
    args.some(
      (a) => a.startsWith("--") && !["--apply", "--dry-run"].includes(a),
    ) ||
    (args.includes("--apply") && args.includes("--dry-run"))
  )
    throw new Error(
      "Usage: npm run content:import -- <file.json> [--dry-run | --apply]",
    );
  console.log(
    JSON.stringify(
      await importContent(
        JSON.parse(await readFile(args[0], "utf8")),
        args.includes("--apply"),
      ),
      null,
      2,
    ),
  );
}
void main()
  .catch(() => {
    console.error(
      "Import failed: validate source, approval, version and database configuration. No partial publication committed.",
    );
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
