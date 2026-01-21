import type {
  Dimension,
  DimensionValue,
  DimensionLabels,
  Lot,
} from '@/types/lot';

/**
 * Normalise une clé de dimension en retirant les accents et en mettant en minuscule
 * Pour correspondre aux clés de l'API (ex: "qualité" -> "qualite")
 */
function normalizeDimensionKey(key: string): string {
  return key
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Retire les diacritiques (accents)
    .toLowerCase();
}

/**
 * Obtient les dimensions accessibles à partir d'un nœud
 * Exclut les propriétés spéciales (pourcentage, total, title, etc.)
 */
export function getDimensionsFromNode(
  node: Lot | Dimension | string | null | undefined
): string[] {
  // Si node est une string, essayer de la parser
  if (typeof node === 'string') {
    try {
      node = JSON.parse(node) as Lot | Dimension;
    } catch (e) {
      console.error('Erreur de parsing JSON:', e);
      return [];
    }
  }

  if (!node || typeof node !== 'object' || Array.isArray(node)) {
    return [];
  }

  // Filtrer les clés qui sont des dimensions (objets non-array)
  // ET qui ont vraiment des valeurs enfants (pas juste un objet vide)
  const dims = Object.keys(node).filter(k => {
    // Exclure les propriétés spéciales (comme dans le code original)
    if (
      ['pourcentage', 'percent', 'name', 'titre', 'title', 'total'].includes(k)
    ) {
      return false;
    }
    const v = (node as Record<string, unknown>)[k];

    // Vérifier que c'est un objet (pas un array)
    if (!v || typeof v !== 'object' || Array.isArray(v)) {
      return false;
    }

    // Vérifier que la dimension a vraiment des valeurs enfants
    // (pas juste un objet vide ou avec seulement des métadonnées)
    const dimObj = v as Record<string, unknown>;
    const METADATA_KEYS = [
      'pourcentage',
      'percent',
      'name',
      'titre',
      'title',
      'total',
      'color',
      'bubble_id',
      'en_gb',
      'fr_fr',
      'es_es',
      'de_de',
      'description',
      'notes',
      'children',
    ];

    // Vérifier qu'il y a au moins une clé qui n'est pas une métadonnée
    // ET que cette clé pointe vers un objet (une vraie valeur enfant)
    const hasValidChild = Object.keys(dimObj).some(key => {
      if (METADATA_KEYS.includes(key)) {
        return false;
      }
      const childValue = dimObj[key];
      // Une vraie valeur enfant doit être un objet (pas une primitive)
      return (
        childValue &&
        typeof childValue === 'object' &&
        !Array.isArray(childValue)
      );
    });

    // Retourner true seulement si la dimension a au moins une valeur enfant valide
    return hasValidChild;
  });

  return dims;
}

/**
 * Obtient le label traduit d'une dimension
 */
export function getDimensionLabel(
  dimKey: string,
  dimensionsLabels: DimensionLabels | null,
  lang: string = 'fr_fr'
): string {
  // Si les dimensions ne sont pas encore chargées, fallback sur la clé formatée
  if (!dimensionsLabels) {
    console.log(
      '[getDimensionLabel] Fallback - dimensionsLabels non disponibles',
      {
        dimKey,
        dimensionsLabels: 'null',
        lang,
      }
    );
    return dimKey.charAt(0).toUpperCase() + dimKey.slice(1).toLowerCase();
  }

  // Normaliser la clé pour la correspondance (retirer les accents)
  const normalizedKey = normalizeDimensionKey(dimKey);

  // Chercher d'abord avec la clé exacte, puis avec la clé normalisée
  let labelData = dimensionsLabels[dimKey] || dimensionsLabels[normalizedKey];

  // Si toujours pas trouvé, chercher dans toutes les clés avec normalisation
  if (!labelData) {
    const matchingKey = Object.keys(dimensionsLabels).find(
      key => normalizeDimensionKey(key) === normalizedKey
    );
    if (matchingKey) {
      labelData = dimensionsLabels[matchingKey];
    }
  }

  if (!labelData) {
    console.log(
      '[getDimensionLabel] Fallback - clé non trouvée dans dimensionsLabels',
      {
        dimKey,
        normalizedKey,
        availableKeys: Object.keys(dimensionsLabels),
        lang,
      }
    );
    return dimKey.charAt(0).toUpperCase() + dimKey.slice(1).toLowerCase();
  }

  // Retourne le label dans la langue appropriée
  const label = labelData[lang];
  if (label && label.trim() !== '') {
    return label;
  }

  // Fallback sur la clé formatée
  console.log('[getDimensionLabel] Fallback - label vide ou non trouvé', {
    dimKey,
    normalizedKey,
    lang,
    availableLabels: labelData,
    label,
  });
  return dimKey.charAt(0).toUpperCase() + dimKey.slice(1).toLowerCase();
}

