import "dotenv/config";
import { runIntake } from "../lib/intake/intake-orchestrator.js";
import { loadProjectConfig } from "../lib/project-config.js";

const config = loadProjectConfig(".");
const result = await runIntake(config);
process.stdout.write(JSON.stringify(result.brief, null, 2) + "\n");
process.exit(0);
