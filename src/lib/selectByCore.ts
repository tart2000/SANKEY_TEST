import type { DimensionHierarchy } from './dimensions';

export type Lot = Record<string, unknown>;

export type SelectByOptions = {
  threshold?: number | null;
  condition?: 'over' | 'under' | null;
};

export type SelectByResult = {
  targetLot: Lot;
  coProductLot: Lot;
};

export function buildPathToDimension(
  dimensionName: string,
  hierarchy: DimensionHierarchy
): string[] {
  const def = hierarchy[dimensionName];
  if (!def) {
    return [];
  }

  const path: string[] = [];
  let current: string = dimensionName;

  while (hierarchy[current]?.parent) {
    current = hierarchy[current].parent as string;
    path.unshift(current);
  }

  return path;
}

function selectByLevel1Direct(
  lot: Lot,
  dimensionName: string,
  selectedBubbleIds: string[]
): SelectByResult {
  const dist = lot[dimensionName] as
    | Record<
        string,
        { pourcentage?: number; bubble_id?: string; color?: string }
      >
    | undefined;
  if (!dist || typeof dist !== 'object') {
    const emptyLot: Lot = { total: 0 };
    (emptyLot as Record<string, unknown>)[dimensionName] = {};
    return {
      targetLot: emptyLot,
      coProductLot: lot,
    };
  }

  const selected: Record<string, unknown> = {};
  const rest: Record<string, unknown> = {};
  let selectedPct = 0;
  let restPct = 0;

  for (const [key, value] of Object.entries(dist)) {
    const val = value as {
      pourcentage?: number;
      bubble_id?: string;
      color?: string;
    };
    const pourcentage =
      typeof val === 'object' && val !== null && val.pourcentage !== undefined
        ? val.pourcentage
        : 0;

    if (val?.bubble_id && selectedBubbleIds.includes(val.bubble_id)) {
      (selected as Record<string, unknown>)[key] = JSON.parse(
        JSON.stringify(value)
      );
      selectedPct += pourcentage;
    } else {
      (rest as Record<string, unknown>)[key] = JSON.parse(
        JSON.stringify(value)
      );
      restPct += pourcentage;
    }
  }

  if (selectedPct > 0) {
    for (const k of Object.keys(selected)) {
      const o = (selected as Record<string, { pourcentage: number }>)[k];
      if (o && typeof o === 'object')
        o.pourcentage = (o.pourcentage / selectedPct) * 100;
    }
  }

  if (restPct > 0) {
    for (const k of Object.keys(rest)) {
      const o = (rest as Record<string, { pourcentage: number }>)[k];
      if (o && typeof o === 'object')
        o.pourcentage = (o.pourcentage / restPct) * 100;
    }
  }

  const targetLot = JSON.parse(JSON.stringify(lot)) as Lot;
  (targetLot as Record<string, unknown>)[dimensionName] = selected;
  targetLot.total = ((lot.total as number) * selectedPct) / 100;

  const coProductLot = JSON.parse(JSON.stringify(lot)) as Lot;
  (coProductLot as Record<string, unknown>)[dimensionName] = rest;
  coProductLot.total = ((lot.total as number) * restPct) / 100;

  return { targetLot, coProductLot };
}

type TraverseResult = {
  selected: Record<string, unknown> | null;
  rest: Record<string, unknown> | null;
  selectedMass: number;
  restMass: number;
};

