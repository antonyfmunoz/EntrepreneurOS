/**
 * Diagnostic 2: inspect full response shape from Stitch API.
 */
import { StitchToolClient } from "@google/stitch-sdk";

async function test() {
  const toolClient = new StitchToolClient({ apiKey: process.env.STITCH_API_KEY! });

  const raw = await toolClient.callTool("generate_screen_from_text", {
    projectId: process.env.STITCH_PROJECT_ID!,
    prompt: "A simple login page with email and password fields and a Sign In button. Dark background.",
    deviceType: "DESKTOP",
  }) as any;

  console.log("=== Top-level keys ===");
  console.log(Object.keys(raw));

  console.log("\n=== outputComponents length ===");
  console.log(raw.outputComponents?.length);

  if (raw.outputComponents?.[0]) {
    const comp = raw.outputComponents[0];
    console.log("\n=== outputComponents[0] keys ===");
    console.log(Object.keys(comp));

    if (comp.design) {
      console.log("\n=== design keys ===");
      console.log(Object.keys(comp.design));
      if (comp.design.screens) {
        console.log("\n=== design.screens[0] keys ===");
        console.log(Object.keys(comp.design.screens[0]));
        console.log("\n=== design.screens[0] (truncated) ===");
        console.log(JSON.stringify(comp.design.screens[0]).slice(0, 1000));
      }
    }

    if (comp.designSystem) {
      console.log("\n=== designSystem keys ===");
      console.log(Object.keys(comp.designSystem));
    }

    // Check all nested keys
    for (const key of Object.keys(comp)) {
      const val = comp[key];
      if (val && typeof val === "object") {
        console.log(`\n=== ${key} keys ===`);
        console.log(Object.keys(val));
        if (val.screens) {
          console.log(`  screens length: ${val.screens.length}`);
          console.log(`  screens[0] keys: ${Object.keys(val.screens[0])}`);
          const s = val.screens[0];
          if (s.htmlUri || s.htmlUrl || s.html) {
            console.log("  FOUND HTML:", (s.htmlUri || s.htmlUrl || s.html).toString().slice(0, 200));
          }
          if (s.screenshotUri || s.screenshotUrl || s.screenshot || s.imageUri) {
            console.log("  FOUND IMAGE:", (s.screenshotUri || s.screenshotUrl || s.screenshot || s.imageUri).toString().slice(0, 200));
          }
          console.log("  Full screen[0]:", JSON.stringify(s).slice(0, 2000));
        }
      }
    }
  }

  await toolClient.close();
}

test().catch(console.error);
