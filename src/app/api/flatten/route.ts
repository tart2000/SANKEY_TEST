import type { NextRequest } from 'next/server';

import { BubbleClientError } from '@/lib/bubbleClient';
import { getDimensionHierarchy } from '@/lib/dimensions';

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'X-Frame-Options': 'ALLOWALL',
  'Content-Security-Policy':
    "frame-ancestors 'self' https://app.valoramix.com https://*.valoramix.com",
};

const buildResponse = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: JSON_HEADERS,
  });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const normalizeBoolean = (value: unknown): boolean | null => {
  if (value === null || value === undefined) {
    return null;
  }
  if (value === true || value === 'true' || value === '1') {
    return true;
  }
  if (value === false || value === 'false' || value === '0') {
    return false;
  }
  return null;
};

/**
 * Récupère le lot depuis Bubble en texte brut pour préserver les clés dupliquées
 */
const fetchLotRaw = async (
  endpoint: string,
  params: Record<string, unknown>
): Promise<Record<string, unknown>> => {
  const apiKey = process.env.BUBBLE_API_KEY;
  if (!apiKey) {
    throw new BubbleClientError(
      'Configuration error: BUBBLE_API_KEY not found',
      500,
      { error: 'Configuration error: BUBBLE_API_KEY not found' }
    );
  }

  const normalizedParams: Record<string, unknown> = { ...params };
  const isLive =
    normalizedParams.isLive === true || normalizedParams.isLive === 'true';
  let baseUrl = 'https://app.valoramix.com/';
  if (!isLive) {
    baseUrl += 'version-test/';
  }
  baseUrl += 'api/1.1/wf/';

  const paramsSansIsLive: Record<string, unknown> = { ...normalizedParams };
  delete paramsSansIsLive.isLive;

  const url = baseUrl + endpoint.replace(/^\//, '');
  const fetchOptions: RequestInit = {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(paramsSansIsLive),
    signal: AbortSignal.timeout(30000),
  };

  const response = await fetch(url, fetchOptions);
  const text = await response.text();

  if (response.status < 200 || response.status >= 300) {
    throw new BubbleClientError(
      'Impossible de récupérer le lot via Bubble',
      response.status,
      { error: 'Erreur Bubble', raw: text }
    );
  }

  // Parser le JSON brut en préservant les clés dupliquées
  // On utilise une approche simple : parser le JSON normalement avec JSON.parse()
  // puis détecter les clés dupliquées dans le texte brut et les grouper

  // D'abord, parser normalement pour avoir une structure valide
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text) as Record<string, unknown>;
  } catch (parseError) {
    // Si le JSON est invalide, essayer de réparer les clés dupliquées
    // en les convertissant en tableaux avant de parser
    throw new BubbleClientError('Erreur lors du parsing JSON', 502, {
      error: 'JSON invalide',
      message:
        parseError instanceof Error ? parseError.message : String(parseError),
    });
  }

  if (!isRecord(parsed)) {
    throw new BubbleClientError(
      'Format de lot renvoyé par Bubble inattendu',
      502,
      {
        error: 'Lot invalide',
        details:
          'Bubble doit renvoyer un objet JSON représentant le lot complet.',
        bubbleResponse: parsed,
      }
    );
  }

  // Maintenant, détecter les clés dupliquées dans le texte brut pour les dimensions
  // On va parser récursivement les dimensions pour détecter les doublons
  const processDimensionForDuplicates = (
    obj: Record<string, unknown>,
    dimensionPath: string[]
  ): Record<string, unknown> => {
    const result: Record<string, unknown> = {};

    Object.entries(obj).forEach(([key, value]) => {
      if (key === 'title' || key === 'total' || key === 'frequency') {
        result[key] = value;
        return;
      }

      // Pour les dimensions, chercher les clés dupliquées dans le texte brut
      if (isRecord(value)) {
        // Chercher toutes les occurrences de cette clé dans le texte brut
        // au niveau de la dimension courante
        const keyPattern = new RegExp(
          `"${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"\\s*:\\s*\\{`,
          'g'
        );
        const matches = [...text.matchAll(keyPattern)];

        if (matches.length > 1) {
          // Clé dupliquée détectée : extraire toutes les valeurs
          const values: unknown[] = [];

          matches.forEach(match => {
            if (match.index !== undefined) {
              // Extraire l'objet JSON complet à partir de cette position
              try {
                const objStart = match.index + match[0].length - 1;
                let depth = 1;
                let objEnd = objStart;

                while (objEnd < text.length && depth > 0) {
                  if (text[objEnd] === '{') depth++;
                  else if (text[objEnd] === '}') depth--;
                  objEnd++;
                }

                const objText = text.substring(objStart, objEnd);
                const parsedObj = JSON.parse(objText) as Record<
                  string,
                  unknown
                >;
                values.push(parsedObj);
              } catch {
                // Ignorer les erreurs d'extraction
              }
            }
          });

          if (values.length > 1) {
            result[key] = values; // Stocker comme tableau
          } else {
            result[key] = processDimensionForDuplicates(value, [
              ...dimensionPath,
              key,
            ]);
          }
        } else {
          result[key] = processDimensionForDuplicates(value, [
            ...dimensionPath,
            key,
          ]);
        }
      } else {
        result[key] = value;
      }
    });

    return result;
  };

  return processDimensionForDuplicates(parsed, []);
};

