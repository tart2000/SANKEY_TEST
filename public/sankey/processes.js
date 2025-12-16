// ============================================================================
// FONCTIONS UTILITAIRES POUR SELECTBY
// ============================================================================

/**
 * Construit le chemin d'accès à une dimension en remontant depuis la dimension cible
 * vers la racine en utilisant DIMENSION_HIERARCHY
 * @param {string} dimensionName - Nom de la dimension (ex: 'formats', 'matieres', 'proprete')
 * @returns {string[]} Tableau avec le chemin : ['formats', 'types'] pour 'matieres', [] pour 'formats'
 */
function buildPathToDimension(dimensionName) {
  if (
    !window.DIMENSION_HIERARCHY ||
    !window.DIMENSION_HIERARCHY[dimensionName]
  ) {
    console.error(
      `[buildPathToDimension] Dimension inconnue: ${dimensionName}`
    );
    return [];
  }

  const path = [];
  let current = dimensionName;
  const hierarchy = window.DIMENSION_HIERARCHY;

  // Remonter la hiérarchie jusqu'à la racine (parent = null)
  while (hierarchy[current] && hierarchy[current].parent) {
    current = hierarchy[current].parent;
    path.unshift(current); // Ajouter au début du chemin
  }

  return path;
}

// ============================================================================
// FONCTION GÉNÉRIQUE SELECTBY
// ============================================================================

/**
 * Fonction générique pour sélectionner des éléments d'un lot selon une dimension
 * @param {Object} lot - Le lot d'entrée à séparer
 * @param {string} dimensionName - Nom de la dimension (ex: 'formats', 'matieres', 'proprete')
 * @param {string[]} selectedBubbleIds - Array des bubble_id à sélectionner
 * @param {Object} options - Options supplémentaires (threshold, condition, etc.)
 * @returns {{targetLot: Object, coProductLot: Object}} Deux lots : sélectionné et reste
 */
function selectBy(lot, dimensionName, selectedBubbleIds, options = {}) {
  const { threshold = null, condition = null } = options;

  // 1. VALIDATION DES PARAMÈTRES
  if (
    !window.DIMENSION_HIERARCHY ||
    !window.DIMENSION_HIERARCHY[dimensionName]
  ) {
    console.error(`[selectBy] Dimension inconnue: ${dimensionName}`);
    return {
      targetLot: { total: 0 },
      coProductLot: lot,
    };
  }

  // Normaliser selectedBubbleIds (toujours un tableau)
  const normalizedIds = Array.isArray(selectedBubbleIds)
    ? selectedBubbleIds.filter(id => id !== null && id !== undefined)
    : selectedBubbleIds
      ? [selectedBubbleIds]
      : [];

  if (normalizedIds.length === 0) {
    console.warn(
      `[selectBy] Aucun bubble_id sélectionné pour ${dimensionName}`
    );
    const emptyLot = JSON.parse(JSON.stringify(lot));
    Object.keys(emptyLot).forEach(key => {
      if (key !== 'total') delete emptyLot[key];
    });
    emptyLot.total = 0;
    return {
      targetLot: emptyLot,
      coProductLot: lot,
    };
  }

  // 2. CONSTRUIRE LE CHEMIN
  const path = buildPathToDimension(dimensionName);
  const hierarchy = window.DIMENSION_HIERARCHY[dimensionName];
  const isLevel1Direct = hierarchy.level === 1 && hierarchy.parent === null;

  // 3. CLONAGE PROFOND
  const targetLot = JSON.parse(JSON.stringify(lot));
  const coProductLot = JSON.parse(JSON.stringify(lot));

  // 4. APPLIQUER LA LOGIQUE SELON LE TYPE DE DIMENSION
  if (isLevel1Direct) {
    // Niveau 1 direct (formats, qualite, proprete)
    return selectByLevel1Direct(lot, dimensionName, normalizedIds, options);
  } else {
    // Niveaux imbriqués (types, matieres, couleurs, perturbateurs, fibres)
    return selectByNestedLevel(
      lot,
      dimensionName,
      path,
      normalizedIds,
      options
    );
  }
}

/**
 * Sélection pour les dimensions de niveau 1 direct (formats, qualite, proprete)
 */
function selectByLevel1Direct(
  lot,
  dimensionName,
  selectedBubbleIds,
  options = {}
) {
  const dist = lot[dimensionName];
  if (!dist) {
    console.warn(`[selectBy] Lot sans dimension ${dimensionName}`);
    const emptyLot = { total: 0 };
    emptyLot[dimensionName] = {};
    return {
      targetLot: emptyLot,
      coProductLot: lot,
    };
  }

  let selected = {};
  let rest = {};
  let selectedPct = 0;
  let restPct = 0;

  Object.entries(dist).forEach(([key, value]) => {
    const pourcentage =
      typeof value === 'object' && value !== null
        ? value.pourcentage !== undefined
          ? value.pourcentage
          : 0
        : value || 0;

    if (
      value &&
      value.bubble_id &&
      selectedBubbleIds.includes(value.bubble_id)
    ) {
      selected[key] = JSON.parse(JSON.stringify(value));
      selectedPct += pourcentage;
    } else {
      rest[key] = JSON.parse(JSON.stringify(value));
      restPct += pourcentage;
    }
  });

  // Normalisation des pourcentages
  if (selectedPct > 0) {
    Object.keys(selected).forEach(k => {
      selected[k].pourcentage = (selected[k].pourcentage / selectedPct) * 100;
    });
  }

  if (restPct > 0) {
    Object.keys(rest).forEach(k => {
      rest[k].pourcentage = (rest[k].pourcentage / restPct) * 100;
    });
  }

  // Création des deux lots
  const targetLot = JSON.parse(JSON.stringify(lot));
  targetLot[dimensionName] = selected;
  targetLot.total = (lot.total * selectedPct) / 100;

  const coProductLot = JSON.parse(JSON.stringify(lot));
  coProductLot[dimensionName] = rest;
  coProductLot.total = (lot.total * restPct) / 100;

  // Validation de cohérence
  if (
    Math.abs(
      lot.total - ((targetLot?.total || 0) + (coProductLot?.total || 0))
    ) > 2
  ) {
    console.warn(
      `[selectBy] Poids incohérent pour ${dimensionName} : origine =`,
      lot.total,
      'target =',
      targetLot?.total || 0,
      'reste =',
      coProductLot?.total || 0,
      'somme =',
      (targetLot?.total || 0) + (coProductLot?.total || 0)
    );
  }

  return { targetLot, coProductLot };
}

/**
 * Sélection pour les dimensions imbriquées (types, matieres, couleurs, etc.)
 */
function selectByNestedLevel(
  lot,
  dimensionName,
  path,
  selectedBubbleIds,
  options = {}
) {
  const targetLot = JSON.parse(JSON.stringify(lot));
  const coProductLot = JSON.parse(JSON.stringify(lot));
  let selectedMassTotal = 0;
  let restMassTotal = 0;

  // Si la dimension est dans la hiérarchie formats, on parcourt formats
  if (path.includes('formats') || path.length === 0) {
    if (!lot.formats) {
      console.warn(`[selectBy] Lot sans dimension formats`);
      return {
        targetLot: { total: 0, formats: {} },
        coProductLot: lot,
      };
    }

    Object.entries(lot.formats).forEach(([formatKey, formatObj]) => {
      // Calculer la masse du format
      const formatMass = lot.total * (formatObj.pourcentage / 100);

      // Parcourir récursivement depuis le format (on passe le chemin sans 'formats')
      const pathFromFormat = path.filter(p => p !== 'formats');
      const result = traverseAndSeparate(
        formatObj,
        pathFromFormat,
        dimensionName,
        selectedBubbleIds,
        lot.total,
        formatMass,
        options
      );

      if (result.selectedMass > 0) {
        targetLot.formats[formatKey] = result.selected;
        targetLot.formats[formatKey].pourcentage = result.selectedMass;
        selectedMassTotal += result.selectedMass;
      } else {
        delete targetLot.formats[formatKey];
      }

      if (result.restMass > 0) {
        coProductLot.formats[formatKey] = result.rest;
        coProductLot.formats[formatKey].pourcentage = result.restMass;
        restMassTotal += result.restMass;
      } else {
        delete coProductLot.formats[formatKey];
      }
    });
  }

  // Mise à jour des totaux
  targetLot.total = selectedMassTotal;
  coProductLot.total = restMassTotal;

  // Normalisation des pourcentages des formats
  if (selectedMassTotal > 0) {
    Object.keys(targetLot.formats || {}).forEach(formatKey => {
      targetLot.formats[formatKey].pourcentage =
        (targetLot.formats[formatKey].pourcentage / selectedMassTotal) * 100;
    });
  }

  if (restMassTotal > 0) {
    Object.keys(coProductLot.formats || {}).forEach(formatKey => {
      coProductLot.formats[formatKey].pourcentage =
        (coProductLot.formats[formatKey].pourcentage / restMassTotal) * 100;
    });
  }

  // Validation de cohérence
  const totalResult = targetLot.total + coProductLot.total;
  if (Math.abs(lot.total - totalResult) > 2) {
    console.warn(
      `[selectBy] Poids incohérent pour ${dimensionName} : origine =`,
      lot.total,
      'target =',
      targetLot.total,
      'reste =',
      coProductLot.total,
      'somme =',
      totalResult
    );
  }

  return { targetLot, coProductLot };
}

/**
 * Parcours récursif et séparation pour les dimensions imbriquées
 * Reproduit exactement la logique des anciennes fonctions selectBy*
 */
