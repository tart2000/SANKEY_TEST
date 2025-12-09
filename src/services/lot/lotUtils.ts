import type {
  Dimension,
  DimensionValue,
  Lot,
  CheminSelection,
  AggregatedRow,
} from '@/types/lot';
import { getTitreAffiche } from './dimensionUtils';

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

/**
 * Trouve le bubble_id dans la structure du lot pour une dimension et une clé donnée
 * Exactement comme dans sankey.js ligne 2148
 */
function findBubbleIdInStructure(
  lot: Lot,
  dimension: string,
  key: string
): string | null {
  const windowWithHierarchy = window as unknown as {
    DIMENSION_HIERARCHY?: Record<string, { parent?: string | null }>;
  };
  const dimConfig =
    windowWithHierarchy.DIMENSION_HIERARCHY &&
    windowWithHierarchy.DIMENSION_HIERARCHY[dimension];
  if (!dimConfig || !dimConfig.parent) return null;

  // Construire le chemin
  const bubbleIdPath: string[] = [];
  let currentDim: string | null = dimension;
  const hierarchy = windowWithHierarchy.DIMENSION_HIERARCHY;
  if (!hierarchy) return null;

  while (currentDim) {
    bubbleIdPath.unshift(currentDim);
    const config: { parent?: string | null } | undefined =
      hierarchy[currentDim];
    currentDim = config ? config.parent || null : null;
  }

  function searchBubbleId(
    node: Record<string, unknown>,
    pathIndex: number
  ): string | null {
    if (pathIndex >= bubbleIdPath.length) return null;
    const currentDimName = bubbleIdPath[pathIndex];
    const isLastDim = pathIndex === bubbleIdPath.length - 1;

    if (currentDimName in node) {
      const dimValue = node[currentDimName];
      if (isLastDim) {
        if (
          dimValue &&
          typeof dimValue === 'object' &&
          !Array.isArray(dimValue) &&
          key in dimValue
        ) {
          const valueObj = (dimValue as Record<string, unknown>)[key];
          if (
            valueObj &&
            typeof valueObj === 'object' &&
            !Array.isArray(valueObj) &&
            'bubble_id' in valueObj
          ) {
            return (valueObj as { bubble_id?: string }).bubble_id || null;
          }
        }
      } else {
        if (
          dimValue &&
          typeof dimValue === 'object' &&
          !Array.isArray(dimValue)
        ) {
          for (const childObj of Object.values(
            dimValue as Record<string, unknown>
          )) {
            if (
              childObj &&
              typeof childObj === 'object' &&
              !Array.isArray(childObj)
            ) {
              const found = searchBubbleId(
                childObj as Record<string, unknown>,
                pathIndex + 1
              );
              if (found) return found;
            }
          }
        }
      }
    }
    return null;
  }

  // Pour les dimensions enfants, commencer depuis lot.formats
  if (bubbleIdPath[0] === 'formats' && lot.formats) {
    const formats = lot.formats as Record<string, unknown>;
    for (const formatObj of Object.values(formats)) {
      if (
        formatObj &&
        typeof formatObj === 'object' &&
        !Array.isArray(formatObj)
      ) {
        const found = searchBubbleId(formatObj as Record<string, unknown>, 1);
        if (found) return found;
      }
    }
    return null;
  } else {
    return searchBubbleId(lot as Record<string, unknown>, 0);
  }
}

/**
 * Obtient les valeurs agrégées d'un lot pour une dimension donnée, groupées par bubble_id
 * S'inspire de generateGroupedLotData dans sankey.js
 */
