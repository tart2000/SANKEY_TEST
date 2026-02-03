/**
 * BIBLE ABSOLUE DES DIMENSIONS - NE JAMAIS MODIFIER
 *
 * Structure hiérarchique des dimensions pour la construction des lots
 * À utiliser comme guide pour parser, générer ou valider les lots
 *
 * formats (niveau 1)
 * ├── types (niveau 2)
 * │   ├── matieres (niveau 3)
 * │   │   ├── fibres (niveau 4)
 * │   ├── couleurs (niveau 3)
 * │   └── perturbateurs (niveau 3)
 * proprete (niveau 1)
 * qualite (niveau 1)
 */

// Structure hiérarchique des dimensions
window.DIMENSION_HIERARCHY = {
  formats: {
    level: 1,
    parent: null,
    children: ['types'],
    description: 'Formats principaux (vêtements, linges, chaussures, etc.)',
  },
  types: {
    level: 2,
    parent: 'formats',
    children: ['matieres', 'couleurs', 'perturbateurs'],
    description: 'Types de produits dans chaque format',
  },
  matieres: {
    level: 3,
    parent: 'types',
    children: ['fibres'],
    description: 'Matériaux des produits',
    isPriority: true,
  },
  fibres: {
    level: 4,
    parent: 'matieres',
    children: [],
    description: 'Fibres des matériaux',
    isPriority: true,
  },
  couleurs: {
    level: 3,
    parent: 'types',
    children: [],
    description: 'Couleurs des produits',
  },
  perturbateurs: {
    level: 3,
    parent: 'types',
    children: [],
    description: 'Perturbateurs dans les produits',
  },
  proprete: {
    level: 1,
    parent: null,
    children: [],
    description: 'Niveau de propreté des produits',
  },
  qualite: {
    level: 1,
    parent: null,
    children: [],
    description: 'Niveau de qualité des produits',
  },
};

// Ordre de traitement des dimensions (du plus haut au plus bas)
window.DIMENSION_PROCESSING_ORDER = [
  'formats',
  'types',
  'matieres',
  'fibres',
  'couleurs',
  'perturbateurs',
  'proprete',
  'qualite',
];