function separateByBubbleId(
  obj: Record<string, unknown>,
  dimensionName: string,
  selectedBubbleIds: string[],
  _totalLotMass: number,
  parentMass: number,
  options: SelectByOptions
): TraverseResult {
  const threshold = options.threshold ?? null;
  const condition = options.condition ?? null;
  const dist = (obj[dimensionName] || {}) as Record<
    string,
    { pourcentage?: number; bubble_id?: string; color?: string }
  >;

  if (Object.keys(dist).length === 0) {
    return {
      selected: null,
      rest: obj,
      selectedMass: 0,
      restMass: parentMass,
    };
  }

  if (dimensionName === 'fibres') {
    let shouldSelectMatiere = false;
    for (const [, value] of Object.entries(dist)) {
      const pct =
        typeof value === 'object' &&
        value !== null &&
        value.pourcentage !== undefined
          ? value.pourcentage
          : 0;
      const matchesBubbleId =
        value?.bubble_id && selectedBubbleIds.includes(value.bubble_id);
      if (matchesBubbleId) {
        let matchesThreshold = true;
        if (threshold != null && condition && selectedBubbleIds.length === 1) {
          if (condition === 'over') matchesThreshold = pct >= threshold;
          else if (condition === 'under') matchesThreshold = pct <= threshold;
        }
        if (matchesThreshold) {
          shouldSelectMatiere = true;
          break;
        }
      }
    }
    if (shouldSelectMatiere) {
      return {
        selected: JSON.parse(JSON.stringify(obj)) as Record<string, unknown>,
        rest: null,
        selectedMass: parentMass,
        restMass: 0,
      };
    }
    return {
      selected: null,
      rest: obj,
      selectedMass: 0,
      restMass: parentMass,
    };
  }

  const selected: Record<string, unknown> = {};
  const rest: Record<string, unknown> = {};
  let selectedPct = 0;
  let restPct = 0;

  for (const [key, value] of Object.entries(dist)) {
    const pct =
      typeof value === 'object' &&
      value !== null &&
      value.pourcentage !== undefined
        ? value.pourcentage
        : 0;
    const matchesBubbleId =
      value?.bubble_id && selectedBubbleIds.includes(value.bubble_id);
    let matchesThreshold = true;
    if (threshold != null && condition && selectedBubbleIds.length === 1) {
      if (condition === 'over') matchesThreshold = pct >= threshold;
      else if (condition === 'under') matchesThreshold = pct <= threshold;
    }
    if (matchesBubbleId && matchesThreshold) {
      (selected as Record<string, unknown>)[key] = JSON.parse(
        JSON.stringify(value)
      );
      if (value?.color)
        (selected as Record<string, { color?: string }>)[key].color =
          value.color;
      selectedPct += pct;
    } else {
      (rest as Record<string, unknown>)[key] = JSON.parse(
        JSON.stringify(value)
      );
      if (value?.color)
        (rest as Record<string, { color?: string }>)[key].color = value.color;
      restPct += pct;
    }
  }

  if (selectedPct > 0) {
    for (const k of Object.keys(selected)) {
      const o = (selected as Record<string, { pourcentage: number }>)[k];
      if (o && typeof o === 'object')
        o.pourcentage = (o.pourcentage / selectedPct) * 100;
    }
  } else {
    for (const k of Object.keys(selected)) {
      const o = (selected as Record<string, { pourcentage: number }>)[k];
      if (o && typeof o === 'object') o.pourcentage = 0;
    }
  }

  if (restPct > 0) {
    for (const k of Object.keys(rest)) {
      const o = (rest as Record<string, { pourcentage: number }>)[k];
      if (o && typeof o === 'object')
        o.pourcentage = (o.pourcentage / restPct) * 100;
    }
  } else {
    for (const k of Object.keys(rest)) {
      const o = (rest as Record<string, { pourcentage: number }>)[k];
      if (o && typeof o === 'object') o.pourcentage = 0;
    }
  }

  const selectedMass = parentMass * (selectedPct / 100);
  const restMass = parentMass * (restPct / 100);
  const selectedObj =
    selectedPct > 0 ? { ...obj, [dimensionName]: selected } : null;
  const restObj = restPct > 0 ? { ...obj, [dimensionName]: rest } : obj;

  return {
    selected: selectedObj,
    rest: restObj,
    selectedMass,
    restMass,
  };
}

