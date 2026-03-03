import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { execSync } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const envExamplePath = path.join(root, ".env.example");
const envLocalPath = path.join(root, ".env.local");

function randomSecret(size = 48) {
  return randomBytes(size).toString("base64url");
}

function parseEnv(text) {
  const lines = text.split(/\r?\n/);
  const map = new Map();
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    map.set(key, value);
  }
  return map;
}

function toEnvText(map) {
  return [...map.entries()].map(([k, v]) => `${k}="${v}"`).join("\n") + "\n";
}

if (!existsSync(envExamplePath)) {
  throw new Error(".env.example is missing.");
}

const exampleMap = parseEnv(readFileSync(envExamplePath, "utf8"));
const localMap = existsSync(envLocalPath)
  ? parseEnv(readFileSync(envLocalPath, "utf8"))
  : new Map(exampleMap);

if (!localMap.get("NEXTAUTH_SECRET") || localMap.get("NEXTAUTH_SECRET")?.includes("replace-with")) {
  localMap.set("NEXTAUTH_SECRET", randomSecret());
}
if (!localMap.get("CRON_SECRET") || localMap.get("CRON_SECRET")?.includes("replace-with")) {
  localMap.set("CRON_SECRET", randomSecret());
}
if (!localMap.get("NEXTAUTH_URL")) {
  localMap.set("NEXTAUTH_URL", "http://localhost:3000");
}
if (!localMap.get("NEXT_PUBLIC_APP_URL")) {
  localMap.set("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
}

writeFileSync(envLocalPath, toEnvText(localMap), "utf8");
console.log("Updated .env.local with generated secrets.");

console.log("Installing dependencies...");
execSync("npm install", { stdio: "inherit" });

console.log("Generating Prisma client...");
execSync("npm run prisma:generate", { stdio: "inherit" });

const db = localMap.get("DATABASE_URL") ?? "";
const canPushDb =
  db &&
  !db.includes("USER:PASSWORD") &&
  !db.includes("HOST:5432/DB_NAME") &&
  !db.includes("replace");

if (canPushDb) {
  console.log("Applying schema to database...");
  execSync("npm run prisma:push", { stdio: "inherit" });
} else {
  console.log("Skipped prisma:push (DATABASE_URL still placeholder).");
}

console.log("Running lint...");
execSync("npm run lint", { stdio: "inherit" });

console.log("Setup complete.");
