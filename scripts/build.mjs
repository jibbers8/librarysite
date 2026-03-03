import { execSync } from "node:child_process";

const run = (command) => execSync(command, { stdio: "inherit" });

run("npm run prisma:generate");

if (process.env.VERCEL === "1") {
  run("npm run prisma:push");
}

run("next build");
