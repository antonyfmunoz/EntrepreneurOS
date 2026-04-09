// lib/ui-generator/preview-server.ts
// Fetches Stitch-generated HTML from a presigned URL and serves it on a local
// port for browser preview during the human review gate.
//
// Usage:
//   const { localUrl, shutdown } = await startPreviewServer(htmlUrl);
//   // user reviews at localUrl
//   await shutdown();
//
// Port selection: tries ports starting at 4200, incrementing on EADDRINUSE.
// Graceful: if fetch fails or all ports busy, returns null (never throws).

import http from "node:http";
import type { AddressInfo } from "node:net";

export interface PreviewHandle {
  localUrl: string;
  port: number;
  shutdown: () => Promise<void>;
}

const START_PORT = 4200;
const MAX_PORT_ATTEMPTS = 10;

/**
 * Fetch HTML from a Stitch presigned URL and serve it locally.
 * Returns a PreviewHandle with the local URL and a shutdown function,
 * or null if the HTML cannot be fetched or no port is available.
 */
export async function startPreviewServer(
  htmlUrl: string,
): Promise<PreviewHandle | null> {
  let htmlContent: string;
  try {
    const resp = await fetch(htmlUrl);
    if (!resp.ok) return null;
    htmlContent = await resp.text();
  } catch {
    return null;
  }

  for (let attempt = 0; attempt < MAX_PORT_ATTEMPTS; attempt++) {
    const port = START_PORT + attempt;
    const result = await tryListen(htmlContent, port);
    if (result) return result;
  }

  return null;
}

function tryListen(htmlContent: string, port: number): Promise<PreviewHandle | null> {
  return new Promise((resolve) => {
    const server = http.createServer((_req, res) => {
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      });
      res.end(htmlContent);
    });

    server.once("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        resolve(null);
      } else {
        resolve(null);
      }
    });

    server.listen(port, "127.0.0.1", () => {
      const addr = server.address() as AddressInfo;
      resolve({
        localUrl: `http://127.0.0.1:${addr.port}`,
        port: addr.port,
        shutdown: () =>
          new Promise<void>((res) => {
            server.close(() => res());
          }),
      });
    });
  });
}