function traverseAndSeparate(
  obj,
  pathRemaining,
  targetDimension,
  selectedBubbleIds,
  totalLotMass,
  parentMass,
  options = {}
) {
  // Si on est arrivé au parent de la dimension cible, on sépare
  if (pathRemaining.length === 0) {
    return separateByBubbleId(
      obj,
      targetDimension,
      selectedBubbleIds,
      totalLotMass,
      parentMass,
      options
    );
  }

  // Sinon, on continue de descendre dans la hiérarchie
  const currentDimension = pathRemaining[0];
  const remainingPath = pathRemaining.slice(1);
  const currentObj = obj[currentDimension];

  if (
    !currentObj ||
    typeof currentObj !== 'object' ||
    Array.isArray(currentObj)
  ) {
    // Dimension manquante, tout va au reste
    return {
      selected: null,
      rest: JSON.parse(JSON.stringify(obj)),
      selectedMass: 0,
      restMass: parentMass,
    };
  }

  // Calculer la masse du niveau actuel (pourcentage de l'objet parent)
  const objPct = typeof obj.pourcentage === 'number' ? obj.pourcentage : 100;
  const currentLevelMass = parentMass;

  let selectedResult = {};
  let restResult = {};
  let selectedMassTotal = 0;
  let restMassTotal = 0;

  // Stocker les masses de chaque élément pour recalculer les pourcentages
  const elementMassesSelected = {};
  const elementMassesRest = {};

  // Parcourir tous les éléments de la dimension courante
  Object.entries(currentObj).forEach(([key, value]) => {
    // Calculer la masse de cet élément basée sur son pourcentage
    const elementPct =
      typeof value === 'object' &&
      value !== null &&
      value.pourcentage !== undefined
        ? value.pourcentage
        : typeof value === 'number'
          ? value
          : 0;
    const elementMass = currentLevelMass * (elementPct / 100);

    // Descendre récursivement dans la hiérarchie
    const result = traverseAndSeparate(
      value,
      remainingPath,
      targetDimension,
      selectedBubbleIds,
      totalLotMass,
      elementMass,
      options
    );

    // Traiter les résultats de la récursion
    if (result.selectedMass > 0) {
      selectedResult[key] = JSON.parse(JSON.stringify(result.selected));
      // Préserver les propriétés de l'élément parent (comme color)
      if (
        value &&
        typeof value === 'object' &&
        value.color &&
        !selectedResult[key].color
      ) {
        selectedResult[key].color = value.color;
      }
      elementMassesSelected[key] = result.selectedMass;
      selectedMassTotal += result.selectedMass;
    }

    if (result.restMass > 0) {
      restResult[key] = JSON.parse(JSON.stringify(result.rest));
      // Préserver les propriétés de l'élément parent (comme color)
      if (
        value &&
        typeof value === 'object' &&
        value.color &&
        !restResult[key].color
      ) {
        restResult[key].color = value.color;
      }
      elementMassesRest[key] = result.restMass;
      restMassTotal += result.restMass;
    } else if (result.selectedMass === 0 && result.restMass === 0) {
      // Si rien n'est sélectionné et rien n'est resté, tout va au reste
      restResult[key] = JSON.parse(JSON.stringify(value));
      if (value && typeof value === 'object' && value.color) {
        restResult[key].color = value.color;
      }
      elementMassesRest[key] = elementMass;
      restMassTotal += elementMass;
    }
  });

  // Recalculer les pourcentages basés sur les masses stockées
  if (selectedMassTotal > 0 && selectedResult) {
    Object.keys(selectedResult).forEach(key => {
      if (
        selectedResult[key] &&
        typeof selectedResult[key] === 'object' &&
        elementMassesSelected[key] !== undefined
      ) {
        selectedResult[key].pourcentage =
          (elementMassesSelected[key] / selectedMassTotal) * 100;
      }
    });
  }

  if (restMassTotal > 0 && restResult) {
    Object.keys(restResult).forEach(key => {
      if (
        restResult[key] &&
        typeof restResult[key] === 'object' &&
        elementMassesRest[key] !== undefined
      ) {
        restResult[key].pourcentage =
          (elementMassesRest[key] / restMassTotal) * 100;
      }
    });
  }

  // Construire les objets résultat avec la structure préservée
  const selectedObj =
    selectedMassTotal > 0
      ? (() => {
          const result = JSON.parse(JSON.stringify(obj));
          result[currentDimension] = selectedResult;
          return result;
        })()
      : null;
  const restObj =
    restMassTotal > 0
      ? (() => {
          const result = JSON.parse(JSON.stringify(obj));
          result[currentDimension] = restResult;
          return result;
        })()
      : null;

  return {
    selected: selectedObj,
    rest: restObj,
    selectedMass: selectedMassTotal,
    restMass: restMassTotal,
  };
}

/**
 * Séparation par bubble_id au niveau de la dimension cible
 * Reproduit exactement la logique des anciennes fonctions
 */
function separateByBubbleId(
  obj,
  dimensionName,
  selectedBubbleIds,
  totalLotMass,
  parentMass,
  options = {}
) {
  const { threshold = null, condition = null } = options;

  const dist = obj[dimensionName] || {};
  let selected = {};
  let rest = {};
  let selectedPct = 0;
  let restPct = 0;

  // Si la dimension n'existe pas ou est vide, tout va au reste
  if (Object.keys(dist).length === 0) {
    return {
      selected: null,
      rest: obj,
      selectedMass: 0,
      restMass: parentMass,
    };
  }

  // Séparer les éléments selon les bubble_id
  Object.entries(dist).forEach(([key, value]) => {
    const pct =
      typeof value === 'object' && value !== null
        ? value.pourcentage !== undefined
          ? value.pourcentage
          : 0
        : value || 0;

    // Vérification bubble_id
    const matchesBubbleId =
      value && value.bubble_id && selectedBubbleIds.includes(value.bubble_id);

    // Vérification threshold (seulement si une seule fibre sélectionnée)
    let matchesThreshold = true;
    if (
      threshold !== null &&
      threshold !== undefined &&
      condition &&
      selectedBubbleIds.length === 1
    ) {
      if (condition === 'over') {
        matchesThreshold = pct >= threshold;
      } else if (condition === 'under') {
        matchesThreshold = pct <= threshold;
      }
    }

    // Sélectionner si les deux conditions sont remplies
    if (matchesBubbleId && matchesThreshold) {
      selected[key] = JSON.parse(JSON.stringify(value));
      if (value.color) selected[key].color = value.color;
      selectedPct += pct;
    } else {
      rest[key] = JSON.parse(JSON.stringify(value));
      if (value.color) rest[key].color = value.color;
      restPct += pct;
    }
  });

  // Normalisation des pourcentages
  if (selectedPct > 0) {
    Object.keys(selected).forEach(k => {
      selected[k].pourcentage = (selected[k].pourcentage / selectedPct) * 100;
    });
  } else {
    Object.keys(selected).forEach(k => {
      selected[k].pourcentage = 0;
    });
  }

  if (restPct > 0) {
    Object.keys(rest).forEach(k => {
      rest[k].pourcentage = (rest[k].pourcentage / restPct) * 100;
    });
  } else {
    Object.keys(rest).forEach(k => {
      rest[k].pourcentage = 0;
    });
  }

  // Calcul des masses
  const selectedMass = parentMass * (selectedPct / 100);
  const restMass = parentMass * (restPct / 100);

  // Construire les objets résultat en préservant la structure complète
  const selectedObj =
    selectedPct > 0 ? { ...obj, [dimensionName]: selected } : null;
  const restObj = restPct > 0 ? { ...obj, [dimensionName]: rest } : obj;

  return {
    selected: selectedObj,
    rest: restObj,
    selectedMass,
    restMass,
  };
}

// ============================================================================
// WRAPPERS RÉTROCOMPATIBLES
// ============================================================================

// Nouvelle transformation adaptée à lotType : sélection par format
function selectByFormat(lot, selectedFormats) {
  // Normaliser le paramètre : accepter tableau ou valeur unique, et aplatir les tableaux imbriqués
  const normalizedIds = Array.isArray(selectedFormats)
    ? selectedFormats
        .flatMap(item => (Array.isArray(item) ? item : [item]))
        .filter(id => id !== null && id !== undefined)
    : selectedFormats
      ? [selectedFormats]
      : [];

  return selectBy(lot, 'formats', normalizedIds);
}

// Sélectionne un ou plusieurs types dans un format donné (niveau 2)
function selectByType(lot, selectedTypes) {
  // Normaliser le paramètre : accepter tableau ou valeur unique
  const normalizedIds = Array.isArray(selectedTypes)
    ? selectedTypes.filter(id => id !== null && id !== undefined)
    : selectedTypes
      ? [selectedTypes]
      : [];

  return selectBy(lot, 'types', normalizedIds);
}

// Sélectionne une ou plusieurs matières dans un type donné (niveau 3)
function selectByMatiere(lot, selectedMatieres) {
  // Normaliser le paramètre : accepter tableau ou valeur unique
  const normalizedIds = Array.isArray(selectedMatieres)
    ? selectedMatieres.filter(id => id !== null && id !== undefined)
    : selectedMatieres
      ? [selectedMatieres]
      : [];

  return selectBy(lot, 'matieres', normalizedIds);
}

// Patch pour selectByQualite
function selectByQualite(lot, selectedQualites) {
  // Normaliser le paramètre : accepter tableau ou valeur unique
  const normalizedIds = Array.isArray(selectedQualites)
    ? selectedQualites.filter(id => id !== null && id !== undefined)
    : selectedQualites
      ? [selectedQualites]
      : [];

  return selectBy(lot, 'qualite', normalizedIds);
}

// Sélectionne une ou plusieurs couleurs dans un lot
function selectByCouleur(lot, selectedCouleurs) {
  // Normaliser le paramètre : accepter tableau ou valeur unique
  const normalizedIds = Array.isArray(selectedCouleurs)
    ? selectedCouleurs.filter(id => id !== null && id !== undefined)
    : selectedCouleurs
      ? [selectedCouleurs]
      : [];

  return selectBy(lot, 'couleurs', normalizedIds);
}
// Sélectionne une ou plusieurs fibres dans un lot
function selectByFibre(
  lot,
  selectedFibres,
  threshold = null,
  condition = null
) {
  // Normaliser le paramètre : accepter tableau ou valeur unique
  const normalizedIds = Array.isArray(selectedFibres)
    ? selectedFibres.filter(id => id !== null && id !== undefined)
    : selectedFibres
      ? [selectedFibres]
      : [];

  // Construire les options (threshold/condition seulement si une seule fibre)
  const options = {};
  if (
    threshold !== null &&
    threshold !== undefined &&
    condition &&
    normalizedIds.length === 1
  ) {
    options.threshold = threshold;
    options.condition = condition;
  }

  return selectBy(lot, 'fibres', normalizedIds, options);
}

function selectByProprete(lot, selectedProprete) {
  // Normaliser le paramètre : accepter tableau ou valeur unique
  const normalizedIds = Array.isArray(selectedProprete)
    ? selectedProprete.filter(id => id !== null && id !== undefined)
    : selectedProprete
      ? [selectedProprete]
      : [];

  return selectBy(lot, 'proprete', normalizedIds);
}

// Sélectionne un ou plusieurs perturbateurs dans un lot
function selectByPerturbateur(lot, selectedPerturbateurs) {
  // Normaliser le paramètre : accepter tableau ou valeur unique
  const normalizedIds = Array.isArray(selectedPerturbateurs)
    ? selectedPerturbateurs.filter(id => id !== null && id !== undefined)
    : selectedPerturbateurs
      ? [selectedPerturbateurs]
      : [];

  return selectBy(lot, 'perturbateurs', normalizedIds);
}

