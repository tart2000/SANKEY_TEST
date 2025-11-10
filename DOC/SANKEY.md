# Visualisation Sankey - Valorisation des Matières Textiles

## Description

Ce projet est un prototype avancé de visualisation interactive de type Sankey pour suivre le flux de valorisation des matières textiles. Il permet de visualiser les différents parcours de valorisation d'un lot, d’éditer les scénarios de transformation (principaux et coproduits) et de synchroniser les données avec Bubble via l’API interne. Le module Sankey tourne dans `public/sankey/` (HTML/JS autonome) et est encapsulé dans l’application Next.js (`/sankey`) qui gère la sélection du lot/scénario/team, la langue, le mode édition et les communications `postMessage`.

Le Sankey offre une navigation multi-dimensions (format, type, matière, couleur, qualité, fibres, propreté, perturbateurs) avec stackbars colorées dynamiques, tooltips détaillés, boutons d’action contextuels (`+`, fork, etc.), calculs de coûts par technologie et gestion des transformations dynamiques définies côté Bubble.

## Fonctionnalités Principales

### Visualisation et Navigation

- **Diagramme Sankey horizontal** : Visualisation interactive des flux de valorisation
- **Dimensions multiples** : Affichage dynamique des différentes dimensions (format, type, matière, fibres, couleur, qualité, propreté)
- **Stackbars colorées** : Représentation visuelle de la répartition des dimensions avec des palettes de couleurs harmonieuses
- **Tooltips informatifs** : Affichage détaillé des informations au survol des éléments

### Gestion des Lots

- **Structure hiérarchique** : Organisation des données en format > type > matière > fibres
- **Calculs dynamiques** : Génération automatique des pourcentages et des masses
- **Validation des destinations** : Indication visuelle des lots valorisés avec leur destination finale

### Système de Transformation

- **Scénario dynamique** : Structure flexible permettant des transformations imbriquées
- **Filtres avancés** : Sélection par format, type, matière, couleur, qualité, propreté et fibres
- **Seuils de fibres** : Filtrage précis des matières selon leur composition en fibres

## Utilisation

### Structure du Scénario

Le scénario est défini comme un objet arborescent qui distingue :

- les transformations principales (`main.transformations`) lorsqu’il provient de Bubble (structure recommandée) ;
- un champ `transformations` à la racine pour les scénarios historiques (toujours supporté pour compatibilité) ;
- le champ `coproduct_scenario.transformations` pour les actions appliquées au “reste”.

```js
const scenario = {
  main: {
    transformations: [
      {
        type: 'selectByFormat', // type de sélection
        keys: ['1730809932159x273229509786599420'], // bubble_ids à sélectionner
        scenario: {
          transformations: [
            {
              type: 'selectByMatiere',
              keys: ['1753277557054x291758371680550900'],
              scenario: {
                transformations: [],
                coproduct_scenario: { transformations: [] },
              },
              _path: [
                'main',
                'transformations',
                0,
                'scenario',
                'transformations',
                0,
              ],
              _nodeId: 'path-0-0',
            },
          ],
          coproduct_scenario: { transformations: [] },
        },
        coproduct_scenario: { transformations: [] },
        target: 'CT2',
        _path: ['main', 'transformations', 0],
        _nodeId: 'path-0',
      },
    ],
  },
  coproduct_scenario: {
    transformations: [
      {
        type: 'selectByCouleur',
        keys: ['1753277499159x841848085058682900'],
        _path: ['coproduct_scenario', 'transformations', 0],
        _nodeId: 'coproduct-0',
      },
    ],
  },
};
```

**Notes importantes :**

- `_path`, `_index` et `_nodeId` sont maintenus automatiquement pour faciliter les mises à jour, la navigation et l’affichage du bouton `+`.
- Si `main` est absent, `scenario.transformations` et `scenario.coproduct_scenario` restent pris en charge (fichiers Bubble anciens).
- Les `keys` doivent toujours contenir les `bubble_id` (pas les labels). Les textes affichés sont injectés via les données du lot.

### Types de Sélection Disponibles

1. **Sélections de base**
   - `selectByFormat` : Sélection par format (vêtements, chaussures, etc.)
   - `selectByType` : Sélection par type (après format)
   - `selectByMatiere` : Sélection par matière (après format et type)
   - `selectByCouleur` : Sélection par couleur
   - `selectByQualite` : Sélection par qualité
   - `selectByProprete` : Sélection par propreté

2. **Sélection avancée par fibres**
   ```js
   {
     type: 'selectByFibre',
     keys: ['coton'],
     threshold: 60,        // optionnel
     condition: 'over',    // optionnel
     scenario: { /* ... */ }
   }
   ```

### Validation des Destinations

- Chaque lot peut avoir une destination finale (`target`)
- Les lots validés sont marqués d'une icône de validation
- Le tooltip affiche :
  - La destination du lot
  - Le poids du lot
  - Le total des lots ayant la même destination

## Intégration Technique

### Structure des Fichiers

- `index.html` : structure HTML + initialisation i18next + paramètres iframe
- `styles.css` : base visuelle spécifique au module Sankey (complétée par Tailwind compilé)
- `sankey.js` : orchestrateur principal (chargement des données Bubble, parsing, rendu d3, interactions, communication postMessage)
- `scenario.js` : helpers pour la navigation dans l’arbre, duplication profonde, calculs sur les lots, dynamic transfos
- `processes.js` : librairie des transformations statiques (selectBy*, process*, filtres)
- `transformation-popup.js` : popup d’édition d’une transformation (sélection, cibles, options)
- `tech-popup.js` : popup d’édition des technos (fetch Bubble, versioning, calculs de coûts)
- `utils/` : fonctions partagées (normalisation, couleurs, lots)
- `../data/*.js` : jeux de données modulaires (lot type, couleurs, dynamic transfos) synchronisés avec Bubble
- `../i18n-config.js` : configuration i18next générée par `npm run build:translations`

### Dépendances

- D3.js v7
- d3-sankey v0.12.3

## Développement

### Ajout de Nouvelles Dimensions

