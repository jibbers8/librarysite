"use client";

import { signIn } from "next-auth/react";

export function SignInButton() {
  return (
    <button
      className="inline-block rounded-md bg-black px-4 py-2 text-sm font-medium text-white"
      onClick={() => signIn("google", { callbackUrl: "/owner" })}
      type="button"
    >
      Sign in with Google
    </button>
  );
}
