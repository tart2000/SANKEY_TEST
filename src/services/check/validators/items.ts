import type { ValidationIssue, Validator } from '../types';
import {
  isHexColor,
  isNonEmptyString,
  isPlainObject,
  isRecord,
  toPath,
} from '../utils';

const OPTIONAL_LABEL_KEYS = ['en_gb', 'fr_fr'];

const traverseNode = (
  node: Record<string, unknown>,
  path: string[],
  dimensionKey: string,
  issues: ValidationIssue[],
  hierarchy: Record<string, { children: string[] }>
) => {
  const pourcentage = node['pourcentage'];
  if (typeof pourcentage !== 'number' || Number.isNaN(pourcentage)) {
    issues.push({
      path: toPath([...path, 'pourcentage']),
      expected: 'Nombre valide',
      found: pourcentage,
      severity: 'critical',
    });
  }

  const color = node['color'];
  if (!isHexColor(color)) {
    issues.push({
      path: toPath([...path, 'color']),
      expected: 'Couleur hexadécimale (#RRGGBB)',
      found: color,
      severity: 'critical',
    });
  }

  const bubbleId = node['bubble_id'];
  if (!isNonEmptyString(bubbleId)) {
    issues.push({
      path: toPath([...path, 'bubble_id']),
      expected: 'Identifiant Bubble non vide',
      found: bubbleId,
      severity: 'critical',
    });
  }

  OPTIONAL_LABEL_KEYS.forEach(labelKey => {
    if (labelKey in node) {
      const value = node[labelKey];
      if (!isNonEmptyString(value)) {
        issues.push({
          path: toPath([...path, labelKey]),
          expected: 'Libellé non vide',
          found: value,
          severity: 'warning',
        });
      }
    }
  });

  const childDefinition = hierarchy[dimensionKey];
  childDefinition?.children.forEach(childKey => {
    const collection = node[childKey];
    if (!isRecord(collection)) {
      if (collection !== undefined) {
        issues.push({
          path: toPath([...path, childKey]),
          expected: 'Objet enfant',
          found: collection,
          severity: 'critical',
        });
      }
      return;
    }

    Object.entries(collection).forEach(([name, childNode]) => {
      if (!isPlainObject(childNode)) {
        issues.push({
          path: toPath([...path, childKey, name]),
          expected: 'Objet enfant',
          found: childNode,
          severity: 'critical',
        });
        return;
      }
      traverseNode(
        childNode,
        [...path, childKey, name],
        childKey,
        issues,
        hierarchy
      );
    });
  });
};

export const validateItems: Validator = (lot, context) => {
  const issues: ValidationIssue[] = [];

  const formats = (lot as Record<string, unknown>)['formats'];
  if (!isRecord(formats)) {
    return issues;
  }

  Object.entries(formats).forEach(([formatName, formatValue]) => {
    if (!isPlainObject(formatValue)) {
      issues.push({
        path: toPath(['formats', formatName]),
        expected: 'Objet de format',
        found: formatValue,
        severity: 'critical',
      });
      return;
    }

    traverseNode(
      formatValue,
      ['formats', formatName],
      'formats',
      issues,
      context.dimensionHierarchy
    );
  });

  return issues;
};
