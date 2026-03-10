import type { DimensionHierarchy } from '@/lib/dimensions';
import {
  buildPathToDimension,
  selectBy,
  type Lot,
  type SelectByOptions,
} from '@/lib/selectByCore';

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

type TranslationRule = {
  dimension: string;
  outputId: string;
};

type ApplyCdcOptions = {
  translationRules?: TranslationRule[];
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

/** Vérifie si la dimension existe dans le lot au bon endroit (selon la hiérarchie). */
function dimensionExistsInLot(
  lot: Lot,
  dimKey: string,
  hierarchy: DimensionHierarchy
): boolean {
  const path = buildPathToDimension(dimKey, hierarchy);
  if (path.length === 0) {
    return Boolean((lot as Record<string, unknown>)[dimKey]);
  }
  let nodes: unknown[] = [lot];
  for (const p of path) {
    const next: unknown[] = [];
    for (const node of nodes) {
      if (!node || typeof node !== 'object' || Array.isArray(node)) continue;
      const obj = node as Record<string, unknown>;
      const val = obj[p];
      if (val == null || typeof val !== 'object' || Array.isArray(val))
        continue;
      const coll = val as Record<string, unknown>;
      for (const k of Object.keys(coll)) {
        next.push(coll[k]);
      }
    }
    nodes = next;
  }
  for (const node of nodes) {
    if (
      node &&
      typeof node === 'object' &&
      !Array.isArray(node) &&
      dimKey in (node as Record<string, unknown>)
    ) {
      return true;
    }
  }
  return false;
}

/** Vérifie si l'item (bubble_id) est présent dans le lot pour la dimension donnée. */
function itemExistsInLot(
  lot: Lot,
  dimKey: string,
  itemBubbleId: string,
  hierarchy: DimensionHierarchy
): boolean {
  const path = buildPathToDimension(dimKey, hierarchy);
  if (path.length === 0) {
    const coll = (lot as Record<string, unknown>)[dimKey] as
      | Record<string, { bubble_id?: string }>
      | undefined;
    if (!coll || typeof coll !== 'object') return false;
    for (const key of Object.keys(coll)) {
      const el = coll[key];
      if (el && typeof el === 'object' && el.bubble_id === itemBubbleId) {
        return true;
      }
    }
    return false;
  }
  let nodes: unknown[] = [lot];
  for (const p of path) {
    const next: unknown[] = [];
    for (const node of nodes) {
      if (!node || typeof node !== 'object' || Array.isArray(node)) continue;
      const obj = node as Record<string, unknown>;
      const val = obj[p];
      if (val == null || typeof val !== 'object' || Array.isArray(val))
        continue;
      const coll = val as Record<string, unknown>;
      for (const k of Object.keys(coll)) {
        next.push(coll[k]);
      }
    }
    nodes = next;
  }
  for (const node of nodes) {
    if (!node || typeof node !== 'object' || Array.isArray(node)) continue;
    const coll = (node as Record<string, unknown>)[dimKey] as
      | Record<string, { bubble_id?: string }>
      | undefined;
    if (!coll || typeof coll !== 'object') continue;
    for (const key of Object.keys(coll)) {
      const el = coll[key];
      if (el && typeof el === 'object' && el.bubble_id === itemBubbleId) {
        return true;
      }
    }
  }
  return false;
}

type ConstraintWithIndex = CdcConstraint & { _index: number };

function buildOptions(constraint: CdcConstraint): SelectByOptions {
  if (
    !hasThresholdContent(constraint.hasThreshold) ||
    !constraint.hasThreshold ||
    typeof constraint.hasThreshold !== 'object' ||
    !('value' in constraint.hasThreshold) ||
    !('threshold' in constraint.hasThreshold)
  ) {
    return {};
  }
  const ht = constraint.hasThreshold as {
    value?: number;
    threshold?: string;
  };
  return {
    threshold: ht.value ?? null,
    condition:
      (ht.threshold === 'over' || ht.threshold === 'under'
        ? ht.threshold
        : undefined) ?? null,
  };
}

/** Group constraints by (dimKey, include); each group = one selectBy with all item bubble_ids (OR). */
function groupConstraintsByDimension(
  sorted: ConstraintWithIndex[],
  hierarchy: DimensionHierarchy
): Array<{
  dimKey: string;
  include: boolean;
  itemIds: string[];
  indices: number[];
  options: SelectByOptions;
  hasPriority: boolean;
}> {
  const groups: Array<{
    dimKey: string;
    include: boolean;
    itemIds: string[];
    indices: number[];
    options: SelectByOptions;
    hasPriority: boolean;
  }> = [];
  let current: {
    dimKey: string;
    include: boolean;
    itemIds: string[];
    indices: number[];
    options: SelectByOptions;
    hasPriority: boolean;
  } | null = null;

  for (const c of sorted) {
    const dimKey = normalizeDimensionKey(c.dimension, hierarchy);
    const include = c.include === true;
    const def = hierarchy[dimKey];
    const isPriority = Boolean(def?.isPriority);

    if (current && current.dimKey === dimKey && current.include === include) {
      current.itemIds.push(c.item);
      current.indices.push(c._index);
      if (isPriority) current.hasPriority = true;
      if (current.itemIds.length > 1) {
        current.options = {};
      } else if (hasThresholdContent(c.hasThreshold)) {
        current.options = buildOptions(c);
      }
    } else {
      if (current) groups.push(current);
      current = {
        dimKey,
        include,
        itemIds: [c.item],
        indices: [c._index],
        options: hasThresholdContent(c.hasThreshold) ? buildOptions(c) : {},
        hasPriority: isPriority,
      };
    }
  }
  if (current) groups.push(current);
  return groups;
}

function canBeSatisfiedByTranslation(
  dimKey: string,
  itemBubbleId: string,
  lot: Lot,
  hierarchy: DimensionHierarchy,
  translationRules?: TranslationRule[]
): boolean {
  if (!translationRules || translationRules.length === 0) return false;

  const rule = translationRules.find(rule => {
    const ruleDimKey = normalizeDimensionKey(rule.dimension, hierarchy);
    return ruleDimKey === dimKey && rule.outputId === itemBubbleId;
  });

  if (!rule) return false;

  return dimensionExistsInLot(lot, dimKey, hierarchy);
}

export function applyCdc(
  lot: Lot,
  cdc: Cdc,
  hierarchy: DimensionHierarchy,
  processingOrder: string[],
  options: ApplyCdcOptions = {}
): CompareResult {
  const { translationRules } = options;
  const constraints = cdc.constraints ?? [];
  const totalLot = (lot.total as number) || 0;

  const constraintByIndex: ConstraintWithIndex[] = constraints.map(
    (c, index) => ({ ...c, _index: index })
  );
  const orderRank = (dimKey: string) => {
    const i = processingOrder.indexOf(dimKey);
    return i >= 0 ? i : processingOrder.length;
  };
  const sortedForCalculation = [...constraintByIndex].sort(
    (a, b) =>
      orderRank(normalizeDimensionKey(a.dimension, hierarchy)) -
      orderRank(normalizeDimensionKey(b.dimension, hierarchy))
  );

  const groups = groupConstraintsByDimension(sortedForCalculation, hierarchy);

  const analysisByIndex: Record<number, 'green' | 'orange' | 'red'> = {};
  const initialLot: Lot = JSON.parse(JSON.stringify(lot));
  let currentLot: Lot = JSON.parse(JSON.stringify(lot));
  let priorityPresentElsewhere = false;

  for (const group of groups) {
    const { dimKey, include, itemIds, indices, options, hasPriority } = group;
    const def = hierarchy[dimKey];
    const dimensionPresent = Boolean(def);
    const dimensionPresentInLot = dimensionExistsInLot(
      currentLot,
      dimKey,
      hierarchy
    );

    const result = dimensionPresent
      ? selectBy(currentLot, dimKey, itemIds, options, hierarchy)
      : { targetLot: { total: 0 } as Lot, coProductLot: currentLot };

    const nextLot = include ? result.targetLot : result.coProductLot;

    for (const i of indices) {
      const constraint = constraints[i];
      const itemInCurrentLot = itemExistsInLot(
        currentLot,
        dimKey,
        constraint.item,
        hierarchy
      );
      const itemInInitialLot = itemExistsInLot(
        initialLot,
        dimKey,
        constraint.item,
        hierarchy
      );
      const canViaTranslation = canBeSatisfiedByTranslation(
        dimKey,
        constraint.item,
        initialLot,
        hierarchy,
        translationRules
      );
      let constraintAnalysis: 'green' | 'orange' | 'red';
      if (include) {
        if (dimensionPresent && itemInCurrentLot) {
          constraintAnalysis = 'green';
        } else if (canViaTranslation) {
          constraintAnalysis = 'green';
        } else if (hasPriority) {
          if (itemInInitialLot) {
            constraintAnalysis = 'orange';
            priorityPresentElsewhere = true;
          } else {
            constraintAnalysis = 'red';
          }
        } else {
          constraintAnalysis = 'orange';
        }
      } else {
        constraintAnalysis =
          dimensionPresent && itemInCurrentLot
            ? 'orange'
            : dimensionPresent && dimensionPresentInLot
              ? 'green'
              : 'orange';
      }
      analysisByIndex[i] = constraintAnalysis;
    }
    currentLot = nextLot;
  }

  const target = (currentLot.total as number) ?? 0;
  const target_pct = totalLot > 0 ? (target / totalLot) * 100 : 0;

  const uniqueDimensionKeys = [
    ...new Set(
      constraints.map(c => normalizeDimensionKey(c.dimension, hierarchy))
    ),
  ];
  const isFlagged =
    getSiblingDimensions(uniqueDimensionKeys, hierarchy) ||
    priorityPresentElsewhere;

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
