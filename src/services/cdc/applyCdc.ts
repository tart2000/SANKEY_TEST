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
  analysis: 'green' | 'yellow' | 'orange' | 'red';
  constraints: Array<{
    bubble_id: string;
    analysis: 'green' | 'yellow' | 'orange' | 'red';
    dimension: string;
    reasonCode: number;
  }>;
};

type TranslationRule = {
  dimension: string;
  outputId: string;
};

type DynamicRule = {
  inputTypeIds: string[];
  outputTypeId: string;
  outputFormatId: string;
};

type ApplyCdcOptions = {
  translationRules?: TranslationRule[];
  dynamicRules?: DynamicRule[];
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

function canBeSatisfiedByDynamicTransfo(
  dimKey: string,
  itemBubbleId: string,
  lot: Lot,
  hierarchy: DimensionHierarchy,
  dynamicRules?: DynamicRule[]
): boolean {
  if (!dynamicRules || dynamicRules.length === 0) return false;

  const normalizedDimKey = normalizeDimensionKey(dimKey, hierarchy);

  if (normalizedDimKey !== 'types' && normalizedDimKey !== 'formats') {
    return false;
  }

  const rule = dynamicRules.find(rule =>
    normalizedDimKey === 'types'
      ? rule.outputTypeId === itemBubbleId
      : rule.outputFormatId === itemBubbleId
  );

  if (!rule) return false;

  return rule.inputTypeIds.some(inputTypeId =>
    itemExistsInLot(lot, 'types', inputTypeId, hierarchy)
  );
}

export function applyCdc(
  lot: Lot,
  cdc: Cdc,
  hierarchy: DimensionHierarchy,
  processingOrder: string[],
  options: ApplyCdcOptions = {}
): CompareResult {
  const { translationRules, dynamicRules } = options;
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

  const analysisByIndex: Record<number, 'green' | 'yellow' | 'orange' | 'red'> =
    {};
  const reasonCodeByIndex: Record<number, number> = {};
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
      const canViaDynamic = canBeSatisfiedByDynamicTransfo(
        dimKey,
        constraint.item,
        initialLot,
        hierarchy,
        dynamicRules
      );
      let constraintAnalysis: 'green' | 'yellow' | 'orange' | 'red';
      if (include) {
        if (dimensionPresent && itemInCurrentLot) {
          constraintAnalysis = 'green';
          reasonCodeByIndex[i] = 100; // include_present_in_current_lot
        } else if (canViaTranslation || canViaDynamic) {
          constraintAnalysis = 'yellow';
          // Distinguer translation vs dynamique si possible
          reasonCodeByIndex[i] = canViaTranslation ? 110 : 120;
        } else if (hasPriority) {
          if (itemInInitialLot) {
            constraintAnalysis = 'red';
            priorityPresentElsewhere = true;
            reasonCodeByIndex[i] = 130; // include_priority_present_elsewhere
          } else {
            constraintAnalysis = 'red';
            reasonCodeByIndex[i] = 140; // include_priority_missing_unreachable
          }
        } else {
          constraintAnalysis = 'orange';
          // Dimension non prioritaire, item ni présent ni atteignable
          reasonCodeByIndex[i] = 150; // include_non_priority_missing
        }
      } else {
        if (dimensionPresent && itemInCurrentLot) {
          constraintAnalysis = 'orange';
          reasonCodeByIndex[i] = 200; // exclude_item_still_present
        } else if (dimensionPresent && dimensionPresentInLot) {
          constraintAnalysis = 'green';
          reasonCodeByIndex[i] = 210; // exclude_item_successfully_removed
        } else {
          constraintAnalysis = 'orange';
          reasonCodeByIndex[i] = 220; // exclude_dimension_absent_or_empty
        }
      }
      analysisByIndex[i] = constraintAnalysis;
    }
    currentLot = nextLot;
  }

  // Propagation : rétrograde un parent green en orange si un descendant est orange/red
  const getAllDescendants = (dimKey: string): string[] => {
    const children = hierarchy[dimKey]?.children ?? [];
    const all = [...children];
    for (const child of children) {
      all.push(...getAllDescendants(child));
    }
    return all;
  };

  for (let i = 0; i < constraints.length; i++) {
    if (analysisByIndex[i] !== 'green') continue;

    const dimKey = normalizeDimensionKey(constraints[i].dimension, hierarchy);
    const descendants = getAllDescendants(dimKey);
    if (descendants.length === 0) continue;

    const hasFailedDescendant = constraints.some((c, j) => {
      if (j === i) return false;
      const otherDimKey = normalizeDimensionKey(c.dimension, hierarchy);
      if (!descendants.includes(otherDimKey)) return false;
      return analysisByIndex[j] === 'orange' || analysisByIndex[j] === 'red';
    });

    if (hasFailedDescendant) {
      analysisByIndex[i] = 'orange';
      reasonCodeByIndex[i] = 160; // green_downgraded_child_dimension_failed
    }
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
  const hasYellow = Object.values(analysisByIndex).some(a => a === 'yellow');
  const analysis: 'green' | 'yellow' | 'orange' | 'red' = hasRed
    ? 'red'
    : hasOrange || hasYellow || isFlagged
      ? 'orange'
      : 'green';

  const constraintsOut = constraints.map((c, i) => ({
    bubble_id: c.bubble_id,
    analysis: analysisByIndex[i] ?? 'orange',
    dimension: c.dimension,
    reasonCode: reasonCodeByIndex[i] ?? 0,
  }));

  return {
    target,
    target_pct,
    isFlagged,
    analysis,
    constraints: constraintsOut,
  };
}