export function getAggregatedValues(
  lot: Lot,
  dimension: string,
  lang: string = 'fr_fr'
): AggregatedRow[] {
  const lotTotal = lot.total || 0;
  const itemsByBubbleId = new Map<
    string | null,
    {
      totalKg: number;
      totalPercentage: number; // En pourcentage brut (avant normalisation)
      name: string;
      color?: string;
    }
  >();

  let totalSansDimension = 0;
  let totalLot = 0;

  // Utiliser DIMENSION_HIERARCHY exactement comme dans sankey.js
  const windowWithHierarchy = window as unknown as {
    DIMENSION_HIERARCHY?: Record<string, { parent?: string | null }>;
  };
  const dimConfig =
    windowWithHierarchy.DIMENSION_HIERARCHY &&
    windowWithHierarchy.DIMENSION_HIERARCHY[dimension];
  if (!dimConfig) return [];

  // Cas 1 : Dimension racine (pas de parent)
  if (!dimConfig.parent) {
    const dimensionData = lot[dimension] as Dimension | undefined;
    if (dimensionData) {
      Object.entries(dimensionData).forEach(([key, valueObj]) => {
        if (key === 'title') return;

        const pourcentage =
          typeof valueObj === 'number'
            ? valueObj
            : valueObj &&
                typeof valueObj === 'object' &&
                'pourcentage' in valueObj
              ? (valueObj as { pourcentage: number }).pourcentage
              : 0;

        if (pourcentage > 0) {
          const bubbleId =
            valueObj && typeof valueObj === 'object' && 'bubble_id' in valueObj
              ? (valueObj as { bubble_id?: string }).bubble_id || null
              : null;
          const color =
            valueObj && typeof valueObj === 'object' && 'color' in valueObj
              ? (valueObj as { color?: string }).color
              : undefined;
          const name = getTitreAffiche(key, valueObj as DimensionValue, lang);
          const total = (lotTotal * pourcentage) / 100;

          if (bubbleId) {
            if (itemsByBubbleId.has(bubbleId)) {
              const existing = itemsByBubbleId.get(bubbleId)!;
              existing.totalPercentage += pourcentage;
              existing.totalKg += total;
            } else {
              itemsByBubbleId.set(bubbleId, {
                name,
                color,
                totalPercentage: pourcentage,
                totalKg: total,
              });
            }
            totalLot += pourcentage;
          } else {
            totalSansDimension += pourcentage;
          }
        }
      });

      // Normaliser les pourcentages après agrégation
      const total = totalLot + totalSansDimension;
      if (total > 0) {
        itemsByBubbleId.forEach(item => {
          item.totalPercentage = (item.totalPercentage / total) * 100;
          item.totalKg = (lotTotal * item.totalPercentage) / 100;
        });
      }

      // Ajouter l'item N/A si nécessaire (après normalisation)
      if (totalSansDimension > 0 && total > 0) {
        const naPercent = (totalSansDimension / total) * 100;
        const naTotal = (lotTotal * naPercent) / 100;
        itemsByBubbleId.set(null, {
          name: 'N/A',
          color: undefined,
          totalPercentage: naPercent,
          totalKg: naTotal,
        });
      } else if (totalSansDimension > 0 && totalLot === 0) {
        // Tout le lot est sans cette dimension
        itemsByBubbleId.set(null, {
          name: 'N/A',
          color: undefined,
          totalPercentage: 100,
          totalKg: lotTotal,
        });
      }
    }
  } else {
    // Cas 2 : Dimension enfant - construire le chemin depuis la racine
    // Exactement comme dans sankey.js ligne 2299-2307
    const path: string[] = [];
    let currentDim: string | null = dimension;
    const hierarchy = windowWithHierarchy.DIMENSION_HIERARCHY;
    if (!hierarchy) return [];

    while (currentDim) {
      path.unshift(currentDim);
      const config: { parent?: string | null } | undefined =
        hierarchy[currentDim];
      currentDim = config ? config.parent || null : null;
    }

    // Fonction récursive pour parcourir la structure
    function traverse(
      node: Record<string, unknown>,
      pathIndex: number,
      accumulatedMass: number
    ) {
      if (pathIndex >= path.length) return;

      const currentDimName = path[pathIndex];
      const isLastDim = pathIndex === path.length - 1;

      // Vérifier si la dimension existe à ce niveau
      if (currentDimName in node) {
        const dimData = node[currentDimName] as Record<string, unknown>;
        // Exactement comme sankey.js ligne 2319 - ne pas filtrer 'title' ici
        const hasContent = Object.keys(dimData).length > 0;

        if (isLastDim) {
          // On est à la dimension cible
          if (hasContent) {
            totalLot += accumulatedMass;
            let sumDimension = 0;
            Object.entries(dimData).forEach(([key, valueObj]) => {
              if (key === 'title') return;

              let pct = 0;
              if (typeof valueObj === 'object' && valueObj !== null) {
                const obj = valueObj as {
                  pourcentage?: number;
                  masse?: number;
                };
                pct =
                  obj.pourcentage !== undefined
                    ? obj.pourcentage
                    : obj.masse !== undefined
                      ? obj.masse
                      : 0;
              } else if (typeof valueObj === 'number') {
                pct = valueObj;
              }

              const mass = (pct / 100) * accumulatedMass;
              const total = (lotTotal * mass) / 100;
              sumDimension += mass;

              let bubbleId =
                valueObj && typeof valueObj === 'object'
                  ? (valueObj as { bubble_id?: string }).bubble_id || null
                  : null;
              // Si pas de bubble_id direct, chercher dans la structure
              if (!bubbleId) {
                bubbleId = findBubbleIdInStructure(lot, dimension, key);
              }
              const color =
                valueObj && typeof valueObj === 'object'
                  ? (valueObj as { color?: string }).color
                  : undefined;
              const name = getTitreAffiche(
                key,
                valueObj as DimensionValue,
                lang
              );

              if (bubbleId) {
                if (itemsByBubbleId.has(bubbleId)) {
                  const existing = itemsByBubbleId.get(bubbleId)!;
                  existing.totalPercentage += mass;
                  existing.totalKg += total;
                } else {
                  itemsByBubbleId.set(bubbleId, {
                    name: name,
                    color: color,
                    totalPercentage: mass,
                    totalKg: total,
                  });
                }
              } else {
                // Pas de bubble_id, on compte dans totalSansDimension
                totalSansDimension += mass;
              }
            });

            // Si la somme ne couvre pas toute la masse, le reste est inconnu
            if (sumDimension < accumulatedMass) {
              totalSansDimension += accumulatedMass - sumDimension;
            }
          } else {
            // Dimension vide - tout va dans totalSansDimension
            totalSansDimension += accumulatedMass;
          }
        } else {
          // On continue à descendre dans la hiérarchie
          // Exactement comme sankey.js ligne 2386-2401
          if (hasContent) {
            Object.values(dimData).forEach(childObj => {
              const pctChild =
                typeof childObj === 'object' && childObj !== null
                  ? typeof (childObj as { pourcentage?: number })
                      .pourcentage === 'number'
                    ? (childObj as { pourcentage: number }).pourcentage
                    : 100
                  : 100;
              const childMass = (accumulatedMass * pctChild) / 100;
              traverse(
                childObj as Record<string, unknown>,
                pathIndex + 1,
                childMass
              );
            });
          } else {
            // Dimension intermédiaire vide, on compte comme "sans dimension"
            totalSansDimension += accumulatedMass;
          }
        }
      } else {
        // La dimension n'existe pas à ce niveau
        totalSansDimension += accumulatedMass;
      }
    }

    // Démarrer la traversée depuis le lot
    // Exactement comme sankey.js ligne 2409-2423
    // Pour les dimensions enfants, le chemin commence toujours par 'formats'
    if (path[0] === 'formats' && lot.formats) {
      // Itérer sur chaque format avec son pourcentage
      Object.values(lot.formats).forEach(formatObj => {
        const pctFormat =
          typeof (formatObj as { pourcentage?: number }).pourcentage ===
          'number'
            ? (formatObj as { pourcentage: number }).pourcentage
            : 100;
        traverse(formatObj as Record<string, unknown>, 1, pctFormat);
      });
    } else {
      // Cas par défaut (ne devrait pas arriver pour les dimensions enfants)
      traverse(lot as Record<string, unknown>, 0, 100);
    }

    // Normaliser les pourcentages après agrégation et recalculer les totaux
    const total = totalLot + totalSansDimension;
    if (total > 0) {
      itemsByBubbleId.forEach(item => {
        item.totalPercentage = (item.totalPercentage / total) * 100;
        // Recalculer le total avec le pourcentage normalisé
        item.totalKg = (lotTotal * item.totalPercentage) / 100;
      });
    }
  }

  // Ajouter l'item N/A si nécessaire (après normalisation)
  const total = totalLot + totalSansDimension;
  if (totalSansDimension > 0 && total > 0) {
    const naPercent = (totalSansDimension / total) * 100;
    const naTotal = (lotTotal * naPercent) / 100;
    itemsByBubbleId.set(null, {
      name: 'N/A',
      color: undefined,
      totalPercentage: naPercent,
      totalKg: naTotal,
    });
  } else if (totalSansDimension > 0 && totalLot === 0) {
    // Tout le lot est sans cette dimension
    itemsByBubbleId.set(null, {
      name: 'N/A',
      color: undefined,
      totalPercentage: 100,
      totalKg: lotTotal,
    });
  }

  // Convertir la Map en tableau
  const result: AggregatedRow[] = Array.from(itemsByBubbleId.entries()).map(
    ([bubbleId, data]) => {
      return {
        bubbleId,
        name: data.name,
        totalKg: data.totalKg,
        totalPercentage: data.totalPercentage,
        color: data.color,
      };
    }
  );

  // Trier par pourcentage décroissant
  result.sort((a, b) => b.totalPercentage - a.totalPercentage);

  return result;
}
