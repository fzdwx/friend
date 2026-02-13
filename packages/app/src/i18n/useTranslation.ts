/**
 * Translation utility functions
 *
 * Provides type-safe translation hooks and helpers
 */

import { useTranslation as useTranslationBase } from 'react-i18next';
import type { TFunction } from 'i18next';

// Re-export the hook with proper typing
export function useTranslation() {
  return useTranslationBase();
}

// Get translation function for use outside React components
export function getT(): TFunction {
  const i18n = require('./index').default;
  return i18n.t.bind(i18n);
}

// Change language and persist
export async function changeLanguage(lng: string): Promise<void> {
  const i18n = require('./index').default;
  await i18n.changeLanguage(lng);
}

// Get current language
export function getCurrentLanguage(): string {
  const i18n = require('./index').default;
  return i18n.language;
}

// Check if a language is supported
export function isSupportedLanguage(lng: string): boolean {
  const { supportedLanguages } = require('./index');
  return supportedLanguages.some((l: { code: string }) => l.code === lng);
}
