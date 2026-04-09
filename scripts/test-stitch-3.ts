import { StitchToolClient } from "@google/stitch-sdk";

async function test() {
  const toolClient = new StitchToolClient({ apiKey: process.env.STITCH_API_KEY! });

  const raw = await toolClient.callTool("generate_screen_from_text", {
    projectId: process.env.STITCH_PROJECT_ID!,
    prompt: "A simple login page with email and password fields and a Sign In button. Dark background.",
    deviceType: "DESKTOP",
  }) as any;

  console.log(`outputComponents count: ${raw.outputComponents?.length}`);

  for (let i = 0; i < (raw.outputComponents?.length ?? 0); i++) {
    const comp = raw.outputComponents[i];
    const keys = Object.keys(comp);
    console.log(`\n--- Component ${i}: keys = [${keys.join(", ")}] ---`);

    for (const key of keys) {
      const val = comp[key];
      if (val && typeof val === "object") {
        const subKeys = Object.keys(val);
        console.log(`  ${key} keys: [${subKeys.join(", ")}]`);

        // Look for screens
        if (val.screens) {
          console.log(`  FOUND SCREENS: count=${val.screens.length}`);
          for (let j = 0; j < val.screens.length; j++) {
            const s = val.screens[j];
            console.log(`    screen[${j}] keys: [${Object.keys(s).join(", ")}]`);
            console.log(`    screen[${j}] data: ${JSON.stringify(s).slice(0, 500)}`);
          }
        }
      } else {
        console.log(`  ${key}: ${JSON.stringify(val)?.slice(0, 200)}`);
      }
    }
  }

  await toolClient.close();
}

test().catch(console.error);
