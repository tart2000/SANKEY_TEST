/**
 * Config des transformations "translations" (ex. Nettoyage → propre, Décoloration → blanc).
 * Source unique : utilisé par le Sankey (front) et par l'API compare (backend via translationsConfig.ts).
 */
window.TRANSLATION_TYPES = {
  cleaning: {
    label: 'Nettoyage',
    en_gb: 'Cleaning',
    description: 'Transforme le lot en propre',
    description_en_gb: 'Transform the lot into clean',
    dimension: 'proprete',
    output_id_test: '1751363332290x936743758301757400',
    output_id_live: '1751363332290x936743758301757400',
    step: 'preparation',
  },
  decoloration: {
    label: 'Décoloration',
    en_gb: 'Bleaching',
    description: 'Transforme le lot en blanc',
    description_en_gb: 'Transform the lot into white',
    dimension: 'couleurs',
    output_id_test: '1751446409161x466100660519829500',
    output_id_live: '1751446409161x466100660519829500',
    step: 'preparation',
  },
};

window.translationTypes = window.TRANSLATION_TYPES;
