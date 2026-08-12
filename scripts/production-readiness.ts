import { client } from "../server/db";
import { productionReadiness } from "../server/operations/readiness";

productionReadiness()
  .then((result) => { console.log(JSON.stringify(result, null, 2)); if (!result.ready) process.exitCode = 1; })
  .catch((error) => { console.error(error instanceof Error ? error.message : "Readiness evaluation failed."); process.exitCode = 1; })
  .finally(() => client.end({ timeout: 5 }));
