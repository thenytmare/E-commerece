import { cookies } from 'next/headers';
import { parseTheme, THEME_COOKIE, type ThemeChoice } from '@/lib/theme';

/** The shopper's saved light/dark choice, read on the server. */
export async function getThemeChoice(): Promise<ThemeChoice> {
  return parseTheme((await cookies()).get(THEME_COOKIE)?.value);
}