// Table de correspondance entre les noms techniques et les noms d'affichage
const transformationTypes = {
  selectByFormat: {
    label: 'Tri par format',
    en_gb: 'Sort by format',
    description:
      'Sélectionne les articles selon leur format (vêtements, chaussures, etc.)',
    description_en_gb:
      'Select items according to their format (clothing, shoes, etc.)',
    keyList: 'formats',
    requiredKey: true,
    step: 'sorting',
    supportsThreshold: false, // Masqué pour l'instant
  },
  selectByType: {
    label: 'Tri par type',
    en_gb: 'Sort by type',
    description: 'Sélectionne les articles selon leur type (après format)',
    description_en_gb: 'Select items according to their type (after format)',
    keyList: 'types',
    requiredKey: true,
    step: 'sorting',
  },
  selectByMatiere: {
    label: 'Tri par matière',
    en_gb: 'Sort by material',
    description: 'Sélectionne les articles selon leur matière',
    description_en_gb: 'Select items according to their material',
    keyList: 'matieres',
    requiredKey: true,
    step: 'sorting',
  },
  selectByQualite: {
    label: 'Tri par intégrité',
    en_gb: 'Sort by textile integrity',
    description: "Sélectionne les articles selon l'intégrité de la matière",
    description_en_gb: 'Select items according to their textile integrity',
    keyList: 'qualite',
    requiredKey: true,
    step: 'sorting',
  },
  selectByCouleur: {
    label: 'Tri par couleur',
    en_gb: 'Sort by color',
    description: 'Sélectionne les articles selon leur couleur',
    description_en_gb: 'Select items according to their color',
    keyList: 'couleurs',
    requiredKey: true,
    step: 'sorting',
  },
  selectByFibre: {
    label: 'Tri par fibre',
    en_gb: 'Sort by fiber',
    description: 'Sélectionne les articles selon leur composition en fibres',
    description_en_gb: 'Select items according to their fiber composition',
    keyList: 'fibres',
    requiredKey: true,
    step: 'sorting',
    supportsThreshold: true,
  },
  selectByProprete: {
    label: 'Tri par propreté',
    en_gb: 'Sort by cleanliness',
    description: 'Sélectionne les articles selon leur propreté',
    description_en_gb: 'Select items according to their cleanliness',
    keyList: 'proprete',
    requiredKey: true,
    step: 'sorting',
  },
  selectByPerturbateur: {
    label: 'Tri par nievau de perturbation',
    en_gb: 'Sort by level of disruption',
    description: 'Sélectionne les articles selon la présence de perturbateurs',
    description_en_gb: 'Select items according to the presence of disruptors',
    keyList: 'perturbateurs',
    requiredKey: true,
    step: 'sorting',
  },
};

// Table de correspondance pour les transformations "translations"
const translationTypes = {
  cleaning: {
    label: 'Nettoyage',
    en_gb: 'Cleaning',
    description: 'Transforme le lot en propre',
    description_en_gb: 'Transform the lot into clean',
    dimension: 'proprete',
    output_id_test: '1751363332290x936743758301757400',
    output_id_live: '1751363332290x936743758301757400',
    step: 'preparation',
  },
  decoloration: {
    label: 'Décoloration',
    en_gb: 'Bleaching',
    description: 'Transforme le lot en blanc',
    description_en_gb: 'Transform the lot into white',
    description_en_gb:
      'Overwrites all color values into a single normalized value',
    dimension: 'couleurs',
    output_id_test: '1751446409161x466100660519829500',
    output_id_live: '1751446409161x466100660519829500',
    step: 'preparation',
  },
};

// Cache pour les transformations dynamiques
let dynamicTransfosCache = new Map();
let dynamicTransfosLoaded = false;
let lastLoadedIsLive = null; // Pour tracker le dernier mode chargé

// Cache global (bubble_id -> color) pour éviter des appels répétés
window.colorById = window.colorById || new Map();

// Cache unifié pour les items mini (bubble_id -> {bubble_id, fr_fr, en_gb, color})
window.itemMiniCache = window.itemMiniCache || new Map();

// Cache pour les items complets (bubble_id -> structure complète avec toutes les dimensions)
window.itemCompleteCache = window.itemCompleteCache || new Map();

// Récupère l'item mini complet (bubble_id, fr_fr, en_gb, color)
async function fetchItemMini(bubbleId) {
  try {
    if (!bubbleId || window.itemMiniCache.has(bubbleId))
      return window.itemMiniCache.get(bubbleId) || null;

    const params = getUrlParams();
    const isLive = params.isLive;
    const response = await fetch('/api/bubble', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: 'item_small',
        params: { id: bubbleId, isLive },
        method: 'GET',
      }),
    });
    if (!response.ok) return null;
    const data = await response.json();

    // Stocker dans les deux caches pour compatibilité
    window.itemMiniCache.set(bubbleId, data);
    if (data && data.color) {
      window.colorById.set(bubbleId, data.color);
    }

    return data;
  } catch (e) {
    console.warn('fetchItemMini failed for', bubbleId, e);
    return null;
  }
}

function fetchItemMiniSync(bubbleId) {
  try {
    if (!bubbleId) return null;
    if (window.itemMiniCache.has(bubbleId)) {
      return window.itemMiniCache.get(bubbleId) || null;
    }

    const params = getUrlParams();
    const isLive = params.isLive;
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/bubble', false);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.send(
      JSON.stringify({
        endpoint: 'item_small',
        params: { id: bubbleId, isLive },
        method: 'GET',
      })
    );

    if (xhr.status === 200) {
      const data = JSON.parse(xhr.responseText);
      window.itemMiniCache.set(bubbleId, data);
      if (data && data.color) {
        window.colorById.set(bubbleId, data.color);
      }
      return data;
    }

    console.warn('fetchItemMiniSync failed for', bubbleId, xhr.status);
    return null;
  } catch (error) {
    console.warn('fetchItemMiniSync failed for', bubbleId, error);
    return null;
  }
}

// Récupère l'item complet depuis l'API /item (structure complète avec toutes les dimensions)
async function fetchItemComplete(bubbleId) {
  try {
    if (!bubbleId || window.itemCompleteCache.has(bubbleId))
      return window.itemCompleteCache.get(bubbleId) || null;

    const params = getUrlParams();
    const isLive = params.isLive;
    const response = await fetch('/api/bubble', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: 'item',
        method: 'POST',
        params: { id: bubbleId, isLive },
      }),
    });
    if (!response.ok) return null;
    const data = await response.json();

    // Stocker dans le cache
    window.itemCompleteCache.set(bubbleId, data);

    // Aussi mettre à jour le cache des couleurs si disponible
    if (data && data.color) {
      window.colorById.set(bubbleId, data.color);
    }

    return data;
  } catch (e) {
    console.warn('fetchItemComplete failed for', bubbleId, e);
    return null;
  }
}

function fetchItemCompleteSync(bubbleId) {
  try {
    if (!bubbleId) return null;
    if (window.itemCompleteCache.has(bubbleId)) {
      return window.itemCompleteCache.get(bubbleId) || null;
    }

    const params = getUrlParams();
    const isLive = params.isLive;
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/bubble', false);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.send(
      JSON.stringify({
        endpoint: 'item',
        method: 'POST',
        params: { id: bubbleId, isLive },
      })
    );

    if (xhr.status === 200) {
      const data = JSON.parse(xhr.responseText);
      window.itemCompleteCache.set(bubbleId, data);
      if (data && data.color) {
        window.colorById.set(bubbleId, data.color);
      }
      return data;
    }

    console.warn('fetchItemCompleteSync failed for', bubbleId, xhr.status);
    return null;
  } catch (error) {
    console.warn('fetchItemCompleteSync failed for', bubbleId, error);
    return null;
  }
}

// Wrapper pour compatibilité - récupère seulement la couleur
async function fetchItemColor(bubbleId) {
  const itemMini = await fetchItemMini(bubbleId);
  return itemMini?.color || null;
}

// Charge en masse les couleurs d'une dimension (formats, types, ...)
async function ensureDimensionColorsLoaded(dimension) {
  try {
    if (!dimension) return;
    const endpointMap = {
      qualite: 'qualites',
      proprete: 'propretes',
    };
    const endpoint = endpointMap[dimension] || dimension;
    // Si on a déjà des couleurs pour cette dimension, on garde; on complète seulement
    const params = getUrlParams();
    const isLive = params.isLive;
    const response = await fetch('/api/bubble', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint, params: { isLive }, method: 'GET' }),
    });
    if (!response.ok) return;
    const data = await response.json();
    Object.values(data || {}).forEach(item => {
      if (item && item.bubble_id) {
        // Stocker l'item mini complet
        const itemMini = {
          bubble_id: item.bubble_id,
          fr_fr: item.fr_fr || null,
          en_gb: item.en_gb || null,
          color: item.color || null,
        };
        window.itemMiniCache.set(item.bubble_id, itemMini);

        // Garder colorById pour compatibilité
        if (item.color && !window.colorById.has(item.bubble_id)) {
          window.colorById.set(item.bubble_id, item.color);
        }
      }
    });
  } catch (e) {
    console.warn('ensureDimensionColorsLoaded failed for', dimension, e);
  }
}

function ensureDimensionColorsLoadedSync(dimension) {
  try {
    if (!dimension) return;
    const endpointMap = {
      qualite: 'qualites',
      proprete: 'propretes',
    };
    const endpoint = endpointMap[dimension] || dimension;
    const params = getUrlParams();
    const isLive = params.isLive;
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/bubble', false);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.send(JSON.stringify({ endpoint, params: { isLive }, method: 'GET' }));

    if (xhr.status !== 200) {
      console.warn(
        'ensureDimensionColorsLoadedSync failed for',
        dimension,
        xhr.status
      );
      return;
    }

    const data = JSON.parse(xhr.responseText) || {};
    Object.values(data).forEach(item => {
      if (item && item.bubble_id) {
        const itemMini = {
          bubble_id: item.bubble_id,
          fr_fr: item.fr_fr || null,
          en_gb: item.en_gb || null,
          color: item.color || null,
        };
        window.itemMiniCache.set(item.bubble_id, itemMini);
        if (item.color) {
          window.colorById.set(item.bubble_id, item.color);
        }
      }
    });
  } catch (error) {
    console.warn(
      'ensureDimensionColorsLoadedSync failed for',
      dimension,
      error
    );
  }
}

// Précharge les couleurs nécessaires pour une transfo dynamique (targets + coproducts), sans hardcoder les dimensions
async function preloadColorsForTransfo(details) {
  if (!details || !details.dimensions) return;
  const needed = new Map(); // dimension -> Set(ids)
  Object.entries(details.dimensions).forEach(([dimName, dimCfg]) => {
    if (!dimCfg) return;
    // target (une seule clé)
    const targetVal = dimCfg.target ? Object.values(dimCfg.target)[0] : null;
    if (targetVal && targetVal.bubble_id) {
      if (!needed.has(dimName)) needed.set(dimName, new Set());
      needed.get(dimName).add(targetVal.bubble_id);
    }
    // coproduct (plusieurs clés possibles)
    if (dimCfg.coproduct) {
      Object.values(dimCfg.coproduct).forEach(c => {
        if (c && c.bubble_id) {
          if (!needed.has(dimName)) needed.set(dimName, new Set());
          needed.get(dimName).add(c.bubble_id);
        }
      });
    }
  });
  const pending = [];
  for (const [dimName, ids] of needed.entries()) {
    // Charger la liste de la dimension pour remplir massivement les couleurs
    await ensureDimensionColorsLoaded(dimName);
    ids.forEach(id => {
      if (!window.colorById.has(id)) pending.push(fetchItemColor(id));
    });
  }
  if (pending.length > 0) await Promise.allSettled(pending);
}

