import { nb, TranslationKeys } from './nb';
import { en } from './en';
import { Language } from '../types';

const translations: Record<Language, TranslationKeys> = { nb, en };

export function getTranslations(language: Language): TranslationKeys {
  return translations[language] ?? translations.nb;
}

export { nb, en };
export type { TranslationKeys };
