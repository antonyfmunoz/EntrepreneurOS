/**
 * Quick diagnostic: test Stitch SDK connection and raw response shape.
 */
import { Stitch, StitchToolClient } from "@google/stitch-sdk";

async function test() {
  const apiKey = process.env.STITCH_API_KEY;
  const projectId = process.env.STITCH_PROJECT_ID;

  console.log("API Key:", apiKey ? `${apiKey.slice(0, 8)}...` : "MISSING");
  console.log("Project ID:", projectId ?? "MISSING");

  if (!apiKey || !projectId) {
    console.error("Missing env vars");
    process.exit(1);
  }

  const toolClient = new StitchToolClient({ apiKey });
  const stitch = new Stitch(toolClient);

  // Test 1: List projects
  console.log("\n--- Test 1: List projects ---");
  try {
    const projects = await stitch.projects();
    console.log(`Found ${projects.length} projects:`);
    for (const p of projects) {
      console.log(`  ID: ${p.projectId}, data:`, JSON.stringify(p.data)?.slice(0, 200));
    }
  } catch (err: any) {
    console.error("List projects failed:", err.message);
  }

  // Test 2: Generate a simple screen
  console.log("\n--- Test 2: Generate screen ---");
  try {
    const project = stitch.project(projectId);
    console.log("Project handle created, ID:", project.projectId);

    // Use callTool directly to see raw response
    console.log("\nCalling generate_screen_from_text via raw tool call...");
    const raw = await toolClient.callTool("generate_screen_from_text", {
      projectId,
      prompt: "A simple login page with email and password fields and a Sign In button. Dark background.",
      deviceType: "DESKTOP",
    });
    console.log("\nRaw response type:", typeof raw);
    console.log("Raw response keys:", Object.keys(raw ?? {}));
    console.log("Raw response (truncated):", JSON.stringify(raw)?.slice(0, 2000));
  } catch (err: any) {
    console.error("Generate failed:", err.message);
    console.error("Full error:", err);
  }

  await toolClient.close();
}

test().catch(console.error);
