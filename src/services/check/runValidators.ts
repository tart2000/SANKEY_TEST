import type { CheckContext, ValidatorOutcome } from './types';
import { validators } from './validators';

export const runValidators = (
  lot: Record<string, unknown>,
  context: CheckContext
): ValidatorOutcome[] =>
  validators.map(({ id, label, run }) => ({
    id,
    label,
    issues: run(lot, context),
  }));
