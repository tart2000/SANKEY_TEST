import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

export type TranslationTypeDefinition = {
  label: string;
  en_gb: string;
  description: string;
  description_en_gb: string;
  dimension: string;
  output_id_test: string;
  output_id_live: string;
  step: string;
};

export type TranslationTypes = Record<string, TranslationTypeDefinition>;

let cachedTranslations: TranslationTypes | null = null;

const TRANSLATION_FILE_PATH = path.join(
  process.cwd(),
  'public',
  'config',
  'translations.js'
);

function loadTranslationsFromFile() {
  if (cachedTranslations) return;

  const fileContent = fs.readFileSync(TRANSLATION_FILE_PATH, 'utf-8');
  const context = { window: {} as Record<string, unknown> };

  vm.runInNewContext(fileContent, context);

  const translations = (context.window.TRANSLATION_TYPES ??
    context.window.translationTypes) as TranslationTypes | undefined;

  if (!translations) {
    throw new Error(
      'translations.js doit définir TRANSLATION_TYPES ou translationTypes'
    );
  }

  cachedTranslations = translations;
}

export function getTranslationTypes(): TranslationTypes {
  loadTranslationsFromFile();
  return cachedTranslations as TranslationTypes;
}