1. Ajouter la dimension dans les constantes de données
2. Créer une fonction de sélection correspondante
3. Ajouter la palette de couleurs appropriée
4. Mettre à jour le sélecteur de dimensions

### Modification de la Structure

- Adapter le générateur de `lotType` dans `data.js`
- Maintenir la cohérence des clés entre le scénario et les données
- Utiliser la génération dynamique des listes de valeurs

## Limitations

- Optimisé pour les petits à moyens volumes de données
- Nécessite une structure de données hiérarchique cohérente
- Les clés doivent correspondre exactement (casse, accents, espaces)

## Nouveautés et évolutions récentes (2025)

### Palette et affichage des couleurs

- **Palettes dynamiques** : Les palettes de couleurs sont générées dynamiquement pour chaque dimension (matière, format, type, couleur, qualité) à partir des vraies données présentes dans le lot.
- **Couleurs des matières robustes** : Les couleurs des matières sont désormais alignées sur les matières réellement présentes dans les données (plus de stackbars grises ou de matières manquantes).
- **Stackbars visuelles** : Les stackbars sont colorées avec opacité, contour et border-radius. Un fond hachuré s'affiche si la dimension est vide.

### Stackbars et gestion des dimensions

- **Affichage robuste** : Les stackbars affichent la répartition de la dimension sélectionnée (format, type, matière, fibres, couleur, qualité) et ignorent les clés techniques (`_missing`).
- **Gestion des cas particuliers** : Les stackbars restent robustes même si certaines branches sont vides ou incomplètes.

### Tooltips

- **Détail dynamique** : Les tooltips affichent le détail de la dimension courante pour chaque path, calculé dynamiquement à partir du lot cible.
- **Pourcentages et poids** : Les valeurs sont toujours normalisées et cohérentes avec la structure réelle du lot.

### Icônes d'action

- **Ajout de transformation** : Une icône "+" s'affiche sur chaque nœud feuille et sur le carré du dernier path "Reste", avec un tooltip "Ajouter une transformation".

### Affichage des titres

- **Nom du lot au-dessus du nœud** : Le nom du lot (ex : "Lot initial", "Reste", etc.) est affiché au-dessus de chaque nœud, centré sur la stackbar.

### Suppression de l'objet `data`

- **Plus de dépendance statique** : L'objet `data` n'est plus utilisé. Toutes les listes de valeurs sont générées dynamiquement à partir des vraies données (`lotType`, `matieres_fibres`, etc.).
- **Synchronisation automatique** : Plus aucune dépendance à un objet statique pour les dimensions : tout est synchronisé avec les données affichées.

### Robustesse et nettoyage

- **Nettoyage du code** : Suppression de tout code mort, debug ou variables inutilisées.
- **Synchronisation palettes/données** : Les palettes et les mappings sont toujours synchronisés avec les données affichées.

### Scénario dynamique

- **Scénario imbriqué** : Le scénario de transformations est totalement dynamique et peut être imbriqué à volonté.
- **Correspondance stricte des clés** : Les clés du scénario doivent être en accord exact (casse, accents, espaces) avec les clés des données.

### Instructions pour modification

- **Ajout de dimension ou palette** : Pour ajouter une nouvelle dimension ou palette, il suffit d'ajouter une entrée dans la section correspondante du code JS.
- **Modification de la structure des lots** : Adapter le générateur de `lotType` dans `data.js` pour toute évolution de la structure.

### Filtrage avancé par fibre (`selectByFibre`)

Vous pouvez désormais filtrer les matières selon la proportion d'une ou plusieurs fibres, grâce à deux nouveaux paramètres optionnels :

- `threshold` : valeur seuil (entre 0 et 100)
- `condition` : "over" (plus que) ou "under" (moins que)

**Exemples d'utilisation dans le scénario :**

#### Cas simple (présence d'une fibre, comportement historique)

```js
{
  type: 'selectByFibre',
  keys: ['coton', 'polyester'],
  scenario: { /* ... */ }
}
```

→ Sélectionne toutes les matières contenant au moins une des fibres listées, quel que soit le pourcentage.

#### Cas avancé (avec seuil et condition)

```js
{
  type: 'selectByFibre',
  keys: ['coton'],
  threshold: 60,
  condition: 'over',
  scenario: { /* ... */ }
}
```

→ Sélectionne uniquement les matières contenant **au moins 60% de coton**.

```js
{
  type: 'selectByFibre',
  keys: ['polyester'],
  threshold: 20,
  condition: 'under',
  scenario: { /* ... */ }
}
```

→ Sélectionne uniquement les matières contenant **moins de 20% de polyester**.

#### Plusieurs fibres avec seuil

```js
{
  type: 'selectByFibre',
  keys: ['coton', 'polyester'],
  threshold: 30,
  condition: 'over',
  scenario: { /* ... */ }
}
```

→ Sélectionne toutes les matières contenant **au moins 30% de coton ou de polyester**.

**Remarques :**

- Si `threshold` et `condition` ne sont pas fournis, le comportement par défaut (présence de la fibre) est conservé.
- Vous pouvez passer une ou plusieurs fibres dans `keys`.

### Sélections classiques (format, type, matière, couleur, qualité)

Pour filtrer sur une dimension précise, utilisez les types de transformation suivants dans votre scénario :