/**
 * Normalise les pourcentages d'une collection pour que la somme fasse 100%
 */
const normalizePercentages = (collection: Record<string, unknown>): void => {
  let total = 0;
  const entries: Array<[string, unknown]> = [];

  Object.entries(collection).forEach(([key, value]) => {
    if (key === 'title') return; // Ignorer les clés spéciales
    if (isRecord(value) && typeof value.pourcentage === 'number') {
      total += value.pourcentage;
      entries.push([key, value]);
    }
  });

  if (total > 0 && entries.length > 0) {
    entries.forEach(([, value]) => {
      if (isRecord(value) && typeof value.pourcentage === 'number') {
        value.pourcentage = (value.pourcentage / total) * 100;
      }
    });
  }
};

type EntryWithWeight = {
  key: string;
  value: Record<string, unknown>;
  weight: number;
};

/**
 * Flatten récursif d'une dimension : fusionne les éléments avec le même bubble_id
 */
const flattenDimension = (
  dimensionCollection: Record<string, unknown>,
  dimensionName: string,
  hierarchy: Record<string, { children: string[] }>,
  parentPercentage: number
): Record<string, unknown> => {
  if (!isRecord(dimensionCollection)) {
    return dimensionCollection;
  }

  // Grouper par bubble_id
  const groupedByBubbleId = new Map<string, EntryWithWeight[]>();

  Object.entries(dimensionCollection).forEach(([key, value]) => {
    if (key === 'title') {
      // Conserver les clés spéciales telles quelles
      return;
    }

    // Gérer le cas où value est un tableau (clés dupliquées)
    const values = Array.isArray(value) ? value : [value];

    values.forEach(singleValue => {
      if (!isRecord(singleValue)) {
        return;
      }

      const bubbleId = singleValue.bubble_id;
      if (!bubbleId || typeof bubbleId !== 'string') {
        // Ignorer les éléments sans bubble_id
        return;
      }

      const elementPercentage =
        typeof singleValue.pourcentage === 'number'
          ? singleValue.pourcentage
          : 0;
      const realWeight = (parentPercentage * elementPercentage) / 100;

      if (!groupedByBubbleId.has(bubbleId)) {
        groupedByBubbleId.set(bubbleId, []);
      }
      groupedByBubbleId.get(bubbleId)!.push({
        key,
        value: singleValue,
        weight: realWeight,
      });
    });
  });

  // Fusionner les éléments avec le même bubble_id
  const flattened: Record<string, unknown> = {};

  groupedByBubbleId.forEach(entries => {
    if (entries.length === 0) return;

    // Prendre la première clé comme référence
    const firstEntry = entries[0];

    // Calculer le poids total fusionné
    const totalWeight = entries.reduce((sum, entry) => sum + entry.weight, 0);

    // Calculer le nouveau pourcentage par rapport au parent
    const newPercentage =
      parentPercentage > 0 ? (totalWeight / parentPercentage) * 100 : 0;

    // Créer l'objet fusionné en copiant les propriétés de base du premier élément
    // (mais pas les dimensions enfants, on va les fusionner séparément)
    const merged: Record<string, unknown> = {};
    Object.entries(firstEntry.value).forEach(([key, value]) => {
      // Ne pas copier les dimensions enfants, on va les fusionner
      const allowedChildren = hierarchy[dimensionName]?.children ?? [];
      if (!allowedChildren.includes(key)) {
        merged[key] = value;
      }
    });
    merged.pourcentage = newPercentage;

    // Fusionner récursivement les dimensions enfants
    const allowedChildren = hierarchy[dimensionName]?.children ?? [];
    allowedChildren.forEach(childDimension => {
      // Collecter toutes les collections enfants de tous les entries fusionnés
      const childCollections: Array<{
        collection: Record<string, unknown>;
        weight: number;
      }> = [];

      entries.forEach(entry => {
        const childCollection = entry.value[childDimension];
        if (
          isRecord(childCollection) &&
          Object.keys(childCollection).length > 0
        ) {
          childCollections.push({
            collection: childCollection,
            weight: entry.weight,
          });
        }
      });

      if (childCollections.length > 0) {
        // D'abord, collecter tous les éléments enfants avec leurs contributions
        // en les groupant par bubble_id (pas par clé)
        const childElementsByBubbleId = new Map<
          string,
          Array<{
            key: string;
            value: Record<string, unknown>;
            contribution: number;
          }>
        >();

        childCollections.forEach(({ collection, weight }) => {
          Object.entries(collection).forEach(([childKey, childValue]) => {
            if (childKey === 'title') {
              return; // On gère title séparément
            }

            if (!isRecord(childValue)) {
              return;
            }

            const bubbleId = childValue.bubble_id;
            if (!bubbleId || typeof bubbleId !== 'string') {
              return; // Ignorer les éléments sans bubble_id
            }

            const childPercentage =
              typeof childValue.pourcentage === 'number'
                ? childValue.pourcentage
                : 0;

            // Calculer la contribution de cet enfant au total
            // weight est le poids réel du parent (ex: 25 pour 25%)
            // childPercentage est le pourcentage de l'enfant dans son parent (ex: 100 pour 100%)
            // La contribution = weight * (childPercentage / 100)
            const contribution = weight * (childPercentage / 100);

            if (!childElementsByBubbleId.has(bubbleId)) {
              childElementsByBubbleId.set(bubbleId, []);
            }
            childElementsByBubbleId.get(bubbleId)!.push({
              key: childKey,
              value: childValue,
              contribution,
            });
          });
        });

        // Maintenant, fusionner les éléments avec le même bubble_id
        const mergedChildCollection: Record<string, unknown> = {};

        childElementsByBubbleId.forEach(elements => {
          // Prendre la première clé comme référence
          const firstElement = elements[0];

          // Additionner toutes les contributions
          const totalContribution = elements.reduce(
            (sum, el) => sum + el.contribution,
            0
          );

          // Fusionner toutes les valeurs (garder la première clé)
          const mergedValue: Record<string, unknown> = {
            ...firstElement.value,
          };

          // Fusionner récursivement les dimensions enfants de tous les éléments
          const allowedGrandChildren =
            hierarchy[childDimension]?.children ?? [];
          allowedGrandChildren.forEach(grandChildDimension => {
            const grandChildCollections: Array<{
              collection: Record<string, unknown>;
              contribution: number;
            }> = [];

            elements.forEach(el => {
              const grandChildCollection = el.value[grandChildDimension];
              if (
                isRecord(grandChildCollection) &&
                Object.keys(grandChildCollection).length > 0
              ) {
                grandChildCollections.push({
                  collection: grandChildCollection,
                  contribution: el.contribution,
                });
              }
            });

            if (grandChildCollections.length > 0) {
              // Fusionner récursivement (même logique)
              const mergedGrandChild: Record<string, unknown> = {};
              grandChildCollections.forEach(({ collection, contribution }) => {
                Object.entries(collection).forEach(([key, value]) => {
                  if (key === 'title') {
                    if (!mergedGrandChild[key]) {
                      mergedGrandChild[key] = value;
                    }
                    return;
                  }
                  if (!isRecord(value)) return;

                  const pct =
                    typeof value.pourcentage === 'number'
                      ? value.pourcentage
                      : 0;
                  const childContribution = contribution * (pct / 100);

                  if (!mergedGrandChild[key]) {
                    mergedGrandChild[key] = {
                      ...value,
                      pourcentage: childContribution,
                    };
                  } else {
                    const existing = mergedGrandChild[key];
                    if (isRecord(existing)) {
                      const existingPct =
                        typeof existing.pourcentage === 'number'
                          ? existing.pourcentage
                          : 0;
                      existing.pourcentage = existingPct + childContribution;
                    }
                  }
                });
              });

              // Convertir en pourcentages
              if (totalContribution > 0) {
                Object.entries(mergedGrandChild).forEach(([key, value]) => {
                  if (key === 'title') return;
                  if (
                    isRecord(value) &&
                    typeof value.pourcentage === 'number'
                  ) {
                    value.pourcentage =
                      (value.pourcentage / totalContribution) * 100;
                  }
                });
              }

              normalizePercentages(mergedGrandChild);
              mergedValue[grandChildDimension] = flattenDimension(
                mergedGrandChild,
                grandChildDimension,
                hierarchy,
                (totalContribution / newPercentage) * 100
              );
            }
          });

          // Convertir la contribution totale en pourcentage relatif au nouveau parent
          mergedValue.pourcentage =
            newPercentage > 0 ? (totalContribution / newPercentage) * 100 : 0;

          // Utiliser la première clé rencontrée
          mergedChildCollection[firstElement.key] = mergedValue;
        });

        // Normaliser les pourcentages pour que la somme fasse exactement 100%
        normalizePercentages(mergedChildCollection);

        // Appliquer le flattening récursif sur la collection fusionnée
        // (pour grouper les éléments qui n'ont pas encore été groupés)
        merged[childDimension] = flattenDimension(
          mergedChildCollection,
          childDimension,
          hierarchy,
          newPercentage
        );
      }
    });

    // Utiliser la première clé rencontrée
    flattened[firstEntry.key] = merged;
  });

  // Normaliser les pourcentages
  normalizePercentages(flattened);

  return flattened;
};

