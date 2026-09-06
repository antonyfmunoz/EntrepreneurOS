const { spawn } = require("node:child_process");

const payload = process.env.EOS_FLY_SECRET_PAYLOAD;
const app = process.env.EOS_FLY_SECRET_APP;

if (!payload || !app) {
  process.exit(64);
}

const child = spawn("flyctl.exe", ["secrets", "import", "--app", app, "--stage"], {
  stdio: ["pipe", "pipe", "pipe"],
  windowsHide: true,
});

child.stdout.on("data", (chunk) => process.stdout.write(chunk));
child.stderr.on("data", (chunk) => process.stderr.write(chunk));
child.once("error", () => process.exit(1));
child.once("close", (code) => process.exit(code ?? 1));
child.stdin.end(Buffer.from(payload, "utf8"));
