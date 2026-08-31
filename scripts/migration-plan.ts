import { existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

export type MigrationPlanItem = {
  id: string;
  fullPath: string;
};

export function migrationPlan(root = process.cwd()): MigrationPlanItem[] {
  const sources = [
    {
      label: "scripts/migrations",
      directory: resolve(root, "scripts", "migrations"),
      include: (_file: string) => true,
    },
    {
      label: "migrations",
      directory: resolve(root, "migrations"),
      include: (file: string) => !file.startsWith("0000_"),
    },
  ];

  return sources
    .flatMap(({ label, directory, include }) => {
      if (!existsSync(directory)) return [];
      return readdirSync(directory)
        .filter((file) => file.endsWith(".sql") && include(file))
        .sort()
        .map((file) => ({ id: `${label}/${file}`, fullPath: join(directory, file) }));
    })
    .sort((left, right) => left.id.localeCompare(right.id));
}
