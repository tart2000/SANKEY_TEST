import type { ValidatorDescriptor } from '../types';

import { validateDimensions } from './dimensions';
import { validateDistributions } from './distributions';
import { validateItems } from './items';
import { validateRootStructure } from './rootStructure';

export const validators: ValidatorDescriptor[] = [
  {
    id: 'root-structure',
    label: 'Structure haut niveau',
    run: validateRootStructure,
  },
  {
    id: 'distributions',
    label: 'Totaux à 100%',
    run: validateDistributions,
  },
  {
    id: 'items-structure',
    label: 'Structure de chaque élément',
    run: validateItems,
  },
  {
    id: 'dimensions-hierarchy',
    label: 'Hiérarchie des dimensions',
    run: validateDimensions,
  },
];
