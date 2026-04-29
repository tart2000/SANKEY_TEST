import { useEffect, useState } from 'react';
import i18next from 'i18next';
import { translations } from './translations';

// Initialiser i18next avec les ressources
if (!i18next.isInitialized) {
  i18next.init({
    resources: translations,
    fallbackLng: 'fr_fr',
    debug: false,
    defaultNS: 'translation',
    ns: ['translation'],
  });
} else {
  // En HMR, le singleton i18next persiste : on réinjecte les ressources à chaque
  // ré-exécution du module pour que les nouvelles clés soient prises en compte
  // sans avoir à recharger la page.
  for (const [lng, bundle] of Object.entries(translations)) {
    const ns = (bundle as { translation: Record<string, string> }).translation;
    i18next.addResourceBundle(lng, 'translation', ns, true, true);
  }
}

export function useTranslation(lang: string = 'fr_fr') {
  const [isReady, setIsReady] = useState(i18next.isInitialized);

  useEffect(() => {
    if (i18next.language !== lang) {
      i18next.changeLanguage(lang).then(() => {
        setIsReady(true);
      });
    } else {
      setIsReady(true);
    }
  }, [lang]);

  const t = (key: string, params?: Record<string, string>): string => {
    if (!isReady) return key;

    let translation = i18next.t(key, params);

    // Si la traduction n'existe pas, retourner la clé
    if (translation === key && lang !== 'fr_fr') {
      // Essayer avec fr_fr comme fallback
      const originalLang = i18next.language;
      i18next.changeLanguage('fr_fr');
      translation = i18next.t(key, params);
      i18next.changeLanguage(originalLang);
    }

    return translation;
  };

  return { t, isReady };
}
