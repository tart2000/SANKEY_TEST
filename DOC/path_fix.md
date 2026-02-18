# Plan de Refactoring du Système de Paths et NodeIds

## Problèmes Identifiés

1. **`_nodeId` instables** : Générés séquentiellement, changent à chaque rechargement
2. **`_path` complexes** : Logique fragile dans `getPathForNewTransformation`
3. **`_index` parfois manquants** : Pas toujours ajoutés correctement
4. **Calcul des coûts défaillant** : Volumes incorrects, coûts non calculés
5. **Ajout de transformations défaillant** : Pas toujours au bon endroit

## Solution Proposée

### 1. Système de NodeId Stable et Unique

**Principe** : Chaque transformation reçoit un `_nodeId` unique de 8 chiffres aléatoires au moment de sa création, qui ne change JAMAIS.

```javascript
// Fonction pour générer un ID stable unique
function generateStableNodeId() {
  return Math.floor(10000000 + Math.random() * 90000000).toString();
}
```

**Règles** :

- Le `_nodeId` est généré UNE SEULE FOIS lors de la création de la transformation
- Il est persisté dans le scénario (contrairement à l'état actuel)
- Il ne change JAMAIS, même après rechargement
- Il est utilisé comme identifiant principal pour retrouver les transformations

### 2. Conservation du `_index`

**Principe** : Le `_index` reste tel quel, il indique la position dans le tableau de transformations.

**Règles** :

- `_index` = position dans le tableau (0, 1, 2, ...)
- Il est mis à jour automatiquement lors des ajouts/suppressions
- Il reste cohérent avec l'ordre des transformations

### 3. Suppression du `_path` du scénario

**Principe** : On ne stocke PLUS les `_path` dans le scénario !

**Règles** :

- ❌ Plus de `_path` dans les transformations
- ✅ Le `_path` est calculé à l'affichage dans `applyScenario` et attaché aux **nœuds du graphe** (notamment au nœud Reste)
- ✅ Pour le coproduit, le path utilisé (ajout de transfo, valorisation/détachement) est **toujours `node._path`** (ou dérivé : path sans le dernier `'transformations'` pour atteindre l'objet `coproduct_scenario`)
- ✅ Fonction **getOrCreateObjectAtPath(scenario, path)** : même logique de navigation que `addTransformationToPath` (parcours clé par clé, création des branches manquantes), utilisée pour valoriser/détacher le CDC sur un Reste (atteindre l'objet `coproduct_scenario` et y mettre à jour `target` / `title`)

### 4. Système de Recherche par NodeId

```javascript
// Fonction pour trouver une transformation par son _nodeId et retourner son path
function findTransformationByNodeId(scenario, nodeId) {
  function searchRecursive(obj, currentPath = []) {
    if (obj && typeof obj === 'object') {
      if (Array.isArray(obj)) {
        for (let i = 0; i < obj.length; i++) {
          if (obj[i]._nodeId === nodeId) {
            return {
              transformation: obj[i],
              path: [...currentPath, i],
              index: i,
            };
          }
          // Chercher dans les sous-scénarios
          if (obj[i].scenario) {
            const result = searchRecursive(obj[i].scenario, [
              ...currentPath,
              i,
              'scenario',
            ]);
            if (result) return result;
          }
          if (obj[i].scenario?.coproduct_scenario) {
            const result = searchRecursive(obj[i].scenario.coproduct_scenario, [
              ...currentPath,
              i,
              'scenario',
              'coproduct_scenario',
            ]);
            if (result) return result;
          }
        }
      } else {
        for (const [key, value] of Object.entries(obj)) {
          if (key === 'transformations' && Array.isArray(value)) {
            const result = searchRecursive(value, [...currentPath, key]);
            if (result) return result;
          }
        }
      }
    }
    return null;
  }

  return searchRecursive(scenario);
}

// Fonction pour obtenir le path d'un nœud par son _nodeId
function getPathFromNodeId(scenario, nodeId) {
  const result = findTransformationByNodeId(scenario, nodeId);
  return result ? result.path : null;
}
```

### 5. Gestion de l'Ajout de Transformations

**Problème actuel** : La popup ne sait pas où ajouter la transformation car le path est complexe.

**Solution** : Passer le `_nodeId` du nœud parent à la popup.

```javascript
// Dans sankey.js - Fonction pour calculer le path d'une nouvelle transformation
function calculatePathForNewTransformation(parentNodeId, actionType, scenario) {
  // ✅ Cas spécial : nœud racine (pas de nodeId)
  if (!parentNodeId || parentNodeId === 'root') {
    return ['transformations'];
  }

  const parentNodeInfo = findTransformationByNodeId(scenario, parentNodeId);
  if (!parentNodeInfo) {
    console.error('Parent node not found:', parentNodeId);
    return null;
  }

  if (actionType === 'add_to_coproduct') {
    // Ajouter au coproduit du nœud parent
    return [
      ...parentNodeInfo.path.slice(0, -2),
      'coproduct_scenario',
      'transformations',
    ];
  } else {
    // Ajouter au nœud (cas normal)
    return [...parentNodeInfo.path, 'scenario', 'transformations'];
  }
}

// Dans sankey.js - Gestion du clic sur le bouton "+"
function handleAddTransformationClick(node) {
  const parentNodeId = node._nodeId || node.id;
  const scenario = window.scenarios[window.currentScenarioIdx]?.scenario;
  const path = calculatePathForNewTransformation(
    parentNodeId,
    'add_to_node',
    scenario
  );

  const popup = new TransformationPopup();
  popup.show('add', {
    nodeId: parentNodeId,
    path: path, // ✅ Path calculé à l'avance
    node: node,
  });
}

// Dans sankey.js - Gestion du clic sur le bouton "+" du coproduit
// Le path est pris directement depuis le nœud Reste (_path calculé par applyScenario), pas via calculatePathForNewTransformation
function handleAddCoproductTransformationClick(parentNode) {
  const parentNodeId = parentNode._nodeId || parentNode.id;
  const path = [...parentNode._path]; // path vers coproduct_scenario.transformations

  const popup = new TransformationPopup();
  popup.show('add', {
    nodeId: parentNodeId,
    path: path,
    node: parentNode,
  });
}

// Dans sankey.js - Gestion du clic sur "edit"
function handleEditTransformationClick(node) {
  const nodeId = node._nodeId || node.id;
  const nodeInfo = findTransformationByNodeId(
    window.scenarios[window.currentScenarioIdx].scenario,
    nodeId
  );

  const popup = new TransformationPopup();
  popup.show('edit', {
    nodeId: nodeId,
    path: nodeInfo?.path, // ✅ Path calculé à l'avance
    node: node,
  });
}

// Dans transformation-popup.js - Sauvegarde (SIMPLIFIÉE)
function saveTransformation(transformation) {
  if (this.mode === 'add') {
    // ✅ Mode add : utiliser le path fourni
    const path = this.currentRef.path;
    const scenario = window.scenarios[window.currentScenarioIdx].scenario;

    if (path) {
      addTransformationToPath(scenario, path, transformation);
    } else {
      console.error("Pas de path fourni pour l'ajout de transformation");
    }
  } else if (this.mode === 'edit') {
    // ✅ Mode edit : utiliser le path fourni
    const path = this.currentRef.path;
    const nodeId = this.currentRef.nodeId;
    const nodeInfo = findTransformationByNodeId(
      window.scenarios[window.currentScenarioIdx].scenario,
      nodeId
    );

    if (nodeInfo) {
      // Conserver l'ID existant
      transformation._nodeId = nodeInfo.transformation._nodeId;
      // Supprimer le _path s'il existe
      delete transformation._path;

      // Mettre à jour la transformation
      updateTransformation(
        window.scenarios[window.currentScenarioIdx].scenario,
        nodeInfo.path,
        nodeInfo.index,
        transformation
      );
    }
  }
}
```

### 6. Fonction d'Ajout Simplifiée

**Note** : Cette fonction est définie plus bas avec la génération de `_nodeId`.

### 7. Génération des NodeId (UNE SEULE FOIS)

**IMPORTANT** : Les `_nodeId` doivent être générés UNE SEULE FOIS lors de la création de la transformation, pas dans `applyScenario` !

**Où générer les `_nodeId`** :

1. **Dans `addTransformationToPath()`** : Quand on ajoute une nouvelle transformation
2. **Dans `updateTransformation()`** : Si on modifie une transformation existante sans `_nodeId`

```javascript
// Dans addTransformationToPath()
function addTransformationToPath(scenario, parentPath, transformation) {
  // Générer un _nodeId UNE SEULE FOIS lors de la création
  if (!transformation._nodeId) {
    transformation._nodeId = generateStableNodeId();
  }

  // S'assurer que la transformation a la bonne structure
  if (!transformation.type) {
    console.error('Transformation manque le type');
    return false;
  }

  // S'assurer que keys et _displayNames sont des tableaux
  if (!Array.isArray(transformation.keys)) {
    transformation.keys = [];
  }
  if (!transformation._displayNames) {
    transformation._displayNames = [[]];
  } else if (!Array.isArray(transformation._displayNames)) {
    transformation._displayNames = [transformation._displayNames];
  }

  // Naviguer jusqu'au tableau de transformations parent
  let target = scenario;
  for (let i = 0; i < parentPath.length; i++) {
    target = target[parentPath[i]];
  }

  // Ajouter la transformation
  if (Array.isArray(target)) {
    transformation._index = target.length; // Index automatique
    target.push(transformation);
    return true;
  }

  return false;
}

// Dans updateTransformation() - seulement si pas de _nodeId
function updateTransformation(scenario, path, index, newTransformation) {
  // ... code existant ...

  // Générer un _nodeId seulement si la transformation n'en a pas
  if (!newTransformation._nodeId && !oldTransformation._nodeId) {
    newTransformation._nodeId = generateStableNodeId();
  } else if (oldTransformation._nodeId) {
    // Conserver l'ID existant
    newTransformation._nodeId = oldTransformation._nodeId;
  }

  // ❌ Ne pas enregistrer de _path !
  delete newTransformation._path;

  // ... reste du code ...
}
```

**`applyScenario` ne doit PAS être modifié !** Elle utilise simplement les `_nodeId` existants.

### 8. Correction du Calcul des Coûts

```javascript
// Fonction pour calculer les coûts d'un scénario complet
function calculateScenarioCosts(scenario, lotType) {
  let totalCost = 0;
  const costBreakdown = [];

  function processTransformation(transfo, inputVolume) {
    if (transfo.tech && transfo.tech.details) {
      const costs = calculateTransformationCosts(
        {
          ...transfo,
          lot_input_volume: inputVolume,
        },
        transfo.tech.details,
        window.teamData
      );

      if (costs) {
        totalCost += costs.cout_total;
        costBreakdown.push({
          nodeId: transfo._nodeId,
          transformation: transfo,
          costs: costs,
        });
      }
    }
  }

  // Parcourir toutes les transformations
  function traverseScenario(scenario, inputVolume = lotType.total) {
    if (scenario.transformations) {
      scenario.transformations.forEach(transfo => {
        processTransformation(transfo, inputVolume);

        // Traiter les sous-scénarios
        if (transfo.scenario) {
          traverseScenario(
            transfo.scenario,
            (inputVolume * (transfo.yield || 100)) / 100
          );
        }

        // Traiter les coproduits
        if (scenario.coproduct_scenario) {
          traverseScenario(
            scenario.coproduct_scenario,
            (inputVolume * (100 - (transfo.yield || 100))) / 100
          );
        }
      });
    }
  }

  traverseScenario(scenario);

  return { totalCost, costBreakdown };
}
```

## Plan d'Implémentation

### Étape 1 : Créer les fonctions utilitaires

1. `generateStableNodeId()`
2. `findTransformationByNodeId()`
3. `addTransformationToPath()`

### Étape 2 : Migrer les scénarios existants

1. Ajouter des `_nodeId` stables à toutes les transformations existantes
2. Supprimer tous les `_path` existants du scénario
3. Valider la structure des scénarios migrés

### Étape 3 : Modifier la popup de transformation

1. Recevoir le `_nodeId` du nœud parent et l'`actionType`
2. Utiliser ce ID pour trouver où ajouter la transformation
3. Générer un nouveau `_nodeId` pour la nouvelle transformation
4. Passer le `nodeId` dans la transformation pour la popup

```javascript
// ✅ Comment passer le nodeId à la popup
// Dans onTransformationAdd()
transformation._parentNodeId = nodeId; // Passer le nodeId du parent

// Dans la popup
const parentNodeId = transformation._parentNodeId || this.currentRef.nodeId;
```

```javascript
// Fonction pour migrer un scénario existant
function migrateExistingScenario(scenario) {
  function migrateRecursive(obj) {
    if (obj && typeof obj === 'object') {
      if (Array.isArray(obj)) {
        obj.forEach((transfo, index) => {
          // Générer un _nodeId si pas déjà présent
          if (!transfo._nodeId) {
            transfo._nodeId = generateStableNodeId();
          }

          // Mettre à jour l'_index
          transfo._index = index;

          // Supprimer le _path s'il existe
          delete transfo._path;

          // Traiter les sous-scénarios
          if (transfo.scenario) {
            migrateRecursive(transfo.scenario);
          }
          if (transfo.scenario?.coproduct_scenario) {
            migrateRecursive(transfo.scenario.coproduct_scenario);
          }
        });
      } else {
        for (const [key, value] of Object.entries(obj)) {
          if (key === 'transformations' && Array.isArray(value)) {
            migrateRecursive(value);
          }
        }
      }
    }
  }

  migrateRecursive(scenario);
  return scenario;
}

// Fonction pour valider la structure d'un scénario
function validateScenarioStructure(scenario) {
  const nodeIds = new Set();
  const errors = [];

  function validateRecursive(obj, path = []) {
    if (obj && typeof obj === 'object') {
      if (Array.isArray(obj)) {
        obj.forEach((transfo, index) => {
          const currentPath = [...path, index];

          // Vérifier _nodeId
          if (!transfo._nodeId) {
            errors.push(
              `Transformation sans _nodeId à ${currentPath.join('.')}`
            );
          } else if (nodeIds.has(transfo._nodeId)) {
            errors.push(
              `_nodeId dupliqué: ${transfo._nodeId} à ${currentPath.join('.')}`
            );
          } else {
            nodeIds.add(transfo._nodeId);
          }

          // Vérifier _index
          if (typeof transfo._index !== 'number' || transfo._index !== index) {
            errors.push(
              `_index incorrect à ${currentPath.join('.')}: attendu ${index}, trouvé ${transfo._index}`
            );
          }

          // Vérifier qu'il n'y a pas de _path
          if (transfo._path) {
            errors.push(
              `_path trouvé à ${currentPath.join('.')} (devrait être supprimé)`
            );
          }

          // Traiter les sous-scénarios
          if (transfo.scenario) {
            validateRecursive(transfo.scenario, [...currentPath, 'scenario']);
          }
          if (transfo.scenario?.coproduct_scenario) {
            validateRecursive(transfo.scenario.coproduct_scenario, [
              ...currentPath,
              'scenario',
              'coproduct_scenario',
            ]);
          }
        });
      } else {
        for (const [key, value] of Object.entries(obj)) {
          if (key === 'transformations' && Array.isArray(value)) {
            validateRecursive(value, [...path, key]);
          }
        }
      }
    }
  }

  validateRecursive(scenario);

  return {
    isValid: errors.length === 0,
    errors: errors,
    nodeIdCount: nodeIds.size,
  };
}
```

### Étape 4 : Corriger le calcul des coûts

1. Implémenter `calculateScenarioCosts()`
2. Utiliser les volumes corrects des lots d'entrée
3. Afficher les coûts dans les tooltips

### Étape 5 : Corriger la popup Tech

1. Modifier `updateNodeTechInScenario()` pour utiliser `findTransformationByNodeId()`
2. Supprimer les références à `_path` et `_index` dans la popup tech
3. Utiliser le `nodeId` pour retrouver la transformation

### Étape 6 : Corriger les fonctions d'ajout de transformations

1. Modifier `onTransformationAdd()` pour ne plus utiliser `transformation._path`
2. Modifier `addTransformation()` pour utiliser `findTransformationByNodeId()`
3. Simplifier la logique d'ajout

### Étape 7 : Nettoyer le code obsolète

1. Supprimer `getPathForNewTransformation()`
2. Simplifier la logique de recherche de transformations
3. Supprimer les fonctions non utilisées

## Avantages de cette Solution

1. **Stabilité** : Les `_nodeId` ne changent jamais
2. **Simplicité** : Plus de logique complexe de paths
3. **Fiabilité** : Les transformations sont toujours trouvées
4. **Maintenabilité** : Code plus simple et plus clair
5. **Performance** : Recherche directe par ID

## Points d'Attention

1. **Migration** : Les scénarios existants devront être migrés avec de nouveaux `_nodeId`
2. **Compatibilité** : S'assurer que tous les endroits utilisant les IDs sont mis à jour
3. **Tests** : Tester tous les cas d'usage (ajout, modification, suppression, calcul des coûts)

Cette solution devrait résoudre tous les problèmes identifiés tout en gardant le code simple et maintenable.

## Cas d'Usage du Système de Path

Le système de path doit gérer différents cas d'imbrication de transformations. Voici une analyse détaillée de chaque cas :

### Structure de Base du Scénario

```javascript
const scenario = {
  transformations: [
    // Transformations principales (niveau 1)
    {
      type: 'selectByFormat',
      keys: ['vêtements'], // bubble_id bien ^sûr
      _nodeId: '12345678',
      _index: 0,
      scenario: {
        transformations: [
          // Transformations enfants (niveau 2)
          {
            type: 'selectByType',
            keys: ['T-shirt'],
            _nodeId: '87654321',
            _index: 0,
            scenario: {
              transformations: [],
              coproduct_scenario: {
                transformations: [
                  // Transformations du coproduit enfant (niveau 3)
                  {
                    type: 'selectByCouleur',
                    keys: ['bleu'],
                    _nodeId: '11111111',
                    _index: 0,
                  },
                ],
              },
            },
          },
        ],
        coproduct_scenario: {
          transformations: [
            // Transformations du coproduit (niveau 2)
            {
              type: 'selectByQualite',
              keys: ['neuf'],
              _nodeId: '22222222',
              _index: 0,
            },
          ],
        },
      },
    },
  ],
  coproduct_scenario: {
    transformations: [
      // Transformations du coproduit racine (niveau 1)
      {
        type: 'selectByProprete',
        keys: ['sale'],
        _nodeId: '33333333',
        _index: 0,
      },
    ],
  },
};
```

### Cas 1 : Nœud Racine (Lot Initial)

**Description** : Le nœud racine représente le lot initial, point de départ de toutes les transformations.

**Schéma** :

```
Lot Initial (pas de nodeId)
    ↓ (clic sur +)
    Ajouter transformation principale
```

**Path** : `['transformations']`

**Logique** :

- Le nœud racine n'a PAS de `_nodeId` (pas besoin)
- Quand on clique sur le "+" du nœud racine, on ajoute une transformation au tableau `transformations`
- La nouvelle transformation reçoit un `_nodeId` unique

### Cas 2 : Enfant du Nœud Racine (Transformation Principale)

**Description** : Transformations directement sous le nœud racine, dans `transformations`.

**Schéma** :

```
Lot Initial (pas de nodeId)
    ↓
Transfo 1 (nodeId: '12345678') ← clic sur + ici
    ↓
Transfo 2 (nodeId: '87654321')
```

**Path** : `['transformations', 0, 'scenario', 'transformations']`

**Logique** :

- Quand on clique sur le "+" d'une transformation principale, on ajoute dans son sous-scénario
- La nouvelle transformation est ajoutée dans `transformations[0].scenario.transformations`

### Cas 3 : Dans un Coproduit (Niveau 1)

**Description** : Transformations dans le coproduit racine, dans `coproduct_scenario.transformations`.

**Schéma** :

```
Lot Initial
    ↓
Transfo 1 (nodeId: '12345678')
    ↓
Transfo 2 (nodeId: '87654321')
    ↓
Reste (nodeId: '44444444') ← clic sur + ici
```

**Path** : `['coproduct_scenario', 'transformations']`

**Logique** :

- Le nœud "Reste" a un `_nodeId` généré automatiquement
- Quand on clique sur le "+" du reste, on ajoute dans `coproduct_scenario.transformations`
- La nouvelle transformation reçoit un `_nodeId` unique

### Cas 4 : Dans un Coproduit de Coproduit (Niveau 2+)

**Description** : Transformations dans un coproduit qui est lui-même dans un coproduit.

**Schéma** :

```
Lot Initial (pas de nodeId)
    ↓
Transfo 1 (nodeId: '12345678')
    ↓
    Transfo 1.1 (nodeId: '55555555')
    ↓
    Reste 1.1 (nodeId: '66666666') ← clic sur + ici
```

**Path** : `['transformations', 0, 'scenario', 'coproduct_scenario', 'transformations']`

**Logique** :

- Quand on clique sur le "+" du reste d'un sous-scénario, on ajoute dans le coproduit de ce sous-scénario
- La nouvelle transformation est ajoutée dans `transformations[0].scenario.coproduct_scenario.transformations`

### Cas 5 : Dans un Direct de Coproduit

**Description** : Transformations dans le sous-scénario d'une transformation qui est dans un coproduit.

**Schéma** :

```
Lot Initial
    ↓
Transfo 1 (nodeId: '12345678')
    ↓
Reste (nodeId: '44444444')
    ↓
    Transfo Reste 1 (nodeId: '77777777') ← clic sur + ici
```

**Path** : `['coproduct_scenario', 'transformations', 0, 'scenario', 'transformations']`

**Logique** :

- Quand on clique sur le "+" d'une transformation dans un coproduit, on ajoute dans son sous-scénario
- La nouvelle transformation est ajoutée dans `coproduct_scenario.transformations[0].scenario.transformations`

### Cas 6 : Coproduit de Direct de Coproduit

**Description** : Transformations dans le coproduit d'une transformation qui est dans un coproduit.

**Schéma** :

```
Lot Initial
    ↓
Transfo 1 (nodeId: '12345678')
    ↓
Reste (nodeId: '44444444')
    ↓
    Transfo Reste 1 (nodeId: '77777777')
    ↓
    Reste Reste 1 (nodeId: '88888888') ← clic sur + ici
```

**Path** : `['coproduct_scenario', 'transformations', 0, 'scenario', 'coproduct_scenario', 'transformations']`

**Logique** :

- Quand on clique sur le "+" du reste d'une transformation dans un coproduit, on ajoute dans son coproduit
- La nouvelle transformation est ajoutée dans `coproduct_scenario.transformations[0].scenario.coproduct_scenario.transformations`

## Fonctions de Génération de Path

**IMPORTANT** : Ces fonctions sont maintenant obsolètes car on utilise `actionType` dans la popup !

**Nouvelle approche** : Utiliser `generatePathForNewTransformation(parentNodeId, actionType, scenario)` définie dans la section "Distinction Cruciale".

## Algorithme de Détection du Type de Nœud

**IMPORTANT** : Cette fonction est maintenant obsolète car on utilise `actionType` passé directement à la popup !

```javascript
// ❌ FONCTION OBSOLÈTE - À SUPPRIMER
// function getNodeTypeAndAction(nodeId, scenario)
```

**Nouvelle approche** : Le `actionType` est déterminé directement dans `sankey.js` lors du clic sur le bouton "+" et passé à la popup.

Cette analyse couvre tous les cas possibles d'imbrication et fournit une logique claire pour gérer chaque situation.

## Distinction Cruciale : Bouton "+" Principal vs "+" de Coproduit

### Problème Identifié

Il y a **DEUX types de boutons "+"** différents :

1. **Bouton "+" Principal** : Sur le nœud lui-même → Ajouter dans `scenario.transformations`
2. **Bouton "+" de Coproduit** : Sur le lien "Reste" → Ajouter dans `coproduct_scenario.transformations`

### Comment Distinguer les Deux Cas

#### **Cas 1 : Bouton "+" Principal (sur le nœud)**

```javascript
// Dans sankey.js - Gestion du clic sur le bouton "+" du nœud
function handleAddTransformationClick(node) {
  const parentNodeId = node._nodeId || node.id;
  const scenario = window.scenarios[window.currentScenarioIdx]?.scenario;
  const path = calculatePathForNewTransformation(
    parentNodeId,
    'add_to_node',
    scenario
  );

  const popup = new TransformationPopup();
  popup.show('add', {
    nodeId: parentNodeId,
    path: path, // ✅ Path calculé à l'avance
    node: node,
  });
}
```

#### **Cas 2 : Bouton "+" de Coproduit (sur le lien Reste)**

```javascript
// Dans sankey.js - Gestion du clic sur le bouton "+" du lien Reste
function handleAddCoproductTransformationClick(parentNode) {
  const parentNodeId = parentNode._nodeId || parentNode.id;
  const scenario = window.scenarios[window.currentScenarioIdx]?.scenario;
  const path = calculatePathForNewTransformation(
    parentNodeId,
    'add_to_coproduct',
    scenario
  );

  const popup = new TransformationPopup();
  popup.show('add', {
    nodeId: parentNodeId,
    path: path, // ✅ Path calculé à l'avance
    node: parentNode,
  });
}
```

### Logique dans la Popup

```javascript
// Dans transformation-popup.js - Sauvegarde (SIMPLIFIÉE)
function saveTransformation(transformation) {
  if (this.mode === 'add') {
    // ✅ Mode add : utiliser le path fourni
    const path = this.currentRef.path;
    const scenario = window.scenarios[window.currentScenarioIdx].scenario;

    if (path) {
      addTransformationToPath(scenario, path, transformation);
    } else {
      console.error("Pas de path fourni pour l'ajout de transformation");
    }
  }
}
```

### Exemples Concrets

#### **Exemple 1 : Bouton "+" sur un nœud normal**

```
Lot Initial
    ↓
Transfo 1 (nodeId: '12345678') ← clic sur "+" du nœud
```

**Action** : `calculatePathForNewTransformation('12345678', 'add_to_node')`
**Path calculé** : `['transformations', 0, 'scenario', 'transformations']`
**Résultat** : Ajouter dans `transformations[0].scenario.transformations`

#### **Exemple 2 : Bouton "+" sur le lien Reste**

```
Lot Initial
    ↓
Transfo 1 (nodeId: '12345678')
    ↓
Reste ← clic sur "+" du lien
```

**Action** : `calculatePathForNewTransformation('12345678', 'add_to_coproduct')`
**Path calculé** : `['transformations', 0, 'scenario', 'coproduct_scenario', 'transformations']`
**Résultat** : Ajouter dans `transformations[0].scenario.coproduct_scenario.transformations`

#### **Exemple 3 : Bouton "+" sur un coproduit**

```
Lot Initial
    ↓
Transfo 1 (nodeId: '12345678')
    ↓
Reste (nodeId: '44444444') ← clic sur "+" du nœud
```

**Action** : `calculatePathForNewTransformation('44444444', 'add_to_node')`
**Path calculé** : `['coproduct_scenario', 'transformations', 0, 'scenario', 'transformations']`
**Résultat** : Ajouter dans `coproduct_scenario.transformations[0].scenario.transformations`

### Fonction de Génération de Path

**Note** : Cette fonction est déjà définie plus haut dans la section "Gestion de l'Ajout de Transformations".

### Points d'Attention

1. **Le `actionType` est crucial** : Il détermine où ajouter la transformation
2. **Le path est calculé AVANT** l'appel de la popup
3. **La popup reste simple** : Elle utilise le path fourni
4. **Moins de modifications** : La popup change peu par rapport à l'existant

Cette approche est plus simple et plus maintenable !

## Gestion des Keys et DisplayNames

### Structure des Transformations

Les transformations doivent avoir cette structure :

```javascript
{
  type: ['selectByFormat'], // Tableau avec le type
  keys: ['1x2', '3x4'], // IDs Bubble pour les calculs
  _displayNames: [['T-shirt', 'Pantalon']], // Noms d'affichage français
  _nodeId: '12345678', // ID stable généré une fois
  _index: 0, // Index dans le tableau transformations
  // Plus de _path stocké !
}
```

### Validation dans `addTransformationToPath()`

La fonction `addTransformationToPath()` doit s'assurer que :

1. **`type`** : Tableau avec le type de transformation
2. **`keys`** : Tableau des IDs Bubble (pour les calculs) - **peut être vide pour `dynamic_transfo`**
3. **`_displayNames`** : Tableau de tableaux avec les noms d'affichage - **peut être vide pour `dynamic_transfo`**
4. **`_nodeId`** : Généré automatiquement si absent
5. **`_index`** : Calculé automatiquement

### Cas Spéciaux

#### **Transformations Dynamiques (`dynamic_transfo`)**

```javascript
{
  type: ['dynamic_transfo'],
  bubble_id: '123x456', // ID Bubble de la transformation
  title: 'Titre de la transformation',
  // ... autres propriétés spécifiques
}
```

#### **Transformations Statiques (selectBy\*)**

```javascript
{
  type: ['selectByFormat'],
  keys: ['1x2', '3x4'], // IDs des éléments sélectionnés
  _displayNames: [['T-shirt', 'Pantalon']], // Noms d'affichage
  // ... autres propriétés
}
```

### Exemple de Transformation Valide

```javascript
const transformation = {
  type: ['selectByFormat'],
  keys: ['1x2', '3x4'],
  _displayNames: [['T-shirt', 'Pantalon']],
  // _nodeId sera généré automatiquement
  // _index sera calculé automatiquement
};
```

## Correction de la Popup Tech

### Problème Identifié

La popup tech utilise encore les anciens `_path` et `_index` :

```javascript
// ❌ PROBLÈME dans tech-popup.js ligne 448-454
if (!lastTransfo._path || typeof lastTransfo._index !== 'number') {
  console.error('Transformation sans métadonnées _path/_index:', lastTransfo);
  return;
}

// ❌ PROBLÈME dans tech-popup.js ligne 463-467
window.updateTransformation(
  scenario,
  lastTransfo._path, // ❌ Utilise _path
  lastTransfo._index, // ❌ Utilise _index
  updatedTransformation
);
```

### Solution : Utiliser `findTransformationByNodeId()`

```javascript
// ✅ NOUVELLE LOGIQUE dans tech-popup.js
updateNodeTechInScenario(scenario, nodeId, techData) {
  // Trouver la transformation par son _nodeId
  const nodeInfo = findTransformationByNodeId(scenario, nodeId);

  if (!nodeInfo) {
    console.error('Transformation non trouvée pour nodeId:', nodeId);
    return;
  }

  // Créer la nouvelle transformation avec la tech ajoutée
  const updatedTransformation = {
    ...nodeInfo.transformation,
    tech: techData,
  };

  // Utiliser updateTransformation avec le path calculé
  if (typeof window.updateTransformation === 'function') {
    window.updateTransformation(
      scenario,
      nodeInfo.path,      // ✅ Path calculé à la volée
      nodeInfo.index,     // ✅ Index calculé à la volée
      updatedTransformation
    );
  }
}
```

### Appel de la Popup Tech

```javascript
// ✅ DANS sankey.js - Pas de changement nécessaire
function showTransfoTechPopup(nodeId, transformation) {
  if (window.showTechPopup) {
    const ref = {
      nodeId: nodeId, // ✅ On passe le nodeId
      transformation: transformation, // ✅ On passe la transformation complète
    };

    const hasExistingTech = transformation?.tech;
    const mode = hasExistingTech ? 'edit' : 'add';

    window.showTechPopup(ref, mode);
  }
}
```

## Correction des Fonctions d'Ajout de Transformations

### Problème Identifié

```javascript
// ❌ PROBLÈME dans sankey.js ligne 2872
const path = transformation._path || ['transformations'];
```

### Solution : Utiliser `calculatePathForNewTransformation()`

**Note** : La logique d'ajout est maintenant gérée dans les gestionnaires de clic (`handleAddTransformationClick` et `handleAddCoproductTransformationClick`) qui calculent le path et l'envoient à la popup. Plus besoin de `onTransformationAdd` complexe.

### Fonction `addTransformation` Simplifiée

```javascript
// ✅ NOUVELLE LOGIQUE dans sankey.js
window.addTransformation = function (scenario, path, transformation) {
  console.log('addTransformation called with:', {
    scenario,
    path,
    transformation,
  });

  // Générer un _nodeId stable si pas déjà présent
  if (!transformation._nodeId) {
    transformation._nodeId = generateStableNodeId();
  }

  // Naviguer jusqu'au tableau de transformations
  let target = scenario;
  for (let i = 0; i < path.length; i++) {
    target = target[path[i]];
  }

  // Ajouter la transformation
  if (Array.isArray(target)) {
    transformation._index = target.length; // Index automatique
    target.push(transformation);
    console.log('Transformation ajoutée avec succès');
    return true;
  }

  console.error('Cible non trouvée pour le path:', path);
  return false;
};
```

## Résumé des Changements

### **Popup Tech** :

- ✅ Utilise `findTransformationByNodeId(nodeId)` au lieu de `_path` et `_index`
- ✅ Le `nodeId` est déjà passé correctement
- ✅ Pas de changement dans l'appel de la popup

### **Fonctions d'Ajout** :

- ✅ `calculatePathForNewTransformation()` calcule le path selon l'`actionType`
- ✅ Les gestionnaires de clic calculent le path AVANT d'appeler la popup
- ✅ `addTransformationToPath()` génère automatiquement `_nodeId` et `_index`
- ✅ `addTransformationToPath()` valide la structure des transformations (`keys`, `_displayNames`)
- ✅ Plus de dépendance sur `transformation._path`
- ✅ Gestion du cas nœud racine (sans `nodeId`)
- ✅ Popup simplifiée qui utilise le path fourni
- ✅ Support des transformations dynamiques (sans `keys` obligatoires)

### **Système Final Cohérent** :

- ✅ `_nodeId` généré UNE SEULE FOIS lors de l'ajout
- ✅ `_path` calculé dynamiquement avec `findTransformationByNodeId()`
- ✅ `actionType` utilisé pour calculer le bon path
- ✅ Path calculé AVANT l'appel de la popup
- ✅ Gestion complète du cas nœud racine
- ✅ Popup modifiée minimalement (plus simple à maintenir)
