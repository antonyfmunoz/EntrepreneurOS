// lib/react-gen/live-preview-server.ts
// Ensures a Vite dev server is running for live preview during generation.
// Pages are written to disk and Vite hot-reloads automatically.

import { spawn, type ChildProcess } from "node:child_process";
import http from "node:http";

export interface LivePreviewServer {
  url: string;
  isNew: boolean;
  shutdown: () => Promise<void>;
}

function checkPort(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get({ hostname: "localhost", port, path: "/", timeout: 1000 }, (res) => {
      res.resume();
      resolve(true);
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function pollUntilReady(port: number, timeoutMs: number = 30000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await checkPort(port)) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Vite dev server did not respond on port ${port} within ${timeoutMs / 1000}s`);
}

export async function ensureLivePreviewServer(
  projectRoot: string,
): Promise<LivePreviewServer> {
  // Check if already running on common Vite ports
  for (const port of [5173, 5174, 5000]) {
    if (await checkPort(port)) {
      const url = `http://localhost:${port}`;
      console.log(`\u{1F680} Live preview already running: ${url}`);
      return {
        url,
        isNew: false,
        shutdown: async () => {},
      };
    }
  }

  // Start Vite dev server
  const child: ChildProcess = spawn("npm", ["run", "dev"], {
    cwd: projectRoot,
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
    shell: true,
  });

  // Unref so the parent process can exit independently
  child.unref();

  // Capture port from Vite stdout
  let detectedPort = 5173;
  child.stdout?.on("data", (data: Buffer) => {
    const line = data.toString();
    const portMatch = line.match(/localhost:(\d+)/);
    if (portMatch) detectedPort = parseInt(portMatch[1], 10);
  });

  child.stderr?.on("data", (data: Buffer) => {
    const line = data.toString();
    // Vite sometimes logs to stderr
    const portMatch = line.match(/localhost:(\d+)/);
    if (portMatch) detectedPort = parseInt(portMatch[1], 10);
  });

  // Wait for first successful request
  await pollUntilReady(detectedPort);
  const url = `http://localhost:${detectedPort}`;

  // Print clickable link (OSC 8 hyperlink)
  const osc = `\x1b]8;;${url}\x07${url}\x1b]8;;\x07`;
  console.log(`\u{1F680} Live preview ready: ${osc}`);

  return {
    url,
    isNew: true,
    shutdown: async () => {
      if (child.pid) {
        try {
          process.kill(-child.pid, "SIGTERM");
        } catch {
          child.kill("SIGTERM");
        }
      }
    },
  };
}
