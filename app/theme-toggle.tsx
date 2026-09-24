"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import type { SiteTheme } from "@/lib/theme";

const COOKIE_NAME = "library-theme";

type ThemeToggleProps = {
  current: SiteTheme;
  className?: string;
};

export function ThemeToggle({ current, className }: ThemeToggleProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const next: SiteTheme = current === "classic" ? "stacks" : "classic";

  function handleClick() {
    document.cookie = `${COOKIE_NAME}=${next}; path=/; max-age=31536000; samesite=lax`;
    startTransition(() => router.refresh());
  }

  return (
    <button
      aria-busy={isPending}
      className={className}
      disabled={isPending}
      onClick={handleClick}
      type="button"
    >
      {next === "classic" ? "Switch to classic view" : "Switch to the new look"}
    </button>
  );
}