// Fonction pour charger les transformations dynamiques depuis l'API Bubble
async function loadDynamicTransformations() {
  try {
    const params = getUrlParams();
    const isLive = params.isLive;

    // Vérifier si le mode isLive a changé
    if (lastLoadedIsLive !== null && lastLoadedIsLive !== isLive) {
      dynamicTransfosCache.clear();
      dynamicTransfosLoaded = false;
    }

    // Si déjà chargé pour ce mode, ne pas recharger
    if (dynamicTransfosLoaded && lastLoadedIsLive === isLive) {
      return Array.from(dynamicTransfosCache.values());
    }

    const response = await fetch('/api/bubble', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        endpoint: 'transfos',
        params: { isLive },
        method: 'GET',
      }),
    });

    if (!response.ok) {
      console.warn(
        'Impossible de charger les transformations dynamiques:',
        response.status
      );
      return [];
    }

    const data = await response.json();

    // Vider le cache
    dynamicTransfosCache.clear();

    // Mettre en cache SEULEMENT la liste (sans détails)
    Object.entries(data).forEach(([title, transfo]) => {
      const titleEn =
        transfo.en_gb ||
        transfo.title_en ||
        (transfo.translations && transfo.translations.en_gb) ||
        title;

      dynamicTransfosCache.set(transfo.bubble_id, {
        ...transfo,
        title,
        en_gb: titleEn,
      });
    });

    dynamicTransfosLoaded = true;
    lastLoadedIsLive = isLive; // Mémoriser le mode chargé
    return Array.from(dynamicTransfosCache.values());
  } catch (error) {
    console.warn(
      'Erreur lors du chargement des transformations dynamiques:',
      error
    );
    return [];
  }
}

// Fonction pour obtenir une transformation dynamique par son ID
function getDynamicTransfo(bubbleId) {
  return dynamicTransfosCache.get(bubbleId);
}

// Exporter les fonctions globalement
window.preloadColorsForTransfo = preloadColorsForTransfo;
window.fetchItemColor = fetchItemColor;
window.fetchItemMini = fetchItemMini;
window.fetchItemComplete = fetchItemComplete;

// ← NOUVELLE FONCTION : Obtenir les détails complets d'une transformation
async function getDetailedTransfo(bubbleId, isLive) {
  // ✅ Vérifier le cache d'abord avec clé composite
  const cacheKey = `${bubbleId}_${isLive}`;
  if (dynamicTransfosCache.has(cacheKey)) {
    return dynamicTransfosCache.get(cacheKey);
  }

  try {
    const response = await fetch('/api/bubble', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        endpoint: 'transfo',
        params: { id: bubbleId, isLive },
        method: 'POST',
      }),
    });

    if (!response.ok) {
      throw new Error(`Erreur API: ${response.status}`);
    }

    const data = await response.json();

    // ✅ Mettre en cache immédiatement avec clé composite
    dynamicTransfosCache.set(cacheKey, data);

    return data;
  } catch (error) {
    console.error(
      `Erreur lors du chargement des détails pour ${bubbleId}:`,
      error
    );
    return null;
  }
}

const transformationUtils = {
  getTransformationLabel(type) {
    // Récupérer la langue depuis les paramètres URL
    const params = getUrlParams();
    const lang = params.lang || 'fr_fr';

    // Vérifier d'abord les transformations statiques
    if (transformationTypes[type]) {
      // Retourner le label en fonction de la langue
      if (lang === 'en_gb' && transformationTypes[type].en_gb) {
        return transformationTypes[type].en_gb;
      }
      return transformationTypes[type].label;
    }

    // Vérifier les translations
    if (type.startsWith('translation_')) {
      const translationKey = type.replace('translation_', '');
      const translation = translationTypes[translationKey];
      if (translation) {
        if (lang === 'en_gb' && translation.en_gb) {
          return translation.en_gb;
        }
        return translation.label;
      }
    }

    // Vérifier les transformations dynamiques
    if (type.startsWith('dynamic_transfo_')) {
      const bubbleId = type.replace('dynamic_transfo_', '');
      const transfo = getDynamicTransfo(bubbleId);
      return transfo ? transfo.title : type;
    }

    return type;
  },

  getTransformationDescription(type) {
    // Récupérer la langue depuis les paramètres URL
    const params = getUrlParams();
    const lang = params.lang || 'fr_fr';

    // Vérifier d'abord les transformations statiques
    if (transformationTypes[type]) {
      // Retourner la description en fonction de la langue
      if (lang === 'en_gb' && transformationTypes[type].description_en_gb) {
        return transformationTypes[type].description_en_gb;
      }
      return transformationTypes[type].description;
    }

    // Vérifier les translations
    if (type.startsWith('translation_')) {
      const translationKey = type.replace('translation_', '');
      const translation = translationTypes[translationKey];
      if (translation) {
        if (lang === 'en_gb' && translation.description_en_gb) {
          return translation.description_en_gb;
        }
        return translation.description || '';
      }
    }

    // Vérifier les transformations dynamiques
    if (type.startsWith('dynamic_transfo_')) {
      const bubbleId = type.replace('dynamic_transfo_', '');
      const transfo = getDynamicTransfo(bubbleId);
      return transfo ? `Transformation dynamique: ${transfo.step}` : '';
    }

    return '';
  },

  async getAvailableTransformations() {
    // Transformations statiques (selectBy)
    const staticTransformations = Object.entries(transformationTypes).map(
      ([value, info]) => ({
        value,
        label: info.label,
        en_gb: info.en_gb,
        description: info.description,
        isStatic: true,
      })
    );

    // Transformations translations
    const translationTransformations = Object.entries(translationTypes).map(
      ([key, info]) => ({
        value: `translation_${key}`,
        label: info.label,
        en_gb: info.en_gb,
        description: info.description,
        description_en_gb: info.description_en_gb,
        isTranslation: true,
        dimension: info.dimension,
        step: info.step,
      })
    );

    // Charger la LISTE des transformations dynamiques (sans détails)
    const params = getUrlParams();
    const currentIsLive = params.isLive;

    if (!dynamicTransfosLoaded || lastLoadedIsLive !== currentIsLive) {
      await loadDynamicTransformations();
    }

    // Transformations dynamiques - dédupliquer par bubble_id
    const seenBubbleIds = new Set();
    const dynamicTransformations = Array.from(dynamicTransfosCache.values())
      .filter(transfo => {
        if (seenBubbleIds.has(transfo.bubble_id)) {
          return false; // Déjà vu, ignorer
        }
        seenBubbleIds.add(transfo.bubble_id);
        return true;
      })
      .map(transfo => ({
        value: `dynamic_transfo_${transfo.bubble_id}`,
        label: transfo.title,
        en_gb: transfo.en_gb || transfo.title,
        description: `Transformation dynamique: ${transfo.step}`,
        isDynamic: true,
        bubbleId: transfo.bubble_id,
        version: transfo.version,
      }))
      .sort((a, b) => a.label.localeCompare(b.label)); // Tri alphabétique par titre

    if (
      !window.i18nextReady ||
      !window.i18next ||
      typeof window.i18next.t !== 'function'
    ) {
      console.warn(
        "[processes] i18next n'est pas initialisé pour le séparateur des transformations dynamiques"
      );
      return [
        ...staticTransformations,
        ...translationTransformations,
        ...dynamicTransformations,
      ];
    }

    // Retourner avec séparateur
    return [
      ...staticTransformations,
      ...translationTransformations,
      {
        value: 'separator',
        label: window.i18next.t('dynamicTransformationsSeparator'),
        isSeparator: true,
      },
      ...dynamicTransformations,
    ];
  },

  // Fonction pour obtenir les détails d'une transformation dynamique
  async getDynamicTransfoDetails(bubbleId) {
    const params = getUrlParams();
    const isLive = params.isLive;
    const cacheKey = `${bubbleId}_${isLive}`;

    if (dynamicTransfosCache.has(cacheKey)) {
      return dynamicTransfosCache.get(cacheKey);
    }

    try {
      const params = getUrlParams();
      const isLive = params.isLive;

      const response = await fetch('/api/bubble', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          endpoint: 'transfo',
          params: { id: bubbleId, isLive },
          method: 'POST',
        }),
      });

      if (!response.ok) {
        throw new Error(`Erreur API: ${response.status}`);
      }

      const data = await response.json();

      // Mettre à jour le cache avec clé composite
      dynamicTransfosCache.set(cacheKey, data);

      return data;
    } catch (error) {
      console.error(i18next.t('errorLoadingTransformationDetails'), error);
      return null;
    }
  },

  // Fonction synchrone pour obtenir les détails (charge à la demande si pas en cache)
  getDynamicTransfoDetailsSync(bubbleId) {
    const params = getUrlParams();
    const isLive = params.isLive;
    const cacheKey = `${bubbleId}_${isLive}`;

    // Si déjà en cache, retourner
    if (dynamicTransfosCache.has(cacheKey)) {
      return dynamicTransfosCache.get(cacheKey);
    }

    // Si pas en cache, charger MAINTENANT de manière synchrone

    try {
      // Utiliser XMLHttpRequest pour un appel synchrone
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/bubble', false); // false = synchrone
      xhr.setRequestHeader('Content-Type', 'application/json');

      xhr.send(
        JSON.stringify({
          endpoint: 'transfo',
          params: { id: bubbleId, isLive },
          method: 'POST',
        })
      );

      if (xhr.status === 200) {
        const data = JSON.parse(xhr.responseText);
        dynamicTransfosCache.set(cacheKey, data);
        return data;
      } else {
        console.error('Erreur lors du chargement synchrone:', xhr.status);
        return null;
      }
    } catch (error) {
      console.error('Erreur lors du chargement synchrone des détails:', error);
      return null;
    }
  },
};

// Fonction pour exécuter les transformations dynamiques
function executeDynamicTransfo(lot, transfoDetails) {
  // Utiliser le nouveau moteur de transformation simplifié
  if (!window.simpleDynamicTransformationEngine) {
    window.simpleDynamicTransformationEngine =
      new SimpleDynamicTransformationEngine();
  }

  return window.simpleDynamicTransformationEngine.executeTransformation(
    lot,
    transfoDetails
  );
}

