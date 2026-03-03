import { getServerSession, type NextAuthOptions } from "next-auth";
import AzureAD from "next-auth/providers/azure-ad";
import { PrismaAdapter } from "@auth/prisma-adapter";

import { prisma } from "@/lib/db";

const tenantId = process.env.MICROSOFT_TENANT_ID ?? "common";
const ownerEmail = process.env.OWNER_EMAIL?.toLowerCase();
const microsoftClientId = process.env.MICROSOFT_CLIENT_ID;
const microsoftClientSecret = process.env.MICROSOFT_CLIENT_SECRET;

if (!microsoftClientId || !microsoftClientSecret) {
  throw new Error(
    "MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET must be configured."
  );
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "database",
  },
  providers: [
    AzureAD({
      clientId: microsoftClientId,
      clientSecret: microsoftClientSecret,
      issuer: `https://login.microsoftonline.com/${tenantId}/v2.0`,
      authorization: {
        params: {
          scope: "openid profile email offline_access User.Read Mail.Read",
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      if (!ownerEmail) {
        return true;
      }

      return user.email?.toLowerCase() === ownerEmail;
    },
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
  pages: {
    signIn: "/owner",
  },
};

export function getServerAuthSession() {
  return getServerSession(authOptions);
}
