import test from 'node:test';
import assert from 'node:assert/strict';

import '../public/sankey/merge-lots.js';

const mergeLots = globalThis.mergeLots;

test('mergeLots retourne le lot unique tel quel', () => {
  const lot = {
    total: 100,
    formats: {
      formatA: {
        pourcentage: 100,
        color: '#fa',
        types: {
          typeA: {
            pourcentage: 100,
            color: '#ta',
            matieres: {},
            couleurs: {},
            perturbateurs: {},
            qualites: {},
            propres: {},
          },
        },
      },
    },
    proprete: {
      propre: { pourcentage: 100, color: '#pp' },
    },
    qualite: {
      qualiteA: { pourcentage: 100, color: '#qa' },
    },
  };

  const result = mergeLots([lot]);
  assert.strictEqual(result, lot);
});

test('mergeLots fusionne correctement deux lots simples', () => {
  const lotA = {
    total: 100,
    formats: {
      formatA: {
        pourcentage: 100,
        color: '#fa',
        types: {
          typeA: {
            pourcentage: 100,
            color: '#ta',
            matieres: {},
            couleurs: {},
            perturbateurs: {},
            qualites: {},
            propres: {},
          },
        },
      },
    },
    proprete: {
      propre: { pourcentage: 100, color: '#pp' },
    },
    qualite: {
      qualiteA: { pourcentage: 100, color: '#qa' },
    },
  };

  const lotB = {
    total: 50,
    formats: {
      formatA: {
        pourcentage: 40,
        color: '#fa2',
        types: {
          typeA: {
            pourcentage: 100,
            color: '#ta2',
            matieres: {},
            couleurs: {},
            perturbateurs: {},
            qualites: {},
            propres: {},
          },
        },
      },
      formatB: {
        pourcentage: 60,
        color: '#fb',
        types: {
          typeB: {
            pourcentage: 100,
            color: '#tb',
            matieres: {},
            couleurs: {},
            perturbateurs: {},
            qualites: {},
            propres: {},
          },
        },
      },
    },
    proprete: {
      propre: { pourcentage: 80, color: '#pp2' },
    },
    qualite: {
      qualiteA: { pourcentage: 50, color: '#qa2' },
    },
  };

  const result = mergeLots([lotA, lotB]);

  assert.strictEqual(result.total, 150);
  assert.ok(result.formats.formatA);
  assert.ok(result.formats.formatB);
  assert.ok(result.formats.formatA.types.typeA);
  assert.ok(result.formats.formatB.types.typeB);

  assert.strictEqual(Math.round(result.formats.formatA.pourcentage), 80);
  assert.strictEqual(Math.round(result.formats.formatB.pourcentage), 20);

  assert.strictEqual(Math.round(result.proprete.propre.pourcentage), 93);
  assert.strictEqual(Math.round(result.qualite.qualiteA.pourcentage), 83);
});