// Fonction pour exécuter les transformations "translations"
function executeTranslation(lot, translationConfig) {
  // 1. Récupération de la configuration
  const { dimension, output_id_test, output_id_live } = translationConfig;
  const params = getUrlParams();
  const isLive = params.isLive;
  const outputId = isLive ? output_id_live : output_id_test;

  if (
    !outputId ||
    outputId === 'PLACEHOLDER_TEST_ID' ||
    outputId === 'PLACEHOLDER_LIVE_ID'
  ) {
    console.error('executeTranslation: output_id non défini ou placeholder');
    return {
      targetLot: JSON.parse(JSON.stringify(lot)),
      coProductLot: null,
    };
  }

  // 2. Appel API synchrone
  const itemData = fetchItemMiniSync(outputId);
  if (!itemData || !itemData.fr_fr) {
    console.error(
      "executeTranslation: impossible de récupérer les données de l'item",
      outputId
    );
    return {
      targetLot: JSON.parse(JSON.stringify(lot)),
      coProductLot: null,
    };
  }

  const { bubble_id, fr_fr, en_gb, color } = itemData;

  // Deep clone du lot
  const processedLot = JSON.parse(JSON.stringify(lot));

  // 3. Vérifier si la dimension existe (au niveau racine ou dans les sous-structures)
  const dimensionHierarchy = window.DIMENSION_HIERARCHY || {};
  const dimensionConfig = dimensionHierarchy[dimension];
  const hasParent = dimensionConfig && dimensionConfig.parent;

  // Si la dimension a un parent, elle n'existe pas au niveau racine
  // Sinon, vérifier qu'elle existe au niveau racine
  if (!hasParent) {
    if (
      !processedLot[dimension] ||
      typeof processedLot[dimension] !== 'object'
    ) {
      console.warn(
        `executeTranslation: dimension ${dimension} absente ou invalide au niveau racine`
      );
      return {
        targetLot: processedLot,
        coProductLot: null,
      };
    }
  } else {
    // Pour les dimensions imbriquées, vérifier qu'elles existent quelque part dans le lot
    let found = false;
    const checkDimensionExists = obj => {
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return;
      if (obj[dimension] && typeof obj[dimension] === 'object') {
        found = true;
        return;
      }
      Object.values(obj).forEach(value => {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          checkDimensionExists(value);
        }
      });
    };
    checkDimensionExists(processedLot);
    if (!found) {
      console.warn(
        `executeTranslation: dimension ${dimension} absente dans le lot`
      );
      return {
        targetLot: processedLot,
        coProductLot: null,
      };
    }
  }

  // 4. Gestion des sous-dimensions
  const childDimensions = dimensionConfig ? dimensionConfig.children || [] : [];
  const aggregatedChildren = {};

  // Si la dimension a des enfants, agréger les sous-dimensions
  if (childDimensions.length > 0) {
    // Collecter toutes les occurrences de la dimension dans le lot
    const allDimensionOccurrences = [];

    // Si la dimension existe au niveau racine (pas de parent), l'utiliser directement
    if (
      !hasParent &&
      processedLot[dimension] &&
      typeof processedLot[dimension] === 'object'
    ) {
      allDimensionOccurrences.push({ data: processedLot[dimension], path: [] });
    }

    // Pour les dimensions imbriquées (avec parent), chercher récursivement
    // Pour les dimensions de niveau racine avec enfants, on a déjà ajouté au-dessus
    // mais on peut aussi chercher récursivement pour être sûr (même si normalement elles n'existent qu'au niveau racine)
    const collectDimensionOccurrences = (obj, path = [], skipRoot = false) => {
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return;

      // Si on est au niveau racine et qu'on a déjà ajouté cette dimension, ne pas la rajouter
      if (skipRoot && path.length === 0 && obj[dimension]) {
        // Déjà ajouté, continuer récursivement
      } else if (obj[dimension] && typeof obj[dimension] === 'object') {
        // Vérifier qu'on ne l'a pas déjà ajouté (pour éviter les doublons)
        const alreadyAdded = allDimensionOccurrences.some(
          occ =>
            occ.data === obj[dimension] ||
            (path.length === 0 && occ.path.length === 0)
        );
        if (!alreadyAdded) {
          allDimensionOccurrences.push({ data: obj[dimension], path });
        }
      }

      Object.keys(obj).forEach(key => {
        if (key !== dimension) {
          const value = obj[key];
          if (value && typeof value === 'object' && !Array.isArray(value)) {
            collectDimensionOccurrences(value, [...path, key], skipRoot);
          }
        }
      });
    };

    // Collecter récursivement (skipRoot = true si on a déjà ajouté au niveau racine)
    collectDimensionOccurrences(
      processedLot,
      [],
      !hasParent && processedLot[dimension]
    );

    if (allDimensionOccurrences.length === 0) {
      console.warn(
        `executeTranslation: aucune occurrence de ${dimension} trouvée`
      );
      return {
        targetLot: processedLot,
        coProductLot: null,
      };
    }

    // Pour chaque sous-dimension
    childDimensions.forEach(childDim => {
      const aggregated = {};

      // Parcourir toutes les occurrences de la dimension
      allDimensionOccurrences.forEach(({ data: dimensionData }) => {
        const allKeys = Object.keys(dimensionData);

        allKeys.forEach(key => {
          const parentValue = dimensionData[key];
          if (!parentValue || typeof parentValue !== 'object') return;

          const childData = parentValue[childDim];
          if (!childData || typeof childData !== 'object') return;

          const parentWeight = Math.max(
            Number(parentValue.pourcentage) || 0,
            0
          );

          // Agréger les valeurs de la sous-dimension en pondérant par le pourcentage du parent
          Object.entries(childData).forEach(([childKey, childValue]) => {
            if (!childValue || typeof childValue !== 'object') return;

            const childWeight =
              (Number(childValue.pourcentage) || 0) * (parentWeight / 100);

            if (!aggregated[childKey]) {
              aggregated[childKey] = {
                ...childValue,
                pourcentage: 0,
              };
            }
            aggregated[childKey].pourcentage += childWeight;

            // Préserver les propriétés importantes
            if (childValue.bubble_id)
              aggregated[childKey].bubble_id = childValue.bubble_id;
            if (childValue.color) aggregated[childKey].color = childValue.color;
            if (childValue.en_gb) aggregated[childKey].en_gb = childValue.en_gb;

            // Appliquer la couleur officielle depuis window.colorById si disponible
            if (
              window.colorById &&
              childValue.bubble_id &&
              window.colorById.has(childValue.bubble_id)
            ) {
              aggregated[childKey].color = window.colorById.get(
                childValue.bubble_id
              );
            }

            // Gérer les sous-dimensions récursives (ex: fibres sous matieres)
            const childDimConfig = dimensionHierarchy[childDim];
            const grandChildDims = childDimConfig
              ? childDimConfig.children || []
              : [];
            grandChildDims.forEach(grandChildDim => {
              if (childValue[grandChildDim]) {
                if (!aggregated[childKey][grandChildDim]) {
                  aggregated[childKey][grandChildDim] = {};
                }
                Object.entries(childValue[grandChildDim]).forEach(
                  ([gcKey, gcValue]) => {
                    if (!gcValue || typeof gcValue !== 'object') return;
                    const gcWeight =
                      (Number(gcValue.pourcentage) || 0) * (childWeight / 100);
                    if (!aggregated[childKey][grandChildDim][gcKey]) {
                      aggregated[childKey][grandChildDim][gcKey] = {
                        ...gcValue,
                        pourcentage: 0,
                      };
                    }
                    aggregated[childKey][grandChildDim][gcKey].pourcentage +=
                      gcWeight;
                  }
                );
              }
            });
          });
        });
      });

      // Normaliser la sous-dimension à 100%
      const normalize = obj => {
        const sum = Object.values(obj).reduce(
          (acc, v) => acc + (Number(v.pourcentage) || 0),
          0
        );
        if (sum > 0) {
          Object.values(obj).forEach(v => {
            v.pourcentage = (Number(v.pourcentage) || 0) * (100 / sum);
          });
        }
      };

      normalize(aggregated);

      // Normaliser les sous-dimensions récursives
      Object.values(aggregated).forEach(item => {
        if (item && typeof item === 'object') {
          childDimensions.forEach(childDim => {
            const childDimConfig = dimensionHierarchy[childDim];
            const grandChildDims = childDimConfig
              ? childDimConfig.children || []
              : [];
            grandChildDims.forEach(grandChildDim => {
              if (item[grandChildDim]) {
                normalize(item[grandChildDim]);
              }
            });
          });
        }
      });

      aggregatedChildren[childDim] = aggregated;
    });
  }

  // 5. Écrasement de la dimension
  const newDimensionValue = {
    bubble_id,
    color:
      color ||
      (window.colorById && window.colorById.has(bubble_id)
        ? window.colorById.get(bubble_id)
        : undefined),
    en_gb: en_gb || '',
    pourcentage: 100,
  };

  // Ajouter les sous-dimensions agrégées
  Object.keys(aggregatedChildren).forEach(childDim => {
    newDimensionValue[childDim] = aggregatedChildren[childDim];
  });

  // Fonction récursive pour écraser la dimension partout où elle apparaît
  const overwriteDimensionRecursive = (
    obj,
    targetDimension,
    newValue,
    newKey
  ) => {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return;

    // Si cette dimension existe à ce niveau, l'écraser
    if (obj[targetDimension] && typeof obj[targetDimension] === 'object') {
      obj[targetDimension] = {
        [newKey]: newValue,
      };
    }

    // Parcourir récursivement toutes les propriétés
    Object.keys(obj).forEach(key => {
      const value = obj[key];
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        // Ne pas parcourir la dimension qu'on vient d'écraser
        if (key !== targetDimension) {
          overwriteDimensionRecursive(value, targetDimension, newValue, newKey);
        }
      }
    });
  };

  // 5. Écrasement de la dimension
  // Si la dimension n'a pas de parent, l'écraser au niveau racine
  if (!hasParent) {
    processedLot[dimension] = {
      [fr_fr]: newDimensionValue,
    };
  }

  // Écraser récursivement la dimension dans toutes les sous-structures
  // (toujours faire ça pour s'assurer qu'on écrase toutes les occurrences)
  overwriteDimensionRecursive(
    processedLot,
    dimension,
    newDimensionValue,
    fr_fr
  );

  // 6. Normalisation récursive (seulement pour les sous-dimensions agrégées, pas pour la dimension principale)
  // La dimension principale a déjà pourcentage: 100 et une seule clé, donc pas besoin de normaliser
  // Mais on doit normaliser les sous-dimensions agrégées si elles existent
  if (
    Object.keys(aggregatedChildren).length > 0 &&
    processedLot[dimension] &&
    processedLot[dimension][fr_fr]
  ) {
    const mainValue = processedLot[dimension][fr_fr];
    // Normaliser chaque sous-dimension agrégée
    Object.keys(aggregatedChildren).forEach(childDim => {
      if (mainValue[childDim] && typeof mainValue[childDim] === 'object') {
        if (window.genericTransformationEngine) {
          window.genericTransformationEngine.normalizeDimensionPercentages(
            mainValue[childDim]
          );
        } else {
          // Fallback de normalisation
          const normalize = dimData => {
            if (!dimData || typeof dimData !== 'object') return;
            const total = Object.values(dimData).reduce((sum, v) => {
              return (
                sum +
                (v && typeof v === 'object' && v.pourcentage !== undefined
                  ? v.pourcentage
                  : 0)
              );
            }, 0);
            if (total > 0) {
              Object.values(dimData).forEach(v => {
                if (v && typeof v === 'object' && v.pourcentage !== undefined) {
                  v.pourcentage = (v.pourcentage / total) * 100;
                }
              });
            }
          };
          normalize(mainValue[childDim]);
        }
      }
    });
  }

  // 7. Préservation des autres dimensions (déjà fait avec le deep clone)
  // Le lot est déjà une copie complète, donc toutes les autres dimensions sont préservées

  // 8. Retour
  return {
    targetLot: processedLot,
    coProductLot: null,
  };
}

window.processes = {
  selectByFormat,
  selectByType,
  selectByMatiere,
  selectByQualite,
  selectByCouleur,
  selectByFibre,
  selectByProprete,
  selectByPerturbateur,
  executeDynamicTransfo,
  executeTranslation,
};

window.transformationUtils = transformationUtils;
window.transformationTypes = transformationTypes;
window.translationTypes = translationTypes;