/**
 * Obtient le titre affiché d'un élément (avec traduction si disponible)
 */
export function getTitreAffiche(
  key: string,
  obj: DimensionValue | null | undefined,
  lang: string = 'fr_fr'
): string {
  // Si la langue est en_gb ET que l'objet a une clé en_gb non vide
  if (
    lang === 'en_gb' &&
    obj &&
    typeof obj === 'object' &&
    obj !== null &&
    'en_gb' in obj &&
    typeof obj.en_gb === 'string' &&
    obj.en_gb.trim() !== ''
  ) {
    return obj.en_gb;
  }

  // Sinon, retourne la clé originale
  return key;
}

/**
 * Navigue dans un lot selon un chemin et retourne le nœud correspondant
 */
export function getNodeAtPath(
  lot: Lot,
  path: Array<{ dimension: string; valeur: string | null }>
): Lot | Dimension | null {
  let node: Lot | Dimension | null = lot;

  for (const { dimension, valeur } of path) {
    if (!valeur) break; // On s'arrête si on trouve une dimension sans valeur

    if (!node || typeof node !== 'object' || !(dimension in node)) {
      return null;
    }

    const dimensionValue = (node as Record<string, unknown>)[dimension];
    if (
      typeof dimensionValue !== 'object' ||
      dimensionValue === null ||
      Array.isArray(dimensionValue)
    ) {
      return null;
    }

    const dimensionObj = dimensionValue as Record<string, unknown>;
    if (!(valeur in dimensionObj)) {
      return null;
    }

    const value = dimensionObj[valeur];
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return null;
    }

    node = value as Lot | Dimension;
  }

  return node;
}

/**
 * Obtient les dimensions disponibles à partir de la hiérarchie DIMENSION_HIERARCHY
 * Utilise la structure hiérarchique pour déterminer quelles dimensions sont possibles
 * même si elles sont vides dans le lot actuel
 */
export function getAvailableDimensionsFromHierarchy(
  parentDimension: string | null
): string[] {
  if (typeof window === 'undefined') {
    return [];
  }

  const windowWithHierarchy = window as unknown as {
    DIMENSION_HIERARCHY?: Record<
      string,
      { parent: string | null; children: string[] }
    >;
  };

  const hierarchy = windowWithHierarchy.DIMENSION_HIERARCHY;
  if (!hierarchy) {
    return [];
  }

  if (parentDimension === null) {
    // Retourner les dimensions de niveau 1 (parent = null)
    return Object.keys(hierarchy).filter(
      dim => hierarchy[dim]?.parent === null
    );
  }

  // Retourner les dimensions enfants de la dimension parent
  const parentConfig = hierarchy[parentDimension];
  if (!parentConfig) {
    return [];
  }

  return parentConfig.children || [];
}

/**
 * Vérifie si une dimension existe mais est vide (pas de clés sauf métadonnées)
 */
export function isDimensionEmpty(
  dimension: Dimension | null | undefined
): boolean {
  if (!dimension || typeof dimension !== 'object' || Array.isArray(dimension)) {
    return true;
  }

  const METADATA_KEYS = [
    'pourcentage',
    'percent',
    'name',
    'titre',
    'title',
    'total',
    'color',
    'bubble_id',
    'en_gb',
    'fr_fr',
    'es_es',
    'de_de',
    'description',
    'notes',
    'children',
  ];

  // Filtrer les clés qui ne sont pas des métadonnées
  const validKeys = Object.keys(dimension).filter(
    key => !METADATA_KEYS.includes(key)
  );

  // Si aucune clé valide, la dimension est vide
  return validKeys.length === 0;
}
