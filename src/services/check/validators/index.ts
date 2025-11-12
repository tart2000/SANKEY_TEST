import type { Validator } from '../types';

import { validateDimensions } from './dimensions';
import { validateDistributions } from './distributions';
import { validateItems } from './items';
import { validateRootStructure } from './rootStructure';

export const validators: Validator[] = [
  validateRootStructure,
  validateDistributions,
  validateItems,
  validateDimensions,
];