window.fetchItemMiniSync = fetchItemMiniSync;
window.fetchItemCompleteSync = fetchItemCompleteSync;
window.ensureDimensionColorsLoadedSync = ensureDimensionColorsLoadedSync;

// ← NOUVEAU : Exposer le cache globalement pour le debug
window.dynamicTransfosCache = dynamicTransfosCache;
window.dynamicTransfosLoaded = dynamicTransfosLoaded;

const mergeLots = window.mergeLots;
if (typeof mergeLots !== 'function') {
  console.error(
    '[processes] mergeLots non disponible. Assurez-vous que merge-lots.js est chargé.'
  );
}

// Nouveau moteur de transformation simplifié pour les transformations dynamiques
class SimpleDynamicTransformationEngine {
  constructor() {
    // Import de la Bible des dimensions depuis config/dimensions.js
    this.dimensionHierarchy = window.DIMENSION_HIERARCHY;
    this.processingOrder = window.DIMENSION_PROCESSING_ORDER;

    if (!this.processingOrder) {
      console.error(
        'DIMENSION_PROCESSING_ORDER non trouvé ! Vérifiez que config/dimensions.js est chargé'
      );
      // Fallback si le fichier n'est pas chargé
      this.processingOrder = [
        'formats',
        'types',
        'matieres',
        'fibres',
        'couleurs',
        'perturbateurs',
        'proprete',
        'qualite',
      ];
    }
  }

  // Méthode principale qui orchestre la transformation
  executeTransformation(lot, transfoDetails) {
    // Vérifications de base
    if (!transfoDetails || !transfoDetails.select) {
      throw new Error('Configuration de transformation invalide');
    }

    // 1. Extraire les bubble_id des types à sélectionner
    const selectedTypeIds = Object.values(transfoDetails.select)
      .map(item => item.bubble_id)
      .filter(Boolean);

    if (selectedTypeIds.length === 0) {
      return {
        targetLot: {
          total: 0,
          title: transfoDetails.title || 'Transformation dynamique',
        },
        coProductLot: JSON.parse(JSON.stringify(lot)),
      };
    }

    // 2. Filtrer le lot avec selectByType
    const { targetLot: filteredLot, coProductLot: nonMatchingLot } =
      selectByType(lot, selectedTypeIds);

    // 3. Normaliser les distributions du reste (non-matching)
    if (nonMatchingLot && nonMatchingLot.total > 0) {
      this.normalizeAllDistributions(nonMatchingLot);
    }

    // Si aucun élément ne matche, retourner directement
    if (!filteredLot || filteredLot.total === 0) {
      return {
        targetLot: {
          total: 0,
          title: transfoDetails.title || 'Transformation dynamique',
        },
        coProductLot: nonMatchingLot || JSON.parse(JSON.stringify(lot)),
      };
    }

    // 4. Extraire format et type depuis la nouvelle structure
    // La structure est { format: { fr_fr, en_gb, bubble_id }, type: { fr_fr, en_gb, bubble_id } }
    const extractFormatAndTypeInfo = itemObj => {
      if (!itemObj) {
        return {
          formatBubbleId: null,
          formatData: null,
          typeBubbleId: null,
          typeData: null,
        };
      }
      return {
        formatBubbleId: itemObj.format?.bubble_id || null,
        formatData: itemObj.format || null,
        typeBubbleId: itemObj.type?.bubble_id || null,
        typeData: itemObj.type || null,
      };
    };

    const targetInfo = extractFormatAndTypeInfo(transfoDetails.target);
    const lossInfo = extractFormatAndTypeInfo(transfoDetails.loss);
    const coproductInfo = extractFormatAndTypeInfo(transfoDetails.coproduct);

    if (!targetInfo.formatBubbleId || !targetInfo.typeBubbleId) {
      throw new Error(
        `Item target introuvable: format ou type manquant dans transfoDetails.target`
      );
    }

    // Récupérer le format (item_small) et le type (item complet)
    const targetFormatItem = targetInfo.formatBubbleId
      ? fetchItemMiniSync(targetInfo.formatBubbleId)
      : null;
    const targetTypeItem = targetInfo.typeBubbleId
      ? fetchItemCompleteSync(targetInfo.typeBubbleId)
      : null;

    const lossFormatItem =
      lossInfo.formatBubbleId && transfoDetails.loss_percent > 0
        ? fetchItemMiniSync(lossInfo.formatBubbleId)
        : null;
    const lossTypeItem =
      lossInfo.typeBubbleId && transfoDetails.loss_percent > 0
        ? fetchItemCompleteSync(lossInfo.typeBubbleId)
        : null;

    const coproductFormatItem = coproductInfo.formatBubbleId
      ? fetchItemMiniSync(coproductInfo.formatBubbleId)
      : null;
    const coproductTypeItem = coproductInfo.typeBubbleId
      ? fetchItemCompleteSync(coproductInfo.typeBubbleId)
      : null;

    if (!targetFormatItem || !targetTypeItem) {
      throw new Error(
        `Item target introuvable: format ou type non récupéré depuis l'API`
      );
    }

    // 5. Calculer les volumes
    const inputMass = filteredLot.total;
    const {
      lossMass,
      transformableMass,
      targetMass,
      coproductFromTransformable,
    } = this.calculateVolumes(
      inputMass,
      transfoDetails.loss_percent || 0,
      transfoDetails.yield || 100
    );

    // 6. Créer targetLot avec format + type et distributions conditionnelles
    const targetLot = this.createTargetLot(
      filteredLot,
      targetFormatItem,
      targetTypeItem,
      targetInfo,
      targetMass,
      transfoDetails
    );

    // 7. Créer lossLot si nécessaire
    let lossLot = null;
    if (lossMass > 0 && lossFormatItem && lossTypeItem) {
      lossLot = this.createLossLot(
        lossFormatItem,
        lossTypeItem,
        lossInfo,
        lossMass,
        transfoDetails
      );
    }

    // 8. Créer coproductFromTransformableLot si nécessaire
    let coproductFromTransformableLot = null;
    if (
      coproductFromTransformable > 0 &&
      coproductFormatItem &&
      coproductTypeItem
    ) {
      coproductFromTransformableLot = this.createCoproductLot(
        filteredLot,
        coproductFormatItem,
        coproductTypeItem,
        coproductInfo,
        coproductFromTransformable,
        transfoDetails
      );
    }

    // 9. Fusionner les lots pour le coproductLot final
    // IMPORTANT: mettre coproductFromTransformableLot en premier pour que son format soit la base
    const lotsToMerge = [];
    if (
      coproductFromTransformableLot &&
      coproductFromTransformableLot.total > 0
    ) {
      lotsToMerge.push(coproductFromTransformableLot);
    }
    if (nonMatchingLot && nonMatchingLot.total > 0) {
      lotsToMerge.push(nonMatchingLot);
    }
    if (lossLot && lossLot.total > 0) {
      lotsToMerge.push(lossLot);
    }

    let coProductLot = null;
    if (lotsToMerge.length > 0) {
      coProductLot = lotsToMerge[0];
      for (let i = 1; i < lotsToMerge.length; i++) {
        coProductLot = mergeLots([coProductLot, lotsToMerge[i]]);
      }
    }

    return { targetLot, coProductLot };
  }

  // Trouver un type par bubble_id dans la structure item complète
  findTypeInItemStructure(itemComplete, typeBubbleId) {
    if (!itemComplete || !typeBubbleId) return null;

    // Cas 1: L'API retourne directement le type (structure plate avec bubble_id à la racine)
    if (itemComplete.bubble_id === typeBubbleId) {
      // Prendre le nom depuis fr_fr ou la première clé
      const typeName =
        itemComplete.fr_fr ||
        Object.keys(itemComplete).find(
          k => k !== 'bubble_id' && k !== 'color' && k !== 'en_gb'
        ) ||
        'Type';
      return { typeKey: typeName, type: itemComplete };
    }

    // Cas 2: Parcourir tous les formats (clés racines de l'objet)
    for (const formatKey in itemComplete) {
      const format = itemComplete[formatKey];
      if (!format || typeof format !== 'object') continue;

      // Vérifier si le format lui-même est le type recherché
      if (format.bubble_id === typeBubbleId) {
        return { typeKey: formatKey, type: format };
      }

      // Si le format a des types, les parcourir
      if (format.types && typeof format.types === 'object') {
        for (const typeKey in format.types) {
          const type = format.types[typeKey];
          if (type && type.bubble_id === typeBubbleId) {
            return { typeKey, type };
          }
        }
      }
    }

    // Cas 3: Recherche récursive dans toutes les dimensions (au cas où la structure serait différente)
    const searchRecursive = (obj, path = []) => {
      if (!obj || typeof obj !== 'object') return null;

      // Vérifier si cet objet a le bon bubble_id
      if (obj.bubble_id === typeBubbleId) {
        // Trouver un nom approprié
        const name = obj.fr_fr || path[path.length - 1] || 'Type';
        return { typeKey: name, type: obj };
      }

      // Parcourir toutes les propriétés
      for (const key in obj) {
        if (
          key === 'bubble_id' ||
          key === 'color' ||
          key === 'en_gb' ||
          key === 'fr_fr' ||
          key === 'pourcentage'
        )
          continue;

        const value = obj[key];
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          const result = searchRecursive(value, [...path, key]);
          if (result) return result;
        }
      }

      return null;
    };

    const recursiveResult = searchRecursive(itemComplete);
    if (recursiveResult) return recursiveResult;

    // Si rien n'est trouvé, logger pour debug
    console.warn('Type non trouvé dans la structure item:', {
      typeBubbleId,
      itemStructure: Object.keys(itemComplete),
      firstKey: Object.keys(itemComplete)[0],
      firstValue: itemComplete[Object.keys(itemComplete)[0]],
    });