function traverseAndSeparate(
  obj: Record<string, unknown>,
  pathRemaining: string[],
  targetDimension: string,
  selectedBubbleIds: string[],
  totalLotMass: number,
  parentMass: number,
  options: SelectByOptions
): TraverseResult {
  if (pathRemaining.length === 0) {
    return separateByBubbleId(
      obj,
      targetDimension,
      selectedBubbleIds,
      totalLotMass,
      parentMass,
      options
    );
  }

  const currentDimension = pathRemaining[0];
  const remainingPath = pathRemaining.slice(1);
  const currentObj = obj[currentDimension];

  if (
    !currentObj ||
    typeof currentObj !== 'object' ||
    Array.isArray(currentObj)
  ) {
    return {
      selected: null,
      rest: JSON.parse(JSON.stringify(obj)) as Record<string, unknown>,
      selectedMass: 0,
      restMass: parentMass,
    };
  }

  const currentLevelMass = parentMass;
  const selectedResult: Record<string, unknown> = {};
  const restResult: Record<string, unknown> = {};
  let selectedMassTotal = 0;
  let restMassTotal = 0;
  const elementMassesSelected: Record<string, number> = {};
  const elementMassesRest: Record<string, number> = {};

  const curObj = currentObj as Record<string, unknown>;
  for (const [key, value] of Object.entries(curObj)) {
    const val = value as Record<string, unknown> & { pourcentage?: number };
    const elementPct =
      typeof val?.pourcentage === 'number'
        ? val.pourcentage
        : typeof value === 'number'
          ? value
          : 0;
    const elementMass = currentLevelMass * (elementPct / 100);

    const result = traverseAndSeparate(
      val as Record<string, unknown>,
      remainingPath,
      targetDimension,
      selectedBubbleIds,
      totalLotMass,
      elementMass,
      options
    );

    if (result.selectedMass > 0) {
      (selectedResult as Record<string, unknown>)[key] = JSON.parse(
        JSON.stringify(result.selected)
      );
      const sel = (
        selectedResult as Record<
          string,
          Record<string, unknown> & { color?: string }
        >
      )[key];
      if (val?.color && sel && !sel.color) sel.color = val.color as string;
      elementMassesSelected[key] = result.selectedMass;
      selectedMassTotal += result.selectedMass;
    }

    if (result.restMass > 0) {
      (restResult as Record<string, unknown>)[key] = JSON.parse(
        JSON.stringify(result.rest)
      );
      const r = (
        restResult as Record<
          string,
          Record<string, unknown> & { color?: string }
        >
      )[key];
      if (val?.color && r && !r.color) r.color = val.color as string;
      elementMassesRest[key] = result.restMass;
      restMassTotal += result.restMass;
    } else if (result.selectedMass === 0 && result.restMass === 0) {
      (restResult as Record<string, unknown>)[key] = JSON.parse(
        JSON.stringify(value)
      );
      const r = (
        restResult as Record<
          string,
          Record<string, unknown> & { color?: string }
        >
      )[key];
      if (val?.color && r) r.color = val.color as string;
      elementMassesRest[key] = elementMass;
      restMassTotal += elementMass;
    }
  }

  if (selectedMassTotal > 0) {
    for (const key of Object.keys(selectedResult)) {
      const sel = (
        selectedResult as Record<
          string,
          Record<string, unknown> & { pourcentage: number }
        >
      )[key];
      const m = elementMassesSelected[key];
      if (sel && typeof sel === 'object' && m !== undefined) {
        sel.pourcentage = (m / selectedMassTotal) * 100;
      }
    }
  }

  if (restMassTotal > 0) {
    for (const key of Object.keys(restResult)) {
      const r = (
        restResult as Record<
          string,
          Record<string, unknown> & { pourcentage: number }
        >
      )[key];
      const m = elementMassesRest[key];
      if (r && typeof r === 'object' && m !== undefined) {
        r.pourcentage = (m / restMassTotal) * 100;
      }
    }
  }

  const selectedObj: Record<string, unknown> | null =
    selectedMassTotal > 0
      ? (Object.assign(JSON.parse(JSON.stringify(obj)), {
          [currentDimension]: selectedResult,
        }) as Record<string, unknown>)
      : null;
  const restObj: Record<string, unknown> | null =
    restMassTotal > 0
      ? (Object.assign(JSON.parse(JSON.stringify(obj)), {
          [currentDimension]: restResult,
        }) as Record<string, unknown>)
      : null;

  return {
    selected: selectedObj,
    rest: restObj,
    selectedMass: selectedMassTotal,
    restMass: restMassTotal,
  };
}