/**
 * Flatten un lot complet : applique le flattening sur toutes les dimensions racine
 */
const flattenLot = (
  lot: Record<string, unknown>,
  hierarchy: Record<string, { children: string[] }>
): Record<string, unknown> => {
  const flattened: Record<string, unknown> = {
    ...lot,
  };

  // Conserver les propriétés racine (total, title, frequency, etc.)
  // Appliquer le flattening uniquement sur les dimensions
  Object.keys(hierarchy).forEach(dimensionName => {
    const dimensionValue = lot[dimensionName];
    if (isRecord(dimensionValue)) {
      flattened[dimensionName] = flattenDimension(
        dimensionValue,
        dimensionName,
        hierarchy,
        100 // Au niveau racine, le parent fait 100%
      );
    }
  });

  return flattened;
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);

    if (!isRecord(body)) {
      return buildResponse(
        {
          error: 'Corps de requête JSON invalide',
        },
        400
      );
    }

    const { id, isLive } = body;

    if (typeof id !== 'string' || id.trim() === '') {
      return buildResponse(
        {
          error: 'Paramètre id manquant ou invalide',
        },
        400
      );
    }

    const normalizedIsLive = normalizeBoolean(isLive);
    if (normalizedIsLive === null) {
      return buildResponse(
        {
          error: 'Paramètre isLive manquant ou invalide',
        },
        400
      );
    }

    // Récupérer le lot depuis Bubble
    const lot = await fetchLotRaw('lot', {
      id,
      isLive: normalizedIsLive,
    });

    const hierarchy = getDimensionHierarchy();
    const flattenedLot = flattenLot(lot, hierarchy);

    return buildResponse(flattenedLot, 200);
  } catch (error) {
    if (error instanceof BubbleClientError) {
      const body = error.body;
      const message =
        body && typeof body === 'object'
          ? ((body as { message?: string; error?: string }).message ??
            (body as { message?: string; error?: string }).error)
          : null;

      return buildResponse(
        {
          error: 'Erreur Bubble',
          message: message ?? 'Impossible de récupérer le lot',
        },
        error.status
      );
    }

    console.error('API Flatten - Erreur inattendue:', error);

    return buildResponse(
      {
        error: 'Erreur lors du flattening du lot',
        message: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
}
