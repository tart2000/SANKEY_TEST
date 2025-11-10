# SANKEY_TEST

Prototype complet pour la visualisation et l’édition des flux textile valorisés (diagrammes Sankey, gestion des lots, intégration Bubble) avec une interface Next.js et des modules historiques autonomes.

## Prérequis

- Node.js 20+
- npm 10+ (le dépôt utilise `package-lock.json`)
- Accès aux APIs Bubble associées (lots, scénarios, teams, techs)

## Installation

```bash
npm install
```

## Scripts utiles

| Commande                            | Rôle                                                                                                                  |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`                       | Lance le serveur Next.js en mode dev (Turbopack).                                                                     |
| `npm run build:translations`        | Génère `public/i18n-config.js` à partir de `src/lib/translations.js`. À exécuter à chaque ajout/modif de traductions. |
| `npm run build`                     | Génère les traductions puis build Next.js (`.next/`).                                                                 |
| `npm run start`                     | Démarre l’appli en mode production.                                                                                   |
| `npm run lint` / `npm run lint:fix` | Vérification ESLint (tailwind / shadcn standards).                                                                    |
| `npm run type-check`                | Vérification TypeScript.                                                                                              |
| `npm run check`                     | Lint + type-check (hook `prebuild`).                                                                                  |
| `npm run prepare`                   | Active Husky (post-install).                                                                                          |

> Husky exécute `eslint --fix` sur `.ts/.tsx/.js/.jsx` et `prettier --write` sur `.json/.css/.md/.html` via `lint-staged`.

## Architecture

```
SANKEY_TEST/
├─ src/app/                # Interface Next.js (Lots, Sankey, Data, Tests API)
├─ src/components/ui/      # Composants shadcn/Tailwind partagés
├─ src/data/               # Lots/scénarios/teams d’exemple + langues disponibles
├─ src/lib/translations.js # Dictionnaire centralisé i18n → généré vers /public
├─ public/
│  ├─ sankey/              # Module historique d3-sankey (standalone)
│  ├─ lot/                 # Visualisation lots autonome
│  ├─ data/                # Données statiques, mapping couleurs, etc.
│  ├─ styles/tailwind.css  # Copie post-build du CSS Next.js (script copy-tailwind)
│  └─ config/dimensions.js # Définition des dimensions (à réutiliser, pas de hardcode)
├─ scripts/                # Génération i18n, copie Tailwind, fix chemins
├─ DOC/                    # Documentation interne détaillée (Sankey, transfos dynamiques…)
├─ TODO.md                 # Backlog fonctionnel
└─ README.md               # Ce fichier
```

### Interface Next.js

- Page d’accueil (`/`) : navigation vers Lots, Sankey, Tests API, Données.
- `/lots` : wrapper iframe sur `public/lot/index.html` avec sélection lot/langue et mode `isEditable`. Écoute des messages `IFRAME_HEIGHT`.
- `/sankey` : wrapper iframe sur `public/sankey/index.html` avec sélection scénario/lot/team/langue, mode `isEditable`, gestion dynamique de la hauteur et écoute des messages Bubble (`showLotDetails` etc.).
- `/api_test` : utilitaire interne pour tester les appels Bubble.
- `/data` : visualisation des données de référence.

Toutes les pages utilisent `AppNavbar`, les composants Radix/shadcn (`Select`, `Card`, `Button`…) et Tailwind.

### Modules historiques (`public/sankey`, `public/lot`)

- Autonomes (HTML/CSS/JS vanilla, d3-sankey v0.12.3).
- Chargés depuis les pages Next via `<iframe>`.
- Gestion complète du scénario : transformations imbriquées, coproduits, calculs de coûts avec versioning des techs, filtrage multi-dimensions, couleurs dynamiques synchronisées sur les données réelles.
- Les dimensions et palettes utilisent `public/config/dimensions.js` et `public/data/color_mappings.js` pour éviter tout hardcode.
- Documentation détaillée : `DOC/SANKEY.md`, `DOC/dynamic_transfos.md`, `DOC/bubble.md`, etc.

### Données & intégration Bubble

- Données d’exemple dans `src/data/*.ts` avec `bubbleId`, `isLive`, etc.
- Les iframes attendent des APIs Bubble pour charger scénarios, lots, teams, techs et transformations dynamiques. Voir `DOC/*.md` pour les formats d’API (`/api/bubble`, lots, techs, base_data…).
- Les identifiants Bubble doivent rester invisibles dans l’UI (rappel : bubble IDs transparents).
- Les transformations dynamiques (`dynamic_transfo`) et `transfo_techs` incluent versioning et recalcul des coûts (`calculateTransformationCosts`).

### Internationalisation

- Traductions centralisées dans `src/lib/translations.js`.
- Génération vers `public/i18n-config.js` via `npm run build:translations` (hook `build` automatique).
- Toujours réutiliser les clés existantes ; ne pas dupliquer les libellés identiques.

### Conventions

- Style : Tailwind CSS + composants shadcn (éviter CSS inline ou bespoke).
- Dimensions : utiliser `dimensions.js`, pas de valeurs codées en dur.
- Étapes de transformations : rester agnostique (pas de selectors `propreteSelector`, etc.).
- Textes UI : un seul identifiant i18n par libellé.
- Nettoyage : supprimer tout code mort, éviter les duplications.
- Popups : style cohérent (shadow, pas overlay full width) en s’appuyant sur les classes communes.
- Bubble IDs : ne jamais les afficher dans les dropdowns.
- Tests manuels recommandés : vérifier la génération des traductions, le resize des iframes, la synchro des coûts après mise à jour des techs.

## Documentation complémentaire

- `DOC/SANKEY.md` : architecture complète du Sankey, nouveautés 2025, règles d’intégration Bubble, calculs de coûts.
- `DOC/dynamic_transfos.md` : structure des transformations dynamiques.
- `DOC/bubble.md` : formats d’API Bubble.
- `DOC/path_fix.md`, `DOC/LOT.md`, `DOC/selectBy.md` : cas spécifiques.

Consulter `TODO.md` pour la roadmap (transfos dynamiques, sauvegarde des lots intermédiaires, édition inline des pourcentages, etc.).
