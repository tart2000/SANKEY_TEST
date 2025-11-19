import type { NextRequest } from 'next/server';

import { BubbleClientError, fetchBubbleLot } from '@/lib/bubbleClient';
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

    if (!isRecord(value)) {
      return;
    }

    const bubbleId = value.bubble_id;
    if (!bubbleId || typeof bubbleId !== 'string') {
      // Ignorer les éléments sans bubble_id
      return;
    }

    const elementPercentage =
      typeof value.pourcentage === 'number' ? value.pourcentage : 0;
    const realWeight = (parentPercentage * elementPercentage) / 100;

    if (!groupedByBubbleId.has(bubbleId)) {
      groupedByBubbleId.set(bubbleId, []);
    }
    groupedByBubbleId.get(bubbleId)!.push({
      key,
      value,
      weight: realWeight,
    });
  });

  // Fusionner les éléments avec le même bubble_id
  const flattened: Record<string, unknown> = {};

  groupedByBubbleId.forEach(entries => {
    if (entries.length === 0) return;

    // Prendre la première clé comme référence
    const firstEntry = entries[0];
    const merged: Record<string, unknown> = { ...firstEntry.value };

    // Calculer le poids total fusionné
    const totalWeight = entries.reduce((sum, entry) => sum + entry.weight, 0);

    // Calculer le nouveau pourcentage par rapport au parent
    const newPercentage =
      parentPercentage > 0 ? (totalWeight / parentPercentage) * 100 : 0;
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
        // Fusionner toutes les collections enfants
        const mergedChildCollection: Record<string, unknown> = {};

        childCollections.forEach(({ collection, weight }) => {
          Object.entries(collection).forEach(([childKey, childValue]) => {
            if (childKey === 'title') {
              // Conserver les clés spéciales
              if (!mergedChildCollection[childKey]) {
                mergedChildCollection[childKey] = childValue;
              }
              return;
            }

            if (!isRecord(childValue)) {
              return;
            }

            if (!mergedChildCollection[childKey]) {
              // Nouvelle clé : créer une copie avec le pourcentage ajusté
              const childPercentage =
                typeof childValue.pourcentage === 'number'
                  ? childValue.pourcentage
                  : 0;
              // Calculer le pourcentage relatif au nouveau parent
              const relativePercentage =
                newPercentage > 0
                  ? (weight / newPercentage) * 100 * (childPercentage / 100)
                  : 0;

              mergedChildCollection[childKey] = {
                ...childValue,
                pourcentage: relativePercentage,
              };
            } else {
              // Clé déjà présente : additionner les pourcentages
              const existing = mergedChildCollection[childKey];
              if (isRecord(existing)) {
                const existingPercentage =
                  typeof existing.pourcentage === 'number'
                    ? existing.pourcentage
                    : 0;
                const childPercentage =
                  typeof childValue.pourcentage === 'number'
                    ? childValue.pourcentage
                    : 0;
                const relativePercentage =
                  newPercentage > 0
                    ? (weight / newPercentage) * 100 * (childPercentage / 100)
                    : 0;

                existing.pourcentage = existingPercentage + relativePercentage;
              }
            }
          });
        });

        // Appliquer le flattening récursif sur la collection fusionnée
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

    const lot = await fetchBubbleLot({ id, isLive: normalizedIsLive });
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
