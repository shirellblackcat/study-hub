import { useTheme } from '../lib/theme';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      onClick={toggleTheme}
      aria-label="Toggle light/dark theme"
      className="fixed right-4 top-4 z-30 flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 text-sm shadow dark:bg-slate-800"
    >
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  );
}
