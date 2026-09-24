import { cookies } from "next/headers";

export const THEME_COOKIE = "library-theme";

export type SiteTheme = "stacks" | "classic";

export async function getTheme(): Promise<SiteTheme> {
  const cookieStore = await cookies();
  return cookieStore.get(THEME_COOKIE)?.value === "classic" ? "classic" : "stacks";
}
