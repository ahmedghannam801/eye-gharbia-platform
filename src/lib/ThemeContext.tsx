import React, { createContext, useContext, useState, useEffect } from 'react';

export type Theme = 'light' | 'dark';
export type AccentTheme = 'blue' | 'gold' | 'emerald' | 'purple';

interface ThemeContextProps {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  accentTheme: AccentTheme;
  setAccentTheme: (accent: AccentTheme) => void;
}

const ThemeContext = createContext<ThemeContextProps | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      // Check if user explicitly chose a theme under current preferences
      const savedV2 = localStorage.getItem('eye_theme_v2');
      if (savedV2 === 'light' || savedV2 === 'dark') return savedV2;
    } catch (e) {}
    // Default mode for all users across the platform is 'dark'
    return 'dark';
  });

  const [accentTheme, setAccentThemeState] = useState<AccentTheme>(() => {
    try {
      const saved = localStorage.getItem('eye_accent_theme');
      return (saved as AccentTheme) || 'blue';
    } catch (e) {
      return 'blue';
    }
  });

  const toggleTheme = () => {
    setThemeState((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      try {
        localStorage.setItem('eye_theme_v2', next);
        localStorage.setItem('eye_theme', next);
      } catch (e) {}
      return next;
    });
  };

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem('eye_theme_v2', newTheme);
      localStorage.setItem('eye_theme', newTheme);
    } catch (e) {}
  };

  const setAccentTheme = (accent: AccentTheme) => {
    setAccentThemeState(accent);
    try {
      localStorage.setItem('eye_accent_theme', accent);
    } catch (e) {}
  };

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem('eye_theme_v2', theme);
      localStorage.setItem('eye_theme', theme);
    } catch (e) {}
  }, [theme]);

  useEffect(() => {
    const root = window.document.documentElement;
    root.setAttribute('data-accent', accentTheme);

    const accentMap: Record<AccentTheme, { primary: string; dark: string }> = {
      blue: { primary: '#2b66ff', dark: '#1b4cd3' },
      gold: { primary: '#d97706', dark: '#b45309' },
      emerald: { primary: '#059669', dark: '#047857' },
      purple: { primary: '#7c3aed', dark: '#6d28d9' },
    };

    const colors = accentMap[accentTheme] || accentMap.blue;
    root.style.setProperty('--color-eye-brand', colors.primary);
    root.style.setProperty('--color-eye-brand-dark', colors.dark);
    root.style.setProperty('--primary', colors.primary);
    root.style.setProperty('--border-focus', colors.primary);
  }, [accentTheme]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme, accentTheme, setAccentTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
