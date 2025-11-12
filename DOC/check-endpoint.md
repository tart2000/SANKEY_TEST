# Endpoint `GET /check`

## Table des matières

1. [Conventions](#conventions)
2. [Objectif du endpoint](#objectif-du-endpoint)
3. [Spécification HTTP](#spécification-http)
4. [Catalogue des validations](#catalogue-des-validations)
5. [Grille de tolérance et calcul du code](#grille-de-tolérance-et-calcul-du-code)
6. [Gestion des erreurs techniques](#gestion-des-erreurs-techniques)
7. [Plan d’implémentation](#plan-dimplémentation)
8. [Tests & vérifications](#tests--vérifications)
9. [Pistes d’évolution](#pistes-dévolution)

## Conventions

- Les chemins de fichiers sont indiqués entre backticks, par exemple `src/lib/bubbleClient.ts`.
- Les exemples JSON sont formatés avec des clés en camelCase.
- `severity` peut prendre les valeurs `critical`, `warning` ou `info`.
- Les pourcentages sont exprimés sur 100, avec une tolérance absolue exprimée en points de pourcentage.

## Objectif du endpoint

Mettre à disposition `GET /check` pour **contrôler l’intégrité d’un lot** stocké dans Bubble. L’API :

- récupère le JSON complet du lot via le workflow Bubble existant (identique à l’appel effectué par `/merge`);
- exécute un pipeline de validations spécialisées couvrant la structure, les distributions, le contenu des items et la hiérarchie des dimensions;
- agrège les anomalies détectées pour produire un **code numérique à trois chiffres** (`XYZ`) reflétant la gravité globale, un message synthétique et, en option, la liste détaillée des erreurs.

## Spécification HTTP

- **Méthode** : `GET`
- **Chemin** : `/check`
- **Query params** :
  - `id` _(string, requis)_ : identifiant Bubble du lot à contrôler.
  - `isLive` _(boolean|\"true\"/\"false\", requis)_ : sélectionne l’environnement Bubble (prod vs test).
- **Source de données** : réutiliser `callBubble` pour invoquer le workflow `lot` (POST) avec `{ id, isLive }`.
- **Auth** : identique au setup actuel (`BUBBLE_API_KEY` côté serveur).
- **Réponse** : `200 OK` avec corps JSON

```json
{
  "code": "123",
  "message": "1 anomalie critique et 2 warnings détectés",
  "details": [
    {
      "path": "formats.Vêtements.types",
      "expected": "Somme des pourcentages = 100",
      "found": 105.2,
      "severity": "critical",
      "suggestion": "Revoir la répartition des types dans Bubble"
    }
  ]
}
```

### Codes réservés

- `000` : aucune anomalie détectée.
- `XYZ` : `X` = nombre d’anomalies critiques, `Y` = warnings, `Z` = infos (chaque chiffre plafonné à 9).
- `999` : erreur technique (échec d’appel Bubble, parsing impossible, timeout).

> Le message doit refléter la gravité dominante : priorité aux critiques, puis warnings, puis infos. En absence d’erreur, renvoyer `message: "Lot valide"`.

## Catalogue des validations

| Validateur              | Objectif principal                                           | Gravité typique  | Format de sortie                      |
| ----------------------- | ------------------------------------------------------------ | ---------------- | ------------------------------------- |
| `validateRootStructure` | Présence et typage des clés racine (`title`, `total`, …)     | warning/critical | `{ path, expected, found, severity }` |
| `validateDistributions` | Sommes à 100 % à chaque niveau (formats → types → …)         | info → critical  | idem + `delta` optionnel              |
| `validateItems`         | Clés obligatoires par item (`color`, `bubble_id`, `en_gb`)   | warning/critical | idem                                  |
| `validateDimensions`    | Alignement avec `window.DIMENSION_HIERARCHY` (parent/enfant) | warning/critical | idem                                  |

### Format des erreurs

Chaque validateur retourne un tableau d’objets :

```ts
type ValidationIssue = {
  path: string; // chemin JSON (ex: "formats.Vêtements.types.Baskets")
  expected: string; // règle ou contrainte attendue
  found: unknown; // valeur observée
  severity: 'critical' | 'warning' | 'info';
  suggestion?: string; // piste de correction
  context?: Record<string, unknown>; // optionnel pour données supplémentaires
};
```

### `validateRootStructure`

- Vérifie la présence des clés minimales : `title`, `total`, `frequency`, `formats`.
- S’assure que `formats` est un objet et que chaque entrée possède `pourcentage` (nombre), `color` (string hex), `bubble_id` (string non vide).
- Signale en `critical` les clés manquantes et en `warning` les types inattendus ou champs optionnels absents (`en_gb`, `fr_fr`…).
- Exemple d’erreur : `{"path":"frequency","expected":"String non vide","found":null,"severity":"critical"}`.

### `validateDistributions`

- Parcourt récursivement les niveaux `formats` → `types` → `matieres` → `fibres` ainsi que `couleurs` et `perturbateurs` si présents.
- Calcule la somme `Σ pourcentage` pour chaque collection d’enfants.
- Compare la somme à 100 avec la **grille de tolérance** décrite plus bas.
- Ajoute `context.delta = somme - 100` pour faciliter le diagnostic.
- Exemple : `{"path":"formats.Vêtements.types","expected":"Somme 100 ±1pp","found":105.2,"severity":"critical","context":{"delta":5.2}}`.

### `validateItems`

- Contrôle pour chaque noeud disposant d’un objet (format, type, matière, fibre, perturbateur, couleur) :
  - `color` présent et valeur hex valide (`/^#([0-9a-f]{6})$/i`).
  - `bubble_id` disponible mais non exposé (juste validation non null/empty).
  - `en_gb` ou autres libellés pour lesquels la donnée est attendue.
- Vérifie que `bubble_id` ne fuit pas dans `details` (pas d’affichage direct).
- Classe en `critical` les champs requis manquants, en `warning` les champs facultatifs manquants.

### `validateDimensions`

- Construit une map à partir de `window.DIMENSION_HIERARCHY` (cf. `public/config/dimensions.js`).
- Pour chaque dimension rencontrée :
  - Vérifie que la dimension existe dans la hiérarchie.
  - S’assure que les sous-niveaux observés correspondent exactement aux `children` autorisés.
  - Rejette toute dimension inattendue ou ordre non respecté.
- Exemple : si un format référence directement `fibres`, remonter `{"path":"formats.Vêtements.fibres","expected":"Dimension autorisée: types","found":"fibres","severity":"critical"}`.

## Grille de tolérance et calcul du code

### Tolérance sur les distributions

| Écart absolu (   | Σ - 100    | )                                   | Gravité | Règle appliquée |
| ---------------- | ---------- | ----------------------------------- | ------- | --------------- |
| ≤ 1 pp           | `info`     | Signaler mais ne bloque pas         |
| > 1 pp et ≤ 5 pp | `warning`  | Appel à correction rapide           |
| > 5 pp           | `critical` | Incohérence majeure, blocage requis |

- Les écarts sont arrondis à 2 décimales pour l’affichage.
- Les niveaux ≤ 1 pp peuvent être ignorés dans le message principal si aucune autre anomalie n’est présente.

### Algorithme de scoring

1. Regrouper toutes les issues par gravité.
2. Compter chaque catégorie, plafonner à 9.
3. Construire `code = \`\${crit}\${warn}\${info}\`` (`crit`, `warn`, `info` = compte formaté sur 1 chiffre).
4. Déterminer le message :
   - au moins une critique → message centré sur les critiques.
   - sinon warnings → message sur warnings.
   - sinon infos → message informatif.
   - aucun issue → `code = "000"`, `message = "Lot valide"`.
5. Joindre un résumé chiffré (`"${crit} critiques, ${warn} warnings, ${info} infos"`).

Pseudo-code :

```ts
function buildCheckResponse(issues: ValidationIssue[]) {
  const buckets = { critical: [], warning: [], info: [] };
  for (const issue of issues) {
    buckets[issue.severity].push(issue);
  }

  const crit = Math.min(buckets.critical.length, 9);
  const warn = Math.min(buckets.warning.length, 9);
  const info = Math.min(buckets.info.length, 9);

  const code = `${crit}${warn}${info}`;

  let message: string;
  if (crit > 0) {
    message = `${buckets.critical.length} anomalie(s) critique(s), corriger avant diffusion`;
  } else if (warn > 0) {
    message = `${buckets.warning.length} warning(s), vérifier la cohérence`;
  } else if (info > 0) {
    message = `Lot valide avec ${buckets.info.length} remarque(s) mineure(s)`;
  } else {
    message = 'Lot valide';
  }

  return { code, message, details: issues };
}
```

### Exemples de réponses

1. **Lot valide**
   ```json
   { "code": "000", "message": "Lot valide", "details": [] }
   ```
2. **Lot avec warnings mineurs**
   ```json
   { "code": "021", "message": "2 warning(s), vérifier la cohérence", "details": [...] }
   ```
3. **Lot critique**
   ```json
   { "code": "310", "message": "3 anomalie(s) critique(s), corriger avant diffusion", "details": [...] }
   ```

## Gestion des erreurs techniques

- **Timeout / indisponibilité Bubble** : intercepter `BubbleClientError` (status 504 ou 500), renvoyer `code = "999"`, `message = "Erreur technique Bubble : <détail>"`, sans `details` métier.
- **ID introuvable** : si Bubble renvoie 404 ou payload vide → `code = "999"`, message explicite (`"Lot introuvable dans Bubble"`), inclure `bubbleResponse` dans les logs serveur uniquement.
- **JSON invalide** : si parsing échoue → `code = "999"`, `message = "Réponse Bubble non exploitable"`.
- Journaliser côté serveur : niveau `error` pour les critiques techniques, `warn` pour les cas recoverables.
- Prévoir un header `X-Check-Code` miroir du `code` pour faciliter l’observabilité (optionnel).

## Plan d’implémentation

1. **Structure documentaire**
   - Ajouter ce fichier `DOC/check-endpoint.md`, le référencer dans les docs internes si besoin.
2. **Factorisation Bubble**
   - Extraire la logique de `callBubble` utilisée par `/merge` pour obtenir `fetchBubbleLot(id, isLive)` dans `src/lib/bubbleClient.ts` ou un nouveau module dédié.
3. **Pipeline de validations**
   - Créer le dossier `src/services/check/`.
   - Implémenter chaque validateur dans un fichier séparé (`rootStructure.ts`, `distributions.ts`, `items.ts`, `dimensions.ts`) + un index exportant `runAllValidators`.
4. **Handler API**
   - Nouveau fichier `src/app/api/check/route.ts`.
   - Validation des query params, appel `fetchBubbleLot`, exécution du pipeline, agrégation via `buildCheckResponse`.
5. **Tests automatisés**
   - Dossier `__tests__/check/` avec : `checkRoute.spec.ts`, `validators/*.spec.ts`.
   - Fixtures inspirées de `src/app/api/bubble/examples/lot-response.json`.
6. **Tests manuels**
   - `curl "http://localhost:3000/api/check?id=<ID>&isLive=false"` pour vérifier les 3 cas (OK / warning / critique).
   - Vérifier que les logs Bubble ne révèlent pas d’informations sensibles.

## Tests & vérifications

- **Unitaires** : chaque validateur avec scénarios cible (clé manquante, somme ≠ 100, dimension inconnue, etc.).
- **Intégration** : mock Bubble (`msw` ou interception fetch) pour simuler les statuts 200/404/500.
- **Manuels** : cross-check des réponses `code`/`message` avec UI ou scripts existants.
- **Régression** : s’assurer que `/merge` continue de fonctionner (tests existants).

## Pistes d’évolution

- Paramétrer dynamiquement les tolérances (permettrait de gérer d’autres cas d’usage).
- Ajouter un niveau `severity: suggestion` avec recommandations automatiques.
- Exposer un endpoint `POST /check/batch` pour contrôler plusieurs lots en une requête.
- Intégrer l’historique des checks (persistance en base pour audit).
