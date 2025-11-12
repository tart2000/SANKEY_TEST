import type { ValidationIssue, Validator } from '../types';
import { isNonEmptyString, isPlainObject, isRecord, toPath } from '../utils';

const REQUIRED_ROOT_KEYS: Array<
  [key: string, check: (value: unknown) => boolean, expected: string]
> = [
  ['title', isNonEmptyString, 'Titre non vide'],
  [
    'total',
    value => typeof value === 'number' && !Number.isNaN(value),
    'Total numérique',
  ],
  ['frequency', isNonEmptyString, 'Fréquence non vide'],
  ['formats', isRecord, 'Objet formats'],
];

const CHILD_COLLECTION_KEYS = [
  'types',
  'matieres',
  'fibres',
  'couleurs',
  'perturbateurs',
];

const ensureCollectionShape = (
  parentPath: string[],
  value: unknown,
  issues: ValidationIssue[]
) => {
  if (value === undefined) {
    return;
  }

  if (!isRecord(value)) {
    issues.push({
      path: toPath(parentPath),
      expected: 'Objet de distribution',
      found: value,
      severity: 'critical',
    });
    return;
  }
};

const ensureNodeShape = (
  pathSegments: string[],
  node: unknown,
  issues: ValidationIssue[]
) => {
  if (!isPlainObject(node)) {
    issues.push({
      path: toPath(pathSegments),
      expected: 'Objet de lot',
      found: node,
      severity: 'critical',
    });
    return;
  }

  const pourcentage = node.pourcentage;
  if (typeof pourcentage !== 'number' || Number.isNaN(pourcentage)) {
    issues.push({
      path: toPath([...pathSegments, 'pourcentage']),
      expected: 'Nombre valide',
      found: pourcentage,
      severity: 'critical',
    });
  }

  const color = node.color;
  if (!isNonEmptyString(color)) {
    issues.push({
      path: toPath([...pathSegments, 'color']),
      expected: 'Chaîne non vide',
      found: color,
      severity: 'critical',
    });
  }

  const bubbleId = node.bubble_id;
  if (!isNonEmptyString(bubbleId)) {
    issues.push({
      path: toPath([...pathSegments, 'bubble_id']),
      expected: 'Identifiant Bubble non vide',
      found: bubbleId,
      severity: 'critical',
    });
  }

  CHILD_COLLECTION_KEYS.forEach(key => {
    if (key in node) {
      ensureCollectionShape([...pathSegments, key], node[key], issues);
    }
  });
};

export const validateRootStructure: Validator = lot => {
  const issues: ValidationIssue[] = [];

  REQUIRED_ROOT_KEYS.forEach(([key, check, expected]) => {
    const value = (lot as Record<string, unknown>)[key];
    if (!check(value)) {
      issues.push({
        path: key,
        expected,
        found: value,
        severity: 'critical',
      });
    }
  });

  const formats = (lot as Record<string, unknown>)['formats'];

  if (isRecord(formats)) {
    Object.entries(formats).forEach(([formatName, formatValue]) => {
      ensureNodeShape(['formats', formatName], formatValue, issues);
    });
  }

  return issues;
};