function selectByNestedLevel(
  lot: Lot,
  dimensionName: string,
  path: string[],
  selectedBubbleIds: string[],
  options: SelectByOptions
): SelectByResult {
  const targetLot = JSON.parse(JSON.stringify(lot)) as Lot & {
    formats?: Record<string, { pourcentage: number }>;
  };
  const coProductLot = JSON.parse(JSON.stringify(lot)) as Lot & {
    formats?: Record<string, { pourcentage: number }>;
  };
  let selectedMassTotal = 0;
  let restMassTotal = 0;

  if (path.includes('formats') || path.length === 0) {
    const formats = lot.formats as
      | Record<string, { pourcentage: number }>
      | undefined;
    if (!formats || typeof formats !== 'object') {
      return {
        targetLot: { total: 0, formats: {} } as Lot,
        coProductLot: lot,
      };
    }

    const total = lot.total as number;
    for (const [formatKey, formatObj] of Object.entries(formats)) {
      const formatMass = total * (formatObj.pourcentage / 100);
      const pathFromFormat = path.filter(p => p !== 'formats');
      const result = traverseAndSeparate(
        formatObj as unknown as Record<string, unknown>,
        pathFromFormat,
        dimensionName,
        selectedBubbleIds,
        total,
        formatMass,
        options
      );

      if (result.selectedMass > 0) {
        targetLot.formats = targetLot.formats || {};
        (targetLot.formats as Record<string, unknown>)[formatKey] =
          result.selected;
        (targetLot.formats[formatKey] as { pourcentage: number }).pourcentage =
          result.selectedMass;
        selectedMassTotal += result.selectedMass;
      } else {
        delete targetLot.formats?.[formatKey];
      }

      if (result.restMass > 0) {
        coProductLot.formats = coProductLot.formats || {};
        (coProductLot.formats as Record<string, unknown>)[formatKey] =
          result.rest;
        (
          coProductLot.formats[formatKey] as { pourcentage: number }
        ).pourcentage = result.restMass;
        restMassTotal += result.restMass;
      } else {
        delete coProductLot.formats?.[formatKey];
      }
    }
  }

  targetLot.total = selectedMassTotal;
  coProductLot.total = restMassTotal;

  if (selectedMassTotal > 0 && targetLot.formats) {
    for (const formatKey of Object.keys(targetLot.formats)) {
      const f = (targetLot.formats as Record<string, { pourcentage: number }>)[
        formatKey
      ];
      if (f && typeof f === 'object') {
        f.pourcentage = (f.pourcentage / selectedMassTotal) * 100;
      }
    }
  }

  if (restMassTotal > 0 && coProductLot.formats) {
    for (const formatKey of Object.keys(coProductLot.formats)) {
      const f = (
        coProductLot.formats as Record<string, { pourcentage: number }>
      )[formatKey];
      if (f && typeof f === 'object') {
        f.pourcentage = (f.pourcentage / restMassTotal) * 100;
      }
    }
  }

  return { targetLot, coProductLot };
}

/**
 * Sélectionne des éléments d'un lot selon une dimension (bubble_id).
 * Utilise la hiérarchie passée en argument (pas window).
 */
export function selectBy(
  lot: Lot,
  dimensionName: string,
  selectedBubbleIds: string[],
  options: SelectByOptions,
  hierarchy: DimensionHierarchy
): SelectByResult {
  const def = hierarchy[dimensionName];
  if (!def) {
    return {
      targetLot: { total: 0 } as Lot,
      coProductLot: lot,
    };
  }

  const normalizedIds = Array.isArray(selectedBubbleIds)
    ? selectedBubbleIds.filter(id => id != null && id !== '')
    : selectedBubbleIds
      ? [selectedBubbleIds as unknown as string]
      : [];

  if (normalizedIds.length === 0) {
    const emptyLot = JSON.parse(JSON.stringify(lot)) as Lot;
    for (const key of Object.keys(emptyLot)) {
      if (key !== 'total') delete (emptyLot as Record<string, unknown>)[key];
    }
    emptyLot.total = 0;
    return {
      targetLot: emptyLot,
      coProductLot: lot,
    };
  }

  const isLevel1Direct = def.level === 1 && def.parent === null;

  if (isLevel1Direct) {
    return selectByLevel1Direct(lot, dimensionName, normalizedIds);
  }

  const path = buildPathToDimension(dimensionName, hierarchy);
  return selectByNestedLevel(lot, dimensionName, path, normalizedIds, options);
}
