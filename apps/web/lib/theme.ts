/**
 * Light or dark colours. The shopper's choice is kept in a cookie, so the
 * server sends the page in the right colours and it never flashes white.
 * "system" (no cookie) follows the phone or computer's own setting.
 */
export const THEME_COOKIE = 'theme';

export type ThemeChoice = 'light' | 'dark' | 'system';

export function parseTheme(value: string | undefined | null): ThemeChoice {
  return value === 'light' || value === 'dark' ? value : 'system';
}

/** Classes for <html>: "dark" or "light" when chosen, nothing when following the device. */
export function themeClass(theme: ThemeChoice): string {
  return theme === 'system' ? '' : theme;
}
