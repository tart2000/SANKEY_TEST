import type { DimensionHierarchy } from '@/lib/dimensions';
import type { Lot } from '@/lib/selectByCore';
import type { Cdc, CdcConstraint } from '@/services/cdc/applyCdc';

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

type SelectByOptions = {
  threshold?: number | null;
  condition?: 'over' | 'under' | null;
};

type LabeledCdcConstraint = CdcConstraint & {
  fr_fr?: string;
  en_gb?: string;
};

type ConstraintWithIndex = LabeledCdcConstraint & { _index: number };

type GroupedConstraint = {
  dimKey: string;
  include: boolean;
  itemIds: string[];
  indices: number[];
  options: SelectByOptions;
  hasPriority: boolean;
};

function hasThresholdContent(hasThreshold: unknown): boolean {
  if (!hasThreshold || typeof hasThreshold !== 'object') return false;
  return Object.keys(hasThreshold as object).length > 0;
}

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

function groupConstraintsByDimension(
  sorted: ConstraintWithIndex[],
  hierarchy: DimensionHierarchy
): GroupedConstraint[] {
  const groups: GroupedConstraint[] = [];
  let current: GroupedConstraint | null = null;

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

export type ScenarioNode = {
  transformations: Transformation[];
  coproduct_scenario?: ScenarioNode;
  target?: string;
  title?: string;
};

export type Transformation = {
  type: string[];
  keys: string[];
  _displayNames?: string[][];
  _nodeId?: string;
  _index?: number;
  scenario?: ScenarioNode;
  coproduct_scenario?: ScenarioNode;
  threshold?: number | null;
  condition?: 'over' | 'under' | null;
};

function getSelectByNameForDimension(dimKey: string): string | null {
  switch (dimKey) {
    case 'formats':
      return 'selectByFormat';
    case 'types':
      return 'selectByType';
    case 'matieres':
      return 'selectByMatiere';
    case 'fibres':
      return 'selectByFibre';
    case 'couleurs':
      return 'selectByCouleur';
    case 'perturbateurs':
      return 'selectByPerturbateur';
    case 'proprete':
      return 'selectByProprete';
    case 'qualite':
      return 'selectByQualite';
    default:
      return null;
  }
}

function buildDisplayNamesForGroup(
  group: GroupedConstraint,
  constraints: LabeledCdcConstraint[]
): string[][] {
  const labels: string[] = [];
  for (const index of group.indices) {
    const c = constraints[index];
    if (typeof c.fr_fr === 'string' && c.fr_fr.length > 0) {
      labels.push(c.fr_fr);
    } else if (typeof c.en_gb === 'string' && c.en_gb.length > 0) {
      labels.push(c.en_gb);
    } else {
      labels.push(c.item);
    }
  }
  return [labels];
}

export function buildScenarioFromCdc(
  _lot: Lot,
  cdc: Cdc,
  hierarchy: DimensionHierarchy,
  processingOrder: string[]
): ScenarioNode {
  const constraints = (cdc.constraints ?? []) as LabeledCdcConstraint[];
  const constraintByIndex: ConstraintWithIndex[] = constraints.map(
    (c, index) => ({ ...c, _index: index })
  );

  const orderRank = (dimKey: string) => {
    const i = processingOrder.indexOf(dimKey);
    return i >= 0 ? i : processingOrder.length;
  };

  const sortedForScenario = [...constraintByIndex].sort(
    (a, b) =>
      orderRank(normalizeDimensionKey(a.dimension, hierarchy)) -
      orderRank(normalizeDimensionKey(b.dimension, hierarchy))
  );

  const groups = groupConstraintsByDimension(sortedForScenario, hierarchy);

  const root: ScenarioNode = {
    transformations: [],
    coproduct_scenario: {
      transformations: [],
    },
  };

  let currentContainer: ScenarioNode = root;

  for (const group of groups) {
    const selectByName = getSelectByNameForDimension(group.dimKey);
    if (!selectByName) {
      continue;
    }

    const transformation: Transformation = {
      type: [selectByName],
      keys: group.itemIds,
      _displayNames: buildDisplayNamesForGroup(group, constraints),
      _nodeId: `${selectByName}_${group.dimKey}_${currentContainer.transformations.length}`,
      _index: currentContainer.transformations.length,
    };

    if (group.dimKey === 'fibres') {
      if (group.options.threshold != null) {
        transformation.threshold = group.options.threshold;
      }
      if (group.options.condition) {
        transformation.condition = group.options.condition;
      }
    }

    transformation.scenario = {
      transformations: [],
      coproduct_scenario: {
        transformations: [],
      },
    };
    transformation.coproduct_scenario = {
      transformations: [],
    };

    currentContainer.transformations.push(transformation);

    if (group.include) {
      currentContainer = transformation.scenario!;
    }
  }

  const targetId =
    typeof cdc.bubble_id === 'string' && cdc.bubble_id.trim().length > 0
      ? cdc.bubble_id
      : undefined;
  const title =
    (typeof (cdc as Record<string, unknown>).Title === 'string' &&
    (cdc as Record<string, unknown>).Title
      ? ((cdc as Record<string, unknown>).Title as string)
      : undefined) ??
    (typeof (cdc as Record<string, unknown>).title === 'string' &&
    (cdc as Record<string, unknown>).title
      ? ((cdc as Record<string, unknown>).title as string)
      : undefined) ??
    'CDC';

  if (targetId) {
    currentContainer.target = targetId;
  }
  currentContainer.title = title;

  return root;
}