    return null;
  }

  // Agréger une dimension depuis tous les types de tous les formats d'un lot
  aggregateDimensionFromTypes(lot, dimension) {
    if (!lot.formats) return null;

    const aggregated = {};
    let totalMass = 0;
    const massMap = new Map();

    Object.values(lot.formats).forEach(format => {
      const formatPct = format.pourcentage || 0;
      if (!format.types) return;

      Object.values(format.types).forEach(type => {
        const typePct = type.pourcentage || 0;
        const dimensionData = type[dimension];

        if (!dimensionData) return;

        Object.entries(dimensionData).forEach(([key, value]) => {
          const elementPct = value.pourcentage || 0;
          // Calculer la masse relative : format% * type% * element% / 10000
          const mass = (formatPct * typePct * elementPct) / 10000;
          totalMass += mass;

          if (!massMap.has(key)) {
            massMap.set(key, {
              ...value,
              mass: 0,
            });
          }
          const entry = massMap.get(key);
          entry.mass += mass;
        });
      });
    });

    if (totalMass === 0) return null;

    massMap.forEach((entry, key) => {
      aggregated[key] = {
        ...entry,
        pourcentage: (entry.mass / totalMass) * 100,
      };
      delete aggregated[key].mass;
    });

    return aggregated;
  }

  // Appliquer les distributions conditionnelles au niveau du type
  applyTypeDistributionsConditionally(targetType, referenceType, sourceLot) {
    if (!targetType || !referenceType) return;

    // Parcourir les dimensions enfants de types selon la hiérarchie
    this.processingOrder.forEach(dimension => {
      const dimensionConfig = this.dimensionHierarchy[dimension];
      if (!dimensionConfig || dimensionConfig.parent !== 'types') return;

      // Si le type de référence a cette dimension ET qu'elle n'est pas vide → copier
      if (
        referenceType[dimension] &&
        Object.keys(referenceType[dimension]).length > 0
      ) {
        targetType[dimension] = JSON.parse(
          JSON.stringify(referenceType[dimension])
        );
      } else if (sourceLot) {
        // Sinon, utiliser les distributions agrégées depuis les types du lot d'entrée
        const aggregated = this.aggregateDimensionFromTypes(
          sourceLot,
          dimension
        );
        if (aggregated && Object.keys(aggregated).length > 0) {
          targetType[dimension] = aggregated;
        }
      }
    });
  }

  // Calculer les volumes
  calculateVolumes(inputMass, lossPercent, yieldPercent) {
    const lossMass = (inputMass * lossPercent) / 100;
    const transformableMass = inputMass - lossMass;
    const targetMass = (transformableMass * yieldPercent) / 100;
    const coproductFromTransformable = transformableMass - targetMass;

    return {
      lossMass,
      transformableMass,
      targetMass,
      coproductFromTransformable,
    };
  }

  // Créer le targetLot
  createTargetLot(
    sourceLot,
    targetFormatItem,
    targetTypeItem,
    targetInfo,
    targetMass,
    transfoDetails
  ) {
    const targetLot = {
      total: targetMass,
      title: transfoDetails.title || 'Transformation dynamique',
    };

    // 1. Récupérer le nom du format depuis item_small
    const formatName = targetFormatItem?.fr_fr || 'Format inconnu';
    const formatBubbleId = targetInfo.formatBubbleId;

    // 2. Créer le format
    targetLot.formats = {};
    targetLot.formats[formatName] = {
      bubble_id: formatBubbleId,
      pourcentage: 100,
      color: targetFormatItem?.color || null,
      en_gb: targetFormatItem?.en_gb || null,
      types: {},
    };

    // Appliquer la couleur depuis le cache si nécessaire
    if (
      !targetLot.formats[formatName].color &&
      window.colorById &&
      formatBubbleId
    ) {
      if (window.colorById.has(formatBubbleId)) {
        targetLot.formats[formatName].color =
          window.colorById.get(formatBubbleId);
      }
    }

    // 3. Trouver le type dans la structure item complète
    const typeResult = this.findTypeInItemStructure(
      targetTypeItem,
      targetInfo.typeBubbleId
    );

    if (!typeResult) {
      // Log pour debug
      console.error('Type introuvable dans la structure item:', {
        typeBubbleId: targetInfo.typeBubbleId,
        itemStructure: targetTypeItem ? Object.keys(targetTypeItem) : 'null',
        firstFormatKey: targetTypeItem ? Object.keys(targetTypeItem)[0] : null,
        firstFormat: targetTypeItem
          ? targetTypeItem[Object.keys(targetTypeItem)[0]]
          : null,
      });
      throw new Error(
        `Type introuvable dans la structure item: ${targetInfo.typeBubbleId}. Structure disponible: ${targetTypeItem ? JSON.stringify(Object.keys(targetTypeItem)) : 'null'}`
      );
    }

    const { typeKey, type: referenceType } = typeResult;

    // 4. Créer le type dans le format
    targetLot.formats[formatName].types[typeKey] = {
      bubble_id: targetInfo.typeBubbleId,
      pourcentage: 100,
      color: referenceType.color || null,
      en_gb: referenceType.en_gb || null,
    };

    // Appliquer la couleur depuis le cache si nécessaire
    if (
      !targetLot.formats[formatName].types[typeKey].color &&
      window.colorById &&
      targetInfo.typeBubbleId
    ) {
      if (window.colorById.has(targetInfo.typeBubbleId)) {
        targetLot.formats[formatName].types[typeKey].color =
          window.colorById.get(targetInfo.typeBubbleId);
      }
    }

    // 5. Appliquer les distributions conditionnelles au niveau du type
    this.applyTypeDistributionsConditionally(
      targetLot.formats[formatName].types[typeKey],
      referenceType,
      sourceLot
    );

    // 6. Ajouter les qualités et propretés du lot d'entrée
    if (sourceLot.proprete) {
      targetLot.proprete = JSON.parse(JSON.stringify(sourceLot.proprete));
    }
    if (sourceLot.qualite) {
      targetLot.qualite = JSON.parse(JSON.stringify(sourceLot.qualite));
    }

    // 7. Normaliser toutes les distributions
    this.normalizeAllDistributions(targetLot);

    // 8. Réappliquer les couleurs APRÈS normalisation
    if (targetFormatItem?.color) {
      targetLot.formats[formatName].color = targetFormatItem.color;
    } else if (
      window.colorById &&
      formatBubbleId &&
      window.colorById.has(formatBubbleId)
    ) {
      targetLot.formats[formatName].color =
        window.colorById.get(formatBubbleId);
    }

    if (referenceType.color) {
      targetLot.formats[formatName].types[typeKey].color = referenceType.color;
    } else if (
      window.colorById &&
      targetInfo.typeBubbleId &&
      window.colorById.has(targetInfo.typeBubbleId)
    ) {
      targetLot.formats[formatName].types[typeKey].color = window.colorById.get(
        targetInfo.typeBubbleId
      );
    }

    return targetLot;
  }

  // Créer le lossLot
  createLossLot(
    lossFormatItem,
    lossTypeItem,
    lossInfo,
    lossMass,
    transfoDetails
  ) {
    const lossLot = {
      total: lossMass,
      title: `Perte ${transfoDetails.title || 'dynamique'}`,
    };

    // 1. Récupérer le nom du format depuis item_small
    const formatName = lossFormatItem?.fr_fr || 'Format inconnu';
    const formatBubbleId = lossInfo.formatBubbleId;

    // 2. Créer le format
    lossLot.formats = {};
    lossLot.formats[formatName] = {
      bubble_id: formatBubbleId,
      pourcentage: 100,
      color: lossFormatItem?.color || null,
      en_gb: lossFormatItem?.en_gb || null,
      types: {},
    };

    // Appliquer la couleur depuis le cache si nécessaire
    if (
      !lossLot.formats[formatName].color &&
      window.colorById &&
      formatBubbleId
    ) {
      if (window.colorById.has(formatBubbleId)) {
        lossLot.formats[formatName].color =
          window.colorById.get(formatBubbleId);
      }
    }

    // 3. Trouver le type dans la structure item complète
    const typeResult = this.findTypeInItemStructure(
      lossTypeItem,
      lossInfo.typeBubbleId
    );

    if (!typeResult) {
      throw new Error(
        `Type introuvable dans la structure item: ${lossInfo.typeBubbleId}`
      );
    }

    const { typeKey, type: referenceType } = typeResult;

    // 4. Créer le type dans le format
    lossLot.formats[formatName].types[typeKey] = {
      bubble_id: lossInfo.typeBubbleId,
      pourcentage: 100,
      color: referenceType.color || null,
      en_gb: referenceType.en_gb || null,
    };

    // Appliquer la couleur depuis le cache si nécessaire
    if (
      !lossLot.formats[formatName].types[typeKey].color &&
      window.colorById &&
      lossInfo.typeBubbleId
    ) {
      if (window.colorById.has(lossInfo.typeBubbleId)) {
        lossLot.formats[formatName].types[typeKey].color = window.colorById.get(
          lossInfo.typeBubbleId
        );
      }
    }

    // 5. Copier TOUTES les distributions du type (pas de fusion avec le lot d'entrée)
    // Parcourir toutes les dimensions enfants du type
    this.processingOrder.forEach(dimension => {
      const dimensionConfig = this.dimensionHierarchy[dimension];
      if (!dimensionConfig || dimensionConfig.parent !== 'types') return;

      if (referenceType[dimension]) {
        lossLot.formats[formatName].types[typeKey][dimension] = JSON.parse(
          JSON.stringify(referenceType[dimension])
        );

        // Appliquer récursivement pour les dimensions enfants (matières → fibres, etc.)
        this.applyAllChildDistributionsRecursive(
          lossLot.formats[formatName].types[typeKey][dimension],
          referenceType[dimension],
          dimension
        );
      }
    });

    // 6. Normaliser toutes les distributions
    this.normalizeAllDistributions(lossLot);

    // 7. Réappliquer les couleurs APRÈS normalisation
    if (lossFormatItem?.color) {
      lossLot.formats[formatName].color = lossFormatItem.color;
    } else if (
      window.colorById &&
      formatBubbleId &&
      window.colorById.has(formatBubbleId)
    ) {
      lossLot.formats[formatName].color = window.colorById.get(formatBubbleId);
    }

    if (referenceType.color) {
      lossLot.formats[formatName].types[typeKey].color = referenceType.color;
    } else if (
      window.colorById &&
      lossInfo.typeBubbleId &&
      window.colorById.has(lossInfo.typeBubbleId)
    ) {
      lossLot.formats[formatName].types[typeKey].color = window.colorById.get(
        lossInfo.typeBubbleId
      );
    }

    return lossLot;
  }

  // Créer le coproductLot issu du transformable
  createCoproductLot(
    sourceLot,
    coproductFormatItem,
    coproductTypeItem,
    coproductInfo,
    coproductMass,
    transfoDetails
  ) {
    const coproductLot = {
      total: coproductMass,
      title: `Co-produit ${transfoDetails.title || 'dynamique'}`,
    };

    // 1. Récupérer le nom du format depuis item_small
    const formatName = coproductFormatItem?.fr_fr || 'Format inconnu';
    const formatBubbleId = coproductInfo.formatBubbleId;

    // 2. Créer le format
    coproductLot.formats = {};
    coproductLot.formats[formatName] = {
      bubble_id: formatBubbleId,
      pourcentage: 100,
      color: coproductFormatItem?.color || null,
      en_gb: coproductFormatItem?.en_gb || null,
      types: {},
    };

    // Appliquer la couleur depuis le cache si nécessaire
    if (
      !coproductLot.formats[formatName].color &&
      window.colorById &&
      formatBubbleId
    ) {
      if (window.colorById.has(formatBubbleId)) {
        coproductLot.formats[formatName].color =
          window.colorById.get(formatBubbleId);
      }
    }

    // 3. Trouver le type dans la structure item complète
    const typeResult = this.findTypeInItemStructure(
      coproductTypeItem,
      coproductInfo.typeBubbleId
    );

    if (!typeResult) {
      throw new Error(
        `Type introuvable dans la structure item: ${coproductInfo.typeBubbleId}`
      );
    }

    const { typeKey, type: referenceType } = typeResult;

    // 4. Créer le type dans le format
    coproductLot.formats[formatName].types[typeKey] = {
      bubble_id: coproductInfo.typeBubbleId,
      pourcentage: 100,
      color: referenceType.color || null,
      en_gb: referenceType.en_gb || null,
    };

    // Appliquer la couleur depuis le cache si nécessaire
    if (
      !coproductLot.formats[formatName].types[typeKey].color &&
      window.colorById &&
      coproductInfo.typeBubbleId
    ) {
      if (window.colorById.has(coproductInfo.typeBubbleId)) {
        coproductLot.formats[formatName].types[typeKey].color =
          window.colorById.get(coproductInfo.typeBubbleId);
      }
    }

    // 5. Appliquer les distributions conditionnelles au niveau du type
    this.applyTypeDistributionsConditionally(
      coproductLot.formats[formatName].types[typeKey],
      referenceType,
      sourceLot
    );

    // 6. Normaliser toutes les distributions
    this.normalizeAllDistributions(coproductLot);

    // 7. Réappliquer les couleurs APRÈS normalisation
    if (coproductFormatItem?.color) {
      coproductLot.formats[formatName].color = coproductFormatItem.color;
    } else if (
      window.colorById &&
      formatBubbleId &&
      window.colorById.has(formatBubbleId)
    ) {
      coproductLot.formats[formatName].color =
        window.colorById.get(formatBubbleId);
    }

    if (referenceType.color) {
      coproductLot.formats[formatName].types[typeKey].color =
        referenceType.color;
    } else if (
      window.colorById &&
      coproductInfo.typeBubbleId &&
      window.colorById.has(coproductInfo.typeBubbleId)
    ) {
      coproductLot.formats[formatName].types[typeKey].color =
        window.colorById.get(coproductInfo.typeBubbleId);
    }

    return coproductLot;
  }

  // Appliquer les distributions filles conditionnellement (pour target et coproduct)
  applyChildDistributions(targetLot, referenceItem, sourceLot) {
    if (!targetLot.formats || !referenceItem) return;

    // Parcourir tous les formats dans targetLot
    Object.keys(targetLot.formats).forEach(formatKey => {
      const targetFormat = targetLot.formats[formatKey];

      // Dans l'item complet, les formats sont directement les clés de l'objet
      const referenceFormat = referenceItem.formats
        ? Object.values(referenceItem.formats)[0]
        : Object.keys(referenceItem).length > 0
          ? Object.values(referenceItem)[0]
          : null;

      if (!referenceFormat) return;

      // Pour chaque dimension enfant selon la hiérarchie
      this.processingOrder.forEach(dimension => {
        // NE PAS traiter "formats" lui-même, on est déjà au niveau des formats
        if (dimension === 'formats') {
          return;
        }

        // Vérifier si cette dimension peut être enfant de formats
        const dimensionConfig = this.dimensionHierarchy[dimension];
        if (!dimensionConfig || dimensionConfig.parent !== 'formats') {
          // Vérifier si c'est une dimension de niveau racine (proprete, qualite)
          if (dimensionConfig && !dimensionConfig.parent) {
            // Appliquer au niveau racine du lot
            if (referenceItem[dimension]) {
              // L'item de référence a une distribution → remplacer
              targetLot[dimension] = JSON.parse(
                JSON.stringify(referenceItem[dimension])
              );
            } else if (sourceLot && sourceLot[dimension]) {
              // Sinon, prendre celle du lot d'entrée
              targetLot[dimension] = JSON.parse(
                JSON.stringify(sourceLot[dimension])
              );
            }
          }
          return;
        }

        // Si le targetFormat a déjà cette dimension ET qu'elle a du contenu (copiée depuis le format de référence) → la garder
        if (
          targetFormat[dimension] &&
          Object.keys(targetFormat[dimension]).length > 0
        ) {
          // Ne rien faire, déjà copiée depuis le format de référence et elle a du contenu
        } else if (sourceLot && sourceLot.formats) {
          // Si le targetFormat n'a pas cette dimension OU qu'elle est vide → prendre celle du lot d'entrée (agrégée)
          const aggregated = this.aggregateDimensionFromFormats(
            sourceLot,
            dimension
          );
          if (aggregated && Object.keys(aggregated).length > 0) {
            targetFormat[dimension] = aggregated;
          }
        }
      });
    });
  }

  // Appliquer récursivement les distributions filles
  applyChildDistributionsRecursive(
    targetNode,
    referenceNode,
    sourceLot,
    parentDimension
  ) {
    if (!targetNode || typeof targetNode !== 'object') return;

    // Parcourir toutes les dimensions enfants de la dimension parent
    const parentConfig = this.dimensionHierarchy[parentDimension];
    if (!parentConfig || !parentConfig.children) return;

    parentConfig.children.forEach(childDimension => {
      // Parcourir tous les éléments du nœud cible
      Object.keys(targetNode).forEach(key => {
        const targetElement = targetNode[key];
        const referenceElement = referenceNode?.[key];

        if (!targetElement || typeof targetElement !== 'object') return;

        // Si l'item de référence a une distribution dans cette dimension → remplacer
        if (referenceElement && referenceElement[childDimension]) {
          targetElement[childDimension] = JSON.parse(
            JSON.stringify(referenceElement[childDimension])
          );
        } else if (sourceLot) {
          // Sinon, chercher dans le lot d'entrée (logique complexe, on garde ce qui existe déjà)
          // Pour simplifier, on garde ce qui existe déjà dans targetElement
        }

        // Appliquer récursivement pour les dimensions enfants
        if (targetElement[childDimension]) {
          this.applyChildDistributionsRecursive(
            targetElement[childDimension],
            referenceElement?.[childDimension],
            sourceLot,
            childDimension
          );
        }
      });
    });
  }

  // Agréger une dimension depuis tous les formats d'un lot
  aggregateDimensionFromFormats(lot, dimension) {
    if (!lot.formats) return null;

    const aggregated = {};
    let totalMass = 0;
    const massMap = new Map();

    Object.values(lot.formats).forEach(format => {
      const formatPct = format.pourcentage || 0;
      const dimensionData = format[dimension];

      if (!dimensionData) return;

      Object.entries(dimensionData).forEach(([key, value]) => {
        const elementPct = value.pourcentage || 0;
        const mass = (formatPct * elementPct) / 100;
        totalMass += mass;

        if (!massMap.has(key)) {
          massMap.set(key, {
            ...value,
            mass: 0,
          });
        }
        const entry = massMap.get(key);
        entry.mass += mass;
      });
    });

    if (totalMass === 0) return null;

    massMap.forEach((entry, key) => {
      aggregated[key] = {
        ...entry,
        pourcentage: (entry.mass / totalMass) * 100,
      };
      delete aggregated[key].mass;
    });

    return aggregated;
  }

  // Appliquer TOUTES les distributions filles de l'item de référence (pour loss)
  applyAllChildDistributions(lot, referenceItem) {
    if (!lot.formats || !referenceItem) return;

    // Parcourir tous les formats dans lot
    Object.keys(lot.formats).forEach(formatKey => {
      const lotFormat = lot.formats[formatKey];
      // Dans l'item complet, les formats sont directement les clés de l'objet
      const referenceFormat = referenceItem.formats
        ? Object.values(referenceItem.formats)[0]
        : Object.keys(referenceItem).length > 0
          ? Object.values(referenceItem)[0]
          : null;

      if (!referenceFormat) return;

      // Copier toutes les dimensions de l'item de référence
      this.processingOrder.forEach(dimension => {
        const dimensionConfig = this.dimensionHierarchy[dimension];
        if (!dimensionConfig) return;

        // Si c'est une dimension de niveau racine
        if (!dimensionConfig.parent) {
          if (referenceItem[dimension]) {
            lot[dimension] = JSON.parse(
              JSON.stringify(referenceItem[dimension])
            );
          }
          return;
        }

        // Si c'est une dimension enfant de formats
        if (dimensionConfig.parent === 'formats') {
          if (referenceFormat[dimension]) {
            lotFormat[dimension] = JSON.parse(
              JSON.stringify(referenceFormat[dimension])
            );
          }

          // Appliquer récursivement
          if (lotFormat[dimension]) {
            this.applyAllChildDistributionsRecursive(
              lotFormat[dimension],
              referenceFormat[dimension],
              dimension
            );
          }
        }
      });
    });
  }

  // Appliquer récursivement toutes les distributions (pour loss)
  applyAllChildDistributionsRecursive(
    targetNode,
    referenceNode,
    parentDimension
  ) {
    if (!targetNode || !referenceNode || typeof targetNode !== 'object') return;

    const parentConfig = this.dimensionHierarchy[parentDimension];
    if (!parentConfig || !parentConfig.children) return;

    parentConfig.children.forEach(childDimension => {
      Object.keys(targetNode).forEach(key => {
        const targetElement = targetNode[key];
        const referenceElement = referenceNode[key];

        if (
          !targetElement ||
          !referenceElement ||
          typeof targetElement !== 'object'
        )
          return;

        // Copier complètement la distribution de l'item de référence
        if (referenceElement[childDimension]) {
          targetElement[childDimension] = JSON.parse(
            JSON.stringify(referenceElement[childDimension])
          );
        }

        // Appliquer récursivement
        if (targetElement[childDimension] && referenceElement[childDimension]) {
          this.applyAllChildDistributionsRecursive(
            targetElement[childDimension],
            referenceElement[childDimension],
            childDimension
          );
        }
      });
    });
  }

  // Normaliser toutes les distributions à tous les niveaux
  normalizeAllDistributions(lot) {
    if (!lot || typeof lot !== 'object') return;

    // Normaliser les dimensions de niveau racine
    this.processingOrder.forEach(dimension => {
      const dimensionConfig = this.dimensionHierarchy[dimension];
      if (!dimensionConfig) return;

      // Si c'est une dimension de niveau racine
      if (!dimensionConfig.parent && lot[dimension]) {
        this.normalizeDimension(lot[dimension]);
      }
    });

    // Normaliser récursivement depuis formats
    if (lot.formats) {
      Object.values(lot.formats).forEach(format => {
        this.normalizeFormatRecursive(format, 'formats');
      });
    }
  }

  // Normaliser récursivement un format et ses enfants
  normalizeFormatRecursive(node, parentDimension) {
    if (!node || typeof node !== 'object') return;

    const parentConfig = this.dimensionHierarchy[parentDimension];
    if (!parentConfig || !parentConfig.children) return;

    parentConfig.children.forEach(childDimension => {
      if (node[childDimension]) {
        this.normalizeDimension(node[childDimension]);

        // Normaliser récursivement les enfants
        Object.values(node[childDimension]).forEach(childNode => {
          if (childNode && typeof childNode === 'object') {
            this.normalizeFormatRecursive(childNode, childDimension);
          }
        });
      }
    });
  }

  // Normaliser une dimension (faire que la somme fasse 100%)
  normalizeDimension(dimensionData) {
    if (!dimensionData || typeof dimensionData !== 'object') return;

    const total = Object.values(dimensionData).reduce((sum, item) => {
      return sum + (item.pourcentage || 0);
    }, 0);

    if (total > 0) {
      Object.values(dimensionData).forEach(item => {
        if (item.pourcentage !== undefined) {
          item.pourcentage = (item.pourcentage / total) * 100;
        }
      });
    }
  }
}

// Ancienne classe GenericTransformationEngine supprimée - remplacée par SimpleDynamicTransformationEngine

// Exposer le nouveau moteur globalement
window.SimpleDynamicTransformationEngine = SimpleDynamicTransformationEngine;
