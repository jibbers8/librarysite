const localUrl = "http://localhost:3000/api/auth/callback/azure-ad";
const configuredBase =
  process.env.NEXTAUTH_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.VERCEL_URL ||
  "https://your-domain.vercel.app";

const normalizedCandidate = configuredBase.startsWith("http")
  ? configuredBase
  : `https://${configuredBase}`;

const normalizedProd =
  normalizedCandidate.includes("localhost")
    ? "https://your-domain.vercel.app"
    : normalizedCandidate;

const productionUrl = `${normalizedProd.replace(/\/$/, "")}/api/auth/callback/azure-ad`;

console.log("Microsoft OAuth callback URLs to paste in Azure:");
console.log(`- ${localUrl}`);
console.log(`- ${productionUrl}`);
