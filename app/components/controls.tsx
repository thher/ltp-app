'use client';

import { tx, type Language } from '../lib/i18n';

export function LanguageToggle({
  language,
  onChange,
}: {
  language: Language;
  onChange: (language: Language) => void;
}) {
  return (
    <div className="language-toggle" aria-label={tx(language, 'Velg sprÃ¥k', 'Choose language')}>
      <button
        type="button"
        className={language === 'no' ? 'is-active' : ''}
        onClick={() => onChange('no')}
      >
        {tx(language, 'Norsk', 'Norwegian')}
      </button>
      <button
        type="button"
        className={language === 'en' ? 'is-active' : ''}
        onClick={() => onChange('en')}
      >
        {tx(language, 'English', 'English')}
      </button>
    </div>
  );
}

export function ThemeToggle({ language, theme, onChange }: { language: Language; theme: 'dark' | 'light'; onChange: (value: 'dark' | 'light') => void }) {
  return (
    <div className="theme-toggle" aria-label={tx(language, 'Tema', 'Theme')}>
      <button type="button" className={theme === 'dark' ? 'is-active' : ''} onClick={() => onChange('dark')}>
        {tx(language, 'MÃ¸rk', 'Dark')}
      </button>
      <button type="button" className={theme === 'light' ? 'is-active' : ''} onClick={() => onChange('light')}>
        {tx(language, 'Lys', 'Light')}
      </button>
    </div>
  );
}

export function GlobalTopControls({
  language,
  onLanguageChange,
  theme,
  onThemeChange,
}: {
  language: Language;
  onLanguageChange: (language: Language) => void;
  theme: 'dark' | 'light';
  onThemeChange: (value: 'dark' | 'light') => void;
}) {
  return (
    <div className="global-top-controls no-print">
      <LanguageToggle language={language} onChange={onLanguageChange} />
      <ThemeToggle language={language} theme={theme} onChange={onThemeChange} />
    </div>
  );
}
