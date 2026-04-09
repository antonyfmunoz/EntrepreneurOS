import { describe, it, expect, afterEach } from "vitest";
import { startPreviewServer, type PreviewHandle } from "../../../lib/ui-generator/preview-server.js";
import http from "node:http";

// ─── Helpers ──────────────────────────────────────────────────────────────────

let activeHandles: PreviewHandle[] = [];

afterEach(async () => {
  for (const h of activeHandles) {
    await h.shutdown();
  }
  activeHandles = [];
});

function fetchLocal(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => resolve(data));
    }).on("error", reject);
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("preview-server", () => {
  it("serves HTML content on a local port", async () => {
    // Create a tiny HTTP server that serves test HTML (simulating Stitch URL)
    const testHtml = "<html><body>Test Preview</body></html>";
    const sourceServer = http.createServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(testHtml);
    });

    await new Promise<void>((resolve) => {
      sourceServer.listen(0, "127.0.0.1", () => resolve());
    });
    const sourcePort = (sourceServer.address() as { port: number }).port;

    try {
      const handle = await startPreviewServer(`http://127.0.0.1:${sourcePort}/test.html`);

      expect(handle).not.toBeNull();
      expect(handle!.localUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
      expect(handle!.port).toBeGreaterThanOrEqual(4200);

      activeHandles.push(handle!);

      // Fetch from the preview server
      const content = await fetchLocal(handle!.localUrl);
      expect(content).toBe(testHtml);
    } finally {
      await new Promise<void>((resolve) => sourceServer.close(() => resolve()));
    }
  });

  it("returns null when source URL fetch fails", async () => {
    const handle = await startPreviewServer("http://127.0.0.1:1/nonexistent");
    expect(handle).toBeNull();
  });

  it("shutdown stops the server", async () => {
    const testHtml = "<html><body>Shutdown Test</body></html>";
    const sourceServer = http.createServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(testHtml);
    });

    await new Promise<void>((resolve) => {
      sourceServer.listen(0, "127.0.0.1", () => resolve());
    });
    const sourcePort = (sourceServer.address() as { port: number }).port;

    try {
      const handle = await startPreviewServer(`http://127.0.0.1:${sourcePort}/`);
      expect(handle).not.toBeNull();

      await handle!.shutdown();

      // After shutdown, connecting should fail
      await expect(fetchLocal(handle!.localUrl)).rejects.toThrow();
    } finally {
      await new Promise<void>((resolve) => sourceServer.close(() => resolve()));
    }
  });

  it("skips to next port when current port is busy", async () => {
    const testHtml = "<html><body>Port Skip</body></html>";
    const sourceServer = http.createServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(testHtml);
    });

    await new Promise<void>((resolve) => {
      sourceServer.listen(0, "127.0.0.1", () => resolve());
    });
    const sourcePort = (sourceServer.address() as { port: number }).port;

    // Occupy port 4200
    const blocker = http.createServer();
    await new Promise<void>((resolve) => {
      blocker.listen(4200, "127.0.0.1", () => resolve());
    });

    try {
      const handle = await startPreviewServer(`http://127.0.0.1:${sourcePort}/`);
      expect(handle).not.toBeNull();
      // Should have picked a port > 4200 since 4200 is busy
      expect(handle!.port).toBeGreaterThan(4200);
      activeHandles.push(handle!);
    } finally {
      await new Promise<void>((resolve) => blocker.close(() => resolve()));
      await new Promise<void>((resolve) => sourceServer.close(() => resolve()));
    }
  });
});
