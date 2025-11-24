import type { Dimension, DimensionValue } from '@/types/lot';

/**
 * Deep copy d'un objet
 */
export function deepCopy<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Clamp un pourcentage entre min et max
 */
export function clampPercent(
  val: number,
  min: number = 1,
  max: number = 100
): number {
  return Math.max(min, Math.min(max, val));
}

/**
 * Normalise une distribution pour que la somme fasse 100%
 * Modifie l'objet en place
 */
export function normaliserDistribution(liste: Dimension): void {
  const keys = Object.keys(liste).filter(k => k !== 'title');
  if (keys.length === 0) return;

  // Si un seul élément, mettre à 100%
  if (keys.length === 1) {
    const uniqueKey = keys[0];
    const item = liste[uniqueKey];
    if (typeof item === 'object' && item !== null && 'pourcentage' in item) {
      item.pourcentage = 100;
    } else {
      liste[uniqueKey] = 100;
    }
    return;
  }

  // Calculer le total actuel
  let total = 0;
  const valeurs = keys.map(key => {
    const item = liste[key];
    const pct =
      typeof item === 'object' && item !== null && 'pourcentage' in item
        ? item.pourcentage
        : typeof item === 'number'
          ? item
          : 0;
    total += pct;
    return { key, pct };
  });

  if (total === 0) return;

  // Normaliser chaque valeur proportionnellement
  let cumul = 0;
  valeurs.forEach((entry, index) => {
    let pct = (entry.pct * 100) / total;
    if (index < valeurs.length - 1) {
      pct = Math.round(pct * 10) / 10;
      cumul += pct;
    } else {
      // Dernier élément : ajuster pour que la somme fasse exactement 100
      pct = Math.round((100 - cumul) * 10) / 10;
    }

    const item = liste[entry.key];
    if (typeof item === 'object' && item !== null && 'pourcentage' in item) {
      item.pourcentage = pct;
    } else {
      liste[entry.key] = pct;
    }
  });
}

/**
 * Récupère le pourcentage d'un élément de dimension
 */
export function getPercent(item: DimensionValue): number {
  if (typeof item === 'object' && item !== null && 'pourcentage' in item) {
    return item.pourcentage;
  }
  if (typeof item === 'number') {
    return item;
  }
  return 0;
}

/**
 * Définit le pourcentage d'un élément de dimension
 */
export function setPercent(
  item: DimensionValue,
  percent: number
): DimensionValue {
  if (typeof item === 'object' && item !== null) {
    return { ...item, pourcentage: percent };
  }
  return percent;
}
