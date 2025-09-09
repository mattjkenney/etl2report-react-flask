import React from 'react';
import { useTheme } from '../contexts/ThemeContext';

const ThemeToggle = ({ className = '' }) => {
  const { theme, currentTheme, toggleTheme } = useTheme();

  const getIcon = () => {
    switch (currentTheme) {
      case 'dark':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
          </svg>
        );
      case 'light':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        );
    }
  };

  const getThemeLabel = () => {
    switch (theme) {
      case 'dark':
        return 'Dark mode';
      case 'light':
        return 'Light mode';
      case 'system':
        return `System (${currentTheme})`;
      default:
        return 'Theme';
    }
  };

  return (
    <button
      onClick={toggleTheme}
      className={`
        inline-flex items-center justify-center
        px-3 py-2 
        text-sm font-medium
        text-theme-primary
        bg-theme-secondary
        border border-theme-primary
        rounded-md
        hover:bg-theme-tertiary
        focus:outline-none
        focus:ring-2
        focus:ring-blue-500
        focus:ring-offset-2
        transition-colors
        ${className}
      `}
      title={getThemeLabel()}
      aria-label={`Switch theme. Current: ${getThemeLabel()}`}
    >
      {getIcon()}
      <span className="ml-2 hidden sm:inline">{getThemeLabel()}</span>
    </button>
  );
};

export default ThemeToggle;