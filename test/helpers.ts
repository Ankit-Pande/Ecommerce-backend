import { spawn } from "child_process";
import { createInterface } from "readline";

const API_URL = "http://localhost:8099";

export type Reply = { status: number; json: any; ms: number; cookie: string };

export type CallOptions = {
  token?: string;
  body?: unknown;
  raw?: string;
  cookie?: string;
  ip?: string;
  headers?: Record<string, string>;
};

const otpByPhone = new Map<string, string>();

// Waits the given number of milliseconds.
export function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Starts the API (src/, port 8099, development mode: OTPs are printed, not sent), keeps the OTPs, shows errors.
export async function startServer(logLevel = "info") {
  const server = spawn(process.execPath, ["-r", "ts-node/register/transpile-only", "src/server.ts"], {
    env: { ...process.env, PORT: "8099", NODE_ENV: "development", LOG_LEVEL: logLevel },
    stdio: ["ignore", "pipe", "inherit"],
  });
  createInterface({ input: server.stdout }).on("line", (line) => {
    const otp = line.match(/DEV OTP -> (\d{10}): (\d{6})/);
    if (otp) otpByPhone.set(otp[1], otp[2]);
    if (line.includes("[error]")) console.log(`  server error: ${line}`);
  });
  process.on("exit", () => server.kill());

  for (let tries = 0; tries < 120; tries++) {
    const ready = await fetch(`${API_URL}/health/ready`).catch(() => null);
    if (ready?.ok) return server;
    await wait(500);
  }
  throw new Error("The API did not start in 60 seconds");
}

// The OTP the server printed for this phone (waits up to 2 seconds for the log line).
export async function otpFor(phone: string) {
  for (let tries = 0; tries < 40 && !otpByPhone.has(phone); tries++) await wait(50);
  const otp = otpByPhone.get(phone) ?? "";
  otpByPhone.delete(phone);
  return otp;
}

// Calls one API like a browser would (from the given IP) and measures how long it took.
export async function call(method: string, path: string, options: CallOptions = {}): Promise<Reply> {
  const started = performance.now();
  const response = await fetch(API_URL + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": options.ip ?? "10.9.9.9",
      ...(options.token && { Authorization: `Bearer ${options.token}` }),
      ...(options.cookie && { Cookie: options.cookie }),
      ...options.headers,
    },
    body: options.raw ?? (options.body === undefined ? undefined : JSON.stringify(options.body)),
  });
  const json = await response.json().catch(() => ({}));
  const cookie = response.headers.get("set-cookie")?.split(";")[0] ?? "";
  return { status: response.status, json, ms: Math.round(performance.now() - started), cookie };
}
