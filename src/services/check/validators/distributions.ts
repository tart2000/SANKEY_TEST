import type { ValidationIssue, Validator } from '../types';
import { isRecord, toPath } from '../utils';

const INFO_THRESHOLD = 1;
const WARNING_THRESHOLD = 5;

type TraversableNode = Record<string, unknown>;

const toNumber = (value: unknown) =>
  typeof value === 'number'
    ? value
    : typeof value === 'string'
      ? Number.parseFloat(value)
      : Number.NaN;

const evaluateDelta = (delta: number) => {
  const absoluteDelta = Math.abs(delta);

  if (absoluteDelta === 0) {
    return null;
  }

  if (absoluteDelta <= INFO_THRESHOLD) {
    return { severity: 'info' as const, absoluteDelta };
  }

  if (absoluteDelta <= WARNING_THRESHOLD) {
    return { severity: 'warning' as const, absoluteDelta };
  }

  return { severity: 'critical' as const, absoluteDelta };
};

const collectChildren = (
  node: TraversableNode,
  childKey: string
): Record<string, unknown> | null => {
  const value = node[childKey];

  if (!isRecord(value)) {
    return null;
  }

  return value;
};

const traverseCollection = (
  collection: Record<string, unknown>,
  path: string[],
  dimensionKey: string,
  issues: ValidationIssue[],
  hierarchy: Record<string, { children: string[] }>
) => {
  const entries = Object.entries(collection);
  if (entries.length === 0) {
    return;
  }

  let sum = 0;
  let hasNumericValue = false;

  entries.forEach(([name, value]) => {
    if (!isRecord(value)) {
      return;
    }

    const pourcentage = toNumber(value.pourcentage);
    if (!Number.isNaN(pourcentage)) {
      sum += pourcentage;
      hasNumericValue = true;
    }

    const childDefinition = hierarchy[dimensionKey];
    childDefinition?.children.forEach(childKey => {
      const childCollection = collectChildren(value, childKey);
      if (childCollection) {
        traverseCollection(
          childCollection,
          [...path, name, childKey],
          childKey,
          issues,
          hierarchy
        );
      }
    });
  });

  if (!hasNumericValue) {
    return;
  }

  const delta = sum - 100;
  const roundedDelta = Number(delta.toFixed(2));

  if (roundedDelta === 0) {
    return;
  }

  const deltaResult = evaluateDelta(delta);

  if (!deltaResult) {
    return;
  }

  const roundedSum = Number(sum.toFixed(2));

  issues.push({
    path: toPath(path),
    expected: 'Somme des pourcentages = 100',
    found: roundedSum,
    severity: deltaResult.severity,
    context: {
      delta: roundedDelta,
    },
    suggestion:
      deltaResult.severity === 'critical'
        ? 'Rééquilibrer la répartition avant publication'
        : deltaResult.severity === 'warning'
          ? 'Ajuster les pourcentages pour améliorer la cohérence'
          : undefined,
  });
};

export const validateDistributions: Validator = (lot, context) => {
  const issues: ValidationIssue[] = [];

  const formats = (lot as Record<string, unknown>)['formats'];

  if (!isRecord(formats)) {
    return issues;
  }

  traverseCollection(
    formats,
    ['formats'],
    'formats',
    issues,
    context.dimensionHierarchy
  );

  return issues;
};
