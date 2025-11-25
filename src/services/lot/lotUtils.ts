import type {
  Dimension,
  DimensionValue,
  Lot,
  CheminSelection,
} from '@/types/lot';

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

/**
 * Calcule le poids total d'un niveau de dimension
 * @param lot Le lot complet
 * @param cheminSelection Le chemin de sélection actuel
 * @param niveau Le niveau auquel on veut calculer le poids
 * @returns Le poids total en kg du niveau
 */
export function calculerPoidsNiveau(
  lot: Lot,
  cheminSelection: CheminSelection,
  niveau: number
): number {
  const totalKg = lot.total || 0;

  // Si niveau 0, retourner le total du lot
  if (niveau === 0) {
    return totalKg;
  }

  // Calculer le pourcentage cumulé jusqu'au niveau parent
  let nodeTmp: Lot | Dimension | null = lot;
  let pctCumulTmp = 100;

  for (let i = 0; i < niveau; i++) {
    const { dimension: dim, valeur: val } = cheminSelection[i];
    if (!val || !nodeTmp || typeof nodeTmp !== 'object') break;

    const nodeObj = nodeTmp as Record<string, unknown>;
    if (!(dim in nodeObj)) break;

    const dimValue = nodeObj[dim];
    if (
      typeof dimValue !== 'object' ||
      dimValue === null ||
      Array.isArray(dimValue)
    ) {
      break;
    }

    const dimObj = dimValue as Record<string, unknown>;
    if (!(val in dimObj)) break;

    const n = dimObj[val];
    if (
      typeof n === 'object' &&
      n !== null &&
      !Array.isArray(n) &&
      'pourcentage' in n
    ) {
      pctCumulTmp =
        (pctCumulTmp * (n as { pourcentage: number }).pourcentage) / 100;
    } else if (typeof n === 'number') {
      pctCumulTmp = (pctCumulTmp * n) / 100;
    }

    nodeTmp = n as Lot | Dimension;
  }

  return (totalKg * pctCumulTmp) / 100;
}
