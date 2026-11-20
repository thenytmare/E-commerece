import { THEME_COOKIE, type ThemeChoice } from '@/lib/theme';

const ONE_YEAR = 60 * 60 * 24 * 365;

/**
 * Switch the page's colours now, and remember the choice for next time.
 * The cookie is read by the server, so the next page arrives in the right
 * colours. "system" removes the cookie and follows the device setting.
 */
export function applyTheme(theme: ThemeChoice): void {
  const root = document.documentElement;
  root.classList.remove('light', 'dark');
  if (theme !== 'system') root.classList.add(theme);
  root.dataset.theme = theme;
  const secure = window.location.protocol === 'https:' ? '; secure' : '';
  document.cookie =
    theme === 'system'
      ? `${THEME_COOKIE}=; path=/; max-age=0; samesite=lax${secure}`
      : `${THEME_COOKIE}=${theme}; path=/; max-age=${ONE_YEAR}; samesite=lax${secure}`;
}
