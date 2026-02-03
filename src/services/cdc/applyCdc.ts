import type { DimensionHierarchy } from '@/lib/dimensions';
import { selectBy, type Lot, type SelectByOptions } from '@/lib/selectByCore';

const BUBBLE_DIMENSION_TO_KEY: Record<string, string> = {
  Format: 'formats',
  Formats: 'formats',
  Type: 'types',
  Types: 'types',
  Matiere: 'matieres',
  Matieres: 'matieres',
  Fibre: 'fibres',
  Fibres: 'fibres',
  Couleur: 'couleurs',
  Couleurs: 'couleurs',
  Perturbateur: 'perturbateurs',
  Perturbateurs: 'perturbateurs',
  Proprete: 'proprete',
  Qualite: 'qualite',
};

function normalizeDimensionKey(
  key: string,
  hierarchy: DimensionHierarchy
): string {
  const mapped = BUBBLE_DIMENSION_TO_KEY[key];
  if (mapped && hierarchy[mapped]) return mapped;
  const lower = key.toLowerCase();
  if (hierarchy[lower]) return lower;
  return key;
}

export type CdcConstraint = {
  bubble_id: string;
  dimension: string;
  item: string;
  include: boolean;
  hasThreshold?: Record<string, unknown> | object;
};

export type Cdc = {
  constraints: CdcConstraint[];
  [key: string]: unknown;
};

export type CompareResult = {
  target: number;
  target_pct: number;
  isFlagged: boolean;
  analysis: 'green' | 'orange' | 'red';
  constraints: Array<{
    bubble_id: string;
    analysis: 'green' | 'orange' | 'red';
    dimension: string;
  }>;
};

function hasThresholdContent(hasThreshold: unknown): boolean {
  if (!hasThreshold || typeof hasThreshold !== 'object') return false;
  return Object.keys(hasThreshold as object).length > 0;
}

function getSiblingDimensions(
  constraintDimensions: string[],
  hierarchy: DimensionHierarchy
): boolean {
  const parents = constraintDimensions.map(dim => {
    const def = hierarchy[dim];
    return def?.parent ?? null;
  });
  const seen = new Set<string | null>();
  for (const p of parents) {
    if (p != null && seen.has(p)) return true;
    if (p != null) seen.add(p);
  }
  return false;
}

export function applyCdc(
  lot: Lot,
  cdc: Cdc,
  hierarchy: DimensionHierarchy,
  processingOrder: string[]
): CompareResult {
  const constraints = cdc.constraints ?? [];
  const totalLot = (lot.total as number) || 0;

  const constraintByIndex = constraints.map((c, index) => ({
    ...c,
    _index: index,
  }));
  const orderRank = (dimKey: string) => {
    const i = processingOrder.indexOf(dimKey);
    return i >= 0 ? i : processingOrder.length;
  };
  const sortedForCalculation = [...constraintByIndex].sort(
    (a, b) =>
      orderRank(normalizeDimensionKey(a.dimension, hierarchy)) -
      orderRank(normalizeDimensionKey(b.dimension, hierarchy))
  );

  const analysisByIndex: Record<number, 'green' | 'orange' | 'red'> = {};
  let currentLot: Lot = JSON.parse(JSON.stringify(lot));

  for (const constraint of sortedForCalculation) {
    const dimKey = normalizeDimensionKey(constraint.dimension, hierarchy);
    const def = hierarchy[dimKey];
    const dimensionPresent = Boolean(def);
    const itemId = constraint.item;
    const include = constraint.include === true;

    let options: SelectByOptions = {};
    if (
      hasThresholdContent(constraint.hasThreshold) &&
      constraint.hasThreshold &&
      typeof constraint.hasThreshold === 'object' &&
      'value' in constraint.hasThreshold &&
      'threshold' in constraint.hasThreshold
    ) {
      const ht = constraint.hasThreshold as {
        value?: number;
        threshold?: string;
      };
      options = {
        threshold: ht.value ?? null,
        condition:
          (ht.threshold === 'over' || ht.threshold === 'under'
            ? ht.threshold
            : undefined) ?? null,
      };
    }

    const result = dimensionPresent
      ? selectBy(currentLot, dimKey, [itemId], options, hierarchy)
      : { targetLot: { total: 0 } as Lot, coProductLot: currentLot };

    const nextLot = include ? result.targetLot : result.coProductLot;
    const targetMass = (result.targetLot.total as number) ?? 0;
    const dimensionPresentInLot = Boolean(
      (currentLot as Record<string, unknown>)[dimKey]
    );

    let constraintAnalysis: 'green' | 'orange' | 'red' = 'green';
    if (include) {
      if (!dimensionPresent || !dimensionPresentInLot || targetMass <= 0) {
        constraintAnalysis = def?.isPriority ? 'red' : 'orange';
      }
    } else {
      if (!dimensionPresent || !dimensionPresentInLot) {
        constraintAnalysis = 'orange';
      }
    }

    analysisByIndex[constraint._index] = constraintAnalysis;
    currentLot = nextLot;
  }

  const target = (currentLot.total as number) ?? 0;
  const target_pct = totalLot > 0 ? (target / totalLot) * 100 : 0;

  const uniqueDimensionKeys = [
    ...new Set(
      constraints.map(c => normalizeDimensionKey(c.dimension, hierarchy))
    ),
  ];
  const isFlagged = getSiblingDimensions(uniqueDimensionKeys, hierarchy);

  const hasRed = Object.values(analysisByIndex).some(a => a === 'red');
  const hasOrange = Object.values(analysisByIndex).some(a => a === 'orange');
  const analysis: 'green' | 'orange' | 'red' = hasRed
    ? 'red'
    : hasOrange || isFlagged
      ? 'orange'
      : 'green';

  const constraintsOut = constraints.map((c, i) => ({
    bubble_id: c.bubble_id,
    analysis: analysisByIndex[i] ?? 'orange',
    dimension: c.dimension,
  }));

  return {
    target,
    target_pct,
    isFlagged,
    analysis,
    constraints: constraintsOut,
  };
}