- `selectByFormat` : sélectionne un ou plusieurs formats
- `selectByType` : sélectionne un ou plusieurs types (nécessite d'avoir déjà sélectionné un format)
- `selectByMatiere` : sélectionne une ou plusieurs matières (nécessite d'avoir déjà sélectionné un format et un type)
- `selectByCouleur` : sélectionne une ou plusieurs couleurs
- `selectByQualite` : sélectionne une ou plusieurs qualités

**Exemples d'utilisation dans le scénario :**

#### Sélection par format

```js
{
  type: 'selectByFormat',
  keys: ['1752674004466x758392426243031000', '1753277499159x841848085058682900'], // bubble_ids
  scenario: { /* ... */ }
}
```

→ Sélectionne tous les lots dont le format correspond aux bubble_ids fournis.

#### Sélection par type

```js
{
  type: 'selectByType',
  keys: ['1753277557054x291758371680550900'],
  scenario: { /* ... */ }
}
```

→ Sélectionne tous les lots dont le type possède l’un des bubble_ids listés (après avoir sélectionné un format).

#### Sélection par matière

```js
{
  type: 'selectByMatiere',
  keys: ['1752565035081x996348588023394400'],
  scenario: { /* ... */ }
}
```

→ Sélectionne toutes les matières correspondant aux bubble_ids fournis (après filtrage format + type).

#### Sélection par couleur

```js
{
  type: 'selectByCouleur',
  keys: ['1752564923160x133963234616413900'],
  scenario: { /* ... */ }
}
```

→ Sélectionne toutes les couleurs correspondant aux bubble_ids fournis.

#### Sélection par qualité

```js
{
  type: 'selectByQualite',
  keys: ['1752657446787x193212466860654600'],
  scenario: { /* ... */ }
}
```

→ Sélectionne toutes les qualités correspondant aux bubble_ids fournis.

**Remarques :**

- Pour les sélections imbriquées (type, matière), il faut d'abord avoir filtré sur le niveau supérieur (format, puis type).
- Les `keys` doivent toujours être des identifiants Bubble. Les libellés affichés sont récupérés via les données du lot/dimensions.
- Vous pouvez passer une ou plusieurs valeurs dans `keys` pour chaque type de sélection.

---

## Structure Technique

### Technologies Utilisées

- HTML5
- CSS3
- JavaScript (Vanilla)
- D3.js (pour la visualisation Sankey)

### Architecture

Le projet est conçu pour être léger et facilement intégrable dans d'autres applications (notamment Bubble). Il se compose de :

- Un fichier HTML principal
- Un fichier CSS pour le style
- Un ou plusieurs fichiers JavaScript pour la logique et la génération dynamique des données

### Structure des Données

La structure des données est générée dynamiquement à partir des constantes du projet (`formats_types`, `repartitionParType`, `matieres_fibres`, etc.) et produit un objet hiérarchique `lotType` : format > type > matière > fibres, avec la répartition des couleurs et la qualité.

## Fonctionnalités principales

- Visualisation Sankey horizontale, responsive
- Sélection dynamique de la dimension à afficher (format, type, matière, fibres, couleur, qualité)
- Stackbars colorées et robustes pour chaque dimension
- Tooltips détaillés et dynamiques
- Icônes d'action pour ajouter des transformations
- Affichage du nom du lot au-dessus de chaque nœud
- Gestion dynamique et imbriquée des scénarios de transformation

## Intégration

Le diagramme est conçu pour être facilement intégrable dans d'autres applications, notamment Bubble. Il suffit d'inclure les fichiers nécessaires et d'initialiser le diagramme avec les données appropriées.

## Limitations Actuelles

- Version prototype avec fonctionnalités avancées mais non exhaustives
- Optimisé pour les petits à moyens volumes de données
- Nécessite une structure de données hiérarchique cohérente

## Note

Ce projet évolue rapidement. Pour toute modification, bien vérifier la correspondance exacte des clés entre le scénario et les données, et privilégier la génération dynamique des listes de valeurs pour garantir la robustesse de la visualisation.

## Système de transformations dynamiques (scénario Sankey)

### Principe général du parsing (logique actuelle)

- **Chaque transformation** du tableau `main.transformations` découpe sa part dans le lot initial (toutes dimensions confondues).
- **Tous les paths partent du lot initial** : chaque sélection crée un nœud et un lien depuis le lot initial.
- **Le "reste"** est ce qui n'a pas été sélectionné dans aucune transformation (toutes dimensions confondues), et il est ajouté à la fin comme un nœud supplémentaire.
- **Les sous-scenarios (`scenario`) et les `coproduct_scenario` sont maintenant gérés** avec une logique de paths dynamiques et imbriquées.
- **Système de paths** : Chaque transformation a un `_path` et un `_index` pour identifier sa position exacte dans la structure imbriquée.
- **Gestion des coproduits** : Les transformations du coproduit sont dans `coproduct_scenario.transformations` et suivent la même logique récursive.
- **Ajout de transformations** : Les boutons « + » sont affichés selon la logique dynamique (voir plus bas).

#### Exemple de scénario

```js
const scenario = {
  transformations: [
    {
      type: 'selectFirstLevel',
      dimension: 'format',
      keys: ['Chaussures et bottes'],
      scenario: {},
    },
    {
      type: 'selectFirstLevel',
      dimension: 'matiere',
      keys: ['100% coton'],
      scenario: {},
    },
  ],
  coproduct_scenario: [],
};
```

#### Résultat attendu dans le Sankey

- 1 nœud "Lot initial" à gauche
- 1 path pour la sélection "format: Chaussures et bottes"
- 1 path pour la sélection "matiere: 100% coton"
- 1 path "Reste" pour tout ce qui n'a pas été sélectionné

#### Différence avec un parsing séquentiel ou croisé

- **Séquentiel** : chaque transformation s'applique sur le reste du lot précédent (ce n'est PAS le cas ici)
- **Croisé** : chaque path correspond à une combinaison de sélections sur plusieurs dimensions (ce n'est PAS le cas ici)
- **Ici** : chaque sélection découpe sa part dans le lot initial, indépendamment des autres, puis le reste est ajouté à la fin.

### Principe

Le Sankey peut être généré dynamiquement à partir d'un lot de départ (distribution initiale sur 1000 kg) et d'un **scénario** arborescent de transformations. Chaque transformation modifie la répartition d'une dimension (format, matière, couleur, qualité, etc.) et génère un ou plusieurs nouveaux lots. Le Sankey affiche tous les lots intermédiaires, chaque transformation créant un nouveau nœud et un lien dans le diagramme.

### Nouvelle structure du scénario

Un scénario standard comporte :

- `main.transformations` : liste principale des transformations (sélections, processes, dynamic transfos…).
- `main.coproduct_scenario.transformations` : transformations appliquées au reste généré par chacun des nœuds `main` (optionnel).
- `coproduct_scenario.transformations` à la racine : transformations appliquées au reste global du lot initial.
- Propriétés additionnelles susceptibles d’être présentes :
  - `target` : destination finale (bubble_id) ;
  - `tech` : techno associée (voir section techno) ;
  - `dynamic_transfo_id`, `transfo_type` ;
  - attributs d’UI (`_path`, `_nodeId`, `_index`, `isProcess`, etc.).

Chaque transformation possède les clés principales suivantes :

```ts
type Transformation = {
  type: string; // selectBy*, process*, dynamic_transfo, ...
  keys?: string[]; // bubble_ids ciblés
  dimension?: string; // pour selectFirstLevel / dynamic
  threshold?: number; // selectByFibre
  condition?: 'over' | 'under';
  scenario?: ScenarioNode; // sous-scénario (même structure)
  coproduct_scenario?: ScenarioNode;
  target?: string; // bubble_id destination
  yield?: number; // processes dynamiques
  tech?: TechAttachment; // techno attachée
  _path?: (string | number)[]; // chemin vers la transformation
  _nodeId?: string; // identifiant UI
  _index?: number; // index dans le tableau parent
};

type ScenarioNode = {
  transformations?: Transformation[];
  coproduct_scenario?: ScenarioNode;
};
```

#### Exemple minimal (vide)

```js
const scenario = {
  main: {
    transformations: [],
    coproduct_scenario: { transformations: [] },
  },
  coproduct_scenario: { transformations: [] },
};
```

#### Exemple imbriqué

```js
const scenario = {
  main: {
    transformations: [
      {
        type: 'selectByFormat',
        keys: ['173...'], // bubble_id format
        scenario: {
          transformations: [
            {
              type: 'dynamic_transfo',
              dynamic_transfo_id: 'transfo_lavage_1',
              yield: 80,
              scenario: {
                transformations: [],
                coproduct_scenario: { transformations: [] },
              },
            },
            {
              type: 'selectByMatiere',
              keys: ['175...'],
              target: 'CT2',
              scenario: {
                transformations: [],
                coproduct_scenario: { transformations: [] },
              },
            },
          ],
          coproduct_scenario: { transformations: [] },
        },
        _path: ['main', 'transformations', 0],
        _index: 0,
        _nodeId: 'path-0',
      },
    ],
    coproduct_scenario: {
      transformations: [
        {
          type: 'selectByCouleur',
          keys: ['175...'],
          _path: ['main', 'coproduct_scenario', 'transformations', 0],
          _nodeId: 'main-coproduit-0',
        },
      ],
    },
  },
  coproduct_scenario: {
    transformations: [
      {
        type: 'processBroyage',
        yield: 60,
        tech: {
          bubble_id: 'tech_123',
          quantity: 2,
          rate: 100,
          details: { version: '2025.03' },
        },
        _path: ['coproduct_scenario', 'transformations', 0],
        _nodeId: 'coproduit-root-0',
      },
    ],
  },
};
```

- À chaque niveau, tu peux imbriquer autant de sous-scénarios que nécessaire.
- Les transformations du "reste" (coproduit) se trouvent toujours dans un champ `coproduct_scenario.transformations`.
- Les `_path` / `_nodeId` sont recalculés lors de la sauvegarde pour conserver la cohérence UI.

### Parsing

Le parsing du scénario se fait récursivement : à chaque niveau, on applique toutes les transformations principales, puis toutes les transformations du coproduit (reste), en descendant dans les sous-scénarios si présents.

## Génération dynamique de l'objet `lotType`

Au chargement de la page, un objet `lotType` est généré automatiquement à partir des constantes `formats_types`, `repartitionParType` et `matieres_fibres`.

Cet objet permet d'obtenir une structure hiérarchique complète : format > type > matière > fibres, avec la répartition des couleurs et la qualité.

### Exemple de structure de lot (voir aussi data/lot_type.json)

```js
{
  total: 1000,
  format: {
    "Vêtements": {
      pourcentage: 60,
      en_gb: "name",
      bubble_id: "xyz",
      types: {
        "T-shirt": {
          pourcentage: 40,
          en_gb: "name",
          bubble_id: "xyz",
          matieres: {
            "Coton": {
              pourcentage: 80,
              bubble_id: "xyz",
              en_gb: "name"
              "fibres": { /* ... */ }
            },
            // ...
          },
          couleurs: {
            "Bleu": { pourcentage: 50 },
            // ...
          }
        },
        // ...
      }
    },
    // ...
  },
  qualite: {
    "Neuf étiqueté":
      {pourcentage: 5},
    "Parfait état":
      {pourcentage: 15},
    ...
  }
}
```

- Le champ `total` correspond à la masse totale de référence (exemple : 1000).
- Le champ `format` contient tous les formats, chacun avec ses types, matières, fibres et couleurs.
- Le champ `qualite` reprend la distribution qualité.
- chaque clé a aussi un bubble_id sur lequel doivent se faire toutes les recherches

---

## Utilisation

- Toutes les données sont générées automatiquement à partir des fichiers de données (`data.js`).
- Pour voir la structure générée, ouvrez la console du navigateur : un log `lotType généré : ...` s'affiche au chargement de la page.

---

Pour toute question ou adaptation de la structure, contactez le développeur du projet.

## Affichage du « + » dans le Sankey

### Règle actuelle

- Le « + » s'affiche sur les nœuds feuilles sans lien sortant, sauf si le nœud a une destination finale (`target`) ou s'il est un nœud destination (`isTarget`).
- Le « + » s'affiche également sur le lien « Reste » (coproduit) pour indiquer qu'une transformation supplémentaire peut être ajoutée.

### Dernières modifications

- Le champ `isProcess` est ajouté uniquement sur le résultat principal d'un process (le flux principal), **pas** sur le coproduit.
- Le « + » ne s'affiche plus sur le coproduit d'un process (le « reste » du process), mais reste affiché sur les autres coproduits.

#### Exemple de scénario

```js
{
  type: 'processLavage',
  yield: 0.8,
  scenario: { /* ... */ }
}
```

→ Le résultat principal du lavage aura `isProcess: true` et n'aura pas de « + », tandis que le coproduit (le reste) aura le « + ».

---

# Intégration Bubble-ready : Mode Iframe & wrapper Next.js

## Objectif

Permettre d'intégrer la visualisation Sankey dans Bubble via une iframe, avec passage dynamique des paramètres et chargement des données en temps réel depuis Bubble.

## Paramètres d'entrée de l'iframe

Les paramètres sont injectés par la page Next (`/sankey`) ou par Bubble dans le cas d’une iframe directe :

- `lang` (`fr_fr`, `en_gb`, …) : langue i18next
- `scenarioIdx` : index du scénario courant (utile pour les scénarios mockés côté front)
- `lotId` : **bubble_id** du lot à charger
- `scenarioId` : **bubble_id** du scénario Bubble
- `teamId` : **bubble_id** de la team (profils RH, prix électricité, catalogue tech)
- `isEditable` : `true` / `false` (désactive toute action si faux)
- `isLive` : `true` / `false` (bascule dev/live pour les endpoints Bubble)

## Fonctionnement attendu

- **Aucun dropdown Bubble** dans l'iframe : la sélection se fait dans l’app hôte (Next ou Bubble).
- L'iframe reçoit les IDs à afficher et charge les données correspondantes via API Bubble.
- Les données sont affichées dès qu'elles sont chargées (afficher un loader si besoin).
- Le mode édition (`isEditable=false`) désactive toutes les fonctionnalités d'édition (boutons `+`, popups, drag/drop, sauvegarde).

## API Bubble à brancher

- Réutiliser la fonction existante pour récupérer un lot complet par son ID.
- Créer une fonction pour récupérer un scénario complet par son ID (même logique que pour les lots).
- Les objets récupérés doivent être compatibles avec la structure attendue par le Sankey (voir plus haut).
- Endpoint `team` : retourne les profils RH, coût électrique, liste des techs (avec versions).
- Endpoint `base_data` : dimensions, transformations dynamiques, mappings complémentaires (utilisé pour initialiser les dropdowns).

## Initialisation de l'iframe

1. **Récupérer les paramètres** (via URL ou postMessage)
2. **Charger les données** du lot et du scénario via les API Bubble
3. **Afficher le Sankey** uniquement quand tout est chargé
4. **Désactiver l'édition** si `isEditable` est à `no`

## Synchronisation et notifications

- Prévoir une fonction pour notifier Bubble (via postMessage) quand le Sankey est modifié (si édition activée). Message courant : `{ type: 'showLotDetails', payload: { nodeId, lotData, ... } }`.
- Gérer les erreurs de chargement (afficher un message d'erreur ou un loader)

## Problèmes potentiels et recommandations

- **Mapping des données** : vérifier la compatibilité entre la structure Bubble et celle attendue par le Sankey (adapter si besoin)
- **Chargement asynchrone** : bien gérer l'ordre de chargement et l'affichage (loader, erreurs)
- **Droits d'accès** : attention aux restrictions Bubble entre mode live/dev
- **Robustesse** : toujours vérifier la présence des champs attendus dans les objets reçus

## Exemple de flux d'intégration

1. L'utilisateur sélectionne un lot et un scénario dans Bubble (hors iframe)
2. Bubble passe les IDs à l'iframe via l'URL ou postMessage
3. L'iframe charge les données via les API Bubble
4. Le Sankey s'affiche, en mode édition ou lecture selon le paramètre
5. Toute modification dans l'iframe (si édition) est notifiée à Bubble

---

### Rôle du wrapper Next (`/sankey`)

- Interface utilisateur pour choisir le lot, le scénario, la team et la langue (composants shadcn / Radix).
- Rechargement automatique de l’iframe lorsque l’un des paramètres change (`key` basé sur le state).
- Ajustement automatique de la hauteur de l’iframe via les messages `IFRAME_HEIGHT`.
- Console log des messages métier (`showLotDetails`) pour intégration future dans Bubble ou un panneau latéral.
- Passage du mode édition via checkbox (`isEditable`).
- Gestion de la version dev/live via les métadonnées `isLive` sur les lots/scénarios/teams.

**Pour toute adaptation ou évolution, suivre ce guide pour garantir la compatibilité et la robustesse de l'intégration Bubble.**

---

# Système de Gestion des Techs avec Calcul des Coûts

## Objectif

Intégrer un système complet de gestion des technologies de transformation avec calcul automatique des coûts, versioning intelligent et interface utilisateur optimisée.

## Architecture des Données

### Structure des Techs

```javascript
Tech {
  name: string,
  bubble_id: string,
  quantity: number,
  rate: number, // kg/h par machine
  step: string, // collecting, sorting, etc.
  details: {
    version: string,
    conso: number, // kWh par heure de fonctionnement (par machine)
    profils: {
      profil_name: {
        timeh: number // heures pour 1h d'utilisation de la tech
      }
    }
  }
}
```

### Structure des Transformations Enrichie

```javascript
Transformation {
  // ... données existantes
  tech: {
    name: string,
    bubble_id: string,
    quantity: number,
    rate: number,
    step: string,
    details: TechDetails, // Données complètes de la tech
    version: string
  }
}
```

## Fonctionnalités Implémentées

### 1. **Popup Tech Optimisée**

- **Interface en une ligne** : Sélecteur d'outil et quantité côte à côte
- **Bouton X** : Fermeture en haut à droite
- **Bouton poubelle** : Suppression avec validation (mode edit uniquement)
- **Tableau de données** : Affichage des caractéristiques de la tech sélectionnée

### 2. **Système de Versioning Intelligent**

- **Vérification automatique** : Au chargement de la popup tech
- **Mise à jour silencieuse** : Des techs obsolètes dans le scénario
- **Parcours récursif** : Vérification de tous les sous-scénarios
- **Relance automatique** : Du Sankey après mise à jour

### 3. **Calcul des Coûts Centralisé**

- **Fonction réutilisable** : `calculateTransformationCosts()`
- **Utilisation des données stockées** : Plus d'appels API dans les tooltips
- **Calculs optimisés** : Temps utile, coûts RH, consommation électrique
- **Affichage cohérent** : Dans les tooltips et la popup tech

### 4. **Gestion des Données**

- **Appel API `/tech?id`** : Lors de l'ajout d'une tech
- **Stockage des détails** : Dans `tech.details` pour éviter les appels répétés
- **Synchronisation** : Entre API et scénario via versioning
- **Gestion d'erreurs** : Graceful fallback si API indisponible

## Logique de Calcul

### Calcul du Temps Utile

```javascript
temps_utile = volume_lot_input / (rate_tech × quantity_machines)
```

### Calcul des Coûts

```javascript
function calculateTransformationCosts(transformation, techDetails, teamData) {
  if (!transformation.tech || !techDetails || !teamData) {
    return null;
  }

  const volume = transformation.lot_input_volume || 0;
  const rate = transformation.tech.rate;
  const quantity = transformation.tech.quantity;
  const totalRate = rate * quantity;
  const tempsUtile = volume / totalRate;

  let totalPrix = 0;
  let couts_rh = 0;
  let consommation_totale = 0;

  // Coûts RH
  if (techDetails.profils && teamData.profils) {
    Object.entries(techDetails.profils).forEach(([profilName, profilData]) => {
      const profilTempsUtile = tempsUtile * profilData.timeh;
      const teamProfilData = teamData.profils[profilName];
      if (teamProfilData) {
        const prix = teamProfilData.pricerate * profilTempsUtile;
        couts_rh += prix;
        totalPrix += prix;
      }
    });
  }

  // Consommation électrique
  if (techDetails.conso && teamData.elec) {
    const consoKwh = techDetails.conso * tempsUtile * quantity;
    const prixElec = consoKwh * teamData.elec;
    consommation_totale = consoKwh;
    totalPrix += prixElec;
  }

  return {
    temps_utile: tempsUtile,
    cout_total: totalPrix,
    cout_unitaire: volume > 0 ? totalPrix / volume : 0,
    consommation_totale,
    couts_rh,
    cout_energie: totalPrix - couts_rh,
    version_transfo_tech: techDetails.version || '1.0',
  };
}
```

## Interface Utilisateur

### Popup Tech

- **Sélection d'outil** : Dropdown avec toutes les techs de la team
- **Quantité** : Input numérique avec spinner
- **Tableau de données** : Caractéristiques de la tech sélectionnée
- **Boutons d'action** : Annuler, Enregistrer, Supprimer (mode edit)

### Tooltip Fork

- **Affichage des coûts** : Utilise les données stockées dans le scénario
- **Calculs en temps réel** : Basés sur le volume du lot
- **Détails complets** : Temps utile, profils RH, consommation électrique
- **Pas d'appel API** : Performance optimisée

## API et Intégration

### Endpoints Utilisés

- **`/api/bubble`** avec endpoint `team` : Chargement des techs disponibles
- **`/api/bubble`** avec endpoint `tech` : Récupération des détails d'une tech

### Flux de Données

1. **Chargement initial** : Récupération des techs de la team
2. **Sélection d'une tech** : Appel API pour récupérer les détails
3. **Sauvegarde** : Stockage des détails dans le scénario
4. **Affichage** : Utilisation des données stockées (plus d'API)

## Versioning et Synchronisation

### Vérification des Versions

```javascript
async checkAndUpdateTechVersions() {
  // Parcours récursif du scénario
  // Comparaison des versions
  // Mise à jour automatique si nécessaire
}
```

### Mise à Jour des Techs

```javascript
updateTechDetails(transformation, techDetails) {
  // Synchronisation des données
  // Mise à jour de la version
  // Conservation des métadonnées
}
```

## Optimisations Réalisées

### Performance

- **Suppression des appels API** dans les tooltips
- **Utilisation des données stockées** pour les calculs
- **Versioning intelligent** pour éviter les appels inutiles

### Interface

- **Layout optimisé** : Inputs sur une ligne
- **Boutons contextuels** : Poubelle seulement en mode edit
- **Validation visuelle** : États des boutons selon les données

### Robustesse

- **Gestion d'erreurs** : Fallback gracieux si API indisponible
- **Validation des données** : Vérification avant calculs
- **Logs détaillés** : Pour le debugging

## Utilisation

### Ajout d'une Tech

1. Cliquer sur l'icône "+" d'un nœud
2. Sélectionner "Outils" dans le dropdown
3. Choisir une tech et sa quantité
4. Vérifier les caractéristiques affichées
5. Sauvegarder

### Modification d'une Tech

1. Cliquer sur l'icône fork d'un lien
2. Sélectionner "Outils" dans le dropdown
3. Modifier la tech ou la quantité
4. Utiliser le bouton poubelle pour supprimer si nécessaire

### Affichage des Coûts

- **Tooltip fork** : Affichage détaillé des coûts
- **Calculs automatiques** : Basés sur le volume du lot
- **Données synchronisées** : Avec les dernières versions des techs
  version_transfo_tech: transfoTech.version,
  };
  }

````

## Exemple Concret

## Liste de transfo_techs

Par API Bubble :

```javascript

{
  "title": "Testchtera",
  "bubble_id": "1730809932159x273229509786599420",
  "elec": 0.2,
  "profils": {
    "Chef d'atelier": {
      "pricerate": 20,
      "bubble_id": "1752674004466x758392426243031000"
    },
    "Opérateur de ligne": {
      "pricerate": 14,
      "bubble_id": "1752674021593x353734521788825600"
    },
    "Tourneur/fraiseur": {
      "pricerate": 100,
      "bubble_id": "1752674049729x862972045792641000"
    }
  },
  "techs": {
    "Une machine super intéressante": {
      "rate": 0.5,
      "bubble_id": "1731421834562x920918021539102700",
      "step": "collecting"
    },
    "Table de tri": {
      "rate": 12,
      "bubble_id": "1753277499159x841848085058682900",
      "step": "sorting"
    },
    "Tapis roulant de tri": {
      "rate": 100,
      "bubble_id": "1753277557054x291758371680550900",
      "step": "sorting"
    }
  }
}

````

### Transfo_tech

Reçue par API depuis Bubble :

```javascript

{
  "title": "Testchtera",
  "bubble_id": "1730809932159x273229509786599420",
  "profils": {
    "Chef d'atelier": {
      "rate": 20,
      "bubble_id": "1752674004466x758392426243031000"
    },
    "Opérateur de ligne": {
      "rate": 14,
      "bubble_id": "1752674021593x353734521788825600"
    },
    "Tourneur/fraiseur": {
      "rate": 100,
      "bubble_id": "1752674049729x862972045792641000"
    }
  },
  "techs": {
    "Une machine super intéressante": {
      "rate": 0.5,
      "bubble_id": "1731421834562x920918021539102700",
      "step": "collecting"
    },
    "Table de tri": {
      "rate": 12,
      "bubble_id": "1753277499159x841848085058682900",
      "step": "sorting"
    },
    "Tapis roulant de tri": {
      "rate": 100,
      "bubble_id": "1753277557054x291758371680550900",
      "step": "sorting"
    }
  }
}

```

### Transformation

```javascript
{
  volume: 500, // kg
  nombre_machines: 2,
  // Résultat : temps_utile = 500 / (100 * 2) = 2.5 heures
}
```

## API et Chargement des Données

### Nouvel Endpoint pour les Données de Base

```javascript
fetch('/api/bubble', {
  endpoint: 'base_data',
  params: { isLive: params.isLive },
  method: 'POST',
});
```

### Versioning Intelligent

```javascript
async function checkTransfoTechVersions() {
  const currentVersions = await fetchTransfoTechVersions();

  transformations.forEach(transfo => {
    if (
      transfo.couts_calcules.version_transfo_tech !==
      currentVersions[transfo.transfo_tech_id]
    ) {
      transfo.needs_recalculation = true;
    }
  });
}
```

## Interface Utilisateur

### Affichage des Coûts

- **Tooltips enrichis** : Afficher coût unitaire, temps, consommation
- **Résumé centralisé** : Tableau récapitulatif des coûts par transformation
- **Indicateurs visuels** : Barres de progression pour les coûts, alertes pour les versions obsolètes

### Bouton de Recalcul

```javascript
document.getElementById('recalculate-costs-btn').onclick =
  calculateScenarioCosts;
```

## Gestion des Erreurs

### Cas Edge

- **Transfo_tech supprimée** : Ne pas calculer de coûts pour ce nœud
- **Profil RH manquant** : Afficher un warning ou ignorer
- **Débit = 0** : Afficher une erreur ou utiliser un débit par défaut
- **Prix kWh manquant** : Utiliser une valeur par défaut ou bloquer

## Plan d'Implémentation

### Phase 1 : Structure et API

1. **API pour les données de base** (profils RH, prix kWh)
2. **Modification de l'API transfo_tech** pour inclure les nouveaux champs

### Phase 2 : Calculs de Base

1. **Fonction de calcul** avec la logique corrigée
2. **Gestion des cas edge** (pas de transfo_tech, données manquantes)
3. **Tests avec des exemples concrets**

### Phase 3 : Interface Utilisateur

1. **Tooltips enrichis** avec coûts détaillés
2. **Bouton de recalcul** avec indicateurs de progression
3. **Résumé centralisé** des coûts totaux

### Phase 4 : Optimisations

1. **Cache intelligent** avec versioning
2. **Calculs différés** pour les gros scénarios
3. **Indicateurs visuels** pour les coûts obsolètes

## Points Techniques

### Performance

- **Calculs par lots** : Traiter les transformations par groupes pour éviter de bloquer l'UI
- **Cache local** : Stocker les résultats dans localStorage pour éviter les recalculs inutiles
- **Indicateurs de progression** : "Calcul en cours... 3/10 transformations"

### Données Manquantes

- **Volume du lot d'entrée** : Listé au premier niveau dans la clé 'total' du lot json.
- **Métadonnées** : Ajouter des infos sur les unités, précision, etc.

### Interface Utilisateur

- **Affichage des coûts** : Dans les tooltips, format détaillé ou résumé ?
- **Unité de temps** : Afficher en heures ou en heures:minutes ?
- **Devise** : € par défaut ou configurable ?

---

**Ce système permettra d'évaluer précisément les coûts de valorisation en tenant compte des technologies utilisées, des ressources humaines nécessaires et des consommations énergétiques.**

---

# Système de Transformations Dynamiques (Bubble)

## Objectif

Permettre de créer des transformations configurables dans Bubble (vs les transformations statiques `selectBy*` hardcodées dans `processes.js`). Ces transformations modifient des dimensions et créent 2 lots avec des rendements différents.

## Architecture des Données

### Structure des Transformations Dynamiques

```javascript
DynamicTransfo {
  bubble_id: string,
  title: string,
  version: string,
  yield: number, // % du lot principal (ex: 80 pour 80%)
  conditions: [
    {
      dimension: 'format',
      valeurs_acceptees: ['vêtements'] // ou IDs
    }
  ],
  modifications: {
    principal: {
      format: { nouvelle_valeur_id: 'tissu_decoupe_123', nouvelle_valeur_nom: 'Tissu découpé' },
      type: { nouvelle_valeur_id: 'tissu_decoupe_456', nouvelle_valeur_nom: 'Tissu découpé' }
      // propreté: undefined → hérite de l'entrée
      // qualité: undefined → hérite de l'entrée
    },
    coproduit: {
      formats: {
        // avec distribution
      },
      qualité: {},
      propreté: {}
  }
}
```

### Structure dans le Scénario

```javascript
// Transformation statique (actuelle)
{
  type: 'selectByFormat',
  transfo_type: 'hardcoded',
  keys: ['vêtements']
}

// Transformation dynamique (nouvelle)
{
  type: 'dynamic_transfo',
  transfo_type: 'dynamic',
  dynamic_transfo_id: 'lavage_123'
}
```

## Exemples Concrets

### Lavage (simple)

```javascript
{
  id: 'lavage_123',
  nom: 'Lavage',
  yield: 100,
  conditions_application: [], // s'applique à tout
  modifications: {
    principal: {
      propreté: { nouvelle_valeur_id: 'propre_456', nouvelle_valeur_nom: 'Propre' }
    },
    coproduit: {} // pas de coproduit (yield: 100%)
  }
}
```

### Délissage (complexe)

```javascript
{
  id: 'delissage_789',
  nom: 'Délissage',
  yield: 80,
  conditions_application: [
    {
      dimension: 'format',
      valeurs_acceptees: ['vêtements']
    }
  ],
  modifications: {
    principal: {
      format: { nouvelle_valeur_id: 'tissu_decoupe_123', nouvelle_valeur_nom: 'Tissu découpé' },
      type: { nouvelle_valeur_id: 'tissu_decoupe_456', nouvelle_valeur_nom: 'Tissu découpé' }
    },
    coproduit: {
      type: { nouvelle_valeur_id: 'chiquettes_789', nouvelle_valeur_nom: 'Chiquettes' }
    }
  }
}
```

## Logique de Traitement

### Fonction de Traitement

```javascript
function applyDynamicTransfo(lot, transfo) {
  // 1. Séparer les éléments selon les conditions
  const elements_applicables = filterByConditions(
    lot,
    transfo.conditions_application
  );
  const elements_non_applicables = filterNonApplicables(
    lot,
    transfo.conditions_application
  );

  // 2. Calculer les volumes
  const volume_applicable = elements_applicables.total;
  const volume_principal = volume_applicable * (transfo.yield / 100);
  const volume_coproduit = volume_applicable - volume_principal;

  // 3. Créer le lot principal (éléments applicables transformés)
  const lot_principal = {
    ...elements_applicables,
    total: volume_principal,
    // Appliquer les modifications du principal
    ...applyModifications(
      elements_applicables,
      transfo.modifications.principal
    ),
  };

  // 4. Créer le coproduit (éléments non transformés + éléments applicables non principaux)
  const lot_coproduit = {
    ...elements_non_applicables,
    total: elements_non_applicables.total + volume_coproduit,
    // Fusionner avec les éléments applicables non principaux
    ...mergeWithNonPrincipal(
      elements_applicables,
      volume_coproduit,
      transfo.modifications.coproduit
    ),
  };

  return { principal: lot_principal, coproduit: lot_coproduit };
}
```

### Héritage des Dimensions

- **Dimensions non spécifiées** : Héritent de l'entrée
- **Dimensions spécifiées** : Remplacent les valeurs d'entrée

### Gestion des Conditions

- **Éléments applicables** : Transformés selon le yield
- **Éléments non applicables** : Vont dans le coproduit (non transformés)

## API et Chargement des Données

### Chargement avec BaseData

```javascript
BaseData {
  profils_rh: [...],
  prix_kwh: number,
  transformations_dynamiques: [
    {
      id: 'lavage_123',
      nom: 'Lavage',
      version: '1.0',
      yield: 100,
      conditions_application: [...],
      modifications: {...}
    }
  ]
}
```

### Nouvel Endpoint

```javascript
fetch('/api/bubble', {
  endpoint: 'base_data',
  params: { isLive: params.isLive },
  method: 'POST',
});
```

## Interface Utilisateur

### Dropdown Enrichi

Les transformations dynamiques apparaissent à la suite des transformations statiques :

```
- selectByFormat
- selectByType
- ...
- Lavage (dynamic_transfo)
- Délissage (dynamic_transfo)
```

### Affichage dans le Sankey

- **Même style** que les autres transformations
- **Tooltips enrichis** avec conditions d'application
- **Pas d'icônes distinctes**

## Gestion des Erreurs

### Cas Edge

- **Transformation supprimée** : Afficher un warning ou utiliser une transformation par défaut
- **Conditions non remplies** : Éléments non applicables vont dans le coproduit
- **Yield invalide** : Utiliser une valeur par défaut ou bloquer

## Plan d'Implémentation

### Phase 1 : Structure et API

1. **API pour les transformations dynamiques** (chargement avec BaseData)
2. **Structure unifiée** dans le scénario (`transfo_type: 'dynamic'`)
3. **Fonction de parsing** avec gestion des conditions et modifications

### Phase 2 : Logique de Traitement

1. **Vérification des conditions** d'application (éléments applicables vs non applicables)
2. **Calcul des rendements** (yield → séparation principal/coproduit)
3. **Application des modifications** avec héritage des dimensions non spécifiées
4. **Fusion des lots** (non applicables + coproduit)

### Phase 3 : Interface Utilisateur

1. **Dropdown enrichi** avec transformations dynamiques
2. **Affichage des conditions** dans les tooltips
3. **Gestion des cas edge** (éléments non applicables)

### Phase 4 : Tests et Optimisations

1. **Test avec lavage** (simple, yield: 100%)
2. **Test avec délissage** (complexe, yield: 80%, conditions)
3. **Cache et versioning** (comme pour les transfo_techs)

## Points Techniques

### Performance

- **Cache intelligent** : Charger les transformations avec BaseData
- **Versioning** : Détecter les changements et recalculer si nécessaire
- **Calculs optimisés** : Traiter les conditions et modifications efficacement

### Données Manquantes

- **Mapping des valeurs** : Comment faire le lien entre IDs Bubble et noms d'affichage ?
- **Validation** : Vérifier la cohérence des conditions et modifications
- **Fallback** : Que faire si une transformation est supprimée ?

### Interface Utilisateur

- **Sélection** : Comment présenter les transformations dynamiques dans le dropdown ?
- **Prévisualisation** : Afficher les conditions et modifications avant application ?
- **Feedback** : Indicateurs visuels pour les transformations applicables/non applicables ?

---

**Ce système permettra de créer des transformations configurables dans Bubble tout en maintenant la compatibilité avec les transformations statiques existantes.**
