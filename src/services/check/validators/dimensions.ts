import type { ValidationIssue, Validator } from '../types';
import { isRecord, toPath } from '../utils';

const METADATA_KEYS = new Set([
  'pourcentage',
  'color',
  'bubble_id',
  'en_gb',
  'fr_fr',
  'description',
  'notes',
  'children',
  'total',
]);

const traverseDimensionCollection = (
  collection: Record<string, unknown>,
  currentDimension: string,
  path: string[],
  issues: ValidationIssue[],
  hierarchy: Record<string, { children: string[] }>
) => {
  const allowedChildren = hierarchy[currentDimension]?.children ?? [];
  const allowedSet = new Set(allowedChildren);

  Object.entries(collection).forEach(([entryName, entryValue]) => {
    if (!isRecord(entryValue)) {
      issues.push({
        path: toPath([...path, entryName]),
        expected: 'Objet de dimension',
        found: entryValue,
        severity: 'critical',
      });
      return;
    }

    Object.keys(entryValue).forEach(key => {
      if (METADATA_KEYS.has(key)) {
        return;
      }

      if (!(key in hierarchy)) {
        return;
      }

      if (!allowedSet.has(key)) {
        issues.push({
          path: toPath([...path, entryName, key]),
          expected: `Dimension autorisée: ${allowedChildren.join(', ') || 'aucune'}`,
          found: key,
          severity: 'critical',
        });
        return;
      }

      const childCollection = entryValue[key];
      if (!isRecord(childCollection)) {
        issues.push({
          path: toPath([...path, entryName, key]),
          expected: 'Objet enfant',
          found: childCollection,
          severity: 'critical',
        });
        return;
      }

      traverseDimensionCollection(
        childCollection,
        key,
        [...path, entryName, key],
        issues,
        hierarchy
      );
    });
  });
};

export const validateDimensions: Validator = (lot, context) => {
  const issues: ValidationIssue[] = [];
  const hierarchy = context.dimensionHierarchy;

  const dimensionKeys = Object.keys(hierarchy);

  dimensionKeys.forEach(dimensionKey => {
    const value = (lot as Record<string, unknown>)[dimensionKey];
    if (!value) {
      return;
    }

    if (!isRecord(value)) {
      issues.push({
        path: dimensionKey,
        expected: 'Objet de dimension',
        found: value,
        severity: 'critical',
      });
      return;
    }

    const parent = hierarchy[dimensionKey]?.parent;
    if (parent) {
      // ce dimension ne devrait pas être à la racine
      issues.push({
        path: dimensionKey,
        expected: `Dimension enfant de ${parent}`,
        found: 'racine',
        severity: 'critical',
      });
      return;
    }

    traverseDimensionCollection(
      value,
      dimensionKey,
      [dimensionKey],
      issues,
      hierarchy
    );
  });

  return issues;
};
