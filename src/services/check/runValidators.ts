import type { CheckContext, ValidationIssue } from './types';
import { validators } from './validators';

export const runValidators = (
  lot: Record<string, unknown>,
  context: CheckContext
): ValidationIssue[] =>
  validators.flatMap(validator => validator(lot, context));
