// Configuration
const margin = { top: 20, right: 40, bottom: 20, left: 0 };
let width = window.innerWidth - margin.left - margin.right;
// Hauteur initiale par défaut (sera recalculée dynamiquement selon le contenu)
const FIRST_NODE_MIN_HEIGHT_PX = 600;
let height = FIRST_NODE_MIN_HEIGHT_PX;

// type Transformation = {
//   _nodeId: string;
//   _index: number;
//   type: string;
//   keys: string[];
//   _displayNames: string[][];
//   scenario?: Scenario;
// };

// type Scenario = {
//   transformations: Transformation[];
//   coproduct_scenario?: Scenario;
// };

// Attendre qu'i18next soit prêt
function waitForI18next() {
  if (window.i18nextReady && window.i18next) {
    console.log('[Sankey] i18next is ready, proceeding...');
    return;
  }
  console.log('[Sankey] Waiting for i18next...');
  setTimeout(waitForI18next, 100);
}

// Écouter les changements de langue
window.addEventListener('languageChanged', event => {
  console.log('[Sankey] Language changed to:', event.detail.language);
  // Ici on pourrait mettre à jour les contenus dynamiques si nécessaire
  // Pour l'instant, les dropdowns sont recréés à chaque fois
});

// Attendre qu'i18next soit prêt avant de continuer
waitForI18next();

// Variables globales pour stocker les valeurs courantes
window.currentDimension = 'formats';
window.currentScenarioIdx = 0;
window.currentLotId = '';
// Cache steps meta (labels FR/EN + icon)
window.stepsMeta = window.stepsMeta || null;
window.stepsMetaPromise = window.stepsMetaPromise || null;

// --- Fonction utilitaire pour obtenir le titre traduit ---
function getTitreAffiche(key, obj) {
  // Récupère le paramètre de langue
  const params = getUrlParams();

  // Si la langue est en_gb ET que l'objet a une clé en_gb non vide
  if (params.lang === 'en_gb' && obj && obj.en_gb && obj.en_gb.trim() !== '') {
    return obj.en_gb;
  }

  // Sinon, retourne la clé originale
  return key;
}

// Fonction pour gérer l'état du bouton Enregistrer (exposée globalement)
window.setScenarioModifie = function (modifie) {
  const saveBtn = document.getElementById('save-scenario-btn');
  window._scenarioModifie = !!modifie;
  if (saveBtn) {
    saveBtn.disabled = !modifie;
    saveBtn.style.opacity = modifie ? '1' : '0.5';
  }
};

// ===== FONCTIONS UTILITAIRES POUR LA GESTION DES NODEIDS ET PATHS =====

// Fonction pour générer un ID stable unique (8 chiffres)
function generateStableNodeId() {
  return Math.floor(10000000 + Math.random() * 90000000).toString();
}

// Fonction pour trouver une transformation par son _nodeId et retourner son path
function findTransformationByNodeId(scenario, nodeId) {
  // Normaliser le nodeId en string pour éviter les problèmes de type
  const normalizedNodeId = nodeId != null ? String(nodeId) : null;

  console.log('🔍 [RECHERCHE] findTransformationByNodeId appelée:', {
    nodeId,
    nodeIdType: typeof nodeId,
    normalizedNodeId,
    normalizedNodeIdType: typeof normalizedNodeId,
    scenarioExists: !!scenario,
    scenarioKeys: scenario ? Object.keys(scenario) : [],
  });

  const foundNodeIds = [];

  function searchRecursive(obj, currentPath = []) {
    if (obj && typeof obj === 'object') {
      if (Array.isArray(obj)) {
        for (let i = 0; i < obj.length; i++) {
          const item = obj[i];
          if (item && typeof item === 'object') {
            // Collecter tous les nodeIds trouvés pour debug
            if (item._nodeId !== undefined) {
              foundNodeIds.push({
                nodeId: item._nodeId,
                nodeIdType: typeof item._nodeId,
                path: [...currentPath, i],
                type: item.type,
              });
            }

            // Normaliser les deux côtés en string pour comparaison
            const itemNodeId =
              item._nodeId != null ? String(item._nodeId) : null;
            // Comparaison normalisée (toujours en string)
            if (itemNodeId === normalizedNodeId) {
              console.log('✅ [RECHERCHE] Transformation trouvée !', {
                nodeIdRecherche: nodeId,
                normalizedNodeId,
                foundNodeId: item._nodeId,
                foundNodeIdNormalized: itemNodeId,
                path: [...currentPath, i],
                transformation: item,
              });
              return {
                transformation: item,
                path: [...currentPath, i],
                index: i,
              };
            }
          }
          // Chercher dans les sous-scénarios
          if (obj[i] && obj[i].scenario) {
            const result = searchRecursive(obj[i].scenario, [
              ...currentPath,
              i,
              'scenario',
            ]);
            if (result) return result;
          }
          if (obj[i] && obj[i].scenario?.coproduct_scenario) {
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
        // Parcourir toutes les propriétés récursivement
        for (const [key, value] of Object.entries(obj)) {
          if (value && typeof value === 'object') {
            const result = searchRecursive(value, [...currentPath, key]);
            if (result) return result;
          }
        }
      }
    }
    return null;
  }

  const result = searchRecursive(scenario);

  if (!result) {
    console.error('❌ [RECHERCHE] Transformation NON trouvée !', {
      nodeIdRecherche: nodeId,
      nodeIdRechercheType: typeof nodeId,
      normalizedNodeId,
      nodeIdsTrouves: foundNodeIds,
      scenarioStructure: {
        hasMain: !!(scenario && scenario.main),
        hasTransformations: !!(scenario && scenario.transformations),
        hasMainTransformations: !!(
          scenario &&
          scenario.main &&
          scenario.main.transformations
        ),
        hasCoproductScenario: !!(scenario && scenario.coproduct_scenario),
        hasCoproductTransformations: !!(
          scenario &&
          scenario.coproduct_scenario &&
          scenario.coproduct_scenario.transformations
        ),
        mainTransformationsLength:
          scenario && scenario.main && scenario.main.transformations
            ? scenario.main.transformations.length
            : 0,
        transformationsLength:
          scenario && scenario.transformations
            ? scenario.transformations.length
            : 0,
        coproductTransformationsLength:
          scenario &&
          scenario.coproduct_scenario &&
          scenario.coproduct_scenario.transformations
            ? scenario.coproduct_scenario.transformations.length
            : 0,
      },
    });
  }

  return result;
}

// Fonction pour obtenir le path d'un nœud par son _nodeId
function getPathFromNodeId(scenario, nodeId) {
  const result = findTransformationByNodeId(scenario, nodeId);
  return result ? result.path : null;
}

// Fonction pour calculer le path d'une nouvelle transformation
function calculatePathForNewTransformation(parentNode, actionType, scenario) {
  const parentNodeInfo = parentNode;
  console.log('🔍 calculatePathForNewTransformation called:', {
    parentNodeInfo,
    actionType,
  });
  if (!parentNodeInfo) {
    // Cas spécial : coproduit qui n'a pas de _nodeId correspondant
    if (actionType === 'add_to_coproduct') {
      // Le coproduit appartient toujours à la première transformation
      return ['transformations', 0, 'coproduct_scenario', 'transformations'];
    }
    console.error('Parent node not found:', parentNodeId);
    return null;
  }

  if (actionType === 'add_to_coproduct') {
    // Ajouter au coproduit du nœud parent
    return [...parentNodeInfo._path, 'coproduct_scenario', 'transformations'];
  } else {
    // Ajouter dans le sous-scénario de la transformation sur laquelle on a cliqué
    if (parentNodeInfo._path.slice(-1).toString() === 'transformations') {
      return [...parentNodeInfo._path];
    } else {
      return [...parentNodeInfo._path, 'scenario', 'transformations'];
    }
  }
}

// Fonction pour ajouter une transformation à un path donné
function addTransformationToPath(scenario, parentPath, transformation) {
  console.log('➕ addTransformationToPath called:', {
    parentPath,
    transformation,
  });
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

  console.log('🔍 addTransformationToPath debug:', { parentPath });

  let target = scenario;

  for (let i = 0; i < parentPath.length; i++) {
    const key = parentPath[i];
    if (target[key] === undefined) {
      switch (key) {
        case 'transformations':
          target[key] = [];
          break;
        default:
          target[key] = {};
      }
    }
    target = target[key];
  }
  if (Array.isArray(target)) {
    target.push(transformation);
    return true;
  }

  console.error('Path non supporté:', parentPath);
  return false;
}

// Fonction pour supprimer une transformation par son _nodeId
function removeTransformationByNodeId(scenario, nodeId) {
  console.log('🗑️ removeTransformationByNodeId called:', { nodeId });

  if (!nodeId) {
    console.error('NodeId manquant pour la suppression');
    return false;
  }

  // Fonction récursive pour parcourir et supprimer
  function removeRecursive(obj) {
    if (!obj || typeof obj !== 'object') return false;

    // Si c'est un tableau de transformations
    if (Array.isArray(obj)) {
      for (let i = 0; i < obj.length; i++) {
        if (obj[i] && obj[i]._nodeId === nodeId) {
          console.log("🔍 Transformation trouvée et supprimée à l'index:", i);
          obj.splice(i, 1);

          // Mettre à jour les index des transformations restantes
          for (let j = i; j < obj.length; j++) {
            if (obj[j]._index !== undefined) {
              obj[j]._index = j;
            }
          }

          console.log('✅ Transformation supprimée avec succès');
          return true;
        }
      }
    }

    // Parcourir récursivement toutes les propriétés
    for (const key in obj) {
      if (obj.hasOwnProperty(key) && removeRecursive(obj[key])) {
        return true;
      }
    }

    return false;
  }

  const success = removeRecursive(scenario);

  if (!success) {
    console.error('Transformation non trouvée avec nodeId:', nodeId);
    return false;
  }

  return true;
}

// Fonction pour déplacer une transformation vers le haut par son _nodeId
function moveTransformationUpByNodeId(scenario, nodeId) {
  console.log('⬆️ moveTransformationUpByNodeId called:', { nodeId });

  if (!nodeId) {
    console.error('NodeId manquant pour le déplacement');
    return false;
  }

  // Trouver la transformation et son path
  const transformationInfo = findTransformationByNodeId(scenario, nodeId);
  if (!transformationInfo) {
    console.error('Transformation non trouvée avec nodeId:', nodeId);
    return false;
  }

  const { path, index } = transformationInfo;
  console.log('🔍 Transformation trouvée:', { path, index });

  // Le path contient l'index de la transformation, on doit enlever le dernier élément pour avoir le path vers le tableau
  const arrayPath = path.slice(0, -1);
  console.log('🔍 Path vers le tableau:', arrayPath);

  // Naviguer jusqu'au tableau de transformations
  let arr = scenario;
  for (let i = 0; i < arrayPath.length; i++) {
    const key = arrayPath[i];
    if (Array.isArray(arr)) {
      arr = arr[key];
    } else if (arr && typeof arr === 'object') {
      arr = arr[key];
    }
  }

  if (!Array.isArray(arr)) {
    console.error('Tableau de transformations non trouvé:', arrayPath);
    return false;
  }

  if (index <= 0 || index >= arr.length) {
    console.error(
      'Impossible de déplacer vers le haut:',
      index,
      'Longueur:',
      arr.length
    );
    return false;
  }

  // Échanger avec l'élément précédent
  const temp = arr[index];
  arr[index] = arr[index - 1];
  arr[index - 1] = temp;

  // Mettre à jour les index des transformations échangées
  if (arr[index]._index !== undefined) arr[index]._index = index;
  if (arr[index - 1]._index !== undefined) arr[index - 1]._index = index - 1;

  console.log('✅ Transformation déplacée vers le haut avec succès');
  return true;
}

// Fonction pour déplacer une transformation vers le bas par son _nodeId
function moveTransformationDownByNodeId(scenario, nodeId) {
  console.log('⬇️ moveTransformationDownByNodeId called:', { nodeId });

  if (!nodeId) {
    console.error('NodeId manquant pour le déplacement');
    return false;
  }

  // Trouver la transformation et son path
  const transformationInfo = findTransformationByNodeId(scenario, nodeId);
  if (!transformationInfo) {
    console.error('Transformation non trouvée avec nodeId:', nodeId);
    return false;
  }

  const { path, index } = transformationInfo;
  console.log('🔍 Transformation trouvée:', { path, index });

  // Le path contient l'index de la transformation, on doit enlever le dernier élément pour avoir le path vers le tableau
  const arrayPath = path.slice(0, -1);
  console.log('🔍 Path vers le tableau:', arrayPath);

  // Naviguer jusqu'au tableau de transformations
  let arr = scenario;
  for (let i = 0; i < arrayPath.length; i++) {
    const key = arrayPath[i];
    if (Array.isArray(arr)) {
      arr = arr[key];
    } else if (arr && typeof arr === 'object') {
      arr = arr[key];
    }
  }

  if (!Array.isArray(arr)) {
    console.error('Tableau de transformations non trouvé:', arrayPath);
    return false;
  }

  if (index < 0 || index >= arr.length - 1) {
    console.error(
      'Impossible de déplacer vers le bas:',
      index,
      'Longueur:',
      arr.length
    );
    return false;
  }

  // Échanger avec l'élément suivant
  const temp = arr[index];
  arr[index] = arr[index + 1];
  arr[index + 1] = temp;

  // Mettre à jour les index des transformations échangées
  if (arr[index]._index !== undefined) arr[index]._index = index;
  if (arr[index + 1]._index !== undefined) arr[index + 1]._index = index + 1;

  console.log('✅ Transformation déplacée vers le bas avec succès');
  return true;
}

// Fonction pour mettre à jour une transformation par son _nodeId
function updateTransformationByNodeId(scenario, nodeId, newTransformation) {
  // Normaliser le nodeId en string
  const normalizedNodeId = nodeId != null ? String(nodeId) : null;

  console.log('✏️ updateTransformationByNodeId called:', {
    nodeId,
    nodeIdType: typeof nodeId,
    normalizedNodeId,
    newTransformation,
  });

  if (!normalizedNodeId) {
    console.error('NodeId manquant pour la mise à jour');
    return false;
  }

  // Fonction récursive pour parcourir et mettre à jour
  function updateRecursive(obj) {
    if (!obj || typeof obj !== 'object') return false;

    // Si c'est un tableau de transformations
    if (Array.isArray(obj)) {
      for (let i = 0; i < obj.length; i++) {
        // Normaliser et comparer
        const itemNodeId =
          obj[i]?._nodeId != null ? String(obj[i]._nodeId) : null;
        if (itemNodeId === normalizedNodeId) {
          console.log("🔍 Transformation trouvée et mise à jour à l'index:", i);

          // Préserver le _nodeId et _index existants
          const existingNodeId = obj[i]._nodeId;
          const existingIndex = obj[i]._index;

          // Remplacer la transformation
          obj[i] = {
            ...newTransformation,
            _nodeId: existingNodeId,
            _index: existingIndex,
          };

          console.log('✅ Transformation mise à jour avec succès');
          return true;
        }
      }
    }

    // Parcourir récursivement toutes les propriétés
    for (const key in obj) {
      if (obj.hasOwnProperty(key) && updateRecursive(obj[key])) {
        return true;
      }
    }

    return false;
  }

  const success = updateRecursive(scenario);

  if (!success) {
    console.error('Transformation non trouvée avec nodeId:', nodeId);
    return false;
  }

  return true;
}

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

// ===== GESTIONNAIRES DE CLIC POUR LES TRANSFORMATIONS =====

// Gestionnaire pour le clic sur le bouton "+" du nœud (ajouter au nœud)
function handleAddTransformationClick(node) {
  const parentNodeId = node._nodeId || node.id;
  const scenario = window.scenarios[window.currentScenarioIdx]?.scenario;

  console.log('🔍 Node details:', {
    nodeId: node.id,
    nodeIdType: typeof node.id,
    nodeIdValue: node.id,
    nodeId: node._nodeId,
    nodeIdType: typeof node._nodeId,
    nodeIdValue: node._nodeId,
    parentNodeId,
    parentNodeIdType: typeof parentNodeId,
  });

  console.log('🔍 handleAddTransformationClick called:', {
    node,
    parentNodeId,
    scenarioIdx: window.currentScenarioIdx,
    scenario: scenario,
    scenarios: window.scenarios,
  });

  const path = calculatePathForNewTransformation(node, 'add_to_node', scenario);

  console.log('🔍 Calculated path:', path);

  if (!path) {
    console.error('❌ Path calculation failed for node:', node);
    return;
  }

  const popup = new TransformationPopup();
  popup.show(
    {
      nodeId: parentNodeId,
      path: path, // Path calculé à l'avance
      node: node,
    },
    'add'
  );
}

// Gestionnaire pour le clic sur le bouton "+" du coproduit (ajouter au coproduit)
function handleAddCoproductTransformationClick(parentNode) {
  const parentNodeId = parentNode._nodeId || parentNode.id;
  console.log('handleAddCoproductTransformationClick', parentNode);
  const path = [...parentNode._path];

  const popup = new TransformationPopup();
  popup.show(
    {
      nodeId: parentNodeId,
      path: path, // Path calculé à l'avance
      node: parentNode,
    },
    'add'
  );
}

// Gestionnaire pour le clic sur "edit" d'une transformation
function handleEditTransformationClick(node) {
  const nodeId = node._nodeId || node.id;
  const nodeInfo = findTransformationByNodeId(
    window.scenarios[window.currentScenarioIdx].scenario,
    nodeId
  );

  const popup = new TransformationPopup();
  popup.show(
    {
      nodeId: nodeId,
      path: nodeInfo?.path, // Path calculé à l'avance
      node: node,
    },
    'edit'
  );
}

// ===== FIN DES GESTIONNAIRES DE CLIC =====

// ===== FIN DES FONCTIONS UTILITAIRES =====

// Fonction utilitaire pour lire les paramètres d'URL
function getUrlParams() {
  const urlParams = new URLSearchParams(window.location.search);
  return {
    dimension: urlParams.get('dimension') || 'formats',
    // Supprimer scenarioIdx car il n'est pas nécessaire en mode iframe
    // scenarioIdx: parseInt(urlParams.get('scenarioIdx') || '0', 10),
    lotId: urlParams.get('lotId') || '',
    // Par défaut en lecture seule, seulement si explicitement 'true'
    isEditable: urlParams.get('isEditable') === 'true',
    scenarioId: urlParams.get('scenarioId') || '',
    teamId: urlParams.get('teamId') || '',
    // Utiliser isLive pour tout, pas besoin de scenarioIsLive séparé
    isLive: urlParams.get('isLive') === 'true',
    // Supprimer scenarioIsLive car redondant avec isLive
    // scenarioIsLive: urlParams.get('scenarioIsLive') === 'true',
    lang: (urlParams.get('lang') || 'fr').toLowerCase(),
  };
}
// Charger/cacher les steps depuis notre API interne
async function loadStepsMeta(isLive) {
  if (window.stepsMeta) return window.stepsMeta;
  if (window.stepsMetaPromise) return window.stepsMetaPromise;
  window.stepsMetaPromise = fetch('/api/bubble', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      endpoint: 'steps',
      method: 'GET',
      params: { isLive },
    }),
  })
    .then(r => r.json())
    .then(json => {
      window.stepsMeta = json || {};
      return window.stepsMeta;
    })
    .catch(err => {
      console.warn(
        '[Sankey] Failed to load steps meta, fallback to defaults',
        err
      );
      window.stepsMeta = {};
      return window.stepsMeta;
    })
    .finally(() => {
      window.stepsMetaPromise = null;
    });
  return window.stepsMetaPromise;
}

// Fonction pour mettre à jour les paramètres d'URL
function updateUrlParams(params) {
  const url = new URL(window.location);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      url.searchParams.set(key, value);
    }
  });
  window.history.replaceState({}, '', url);
}

// Initialisation avec les paramètres d'URL
function initializeFromUrl() {
  const params = getUrlParams();
  window.currentDimension = params.dimension;
  window.currentScenarioIdx = params.scenarioIdx;
  window.currentLotId = params.lotId;
  window.isEditable = params.isEditable;
  window.currentLang = params.lang;
  // Charger la méta steps si nécessaire
  loadStepsMeta(params.isLive);

  console.log('Sankey initialisé avec:', params);

  // Si on a un lot et un scénario, lancer le Sankey
  if (
    window.lotType &&
    window.scenarios &&
    window.scenarios[window.currentScenarioIdx]
  ) {
    const scenario = window.scenarios[window.currentScenarioIdx].scenario;
    runSankey({
      lot: window.lotType,
      scenario,
      containerId: 'sankey-container',
      dimension: window.currentDimension,
    });
  }
}

// Création du SVG
const svg = d3
  .select('#sankey-container')
  .append('svg')
  .attr('width', width + margin.left + margin.right)
  .attr('height', height + margin.top + margin.bottom)
  .append('g')
  .attr('transform', `translate(${margin.left},${margin.top})`);

// Ajout du pattern SVG pour le fond dashed (à faire UNE SEULE FOIS)
d3.select('#sankey-container svg').select('defs').remove(); // supprime un éventuel doublon
const defs = d3.select('#sankey-container svg').append('defs');
const pattern = defs
  .append('pattern')
  .attr('id', 'dashed-bg')
  .attr('patternUnits', 'userSpaceOnUse')
  .attr('width', 5)
  .attr('height', 5);
pattern
  .append('rect')
  .attr('width', 5)
  .attr('height', 5)
  .attr('fill', '#f5f5f5');
pattern
  .append('path')
  .attr('d', 'M0,0 l5,5 M-1,4 l2,2 M4,-1 l2,2')
  .attr('stroke', '#bbb')
  .attr('stroke-width', 1.5);

// Création du tooltip
const tooltip = d3
  .select('body')
  .append('div')
  .attr('class', 'tooltip')
  .style('opacity', 0);

// Fonction utilitaire pour masquer le tooltip
function hideTooltip() {
  tooltip.style('opacity', 0);
}

// Fonction pour charger les données de la team
function loadTeamData() {
  const teamId = getUrlParams().teamId;
  console.log('loadTeamData appelée avec teamId:', teamId);
  if (teamId) {
    console.log('Chargement des données de la team...');
    return fetch('/api/bubble', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: 'team',
        params: { id: teamId, isLive: getUrlParams().isLive },
        method: 'POST',
      }),
    })
      .then(response => response.json())
      .then(data => {
        console.log('Données de la team reçues:', data);
        window.teamData = data;
        return data;
      })
      .catch(error => {
        console.error('Erreur chargement team:', error);
        throw error;
      });
  } else {
    console.log('Pas de teamId trouvé');
    return Promise.resolve(null);
  }
}

// Fonction globale pour charger les détails d'une tech
async function loadTechDetailsGlobal(techId) {
  const params = getUrlParams();
  const isLive = params.isLive;

  const response = await fetch('/api/bubble', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      endpoint: 'tech',
      params: {
        id: techId,
        isLive,
      },
      method: 'POST',
    }),
  });

  if (!response.ok)
    throw new Error(i18next.t('apiError', { status: response.status }));
  return await response.json();
}

// Exposer la fonction globalement
window.loadTechDetailsGlobal = loadTechDetailsGlobal;

// Fonction globale pour mettre à jour les détails d'une tech dans une transformation
function updateTechDetailsGlobal(transformation, techDetails) {
  // Mettre à jour les détails de la tech dans la transformation
  if (transformation.tech) {
    transformation.tech = {
      ...transformation.tech,
      details: techDetails,
      version: techDetails.version || '1.0',
      rate: techDetails.rate,
      conso: techDetails.conso,
      step: techDetails.step,
      profils: techDetails.profils,
    };

    console.log(
      i18next.t('techUpdated', {
        techName: transformation.tech.name,
        version: techDetails.version,
      })
    );
  }
}

// Exposer la fonction globalement
window.updateTechDetailsGlobal = updateTechDetailsGlobal;

// Fonction globale pour vérifier et mettre à jour les versions des techs
async function checkAndUpdateTechVersionsGlobal() {
  const scenarioIdx = window.currentScenarioIdx;
  const scenario = window.scenarios[scenarioIdx]?.scenario;

  if (!scenario) {
    console.log('No scenario available for version check');
    return { hasUpdates: false, updatedCount: 0 };
  }

  console.log('Checking tech versions...');
  let updatedCount = 0;
  const updatePromises = [];

  // Fonction récursive pour parcourir le scénario
  const checkTransformations = transformations => {
    if (!Array.isArray(transformations)) return;

    transformations.forEach((transfo, index) => {
      if (transfo.tech && transfo.tech.bubble_id) {
        // Créer une promesse pour chaque vérification
        const updatePromise = loadTechDetailsGlobal(transfo.tech.bubble_id)
          .then(techDetails => {
            if (techDetails && techDetails.version) {
              const currentVersion = transfo.tech.version || '1.0';
              const apiVersion = techDetails.version;

              if (currentVersion !== apiVersion) {
                console.log(
                  `Tech version updated: ${transfo.tech.name} (${currentVersion} -> ${apiVersion})`
                );

                // Mettre à jour les détails de la tech
                updateTechDetailsGlobal(transfo, techDetails);
                updatedCount++;
              }
            }
          })
          .catch(error => {
            console.error(
              `Error checking tech version for ${transfo.tech.name}:`,
              error
            );
          });
        updatePromises.push(updatePromise);
      }

      // Vérifier les sous-scénarios récursivement
      if (transfo.scenario && transfo.scenario.transformations) {
        checkTransformations(transfo.scenario.transformations);
      }
      if (
        transfo.scenario &&
        transfo.scenario.coproduct_scenario &&
        transfo.scenario.coproduct_scenario.transformations
      ) {
        checkTransformations(
          transfo.scenario.coproduct_scenario.transformations
        );
      }
    });
  };

  // Vérifier les transformations principales
  if (scenario.transformations) {
    checkTransformations(scenario.transformations);
  }
  if (
    scenario.coproduct_scenario &&
    scenario.coproduct_scenario.transformations
  ) {
    checkTransformations(scenario.coproduct_scenario.transformations);
  }

  // Attendre que toutes les vérifications soient terminées
  await Promise.allSettled(updatePromises);

  return {
    hasUpdates: updatedCount > 0,
    updatedCount: updatedCount,
  };
}

// Exposer la fonction globalement
window.checkAndUpdateTechVersionsGlobal = checkAndUpdateTechVersionsGlobal;

// Fonction pour afficher une notification toast
function showNotification(message, duration = 3000) {
  // Créer le conteneur de notifications s'il n'existe pas
  let notificationContainer = document.getElementById('notification-container');
  if (!notificationContainer) {
    notificationContainer = document.createElement('div');
    notificationContainer.id = 'notification-container';
    notificationContainer.className =
      'fixed top-4 right-4 z-50 flex flex-col gap-2';
    document.body.appendChild(notificationContainer);
  }

  // Créer l'élément de notification
  const notification = document.createElement('div');
  notification.className =
    'bg-white border border-gray-200 rounded-lg shadow-lg px-6 py-4 min-w-[300px] max-w-[500px]';
  notification.style.opacity = '0';
  notification.style.transform = 'translateX(100%)';
  notification.style.transition = 'opacity 0.3s ease, transform 0.3s ease';

  notification.innerHTML = `
    <div class="flex items-center justify-between">
      <span class="text-gray-800 font-medium">${message}</span>
    </div>
  `;

  notificationContainer.appendChild(notification);

  // Animation d'apparition
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      notification.style.opacity = '1';
      notification.style.transform = 'translateX(0)';
    });
  });

  // Disparition automatique
  setTimeout(() => {
    notification.style.opacity = '0';
    notification.style.transform = 'translateX(100%)';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
      // Supprimer le conteneur s'il est vide
      if (
        notificationContainer &&
        notificationContainer.children.length === 0
      ) {
        if (notificationContainer.parentNode) {
          notificationContainer.parentNode.removeChild(notificationContainer);
        }
      }
    }, 300); // Attendre la fin de l'animation
  }, duration);

  return notification;
}

// Exposer la fonction globalement
window.showNotification = showNotification;

// Fonction réutilisable pour calculer les coûts d'une transformation
function calculateTransformationCosts(transformation, techDetails, teamData) {
  if (!transformation.tech || !techDetails || !teamData) {
    return null;
  }

  const volume = transformation.lot_input_volume || 0;
  const rate = transformation.tech.rate; // kg/h par machine
  const quantity = transformation.tech.quantity; // nombre de machines
  const totalRate = rate * quantity; // kg/h total
  const tempsUtile = volume / totalRate; // heures

  let totalPrix = 0;
  let couts_rh = 0;
  let consommation_totale = 0;
  let cout_energie = 0;
  let cout_amortissement = 0;
  let cout_consommables = 0;

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
    cout_energie = consoKwh * teamData.elec;
    consommation_totale = consoKwh;
    totalPrix += cout_energie;
  }

  // Amortissement (€/h)
  if (
    techDetails.amortization !== undefined &&
    techDetails.amortization !== null
  ) {
    cout_amortissement = techDetails.amortization * tempsUtile * quantity;
    totalPrix += cout_amortissement;
  }

  // Consommables (€/kg)
  if (
    techDetails.consumables !== undefined &&
    techDetails.consumables !== null
  ) {
    cout_consommables = techDetails.consumables * volume;
    totalPrix += cout_consommables;
  }

  return {
    temps_utile: tempsUtile,
    cout_total: totalPrix,
    cout_unitaire: volume > 0 ? totalPrix / volume : 0,
    consommation_totale,
    couts_rh,
    cout_energie,
    cout_amortissement,
    cout_consommables,
    version_transfo_tech: techDetails.version || '1.0',
  };
}

// Exposer la fonction globalement
window.calculateTransformationCosts = calculateTransformationCosts;

// Fonction pour créer les segments de stackbar
function createStackbarSegments(
  nodeGroup,
  sortedEntries,
  dimension,
  d,
  nodeHeight,
  stackbarWidth,
  component,
  sum,
  dimensionValues
) {
  // Vérifier que nodeHeight est un nombre valide
  if (isNaN(nodeHeight) || nodeHeight === null || nodeHeight === undefined) {
    console.warn(
      'nodeHeight invalide détecté:',
      nodeHeight,
      'utilisation de 100 par défaut'
    );
    nodeHeight = 100;
  }

  let yOffset = 0;

  sortedEntries.forEach(([key, value]) => {
    // Récupérer la valeur et la couleur depuis la nouvelle structure
    let pourcentage,
      color = '#bbb';

    if (typeof value === 'object' && value !== null) {
      // Nouvelle structure avec couleur
      pourcentage = value.pourcentage || value;
      color = value.color || '#bbb';
    } else {
      // Ancienne structure (fallback)
      pourcentage = value;
      // Chercher la couleur dans le JSON du lot (ancienne logique)
      if (
        dimension === 'formats' &&
        d.lot.formats &&
        d.lot.formats[key] &&
        d.lot.formats[key].color
      ) {
        color = d.lot.formats[key].color;
      } else if (dimension === 'types' && d.lot.formats) {
        // Trouver le type dans chaque format
        Object.values(d.lot.formats).forEach(formatObj => {
          if (
            formatObj.types &&
            formatObj.types[key] &&
            formatObj.types[key].color
          ) {
            color = formatObj.types[key].color;
          }
        });
      } else if (dimension === 'matieres' && d.lot.formats) {
        Object.values(d.lot.formats).forEach(formatObj => {
          if (formatObj.types) {
            Object.values(formatObj.types).forEach(typeObj => {
              if (
                typeObj.matieres &&
                typeObj.matieres[key] &&
                typeObj.matieres[key].color
              ) {
                color = typeObj.matieres[key].color;
              }
            });
          }
        });
      } else if (dimension === 'fibres' && d.lot.formats) {
        Object.values(d.lot.formats).forEach(formatObj => {
          if (formatObj.types) {
            Object.values(formatObj.types).forEach(typeObj => {
              if (typeObj.matieres) {
                Object.values(typeObj.matieres).forEach(matiereObj => {
                  if (
                    matiereObj.fibres &&
                    matiereObj.fibres[key] &&
                    matiereObj.fibres[key].color
                  ) {
                    color = matiereObj.fibres[key].color;
                  }
                });
              }
            });
          }
        });
      } else if (dimension === 'couleurs' && d.lot.formats) {
        Object.values(d.lot.formats).forEach(formatObj => {
          if (formatObj.types) {
            Object.values(formatObj.types).forEach(typeObj => {
              if (
                typeObj.couleurs &&
                typeObj.couleurs[key] &&
                typeObj.couleurs[key].color
              ) {
                color = typeObj.couleurs[key].color;
              }
            });
          }
        });
      } else if (
        dimension === 'qualite' &&
        d.lot.qualite &&
        d.lot.qualite[key] &&
        d.lot.qualite[key].color
      ) {
        color = d.lot.qualite[key].color;
      } else if (
        dimension === 'proprete' &&
        d.lot.proprete &&
        d.lot.proprete[key] &&
        d.lot.proprete[key].color
      ) {
        color = d.lot.proprete[key].color;
      } else if (dimension === 'perturbateurs' && d.lot.formats) {
        Object.values(d.lot.formats).forEach(formatObj => {
          if (formatObj.types) {
            Object.values(formatObj.types).forEach(typeObj => {
              if (
                typeObj.perturbateurs &&
                typeObj.perturbateurs[key] &&
                typeObj.perturbateurs[key].color
              ) {
                color = typeObj.perturbateurs[key].color;
              }
            });
          }
        });
      }
    }

    const height = sum > 0 ? (pourcentage / sum) * nodeHeight : 0;
    const fillColorStr = color + (color.length === 7 ? '99' : ''); // Opacité 60% si hex, sinon rgba déjà
    const strokeColorStr = color;
    const isUnknown =
      key.toLowerCase() === 'inconnu' ||
      key.toLowerCase() === 'autre' ||
      key.toLowerCase() === 'n/a';
    nodeGroup
      .append('rect')
      .attr('x', 0)
      .attr('y', yOffset)
      .attr('height', height)
      .attr('width', STACKBAR_WIDTH)
      .attr('rx', 4)
      .attr('ry', 4)
      .attr('class', 'stackbar-segment')
      .attr('data-key', key)
      .attr('data-dimension', dimension)
      .style('fill', isUnknown ? 'url(#dashed-bg)' : fillColorStr)
      .style('stroke', isUnknown ? '#999' : strokeColorStr)
      .style('stroke-width', '1px')
      .style('opacity', 1)
      .on('mouseover', function () {
        // Utiliser la valeur correcte pour le tooltip
        const tooltipValue =
          typeof value === 'object' && value !== null
            ? value.pourcentage
            : value;
        // Récupérer l'objet complet pour avoir accès aux traductions
        // Il faut récupérer depuis le lot original, pas depuis dimensionValues transformé
        let fullObject = null;
        if (dimension === 'formats' && d.lot.formats && d.lot.formats[key]) {
          fullObject = d.lot.formats[key];
        } else if (dimension === 'types' && d.lot.formats) {
          // Pour types, il faut chercher dans tous les formats
          Object.values(d.lot.formats).forEach(format => {
            if (format.types && format.types[key]) {
              fullObject = format.types[key];
            }
          });
        } else if (dimension === 'matieres' && d.lot.formats) {
          // Pour matieres, il faut chercher dans tous les formats/types
          Object.values(d.lot.formats).forEach(format => {
            if (format.types) {
              Object.values(format.types).forEach(type => {
                if (type.matieres && type.matieres[key]) {
                  fullObject = type.matieres[key];
                }
              });
            }
          });
        } else if (dimension === 'fibres' && d.lot.formats) {
          // Pour fibres, il faut chercher dans tous les formats/types/matieres
          Object.values(d.lot.formats).forEach(format => {
            if (format.types) {
              Object.values(format.types).forEach(type => {
                if (type.matieres) {
                  Object.values(type.matieres).forEach(matiere => {
                    if (matiere.fibres && matiere.fibres[key]) {
                      fullObject = matiere.fibres[key];
                    }
                  });
                }
              });
            }
          });
        } else if (dimension === 'couleurs' && d.lot.formats) {
          // Pour couleurs, chercher dans tous les formats/types/matieres
          Object.values(d.lot.formats).forEach(format => {
            if (format.types) {
              Object.values(format.types).forEach(type => {
                if (type.matieres) {
                  Object.values(type.matieres).forEach(matiere => {
                    if (matiere.couleurs && matiere.couleurs[key]) {
                      fullObject = matiere.couleurs[key];
                    }
                  });
                }
              });
            }
          });
        } else if (
          dimension === 'qualite' &&
          d.lot.qualite &&
          d.lot.qualite[key]
        ) {
          fullObject = d.lot.qualite[key];
        } else if (
          dimension === 'proprete' &&
          d.lot.proprete &&
          d.lot.proprete[key]
        ) {
          fullObject = d.lot.proprete[key];
        } else if (dimension === 'perturbateurs') {
          // Pour perturbateurs, c'est plus complexe car calculé
          fullObject = dimensionValues[key]; // Fallback sur dimensionValues
        }

        let tooltipContent = component
          ? component.getTooltipContent(
              d.lot,
              key,
              tooltipValue,
              d.lot.total,
              fullObject
            )
          : '';
        tooltip.transition().duration(200).style('opacity', 0.95);
        // ===== TOOLTIP DES ÉLÉMENTS DE STACKBAR (NON-TRANSFO) - VRAI =====
        // Forcer la largeur à 180px directement
        tooltip.classed('narrow', true);
        tooltip.style('width', '180px !important');
        const svgRect = svg.node().ownerSVGElement.getBoundingClientRect();
        const rect = this.getBoundingClientRect();
        const offsetX = rect.left - svgRect.left;
        const offsetY = rect.top - svgRect.top;
        tooltip
          .html(tooltipContent)
          .style(
            'left',
            (() => {
              const windowWidth = window.innerWidth;

              // Détecter si c'est un nœud de droite (bout du Sankey)
              const isRightNode = d.x1 >= windowWidth - 100; // Marge de 100px

              if (isRightNode) {
                // Pour les nœuds de droite, déporter de -80px
                return svgRect.left + offsetX - 100 + 'px';
              } else {
                // Pour les nœuds normaux, positionnement normal
                return svgRect.left + offsetX + 'px';
              }
            })()
          )
          .style('top', svgRect.top + offsetY + 'px');
        // Highlight links
        svg
          .selectAll('.link')
          .transition()
          .duration(100)
          .style('stroke-opacity', l => {
            // Si le target est un nœud merged (isTarget), on regarde le lot source
            const isMergedTarget = l.target.isTarget;
            const lotToCheck = isMergedTarget
              ? l.source.lot || {}
              : l.target.lot || {};
            if (dimension === 'formats') {
              return lotToCheck.formats &&
                Object.keys(lotToCheck.formats).includes(key)
                ? 0.7
                : 0.18;
            }
            if (dimension === 'types' || dimension === 'type') {
              const hasType = lot =>
                Object.values(lot.formats || {}).some(
                  f => f.types && Object.keys(f.types).includes(key)
                );
              return hasType(lotToCheck) ? 0.7 : 0.18;
            }
            if (dimension === 'matieres') {
              const hasMatiere = lot =>
                Object.values(lot.formats || {}).some(
                  f =>
                    f.types &&
                    Object.values(f.types).some(
                      t => t.matieres && Object.keys(t.matieres).includes(key)
                    )
                );
              return hasMatiere(lotToCheck) ? 0.7 : 0.18;
            }
            if (dimension === 'fibres') {
              const hasFibre = lot =>
                Object.values(lot.formats || {}).some(
                  f =>
                    f.types &&
                    Object.values(f.types).some(
                      t =>
                        t.matieres &&
                        Object.values(t.matieres).some(
                          m => m.fibres && Object.keys(m.fibres).includes(key)
                        )
                    )
                );
              return hasFibre(lotToCheck) ? 0.7 : 0.18;
            }
            if (dimension === 'couleurs') {
              const hasCouleur = lot =>
                Object.values(lot.formats || {}).some(
                  f =>
                    f.types &&
                    Object.values(f.types).some(
                      t => t.couleurs && Object.keys(t.couleurs).includes(key)
                    )
                );
              return hasCouleur(lotToCheck) ? 0.7 : 0.18;
            }
            if (dimension === 'qualite') {
              return lotToCheck.qualite &&
                Object.keys(lotToCheck.qualite).includes(key)
                ? 0.7
                : 0.18;
            }
            if (dimension === 'proprete') {
              return lotToCheck.proprete &&
                Object.keys(lotToCheck.proprete).includes(key)
                ? 0.7
                : 0.18;
            }
            if (dimension === 'perturbateurs') {
              const hasPerturbateur = lot =>
                Object.values(lot.formats || {}).some(
                  f =>
                    f.types &&
                    Object.values(f.types).some(
                      t =>
                        t.perturbateurs &&
                        Object.keys(t.perturbateurs).includes(key)
                    )
                );
              return hasPerturbateur(lotToCheck) ? 0.7 : 0.18;
            }
            return 0.18;
          });
      })
      .on('mouseout', function () {
        tooltip.transition().duration(500).style('opacity', 0);
        // Reset links
        svg
          .selectAll('.link')
          .transition()
          .duration(100)
          .style('stroke-opacity', 0.18);
      });

    yOffset += height;
  });
}

// Components pour stackbars et tooltips selon la dimension
const stackbarComponents = {
  formats: {
    getStackValues: lot => {
      if (!lot.formats) return {};
      const values = {};
      Object.entries(lot.formats).forEach(([key, obj]) => {
        if (typeof obj.pourcentage === 'number') {
          values[key] = {
            pourcentage: obj.pourcentage,
            color: obj.color, // Conserver la couleur
          };
        }
      });
      return values;
    },
    getTooltipContent: (lot, key, value, total, fullObject) => {
      const titre = getTitreAffiche(key, fullObject);
      return `<strong>${titre}</strong><table class="tooltip-table"><tr><td class="tooltip-row"><span class="tooltip-label">${i18next.t('percentage')}</span> <span class="tooltip-value">${value.toFixed(1)}%</span></td></tr><tr><td class="tooltip-row"><span class="tooltip-label">${i18next.t('weight')}</span> <span class="tooltip-value">${Math.round((total * value) / 100)} kg</span></td></tr></table>`;
    },
  },
  types: {
    getStackValues: lot => {
      if (!lot.formats) return {};
      const values = {};
      let totalWithType = 0;
      Object.values(lot.formats).forEach(formatObj => {
        if (formatObj.types) {
          Object.entries(formatObj.types).forEach(([type, typeObj]) => {
            if (typeof typeObj.pourcentage === 'number') {
              // On ne prend en compte que les types qui ont une part > 0
              const typePct =
                typeObj.pourcentage * (formatObj.pourcentage / 100);
              if (typePct > 0) {
                values[type] = (values[type] || 0) + typePct;
                totalWithType += typePct;
              }
            }
          });
        }
      });
      // Normalisation pour que la somme fasse 100% de la part du lot qui a des types
      if (totalWithType > 0) {
        Object.keys(values).forEach(k => {
          values[k] = (values[k] / totalWithType) * 100;
        });
      }

      // Conserver les couleurs des types
      Object.keys(values).forEach(key => {
        if (key !== 'N/A') {
          // Chercher la couleur dans la structure originale
          let foundColor = null;
          Object.values(lot.formats).forEach(formatObj => {
            if (
              formatObj.types &&
              formatObj.types[key] &&
              formatObj.types[key].color
            ) {
              foundColor = formatObj.types[key].color;
            }
          });
          if (foundColor) {
            values[key] = {
              pourcentage: values[key],
              color: foundColor,
            };
          }
        }
      });

      return values;
    },
    getTooltipContent: (lot, key, value, total, fullObject) => {
      const titre = getTitreAffiche(key, fullObject);
      return `<strong>${titre}</strong><table class="tooltip-table"><tr><td class="tooltip-row"><span class="tooltip-label">${i18next.t('percentage')}</span> <span class="tooltip-value">${value.toFixed(1)}%</span></td></tr><tr><td class="tooltip-row"><span class="tooltip-label">${i18next.t('weight')}</span> <span class="tooltip-value">${Math.round((total * value) / 100)} kg</span></td></tr></table>`;
    },
  },
  matieres: {
    getStackValues: lot => {
      if (!lot.formats) return {};
      const values = {};
      let totalLot = 0;
      let totalSansMatiere = 0;
      Object.values(lot.formats).forEach(formatObj => {
        const pctFormat =
          typeof formatObj.pourcentage === 'number'
            ? formatObj.pourcentage
            : 100;
        if (formatObj.types) {
          Object.values(formatObj.types).forEach(typeObj => {
            const poidsType = (pctFormat * (typeObj.pourcentage || 100)) / 100;
            totalLot += poidsType;
            if (typeObj.matieres && Object.keys(typeObj.matieres).length > 0) {
              let sumMatiere = 0;
              Object.entries(typeObj.matieres).forEach(
                ([matiere, matiereObj]) => {
                  let pctMatiere =
                    typeof matiereObj === 'object' && matiereObj !== null
                      ? matiereObj.pourcentage !== undefined
                        ? matiereObj.pourcentage
                        : 0
                      : matiereObj;
                  values[matiere] =
                    (values[matiere] || 0) + (pctMatiere / 100) * poidsType;
                  sumMatiere += (pctMatiere / 100) * poidsType;
                }
              );
              if (sumMatiere < poidsType) {
                totalSansMatiere += poidsType - sumMatiere;
              }
            } else {
              // Pas de matière renseignée pour ce type
              totalSansMatiere += poidsType;
            }
          });
        }
      });
      // Ajouter la part sans matière AVANT normalisation
      if (totalSansMatiere > 0 && totalLot > 0) {
        values['N/A'] = (totalSansMatiere / totalLot) * 100;
      }
      // Normalisation pour que la somme fasse 100%
      const sum = Object.values(values).reduce((a, b) => a + b, 0);
      if (sum > 0) {
        Object.keys(values).forEach(k => {
          values[k] = (values[k] / sum) * 100;
        });
      }

      // Conserver les couleurs des matières
      Object.keys(values).forEach(key => {
        if (key !== '_missing') {
          // Chercher la couleur dans la structure originale
          let foundColor = null;
          Object.values(lot.formats).forEach(formatObj => {
            if (formatObj.types) {
              Object.values(formatObj.types).forEach(typeObj => {
                if (
                  typeObj.matieres &&
                  typeObj.matieres[key] &&
                  typeObj.matieres[key].color
                ) {
                  foundColor = typeObj.matieres[key].color;
                }
              });
            }
          });
          if (foundColor) {
            values[key] = {
              pourcentage: values[key],
              color: foundColor,
            };
          }
        }
      });

      return values;
    },
    getTooltipContent: (lot, key, value, total, fullObject) => {
      const titre = getTitreAffiche(key, fullObject);
      // Trouver la matière dans le lot courant
      let fibresDistrib = {};
      Object.values(lot.formats).forEach(formatObj => {
        if (formatObj.types) {
          Object.values(formatObj.types).forEach(typeObj => {
            if (
              typeObj.matieres &&
              typeObj.matieres[key] &&
              typeObj.matieres[key].fibres
            ) {
              Object.entries(typeObj.matieres[key].fibres).forEach(
                ([fibre, pct]) => {
                  let pctValue =
                    typeof pct === 'object' && pct !== null
                      ? pct.pourcentage !== undefined
                        ? pct.pourcentage
                        : 0
                      : pct;
                  fibresDistrib[fibre] = (fibresDistrib[fibre] || 0) + pctValue;
                }
              );
            }
          });
        }
      });
      // Normalisation (au cas où plusieurs types)
      const sumFibres = Object.values(fibresDistrib).reduce((a, b) => a + b, 0);
      if (sumFibres > 0) {
        Object.keys(fibresDistrib).forEach(f => {
          fibresDistrib[f] = (fibresDistrib[f] / sumFibres) * 100;
        });
      }
      let fibresStr = '';
      if (Object.keys(fibresDistrib).length > 0) {
        fibresStr =
          '<br/><em>Fibres :</em><br/>' +
          Object.entries(fibresDistrib)
            .map(([f, pct]) => `${f} : ${Number(pct).toFixed(1)}%`)
            .join('<br/>');
      }
      return `<strong>${titre}</strong><br/>Pourcentage : ${Number(value).toFixed(1)}%<br/>Poids : ${Math.round((total * value) / 100)} kg${fibresStr}`;
    },
  },
  fibres: {
    getStackValues: lot => {
      if (!lot.formats) return {};
      const values = {};
      let totalLot = 0;
      let totalSansFibre = 0;
      Object.values(lot.formats).forEach(formatObj => {
        const pctFormat =
          typeof formatObj.pourcentage === 'number'
            ? formatObj.pourcentage
            : 100;
        if (formatObj.types) {
          Object.values(formatObj.types).forEach(typeObj => {
            const poidsType = (pctFormat * (typeObj.pourcentage || 100)) / 100;
            totalLot += poidsType;
            if (typeObj.matieres && Object.keys(typeObj.matieres).length > 0) {
              Object.values(typeObj.matieres).forEach(matiereObj => {
                const pctMatiere =
                  typeof matiereObj.pourcentage === 'number'
                    ? matiereObj.pourcentage
                    : 100;
                const poidsMatiere = (poidsType * pctMatiere) / 100;
                if (
                  matiereObj.fibres &&
                  Object.keys(matiereObj.fibres).length > 0
                ) {
                  let sumFibre = 0;
                  Object.entries(matiereObj.fibres).forEach(([fibre, val]) => {
                    let pctFibre =
                      typeof val === 'object' && val !== null
                        ? val.pourcentage !== undefined
                          ? val.pourcentage
                          : val.masse !== undefined
                            ? val.masse
                            : 0
                        : val;
                    values[fibre] =
                      (values[fibre] || 0) + (pctFibre / 100) * poidsMatiere;
                    sumFibre += (pctFibre / 100) * poidsMatiere;
                  });
                  if (sumFibre < poidsMatiere) {
                    totalSansFibre += poidsMatiere - sumFibre;
                  }
                } else {
                  // Pas de fibre renseignée pour cette matière
                  totalSansFibre += poidsMatiere;
                }
              });
            } else {
              // Pas de matière renseignée pour ce type
              totalSansFibre += poidsType;
            }
          });
        }
      });
      // Ajouter la part sans fibre AVANT normalisation
      if (totalSansFibre > 0 && totalLot > 0) {
        values['N/A'] = (totalSansFibre / totalLot) * 100;
      }
      // Normalisation pour que la somme fasse 100%
      const sum = Object.values(values).reduce((a, b) => a + b, 0);
      if (sum > 0) {
        Object.keys(values).forEach(k => {
          values[k] = (values[k] / sum) * 100;
        });
      }

      // Conserver les couleurs des fibres
      Object.keys(values).forEach(key => {
        if (key !== '_missing') {
          // Chercher la couleur dans la structure originale
          let foundColor = null;
          Object.values(lot.formats).forEach(formatObj => {
            if (formatObj.types) {
              Object.values(formatObj.types).forEach(typeObj => {
                if (typeObj.matieres) {
                  Object.values(typeObj.matieres).forEach(matiereObj => {
                    if (
                      matiereObj.fibres &&
                      matiereObj.fibres[key] &&
                      matiereObj.fibres[key].color
                    ) {
                      foundColor = matiereObj.fibres[key].color;
                    }
                  });
                }
              });
            }
          });
          if (foundColor) {
            values[key] = {
              pourcentage: values[key],
              color: foundColor,
            };
          }
        }
      });

      return values;
    },
    getTooltipContent: (lot, key, value, total, fullObject) => {
      const titre = getTitreAffiche(key, fullObject);
      return `<strong>${titre}</strong><br/>Pourcentage : ${value.toFixed(1)}%<br/>Poids : ${Math.round((total * value) / 100)} kg`;
    },
  },
  couleurs: {
    getStackValues: lot => {
      if (!lot.formats) return {};
      const values = {};
      let totalLot = 0;
      let totalSansCouleur = 0;
      Object.values(lot.formats).forEach(formatObj => {
        const pctFormat =
          typeof formatObj.pourcentage === 'number'
            ? formatObj.pourcentage
            : 100;
        if (formatObj.types) {
          Object.values(formatObj.types).forEach(typeObj => {
            const masseType = (pctFormat * (typeObj.pourcentage || 100)) / 100;
            totalLot += masseType;
            if (typeObj.couleurs && Object.keys(typeObj.couleurs).length > 0) {
              let sumCouleur = 0;
              Object.entries(typeObj.couleurs).forEach(
                ([couleur, couleurObj]) => {
                  let pct = 0;
                  if (
                    typeof couleurObj === 'object' &&
                    typeof couleurObj.pourcentage === 'number'
                  ) {
                    pct = couleurObj.pourcentage;
                  } else if (typeof couleurObj === 'number') {
                    pct = couleurObj;
                  }
                  values[couleur] =
                    (values[couleur] || 0) + (pct / 100) * masseType;
                  sumCouleur += (pct / 100) * masseType;
                }
              );
              // Si la somme des couleurs ne couvre pas toute la masse du type, le reste est inconnu
              if (sumCouleur < masseType) {
                totalSansCouleur += masseType - sumCouleur;
              }
            } else {
              // Pas de couleur renseignée pour ce type
              totalSansCouleur += masseType;
            }
          });
        }
      });
      // Ajouter la part sans couleur AVANT normalisation
      if (totalSansCouleur > 0 && totalLot > 0) {
        values['N/A'] = (totalSansCouleur / totalLot) * 100;
      }
      // Normalisation pour que la somme fasse 100%
      const sum = Object.values(values).reduce((a, b) => a + b, 0);
      if (sum > 0) {
        Object.keys(values).forEach(k => {
          values[k] = (values[k] / sum) * 100;
        });
      }

      // Conserver les couleurs des couleurs
      Object.keys(values).forEach(key => {
        if (key !== 'N/A') {
          // Chercher la couleur dans la structure originale
          let foundColor = null;
          Object.values(lot.formats).forEach(formatObj => {
            if (formatObj.types) {
              Object.values(formatObj.types).forEach(typeObj => {
                if (
                  typeObj.couleurs &&
                  typeObj.couleurs[key] &&
                  typeObj.couleurs[key].color
                ) {
                  foundColor = typeObj.couleurs[key].color;
                }
              });
            }
          });
          if (foundColor) {
            values[key] = {
              pourcentage: values[key],
              color: foundColor,
            };
          }
        }
      });

      return values;
    },
    getTooltipContent: (lot, key, value, total, fullObject) => {
      const titre = getTitreAffiche(key, fullObject);
      return `<strong>${titre}</strong><table class="tooltip-table"><tr><td class="tooltip-row"><span class="tooltip-label">${i18next.t('percentage')}</span> <span class="tooltip-value">${value.toFixed(1)}%</span></td></tr><tr><td class="tooltip-row"><span class="tooltip-label">${i18next.t('weight')}</span> <span class="tooltip-value">${Math.round((total * value) / 100)} kg</span></td></tr></table>`;
    },
  },
  qualite: {
    getStackValues: lot => {
      if (!lot.qualite) return {};
      const values = {};
      Object.entries(lot.qualite).forEach(([qual, pct]) => {
        // pct peut être un nombre ou un objet (selon la structure)
        const pourcentage =
          typeof pct === 'number' ? pct : pct.pourcentage || 0;
        values[qual] = {
          pourcentage: pourcentage,
          color: pct.color, // Conserver la couleur si elle existe
        };
      });
      return values;
    },
    getTooltipContent: (lot, key, value, total, fullObject) => {
      const titre = getTitreAffiche(key, fullObject);
      return `<strong>${titre}</strong><table class="tooltip-table"><tr><td class="tooltip-row"><span class="tooltip-label">${i18next.t('percentage')}</span> <span class="tooltip-value">${value.toFixed(1)}%</span></td></tr><tr><td class="tooltip-row"><span class="tooltip-label">${i18next.t('weight')}</span> <span class="tooltip-value">${Math.round((total * value) / 100)} kg</span></td></tr></table>`;
    },
  },
  proprete: {
    getStackValues: lot => {
      if (!lot.proprete) return {};
      const values = {};
      Object.entries(lot.proprete).forEach(([prop, pct]) => {
        // pct peut être un nombre ou un objet (selon la structure)
        const pourcentage =
          typeof pct === 'number' ? pct : pct.pourcentage || 0;
        values[prop] = {
          pourcentage: pourcentage,
          color: pct.color, // Conserver la couleur si elle existe
        };
      });
      return values;
    },
    getTooltipContent: (lot, key, value, total, fullObject) => {
      const titre = getTitreAffiche(key, fullObject);
      return `<strong>${titre}</strong><br/>Pourcentage : ${value.toFixed(1)}%<br/>Poids : ${Math.round((total * value) / 100)} kg`;
    },
  },
  perturbateurs: {
    getStackValues: lot => {
      // On cherche les perturbateurs dans chaque type de chaque format
      if (!lot.formats) return {};
      const values = {};
      let totalLot = 0;
      let totalSansPerturbateur = 0;
      Object.values(lot.formats).forEach(formatObj => {
        const pctFormat =
          typeof formatObj.pourcentage === 'number'
            ? formatObj.pourcentage
            : 100;
        if (formatObj.types) {
          Object.values(formatObj.types).forEach(typeObj => {
            const masseType = (pctFormat * (typeObj.pourcentage || 100)) / 100;
            totalLot += masseType;
            if (
              typeObj.perturbateurs &&
              Object.keys(typeObj.perturbateurs).length > 0
            ) {
              let sumPert = 0;
              Object.entries(typeObj.perturbateurs).forEach(
                ([pert, pertObj]) => {
                  let pct =
                    typeof pertObj === 'object' &&
                    pertObj.pourcentage !== undefined
                      ? pertObj.pourcentage
                      : typeof pertObj === 'number'
                        ? pertObj
                        : 0;
                  values[pert] = (values[pert] || 0) + (pct / 100) * masseType;
                  sumPert += (pct / 100) * masseType;
                }
              );
              // Si la somme des perturbateurs ne couvre pas toute la masse du type, le reste est inconnu
              if (sumPert < masseType) {
                totalSansPerturbateur += masseType - sumPert;
              }
            } else {
              // Pas de perturbateur renseigné pour ce type
              totalSansPerturbateur += masseType;
            }
          });
        }
      });
      // Ajouter la part sans perturbateur AVANT normalisation
      if (totalSansPerturbateur > 0 && totalLot > 0) {
        values['N/A'] = (totalSansPerturbateur / totalLot) * 100;
      }
      // Normalisation pour que la somme fasse 100%
      const sum = Object.values(values).reduce((a, b) => a + b, 0);
      if (sum > 0) {
        Object.keys(values).forEach(k => {
          values[k] = (values[k] / sum) * 100;
        });
      }
      return values;
    },
    getTooltipContent: (lot, key, value, total, fullObject) => {
      const titre = getTitreAffiche(key, fullObject);
      return `<strong>${titre}</strong><table class="tooltip-table"><tr><td class="tooltip-row"><span class="tooltip-label">${i18next.t('percentage')}</span> <span class="tooltip-value">${value.toFixed(1)}%</span></td></tr><tr><td class="tooltip-row"><span class="tooltip-label">${i18next.t('weight')}</span> <span class="tooltip-value">${Math.round((total * value) / 100)} kg</span></td></tr></table>`;
    },
  },
  // Ajoute ici d'autres dimensions si besoin
};

// --- Fonction utilitaire pour injecter les icônes Phosphor ---
function getIconSVG(name, className = '') {
  const iconMap = {
    plus: 'ph-plus',
    trash: 'ph-trash',
    x: 'ph-x',
    'caret-left': 'ph-caret-left',
    'caret-right': 'ph-caret-right',
    'arrows-split': 'ph-arrows-split',
    'check-circle': 'ph-check-circle',
    'pencil-simple': 'ph-pencil-simple',
    'arrow-up': 'ph-arrow-up',
    'arrow-down': 'ph-arrow-down',
    eye: 'ph-eye',
    'sign-out': 'ph-sign-out',
    // Icônes pour les steps
    't-shirt': 'ph-t-shirt',
    scissors: 'ph-scissors',
    'corners-in': 'ph-corners-in',
    atom: 'ph-atom',
    flask: 'ph-flask',
    gradient: 'ph-gradient',
    truck: 'ph-truck',
    broom: 'ph-broom',
    package: 'ph-package',
    'test-tube': 'ph-test-tube',
  };
  const iconClass = iconMap[name];
  if (!iconClass) return '';
  return `<i class="ph ${iconClass} ${className}"></i>`;
}

// --- Fonction pour récupérer l'icône d'une step ---
function getStepIcon(stepId) {
  if (
    window.stepsMeta &&
    window.stepsMeta[stepId] &&
    window.stepsMeta[stepId].icon
  ) {
    return window.stepsMeta[stepId].icon;
  }
  // Fallback interne si non chargé
  const fallback = {
    collecting: 't-shirt',
    sorting: 'arrows-split',
    'de-zipping': 'corners-in',
    cutting: 'scissors',
    depolymerization: 'atom',
    polymerization: 'flask',
    spinning: 'gradient',
    transport: 'truck',
    'chemical-treatment': 'test-tube',
    'chemical treatment': 'test-tube',
  };
  return fallback[stepId] || 'arrows-split';
}

function getStepLabel(stepId) {
  const lang = (
    window.currentLang ||
    (window.i18next && window.i18next.language) ||
    'fr'
  )
    .slice(0, 2)
    .toLowerCase();
  const meta = window.stepsMeta && window.stepsMeta[stepId];
  if (meta) {
    if (lang === 'fr' && meta.fr) return meta.fr;
    if (lang !== 'fr' && meta.en) return meta.en;
  }
  return stepId;
}

// --- Fonction utilitaire pour récupérer la step d'une transformation ---
function getTransformationStep(transformation) {
  if (!transformation) return 'sorting';

  const type = Array.isArray(transformation.type)
    ? transformation.type[0]
    : transformation.type;

  // 1. Si la transformation a une step définie, l'utiliser
  if (transformation.step) {
    return transformation.step;
  }

  // Log explicite si transfo dynamique sans step
  if (type === 'dynamic_transfo') {
    console.warn(
      '[Sankey] Dynamic transformation without step, using fallback',
      transformation
    );
  }

  // 2. Sinon, chercher dans transformationTypes
  if (window.transformationTypes && window.transformationTypes[type]) {
    return window.transformationTypes[type].step || 'sorting';
  }

  // 3. Chercher dans translationTypes
  if (type.startsWith('translation_')) {
    const translationKey = type.replace('translation_', '');
    if (window.translationTypes && window.translationTypes[translationKey]) {
      return window.translationTypes[translationKey].step || 'sorting';
    }
  }

  // 4. Fallback par défaut
  return 'sorting';
}

// Constantes communes pour le rendu
const STACKBAR_WIDTH = 80;
const EXTRA_BLOCK_WIDTH = 30;
const HORIZONTAL_PADDING = 20;

// Fonction utilitaire pour créer le fond dashed d'une stackbar vide
function createDashedBackground(nodeGroup, nodeHeight, stackbarWidth) {
  nodeGroup
    .append('rect')
    .attr('x', 0)
    .attr('y', 0)
    .attr('height', nodeHeight)
    .attr('width', stackbarWidth)
    .attr('rx', 4)
    .attr('ry', 4)
    .style('fill', 'url(#dashed-bg)')
    .style('stroke', '#bbb')
    .style('stroke-width', '1px')
    .style('opacity', 1);
}

// Fonction utilitaire pour créer le bloc extra à droite de la stackbar
function createExtraBlock(
  nodeGroup,
  stackbarWidth,
  extraBlockWidth,
  nodeHeight,
  nodeData
) {
  nodeGroup
    .append('rect')
    .attr('x', stackbarWidth)
    .attr('y', 0)
    .attr('width', extraBlockWidth)
    .attr('height', nodeHeight)
    .attr('rx', 4)
    .attr('ry', 4)
    .style('fill', 'rgba(204,204,204,0.6)')
    .style('stroke', 'rgba(204,204,204,1)')
    .style('stroke-width', '1px')
    .style('opacity', 1);
}

// Fonction commune pour rendre un nœud
function renderNode(node, position, isStandalone, dimension) {
  // Utiliser une hauteur fixe pour le premier nœud pour maintenir la cohérence
  const nodeHeight = isStandalone
    ? FIRST_NODE_MIN_HEIGHT_PX
    : Math.max(100, height * 0.8);
  const nodeGroup = svg
    .append('g')
    .attr('transform', `translate(${position.x},${position.y})`);

  // Stackbar (fond)
  nodeGroup
    .append('rect')
    .attr('x', 0)
    .attr('height', nodeHeight)
    .attr('width', STACKBAR_WIDTH)
    .style('fill', '#e0e0e0')
    .style('opacity', 0.6);

  // Stackbars pour la dimension sélectionnée
  const component = stackbarComponents[dimension];
  const dimensionValues = component ? component.getStackValues(node.lot) : {};
  const sum = Object.values(dimensionValues).reduce((a, b) => {
    const value = typeof b === 'object' && b !== null ? b.pourcentage : b;
    return a + value;
  }, 0);
  const sortedEntries = Object.entries(dimensionValues)
    .filter(([key]) => !key.startsWith('_'))
    .sort((a, b) => {
      const valueA =
        typeof a[1] === 'object' && a[1] !== null ? a[1].pourcentage : a[1];
      const valueB =
        typeof b[1] === 'object' && b[1] !== null ? b[1].pourcentage : b[1];
      return valueB - valueA;
    });

  // Si la stackbar est vide, afficher un fond dashed
  if (sortedEntries.length === 0) {
    createDashedBackground(nodeGroup, nodeHeight, STACKBAR_WIDTH);
  }

  // Affichage des segments stackbar avec couleur du JSON
  createStackbarSegments(
    nodeGroup,
    sortedEntries,
    dimension,
    node,
    nodeHeight,
    STACKBAR_WIDTH,
    component,
    sum,
    dimensionValues
  );

  // Bloc à droite de la stackbar
  createExtraBlock(
    nodeGroup,
    STACKBAR_WIDTH,
    EXTRA_BLOCK_WIDTH,
    nodeHeight,
    node
  );

  // Gestion des événements et tooltips pour le cas normal
  if (!isStandalone) {
    // Ajouter les événements mouseover/mouseout pour les tooltips
    // (code existant pour les tooltips)
  }

  return nodeGroup;
}

function updateSankey(dimension) {
  // Attendre que les données de la team soient chargées si on a un teamId
  const teamId = getUrlParams().teamId;
  if (teamId && !window.teamData) {
    console.log('Données de la team non disponibles, attente...');
    setTimeout(() => updateSankey(dimension), 100);
    return;
  }

  // Nettoyer le SVG
  svg.selectAll('*').remove();

  // Vérifier que le scénario Sankey est disponible
  if (
    !window.sankeyScenario ||
    !window.sankeyScenario.nodes ||
    !window.sankeyScenario.links
  ) {
    console.log('Sankey non prêt, attente...');
    setTimeout(() => updateSankey(dimension), 100);
    return;
  }

  // Récupérer les nœuds et liens du scénario
  let nodes = window.sankeyScenario.nodes.map(n => ({
    ...n,
    id: String(n.id),
  }));

  // Définir la hauteur du Sankey
  height = FIRST_NODE_MIN_HEIGHT_PX;
  let links = window.sankeyScenario.links.map(l => ({
    ...l,
    source: String(l.source),
    target: String(l.target),
  }));

  // Cas spécial : Sankey vide (aucune transformation appliquée, que des nœuds target ou Reste sans transformation)
  const onlyInitialAndTargets =
    nodes.length > 1 &&
    nodes.slice(1).every(n => n.isTarget || n.isCoproduct) &&
    links.every(l => !l.transformation);

  if (onlyInitialAndTargets) {
    // On ne garde que le lot initial, sans liens ni nœuds target/reste
    nodes = [nodes[0]];
    links = [];
    // Cas spécial : un seul nœud => affichage manuel
    // (on saute la logique D3 Sankey)
    if (nodes.length === 1) {
      const nodeHeight = FIRST_NODE_MIN_HEIGHT_PX;
      const nodeGroup = renderNode(
        nodes[0],
        { x: HORIZONTAL_PADDING, y: 40 },
        true,
        dimension
      );

      // Mettre à jour la hauteur du SVG et du container pour un seul node
      const totalHeight = nodeHeight + 80; // +80 pour les marges
      const svgElement = d3.select('#sankey-container svg');
      svgElement.attr('height', totalHeight + margin.top + margin.bottom);

      const container = document.getElementById('sankey-container');
      if (container) {
        container.style.height =
          totalHeight + margin.top + margin.bottom + 'px';
      }

      // Titre du lot (seulement si ce n'est pas le premier nœud)
      if (nodes[0].id !== '0') {
        const titleText =
          nodes[0].lot && nodes[0].lot.title
            ? nodes[0].lot.title
            : nodes[0].name;

        // Diviser le texte en lignes de max 20 caractères
        const words = titleText.split(' ');
        const lines = [];
        let currentLine = '';

        for (const word of words) {
          if ((currentLine + ' ' + word).length <= 20) {
            currentLine = currentLine ? currentLine + ' ' + word : word;
          } else {
            if (currentLine) lines.push(currentLine);
            currentLine = word;
          }
        }
        if (currentLine) lines.push(currentLine);

        const textElement = nodeGroup
          .append('text')
          .attr('class', 'lot-title')
          .attr('x', -10)
          .attr('y', nodeHeight / 2 - (lines.length - 1) * 6)
          .attr('text-anchor', 'end')
          .attr('dominant-baseline', 'middle')
          .style('font-size', '11px')
          .style('fill', '#666');

        lines.forEach((line, index) => {
          textElement
            .append('tspan')
            .attr('x', -10)
            .attr('dy', index === 0 ? 0 : '1.2em')
            .text(line);
        });
      }

      // Bouton + pour ajouter une transformation (même logique que dans la boucle node.each)
      // Utiliser la même hauteur que celle calculée dans renderNode pour un centrage correct
      const actualNodeHeight = FIRST_NODE_MIN_HEIGHT_PX;
      const yPlus = actualNodeHeight / 2 - 14;
      const fo = nodeGroup
        .append('foreignObject')
        .attr('x', STACKBAR_WIDTH + (EXTRA_BLOCK_WIDTH - 28) / 2)
        .attr('y', yPlus)
        .attr('width', 28)
        .attr('height', 28);
      const div = document.createElement('div');
      div.className =
        'w-7 h-7 p-[3px] flex items-center justify-center rounded bg-gray-300 hover:bg-gray-400 border border-gray-400 cursor-pointer';
      div.innerHTML = getIconSVG(
        'plus',
        'w-7 h-7 text-[1.3rem] flex items-center justify-center'
      );
      fo.node().appendChild(div);

      // Conditionner la position et les comportements
      if (window.isEditable) {
        // Mode éditable : bouton visible et fonctionnel
      } else {
        // Mode lecture seule : positionner le bouton hors de l'écran
        fo.attr('x', -1000).attr('y', -1000);
      }

      // Vérifier si on est en mode éditable avant de créer le dropdown
      if (window.isEditable) {
        // Utiliser la fonction utilitaire pour créer le dropdown
        const dropdownOptions = [
          {
            icon: 'plus',
            label: i18next.t('addTransfo'),
            onClick: () => {
              console.log('🔍 BOUTON + SCÉNARIO VIDE CLICKED');
              // Contexte scénario vide: utiliser explicitement le nœud courant (nodes[0])
              const currentNode = nodes && nodes.length ? nodes[0] : null;
              if (!currentNode) {
                console.error(
                  'Aucun nœud disponible pour ajouter une transformation'
                );
                return;
              }
              // Utiliser le nouveau gestionnaire pour le nœud racine
              handleAddTransformationClick(currentNode);
            },
          },
          {
            icon: 'sign-out',
            label: i18next.t('link'),
            disabled: true,
          },
        ];

        div.addEventListener('click', createDropdown(div, dropdownOptions, 1));
      }

      return; // On ne fait rien d'autre
    }
  }

  // 1. Identifier les nœuds feuilles avec un target
  const leafNodesWithTarget = nodes.filter(
    n => n.lot && n.lot.target && !links.some(l => l.source === n.id)
  );

  // 2. Lister tous les targets uniques
  const uniqueTargets = [
    ...new Set(leafNodesWithTarget.map(n => n.lot.target)),
  ];

  // 3. Créer un nœud destination pour chaque target
  const maxNodeDepth = Math.max(...nodes.map(n => n.depth || 0));
  const targetNodes = uniqueTargets.map(target => {
    // Récupérer tous les lots qui arrivent sur ce target
    const lotsToMerge = leafNodesWithTarget
      .filter(n => n.lot.target === target)
      .map(n => n.lot);

    return {
      id: 'target_' + target,
      name: target,
      isTarget: true,
      lot: mergeLots(lotsToMerge), // On merge les lots ici
      depth: maxNodeDepth + 1,
    };
  });

  // 4. Pour chaque feuille avec target, créer un lien vers le nœud destination
  const newLinks = [];
  leafNodesWithTarget.forEach(leaf => {
    newLinks.push({
      source: String(leaf.id),
      target: 'target_' + leaf.lot.target,
      value: leaf.lot.total,
    });
  });

  // 5. Ajouter ces nœuds et liens à la structure
  nodes = [...nodes, ...targetNodes];
  links = [
    ...links.filter(l => !leafNodesWithTarget.some(n => n.id === l.source)), // on retire les liens sortants des feuilles valorisées
    ...newLinks,
  ];

  // Création du layout Sankey

  // Préserver l'ordre des liens
  const linkOrder = new Map();
  links.forEach((link, i) => {
    const sourceId = String(link.source);
    if (!linkOrder.has(sourceId)) {
      linkOrder.set(sourceId, []);
    }
    linkOrder.get(sourceId).push(i);
  });

  const sankey = d3
    .sankey()
    .nodeWidth(STACKBAR_WIDTH + EXTRA_BLOCK_WIDTH)
    .nodePadding(25) // 28px d'espacement entre nœuds pour éviter l'overlap des boutons
    .extent([
      [HORIZONTAL_PADDING, 0],
      [width - HORIZONTAL_PADDING, height],
    ])
    .nodeId(d => d.id)
    .linkSort((a, b) => {
      const sourceOrder = linkOrder.get(String(a.source.id));
      if (sourceOrder) {
        return sourceOrder.indexOf(a.index) - sourceOrder.indexOf(b.index);
      }
      return 0;
    });

  // Application du layout
  const { nodes: sankeyNodes, links: sankeyLinks } = sankey({ nodes, links });

  // Imposer un pas horizontal fixe entre colonnes
  const columnStep = 300; // distance en px entre 2 colonnes
  const nodeW = STACKBAR_WIDTH + EXTRA_BLOCK_WIDTH;
  const maxDepth = Math.max(...sankeyNodes.map(n => n.depth || 0));

  // Déterminer les nœuds sans liens sortants (sinks)
  const outCountByNodeId = new Map();
  sankeyLinks.forEach(l => {
    const sid = String(l.source.id);
    outCountByNodeId.set(sid, (outCountByNodeId.get(sid) || 0) + 1);
  });

  sankeyNodes.forEach(n => {
    const isSink = !outCountByNodeId.get(String(n.id));
    const depth = isSink ? maxDepth : n.depth || 0;
    const x0 = HORIZONTAL_PADDING + depth * columnStep;
    n.x0 = x0;
    n.x1 = x0 + nodeW;
  });

  // Largeur requise pour contenir toutes les colonnes
  const requiredWidth =
    HORIZONTAL_PADDING + maxDepth * columnStep + nodeW + HORIZONTAL_PADDING;
  const effectiveWidth = Math.max(width, requiredWidth);

  // Calculer la hauteur requise selon le contenu (max de y1 parmi tous les nodes)
  const maxY =
    sankeyNodes.length > 0
      ? Math.max(...sankeyNodes.map(n => n.y1 || 0))
      : height;
  const requiredHeight = Math.max(
    400,
    Math.min(maxY + margin.bottom + 40, 1000)
  );

  // Mettre à jour la hauteur du SVG et du container
  const svgElement = d3.select('#sankey-container svg');
  svgElement.attr('width', effectiveWidth);
  svgElement.attr('height', requiredHeight + margin.top + margin.bottom);

  // Mettre à jour le container
  const container = document.getElementById('sankey-container');
  if (container) {
    container.style.height = requiredHeight + margin.top + margin.bottom + 'px';
  }

  // Calcul des totaux par target
  const targetTotals = {};
  nodes.forEach(node => {
    if (node.lot && node.lot.target) {
      targetTotals[node.lot.target] =
        (targetTotals[node.lot.target] || 0) + node.lot.total;
    }
  });

  // Création des liens
  svg
    .append('g')
    .selectAll('path')
    .data(sankeyLinks)
    .join('path')
    .attr('class', 'link')
    .attr('d', d3.sankeyLinkHorizontal())
    .attr('stroke-width', d => Math.max(1, d.width))
    .style('stroke', '#000')
    .style('stroke-opacity', 0.18);

  // Création des nœuds
  const node = svg
    .append('g')
    .selectAll('g')
    .data(sankeyNodes)
    .join('g')
    .attr('transform', d => `translate(${d.x0},${d.y0})`);

  // Ajout des rectangles pour les nœuds avec stackbars
  node.each(function (d) {
    const nodeGroup = d3.select(this);
    const originalHeight =
      d.y1 !== undefined && d.y0 !== undefined ? d.y1 - d.y0 : 100;
    const nodeHeight = Math.max(2, originalHeight);

    // Centrer le nœud si sa hauteur a été forcée à 2px
    const nodeOffset =
      originalHeight < 2 ? (originalHeight - nodeHeight) / 2 : 0;

    // Stackbar (à gauche du nœud)
    nodeGroup
      .append('rect')
      .attr('x', 0)
      .attr('y', nodeOffset)
      .attr('height', nodeHeight)
      .attr('width', STACKBAR_WIDTH)
      .style('fill', '#e0e0e0')
      .style('opacity', 0.6);

    // Stackbars pour la dimension sélectionnée
    let yOffset = 0;
    const component = stackbarComponents[dimension];
    const dimensionValues = component ? component.getStackValues(d.lot) : {};
    const sum = Object.values(dimensionValues).reduce((a, b) => {
      const value = typeof b === 'object' && b !== null ? b.pourcentage : b;
      return a + value;
    }, 0);
    const sortedEntries = Object.entries(dimensionValues)
      .filter(([key]) => !key.startsWith('_'))
      .sort((a, b) => {
        const valueA =
          typeof a[1] === 'object' && a[1] !== null ? a[1].pourcentage : a[1];
        const valueB =
          typeof b[1] === 'object' && b[1] !== null ? b[1].pourcentage : b[1];
        return valueB - valueA;
      });

    // Si la stackbar est vide, afficher un fond dashed
    if (sortedEntries.length === 0) {
      nodeGroup
        .append('rect')
        .attr('x', 0)
        .attr('y', nodeOffset)
        .attr('height', nodeHeight)
        .attr('width', STACKBAR_WIDTH)
        .attr('rx', 4)
        .attr('ry', 4)
        .style('fill', 'url(#dashed-bg)')
        .style('stroke', '#bbb')
        .style('stroke-width', '1px')
        .style('opacity', 1);
    }

    createStackbarSegments(
      nodeGroup,
      sortedEntries,
      dimension,
      d,
      nodeHeight,
      STACKBAR_WIDTH,
      component,
      sum,
      dimensionValues
    );

    // Bloc à droite de la stackbar
    nodeGroup
      .append('rect')
      .attr('x', STACKBAR_WIDTH)
      .attr('y', nodeOffset)
      .attr('width', EXTRA_BLOCK_WIDTH)
      .attr('height', nodeHeight)
      .attr('rx', 4)
      .attr('ry', 4)
      .style('fill', 'rgba(204,204,204,0.6)') // gris clair, opacité 60%
      .style('stroke', 'rgba(204,204,204,1)') // bordure 100%
      .style('stroke-width', '1px')
      .style('opacity', 1)
      .on('mouseover', function (event) {
        const component = stackbarComponents[dimension];
        // Vérifier si c'est un nœud target
        if (d.isTarget) {
          tooltip.transition().duration(200).style('opacity', 0.95);
          tooltip
            .html(
              `
                        <strong>${d.name}</strong><br/>
                        <span style='font-size:12px;color:#666;'>Nœud destination</span>
                    `
            )
            .style('left', event.pageX + 10 + 'px')
            .style('top', event.pageY - 28 + 'px');
        } else {
          const dimensionValues = component
            ? component.getStackValues(d.lot)
            : {};
          const sumPct = Object.values(dimensionValues).reduce((a, b) => {
            const value =
              typeof b === 'object' && b !== null ? b.pourcentage : b;
            return a + value;
          }, 0);
          const missingPct = dimensionValues._missing || 0;
          let missingInfo = '';
          if (missingPct > 0.1) {
            missingInfo = `<br/><span style='font-size:12px;color:#c00;'>Donnée couleur manquante pour ${missingPct.toFixed(1)}%</span>`;
          }

          // Ajout des informations sur la target
          let targetInfo = '';
          if (d.lot && d.lot.target) {
            targetInfo = `
                            <br/>
                            <div style='margin-top:8px;padding-top:8px;border-top:1px solid #ddd;'>
                                <strong style='color:#4CAF50;'>✓ Destination validée</strong><br/>
                                <span style='font-size:12px;'>Target: ${d.lot.target}</span>
                            </div>
                        `;
          }

          // Déterminer le titre à afficher dans le tooltip
          let tooltipTitle = '';
          if (d.isTarget) {
            tooltipTitle = d.name;
          } else if (d.id === '0') {
            tooltipTitle = d.lot && d.lot.title ? d.lot.title : d.name;
          } else if (d.isCoproduct) {
            tooltipTitle = i18next.t('reste');
          } else {
            // Pour les nœuds de transformation, afficher le nom français de la transformation
            const incomingLink = sankeyLinks.find(l => l.target.id === d.id);
            if (incomingLink && incomingLink.transformation) {
              const transfo = incomingLink.transformation;
              const type = Array.isArray(transfo.type)
                ? transfo.type[0]
                : transfo.type;

              if (transfo.title) {
                tooltipTitle = transfo.title;
              } else {
                const frenchName = window.transformationUtils
                  ? window.transformationUtils.getTransformationLabel(type)
                  : type;
                tooltipTitle = frenchName;
              }

              // Ajouter les paramètres en français si disponibles
              if (transfo._displayNames && transfo._displayNames.length > 0) {
                tooltipTitle += ` : ${transfo._displayNames.join(', ')}`;
              } else if (transfo.keys && transfo.keys.length > 0) {
                // Fallback sur les keys si pas de displayNames
                tooltipTitle += ` : ${transfo.keys.join(', ')}`;
              }
            } else {
              tooltipTitle = d.lot && d.lot.title ? d.lot.title : d.name;
            }
          }

          tooltip.transition().duration(200).style('opacity', 0.95);
          // ===== TOOLTIP DE LA BARRE GRISE (NON-TRANSFO) =====
          // Retirer toutes les classes et appliquer narrow pour la largeur de 180px
          tooltip.classed('narrow', true);
          // Récupérer les données de la stackbar pour la dimension active
          const currentDimension = window.currentDimension;
          const stackbarComponent = stackbarComponents[currentDimension];
          const stackbarValues = stackbarComponent
            ? stackbarComponent.getStackValues(d.lot)
            : {};
          const sortedEntries = Object.entries(stackbarValues)
            .filter(([key]) => !key.startsWith('_'))
            .sort((a, b) => {
              const valueA =
                typeof a[1] === 'object' && a[1] !== null
                  ? a[1].pourcentage
                  : a[1];
              const valueB =
                typeof b[1] === 'object' && b[1] !== null
                  ? b[1].pourcentage
                  : b[1];
              return valueB - valueA;
            });

          // Générer les lignes de répartition
          let distributionRows = '';
          sortedEntries.forEach(([key, value]) => {
            const pourcentage =
              typeof value === 'object' && value !== null
                ? value.pourcentage
                : value;

            // Récupérer l'objet complet pour la traduction
            let fullObject = null;
            if (
              d.lot &&
              d.lot[currentDimension] &&
              d.lot[currentDimension][key]
            ) {
              fullObject = d.lot[currentDimension][key];
            }

            const translatedKey = getTitreAffiche(key, fullObject);
            distributionRows += `<tr><td class="tooltip-row"><span class="tooltip-label">${translatedKey}</span> <span class="tooltip-value">${pourcentage.toFixed(1)}%</span></td></tr>`;
          });

          tooltip
            .html(
              `
                        <strong>${tooltipTitle}</strong>
                        <table class="tooltip-table">
                          <tr><td class="tooltip-row"><span class="tooltip-label">${i18next.t('inputWeight')}</span> <span class="tooltip-value">${Math.round((d.transformations_appliquees && d.transformations_appliquees.length > 0 ? d.transformations_appliquees[d.transformations_appliquees.length - 1].entryLot?.total : null) || d.lot.total)} kg</span></td></tr>
                          ${distributionRows ? `<tr><td class="tooltip-row"><span class="tooltip-label">${i18next.t('distribution')}</span></td></tr>${distributionRows}<tr><td class="tooltip-row"></td></tr><tr><td class="tooltip-row"><span class="tooltip-label">${i18next.t('total')}</span> <span class="tooltip-value">${sumPct.toFixed(1)}%</span></td></tr>` : `<tr><td class="tooltip-row"><span class="tooltip-label">${i18next.t('total')}</span> <span class="tooltip-value">${sumPct.toFixed(1)}%</span></td></tr>`}
                        </table>
                        ${missingInfo}
                        ${targetInfo}
                    `
            )
            .style(
              'left',
              (() => {
                const tooltipWidth = 180; // Largeur fixe du tooltip narrow
                const windowWidth = window.innerWidth;

                // Utiliser la position du nœud plutôt que la souris
                const nodeLeft = d.x0;
                const stackbarWidth = 60; // Largeur de la stackbar

                // Détecter si c'est un nœud de droite (bout du Sankey)
                const isRightNode = d.x1 >= windowWidth - 100; // Marge de 100px

                if (isRightNode) {
                  // Pour les nœuds de droite, positionner à gauche du tooltip
                  return nodeLeft + stackbarWidth + 50 - 180 + 'px';
                } else {
                  // Pour les nœuds normaux, aligner après la stackbar
                  return nodeLeft + stackbarWidth + 20 + 'px';
                }
              })()
            )
            .style('top', event.pageY - 28 + 'px');
        }
      })
      .on('mouseout', function () {
        tooltip.transition().duration(500).style('opacity', 0);
      });

    // 1. Icônes pour les liens sortants (fork)
    const outgoingLinks = sankeyLinks.filter(
      l => l.source.id === d.id && !l.target.isCoproduct
    );
    if (!(d.lot && d.lot.target) && !d.isTarget) {
      outgoingLinks.forEach(link => {
        const linkY = link.y0 - d.y0;
        const fo = nodeGroup
          .append('foreignObject')
          .attr('x', STACKBAR_WIDTH + (EXTRA_BLOCK_WIDTH - 28) / 2)
          .attr('y', linkY - 14)
          .attr('width', 28)
          .attr('height', 28);
        const div = document.createElement('div');
        const isFork = !!link.transformation; // La transformation est sur le lien sortant

        // Déterminer l'icône selon la step de la transformation
        let iconName = 'plus';
        if (isFork && link.transformation) {
          const stepId = getTransformationStep(link.transformation);
          iconName = getStepIcon(stepId);
        }

        // Déterminer la couleur de fond selon si la transformation a une tech
        let bgColor = 'bg-gray-300 hover:bg-gray-400 border-gray-400';
        if (isFork && link.transformation && link.transformation.tech) {
          bgColor = 'bg-green-300 hover:bg-green-400 border-green-400';
        }

        div.className = `w-7 h-7 p-[3px] flex items-center justify-center rounded ${bgColor} border cursor-pointer`;
        div.innerHTML = getIconSVG(
          iconName,
          'w-7 h-7 text-[1.3rem] flex items-center justify-center'
        );
        fo.node().appendChild(div);

        // Mémoriser le bouton pour permettre un déclenchement via le libellé du nœud
        link.dropdownTrigger = div;

        // Dropdown menu state
        let dropdownMenu = null;
        let dropdownOpen = false;
        let closeDropdown = () => {
          if (dropdownMenu) {
            dropdownMenu.remove();
            dropdownMenu = null;
            dropdownOpen = false;
          }
          document.removeEventListener('mousedown', onClickOutside);
        };
        let onClickOutside = e => {
          if (
            dropdownMenu &&
            !dropdownMenu.contains(e.target) &&
            e.target !== div
          ) {
            closeDropdown();
          }
        };

        div.addEventListener('mouseover', function (event) {
          // ===== TOOLTIP DES ICÔNES DE TRANSFORMATION (TRANSFO) =====
          tooltip.transition().duration(200).style('opacity', 0.95);
          // Retirer toutes les classes pour avoir la largeur par défaut (280px)
          tooltip.classed('narrow', false);
          let tooltipContent = '';
          if (isFork && link.transformation) {
            // Utilise la transformation du lien sortant
            const transfo = link.transformation;
            const type = Array.isArray(transfo.type)
              ? transfo.type[0]
              : transfo.type;
            const label =
              transfo.title ||
              (window.transformationUtils
                ? window.transformationUtils.getTransformationLabel(type)
                : type);
            const typeLabel = window.transformationUtils
              ? window.transformationUtils.getTransformationLabel(type)
              : type;
            let tableRows = '';

            if (transfo.scenario) {
              console.log('📋 Tooltip - transfo.scenario:', transfo.scenario);
            }

            if (transfo._displayNames && transfo._displayNames.length > 0) {
              // Utiliser les noms d'affichage français
              tableRows += `<tr><td class="tooltip-row"><span class="tooltip-label">${i18next.t('keys')}</span> <span class="tooltip-value">${transfo._displayNames.join(', ')}</span></td></tr>`;
            } else if (transfo.keys && transfo.keys.length > 0) {
              // Fallback sur les keys si pas de displayNames
              tableRows += `<tr><td class="tooltip-row"><span class="tooltip-label">${i18next.t('keys')}</span> <span class="tooltip-value">${transfo.keys.join(', ')}</span></td></tr>`;
            }
            if (transfo.scenario && transfo.scenario.target) {
              tableRows += `<tr><td class="tooltip-row"><span class="tooltip-label">${i18next.t('target')}</span> <span class="tooltip-value">${transfo.scenario.target}</span></td></tr>`;
            }
            // Ajouter la step de la transformation (label localisé)
            const stepId = getTransformationStep(transfo);
            const stepLabel = getStepLabel(stepId);
            tableRows += `<tr><td class="tooltip-row"><span class="tooltip-label">${i18next.t('step')}</span> <span class="tooltip-value">${stepLabel}</span></td></tr>`;

            // Ajouter la rate (débit) de la transformation
            if (transfo.yield !== undefined) {
              tableRows += `<tr><td class="tooltip-row"><span class="tooltip-label">${i18next.t('yield')}</span> <span class="tooltip-value">${transfo.yield}%</span></td></tr>`;
            }

            // Ajouter le poids du lot d'entrée de la transformation (toujours affiché)
            // Utiliser directement la transformation depuis transformations_appliquees
            const poids = link.inputLot.total; // Utiliser le lot d'entrée de la transformation
            const poidsFormate = poids.toFixed(2);
            tableRows += `<tr><td class="tooltip-row"><span class="tooltip-label">${i18next.t('inputWeight')}</span> <span class="tooltip-value">${poidsFormate} kg</span></td></tr>`;
            // Ajouter les informations de la tech si elle existe
            if (transfo.tech) {
              tableRows += `<tr><td class="tooltip-row"><span class="tooltip-label">${i18next.t('tool')}</span> <span class="tooltip-value">${transfo.tech.name} (x${transfo.tech.quantity})</span></td></tr>`;

              // Ajouter la rate de la tech si elle existe
              if (transfo.tech.rate !== undefined) {
                tableRows += `<tr><td class="tooltip-row"><span class="tooltip-label">${i18next.t('rate')}</span> <span class="tooltip-value">${transfo.tech.rate} kg/h</span></td></tr>`;
              }

              // Utiliser les données de la tech enregistrées dans le scénario
              if (transfo.tech.details) {
                // Utiliser la fonction de calcul des coûts avec les données stockées
                const transformationWithVolume = {
                  ...transfo,
                  lot_input_volume: link.inputLot.total, // Utiliser le lot d'entrée du lien
                };

                const couts = calculateTransformationCosts(
                  transformationWithVolume,
                  transfo.tech.details,
                  window.teamData
                );

                if (couts) {
                  // Formater le temps utile
                  const heures = Math.floor(couts.temps_utile);
                  const minutes = Math.round((couts.temps_utile - heures) * 60);
                  let tempsFormate = '';
                  if (heures > 0) {
                    tempsFormate += `${heures}h`;
                  }
                  if (minutes > 0) {
                    tempsFormate += `${minutes}min`;
                  }
                  if (heures === 0 && minutes === 0) {
                    tempsFormate = '< 1min';
                  }

                  tableRows += `<tr><td class="tooltip-row"><span class="tooltip-label">${i18next.t('usefulTime')}</span> <span class="tooltip-value">${tempsFormate}</span></td></tr>`;

                  // Ajouter les profils RH
                  if (
                    transfo.tech.details.profils &&
                    window.teamData &&
                    window.teamData.profils
                  ) {
                    Object.entries(transfo.tech.details.profils).forEach(
                      ([profilName, profilData]) => {
                        const profilTempsUtile =
                          couts.temps_utile * profilData.timeh;

                        // Formater le temps du profil
                        const profilHeures = Math.floor(profilTempsUtile);
                        const profilMinutes = Math.round(
                          (profilTempsUtile - profilHeures) * 60
                        );
                        let profilTempsFormate = '';
                        if (profilHeures > 0) {
                          profilTempsFormate += `${profilHeures}h`;
                        }
                        if (profilMinutes > 0) {
                          profilTempsFormate += `${profilMinutes}min`;
                        }
                        if (profilHeures === 0 && profilMinutes === 0) {
                          profilTempsFormate = '< 1min';
                        }

                        // Calculer le prix avec le pricerate de la team
                        const teamProfilData =
                          window.teamData.profils[profilName];
                        if (teamProfilData) {
                          const prix =
                            teamProfilData.pricerate * profilTempsUtile;
                          const prixFormate = prix.toFixed(2);
                          tableRows += `<tr><td class="tooltip-row profile"><span class="tooltip-label">${profilName} :</span><br/><span class="tooltip-value">${profilTempsFormate}</span><br/><span class="tooltip-value">${prixFormate}€</span></td></tr>`;
                        }
                      }
                    );
                  }

                  // Ajouter la consommation électrique
                  if (couts.consommation_totale > 0) {
                    tableRows += `<tr><td class="tooltip-row"><span class="tooltip-label">${i18next.t('consumption')}</span> <span class="tooltip-value">${couts.consommation_totale.toFixed(4)} kWh (${couts.cout_energie.toFixed(2)}€)</span></td></tr>`;
                  }

                  // Ajouter le total
                  tableRows += `<tr><td class="tooltip-row total"><span class="tooltip-label">${i18next.t('total')}</span> <span class="tooltip-value">${couts.cout_total.toFixed(2)}€</span></td></tr>`;
                }
              } else {
                // Si pas de détails stockés, afficher un message
                tableRows += `<tr><td class="tooltip-row"><span class="tooltip-label">Détails :</span> <span class="tooltip-value">${i18next.t('detailsNotAvailable')}</span></td></tr>`;
              }
            }

            // Générer le tooltip initial (sera mis à jour par la promesse si nécessaire)
            tooltipContent = `<strong>${label}</strong>${tableRows ? '<table class="tooltip-table">' + tableRows + '</table>' : ''}`;
          } else {
            tooltipContent = '<strong>Ajouter une transformation</strong>';
          }
          tooltip
            .html(tooltipContent)
            .style(
              'left',
              (() => {
                const tooltipWidth = 180; // Largeur fixe du tooltip narrow
                const windowWidth = window.innerWidth;
                const mouseX = event.pageX;

                // Si le tooltip va déborder à droite, le positionner à gauche
                if (mouseX + 10 + tooltipWidth > windowWidth) {
                  return mouseX - tooltipWidth + 10 + 'px';
                } else {
                  return mouseX + 10 + 'px';
                }
              })()
            )
            .style('top', event.pageY - 28 + 'px');
        });
        div.addEventListener('mouseout', function () {
          tooltip.transition().duration(500).style('opacity', 0);
        });
        div.addEventListener('click', function (event) {
          event.stopPropagation();

          // Masquer le tooltip immédiatement quand on clique
          hideTooltip();

          if (!isFork) {
            console.log(
              '🔍 CLIC SIMPLE SUR LIEN - Appel direct de afficherPopupTransfo'
            );
            // Comportement + classique
            const chemin = `${d.name} → ${link.target.name}`;
            const ref = {
              nodeId: d.id,
              dimension: dimension,
              lot: {
                ...d.lot,
                transformations_appliquees: d.transformations_appliquees,
              },
              chemin: chemin,
              link: {
                ...link,
                target: {
                  ...link.target,
                  name: link.target.name.split('→')[0].trim(),
                },
              },
              transformation: link.transformation || null,
            };
            console.log(
              '🔍 window.afficherPopupTransfo exists:',
              typeof window.afficherPopupTransfo
            );
            if (window.afficherPopupTransfo) {
              console.log(
                '🔍 Calling window.afficherPopupTransfo with ref:',
                ref
              );
              window.afficherPopupTransfo(ref, 'add');
            } else {
              console.error('❌ window.afficherPopupTransfo not found!');
            }
            return;
          }
          // Vérifier si on est en mode éditable
          if (!window.isEditable) {
            console.log(
              '🔍 Mode lecture seule - dropdown transformation désactivé'
            );
            return;
          }

          // Toggle dropdown
          console.log('🔍 CRÉATION DROPDOWN - isFork:', isFork);
          if (dropdownOpen) {
            closeDropdown();
            return;
          }
          // Créer le menu dropdown
          dropdownMenu = document.createElement('div');
          dropdownMenu.className =
            'absolute z-50 mt-1 right-0 bg-white rounded-xl shadow-xl py-1 flex flex-col gap-0 border border-gray-200'; // min-w supprimé
          dropdownMenu.style.width = '170px'; // Largeur fixe, lisible, style shadcn/ui
          dropdownMenu.style.position = 'absolute';
          dropdownMenu.style.padding = '0';
          dropdownMenu.style.overflow = 'hidden'; // Empêche tout débordement
          const rect = div.getBoundingClientRect();
          dropdownMenu.style.top = rect.bottom + window.scrollY + 'px';
          dropdownMenu.style.left = rect.right - STACKBAR_WIDTH - 28 + 'px';
          // Génération dynamique du menu avec désactivation Monter/Descendre
          const isFirst = outgoingLinks.indexOf(link) === 0;
          const isLast =
            outgoingLinks.indexOf(link) === outgoingLinks.length - 1;
          dropdownMenu.innerHTML = `
            <button class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50" data-action="edit"><i class="ph ph-pencil-simple text-base align-middle mr-2"></i>${i18next.t('edit')}</button>
            <button class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50" data-action="tools"><i class="ph ph-gear text-base align-middle mr-2"></i>${i18next.t('tools')}</button>
            <button class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50" data-action="view"><i class="ph ph-eye text-base align-middle mr-2"></i>${i18next.t('viewLot')}</button>
            <button class="w-full text-left px-4 py-2 text-sm ${isFirst ? 'text-gray-400 cursor-not-allowed' : 'text-gray-700 hover:bg-blue-50'}" data-action="up" ${isFirst ? 'disabled' : ''}><i class="ph ph-arrow-up text-base align-middle mr-2"></i>${i18next.t('moveUp')}</button>
            <button class="w-full text-left px-4 py-2 text-sm ${isLast ? 'text-gray-400 cursor-not-allowed' : 'text-gray-700 hover:bg-blue-50'}" data-action="down" ${isLast ? 'disabled' : ''}><i class="ph ph-arrow-down text-base align-middle mr-2"></i>${i18next.t('moveDown')}</button>
            <button class="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-50" data-action="delete"><i class="ph ph-trash text-base align-middle mr-2"></i>${i18next.t('delete')}</button>
          `;
          // Appliquer le style inline sur chaque bouton
          dropdownMenu.querySelectorAll('.dropdown-btn').forEach(btn => {
            btn.style.display = 'flex';
            btn.style.alignItems = 'center';
            btn.style.justifyContent = 'flex-start';
            btn.style.gap = '0.7em';
            btn.style.width = '100%';
            btn.style.boxSizing = 'border-box';
            btn.style.background = 'none';
            btn.style.border = 'none';
            btn.style.outline = 'none';
            btn.style.fontSize = '1rem';
            btn.style.fontWeight = '500';
            btn.style.padding = '0.4em 0.8em'; // padding vertical réduit
            btn.style.borderRadius = '0.7em';
            btn.style.transition =
              'background 0.13s, color 0.13s, box-shadow 0.13s';
            btn.style.cursor = btn.disabled ? 'not-allowed' : 'pointer';
            btn.style.color = '#23272f';
            if (btn.dataset.action === 'delete') {
              btn.style.color = '#dc2626';
            }
            btn.onmouseover = function () {
              if (btn.disabled) return;
              if (btn.dataset.action === 'delete') {
                btn.style.background = '#fff1f2';
                btn.style.color = '#b91c1c';
              } else {
                btn.style.background = '#eaf3ff';
                btn.style.color = '#1d4ed8';
              }
            };
            btn.onmouseout = function () {
              btn.style.background = 'none';
              btn.style.color =
                btn.dataset.action === 'delete' ? '#dc2626' : '#23272f';
            };
            btn.onfocus = btn.onmouseover;
            btn.onblur = btn.onmouseout;
          });
          document.body.appendChild(dropdownMenu);
          dropdownOpen = true;
          // Handler pour Modifier
          dropdownMenu.querySelector('[data-action="edit"]').onclick =
            function (e) {
              console.log('✏️ EDIT HANDLER CALLED');
              e.stopPropagation();
              closeDropdown();

              // Trouver le _nodeId de la transformation à éditer
              let transformationNodeId =
                link.transformation && link.transformation._nodeId;

              if (!transformationNodeId) {
                // Fallback : chercher dans les transformations appliquées
                const lastTransfo =
                  d.transformations_appliquees &&
                  d.transformations_appliquees.length
                    ? d.transformations_appliquees[
                        d.transformations_appliquees.length - 1
                      ]
                    : null;

                if (lastTransfo && lastTransfo._nodeId) {
                  transformationNodeId = lastTransfo._nodeId;
                } else {
                  console.error(
                    'Impossible de trouver le _nodeId de la transformation à éditer'
                  );
                  return;
                }
              }

              console.log(
                '🔍 Édition de la transformation avec nodeId:',
                transformationNodeId
              );

              const chemin = `${d.name} → ${link.target.name}`;
              const ref = {
                nodeId: transformationNodeId, // Utiliser le _nodeId de la transformation, pas d.id
                dimension: dimension,
                lot: {
                  ...d.lot,
                  transformations_appliquees: d.transformations_appliquees,
                },
                chemin: chemin,
                link: {
                  ...link,
                  target: {
                    ...link.target,
                    name: link.target.name.split('→')[0].trim(),
                  },
                },
                transformation: link.transformation || null,
              };
              if (window.afficherPopupTransfo)
                window.afficherPopupTransfo(ref, 'edit');
            };
          // Handler pour Visualiser le lot
          dropdownMenu.querySelector('[data-action="view"]').onclick =
            function (e) {
              e.stopPropagation();
              closeDropdown();
              const lotJson = JSON.stringify(link.target.lot, null, 2);
              window.parent.postMessage(
                {
                  id: 'sankey-lot-visualization',
                  type: 'showLotDetails',
                  payload: {
                    nodeId: link.target.id,
                    nodeName: link.target.name,
                    lotData: lotJson,
                    timestamp: new Date().toISOString(),
                  },
                },
                '*'
              );
            };
          // Handler pour Effacer
          dropdownMenu.querySelector('[data-action="delete"]').onclick =
            function (e) {
              e.stopPropagation();
              closeDropdown();
              console.log('🗑️ BOUTON EFFACER CLICKED');

              // Trouver le scénario courant
              const scenarioIdx = window.currentScenarioIdx;
              const scenario = window.scenarios[scenarioIdx]?.scenario;

              if (!scenario) {
                alert('Scénario non trouvé.');
                return;
              }

              // Trouver le _nodeId de la transformation à supprimer
              let nodeId = link.transformation && link.transformation._nodeId;

              if (!nodeId) {
                // Fallback : chercher dans les transformations appliquées
                const lastTransfo =
                  d.transformations_appliquees &&
                  d.transformations_appliquees.length
                    ? d.transformations_appliquees[
                        d.transformations_appliquees.length - 1
                      ]
                    : null;

                if (lastTransfo && lastTransfo._nodeId) {
                  nodeId = lastTransfo._nodeId;
                } else {
                  alert(
                    'Impossible de retrouver la transformation à supprimer.'
                  );
                  return;
                }
              }

              console.log(
                '🔍 Suppression de la transformation avec nodeId:',
                nodeId
              );

              // Utiliser la nouvelle fonction de suppression
              const success = removeTransformationByNodeId(scenario, nodeId);

              if (!success) {
                alert('Erreur lors de la suppression de la transformation.');
                return;
              }

              // Publier le scénario après suppression
              publishScenario(scenario, 'SUPPRESSION TRANSFORMATION');

              // Relancer le Sankey
              const lot = window.lotType;
              const dimension = window.currentDimension;
              if (typeof runSankey === 'function' && lot && scenario) {
                runSankey({
                  lot,
                  scenario,
                  containerId: 'sankey-container',
                  dimension,
                });
              }

              // Activer le bouton Enregistrer
              if (typeof setScenarioModifie === 'function') {
                setScenarioModifie(true);
              }
            };
          // Handler pour Monter
          dropdownMenu.querySelector('[data-action="up"]').onclick = function (
            e
          ) {
            e.stopPropagation();
            closeDropdown();

            // Trouver le _nodeId de la transformation à déplacer
            let transformationNodeId =
              link.transformation && link.transformation._nodeId;

            if (!transformationNodeId) {
              // Fallback : chercher dans les transformations appliquées
              const lastTransfo =
                d.transformations_appliquees &&
                d.transformations_appliquees.length
                  ? d.transformations_appliquees[
                      d.transformations_appliquees.length - 1
                    ]
                  : null;

              if (lastTransfo && lastTransfo._nodeId) {
                transformationNodeId = lastTransfo._nodeId;
              } else {
                console.error(
                  'Impossible de trouver le _nodeId pour le déplacement vers le haut'
                );
                return;
              }
            }

            console.log(
              '🔍 Déplacement vers le haut avec nodeId:',
              transformationNodeId
            );

            if (typeof window.onTransformationMoveUp === 'function') {
              window.onTransformationMoveUp(d.id, {
                _nodeId: transformationNodeId,
              });
            }
          };
          // Handler pour Descendre
          dropdownMenu.querySelector('[data-action="down"]').onclick =
            function (e) {
              e.stopPropagation();
              closeDropdown();

              // Trouver le _nodeId de la transformation à déplacer
              let transformationNodeId =
                link.transformation && link.transformation._nodeId;

              if (!transformationNodeId) {
                // Fallback : chercher dans les transformations appliquées
                const lastTransfo =
                  d.transformations_appliquees &&
                  d.transformations_appliquees.length
                    ? d.transformations_appliquees[
                        d.transformations_appliquees.length - 1
                      ]
                    : null;

                if (lastTransfo && lastTransfo._nodeId) {
                  transformationNodeId = lastTransfo._nodeId;
                } else {
                  console.error(
                    'Impossible de trouver le _nodeId pour le déplacement vers le bas'
                  );
                  return;
                }
              }

              console.log(
                '🔍 Déplacement vers le bas avec nodeId:',
                transformationNodeId
              );

              if (typeof window.onTransformationMoveDown === 'function') {
                window.onTransformationMoveDown(d.id, {
                  _nodeId: transformationNodeId,
                });
              }
            };
          // Handler pour Outils
          dropdownMenu.querySelector('[data-action="tools"]').onclick =
            function (e) {
              e.stopPropagation();
              closeDropdown();
              // Ouvrir la popup "transfo tech"
              showTransfoTechPopup(d.id, link.transformation);
            };
          // Fermer si on clique ailleurs
          setTimeout(() => {
            document.addEventListener('mousedown', onClickOutside);
          }, 0);
        });
      });
    }

    // 2. Icône + sur le lien "Reste" (coproduit)
    const resteLinks = sankeyLinks.filter(
      l => l.source.id === d.id && l.target.isCoproduct
    );
    resteLinks.forEach(link => {
      const linkY = link.y0 - d.y0;
      const fo = nodeGroup
        .append('foreignObject')
        .attr('x', STACKBAR_WIDTH + (EXTRA_BLOCK_WIDTH - 28) / 2)
        .attr('y', linkY - 14)
        .attr('width', 28)
        .attr('height', 28);
      const div = document.createElement('div');
      div.className =
        'w-7 h-7 p-[3px] flex items-center justify-center rounded bg-gray-300 hover:bg-gray-400 border border-gray-400 cursor-pointer';
      div.innerHTML = getIconSVG(
        'plus',
        'w-7 h-7 text-[1.3rem] flex items-center justify-center'
      );
      fo.node().appendChild(div);

      // Conditionner la position et les comportements
      if (window.isEditable) {
        // Mode éditable : bouton visible et fonctionnel
      } else {
        // Mode lecture seule : positionner le bouton hors de l'écran
        fo.attr('x', -1000).attr('y', -1000);
      }

      // Vérifier si on est en mode éditable avant de créer le dropdown
      if (window.isEditable) {
        // Utiliser la fonction utilitaire pour créer le dropdown
        const dropdownOptions = [
          {
            icon: 'plus',
            label: i18next.t('addTransfo'),
            onClick: () => {
              console.log(
                '🔍 BOUTON + NŒUD CLICKED - Node:',
                d.name,
                'NodeId:',
                d.id,
                'isCoproduct:',
                d.isCoproduct
              );
              // Vérifier si c'est un coproduit
              if (d.isCoproduct) {
                console.log('🔍 → Appel handleAddCoproductTransformationClick');
                handleAddCoproductTransformationClick(d);
              } else {
                console.log('🔍 → Appel handleAddTransformationClick');
                handleAddTransformationClick(d);
              }
            },
          },
          {
            icon: 'eye',
            label: i18next.t('viewLot'),
            onClick: () => {
              // Utiliser le lot du nœud qui représente le lot après toutes les transformations
              const lotToShow = d.lot;
              const lotJson = JSON.stringify(lotToShow, null, 2);
              window.parent.postMessage(
                {
                  id: 'sankey-lot-visualization',
                  type: 'showLotDetails',
                  payload: {
                    nodeId: d.id,
                    nodeName: d.name,
                    lotData: lotJson,
                  },
                },
                '*'
              );
            },
          },
          {
            icon: 'sign-out',
            label: i18next.t('link'),
            disabled: true,
          },
        ];

        // Utiliser le même positionnement que les icônes de transformation
        div.addEventListener('click', createDropdown(div, dropdownOptions, 1));
      } else {
        // En mode lecture seule, on peut toujours voir le lot
        div.addEventListener('click', () => {
          const lotToShow = d.lot;
          const lotJson = JSON.stringify(lotToShow, null, 2);
          window.parent.postMessage(
            {
              id: 'sankey-lot-visualization',
              type: 'showLotDetails',
              payload: {
                nodeId: d.id,
                nodeName: d.name,
                lotData: lotJson,
              },
            },
            '*'
          );
        });
      }
    });

    // 3. Icône + sur les nœuds feuilles sans target (aucun lien sortant)
    const hasOutgoing = sankeyLinks.some(l => l.source.id === d.id);
    if (!hasOutgoing && !(d.lot && d.lot.target) && !d.isTarget) {
      const yPlus = nodeHeight / 2 - 14;
      const fo = nodeGroup
        .append('foreignObject')
        .attr('x', STACKBAR_WIDTH + (EXTRA_BLOCK_WIDTH - 28) / 2)
        .attr('y', yPlus)
        .attr('width', 28)
        .attr('height', 28);
      const div = document.createElement('div');
      div.className =
        'w-7 h-7 p-[3px] flex items-center justify-center rounded bg-gray-300 hover:bg-gray-400 border border-gray-400 cursor-pointer';
      div.innerHTML = getIconSVG(
        'plus',
        'w-7 h-7 text-[1.3rem] flex items-center justify-center'
      );
      fo.node().appendChild(div);

      // Conditionner la position et les comportements
      if (window.isEditable) {
        // Mode éditable : bouton visible et fonctionnel
      } else {
        // Mode lecture seule : positionner le bouton hors de l'écran
        fo.attr('x', -1000).attr('y', -1000);
      }

      // Vérifier si on est en mode éditable avant de créer le dropdown
      if (window.isEditable) {
        // Utiliser la fonction utilitaire pour créer le dropdown
        const dropdownOptions = [
          {
            icon: 'plus',
            label: i18next.t('addTransfo'),
            onClick: () => {
              console.log(
                '🔍 BOUTON + NŒUD CLICKED - Node:',
                d.name,
                'NodeId:',
                d.id,
                'isCoproduct:',
                d.isCoproduct
              );
              // Vérifier si c'est un coproduit
              if (d.isCoproduct) {
                console.log('🔍 → Appel handleAddCoproductTransformationClick');
                handleAddCoproductTransformationClick(d);
              } else {
                console.log('🔍 → Appel handleAddTransformationClick');
                handleAddTransformationClick(d);
              }
            },
          },
          {
            icon: 'eye',
            label: i18next.t('viewLot'),
            onClick: () => {
              // Utiliser le lot du nœud qui représente le lot après toutes les transformations
              const lotToShow = d.lot;
              const lotJson = JSON.stringify(lotToShow, null, 2);
              window.parent.postMessage(
                {
                  id: 'sankey-lot-visualization',
                  type: 'showLotDetails',
                  payload: {
                    nodeId: d.id,
                    nodeName: d.name,
                    lotData: lotJson,
                  },
                },
                '*'
              );
            },
          },
          {
            icon: 'sign-out',
            label: i18next.t('link'),
            disabled: true,
          },
        ];

        // Utiliser le même positionnement que les icônes de transformation
        div.addEventListener('click', createDropdown(div, dropdownOptions, 1));
      } else {
        // En mode lecture seule, on peut toujours voir le lot
        div.addEventListener('click', () => {
          const lotToShow = d.lot;
          const lotJson = JSON.stringify(lotToShow, null, 2);
          window.parent.postMessage(
            {
              id: 'sankey-lot-visualization',
              type: 'showLotDetails',
              payload: {
                nodeId: d.id,
                nodeName: d.name,
                lotData: lotJson,
              },
            },
            '*'
          );
        });
      }
    }

    // 4. Icône check sur les nœuds valorisés ou agglomérés (isTarget)
    if ((d.lot && d.lot.target) || d.isTarget) {
      const yCheck = nodeHeight / 2 - 14;
      const fo = nodeGroup
        .append('foreignObject')
        .attr('x', STACKBAR_WIDTH + (EXTRA_BLOCK_WIDTH - 28) / 2)
        .attr('y', yCheck)
        .attr('width', 28)
        .attr('height', 28);
      const div = document.createElement('div');
      div.className =
        'w-7 h-7 p-[3px] flex items-center justify-center rounded bg-green-100 hover:bg-green-200 border border-green-400 cursor-pointer';
      div.innerHTML = getIconSVG(
        'check-circle',
        'w-7 h-7 text-[1.3rem] flex items-center justify-center text-green-600'
      );
      fo.node().appendChild(div);
      div.addEventListener('mouseover', function (event) {
        // ===== TOOLTIP DES NŒUDS TARGET (NON-TRANSFO) =====
        tooltip.transition().duration(200).style('opacity', 0.95);
        // Retirer toutes les classes et appliquer narrow pour la largeur de 180px
        tooltip.classed('narrow', true);
        // Tooltip riche comme avant
        let distributionHtml = '';
        const component = stackbarComponents[dimension];
        if (component && d.lot) {
          const dist = component.getStackValues(d.lot);
          const sum = Object.values(dist).reduce((a, b) => a + b, 0);
          if (Object.keys(dist).length > 0 && sum > 0) {
            distributionHtml += `<div style='margin-top:8px;padding-top:8px;border-top:1px solid #ddd;'><strong>Distribution ${dimension} :</strong><br/>`;
            Object.entries(dist)
              .filter(([key]) => !key.startsWith('_'))
              .sort((a, b) => b[1] - a[1])
              .forEach(([key, value]) => {
                const poids = d.lot.total
                  ? Math.round((d.lot.total * value) / 100)
                  : 0;
                distributionHtml += `${key} : ${value.toFixed(1)}% (${poids} kg)<br/>`;
              });
            distributionHtml += '</div>';
          }
        }
        tooltip
          .html(
            `
                        <strong>Destination validée</strong><br/>
                        Target: ${d.lot && d.lot.target ? d.lot.target : d.name}<br/>
                        <span style='font-size:12px;color:#666;'>Poids du lot: ${d.lot ? Math.round(d.lot.total) : ''} kg</span>
                        ${distributionHtml}
                    `
          )
          .style(
            'left',
            (() => {
              const tooltipWidth = 180; // Largeur fixe du tooltip narrow
              const windowWidth = window.innerWidth;
              const mouseX = event.pageX;

              // Si le tooltip va déborder à droite, le positionner à gauche
              if (mouseX + 10 + tooltipWidth > windowWidth) {
                return mouseX - tooltipWidth + 10 + 'px';
              } else {
                return mouseX + 10 + 'px';
              }
            })()
          )
          .style('top', event.pageY - 28 + 'px');
      });
      div.addEventListener('mouseout', function () {
        tooltip.transition().duration(500).style('opacity', 0);
      });
    }
  });

  // Ajout d'un calque dédié pour les titres, après tous les nœuds
  svg.selectAll('.titles-layer').remove();
  const titlesLayer = svg.append('g').attr('class', 'titles-layer');
  sankeyNodes.forEach(d => {
    // Exclure le premier nœud (id === '0')
    if (d.id === '0') return;

    // Déterminer le titre à afficher
    let displayTitle = '';
    let incomingLink = null;

    if (d.isTarget) {
      // Pour les nœuds target, afficher le nom du target
      displayTitle = d.name;
    } else if (d.isCoproduct) {
      // Pour les nœuds co-produits (reste), afficher "Reste" traduit
      displayTitle = i18next.t('reste');
    } else {
      // Pour les autres nœuds, afficher le nom de la transformation en français
      // Chercher la transformation qui a créé ce nœud
      incomingLink = sankeyLinks.find(l => l.target.id === d.id);
      if (incomingLink && incomingLink.transformation) {
        const transfo = incomingLink.transformation;
        const type = Array.isArray(transfo.type)
          ? transfo.type[0]
          : transfo.type;

        // Utiliser le titre de la transformation s'il existe
        if (transfo.title) {
          displayTitle = transfo.title;
        } else {
          // Sinon utiliser le nom français de la transformation
          const frenchName = window.transformationUtils
            ? window.transformationUtils.getTransformationLabel(type)
            : type;
          displayTitle = frenchName;
        }
      } else {
        // Fallback sur le nom du lot
        displayTitle = d.lot && d.lot.title ? d.lot.title : d.name;
      }
    }

    // Diviser le texte en lignes de max 20 caractères
    const words = displayTitle.split(' ');
    const lines = [];
    let currentLine = '';

    for (const word of words) {
      if ((currentLine + ' ' + word).length <= 20) {
        currentLine = currentLine ? currentLine + ' ' + word : word;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) lines.push(currentLine);

    const textElement = titlesLayer
      .append('text')
      .attr('class', 'lot-title')
      .attr('x', d.x0 - 10)
      .attr('y', (d.y0 + d.y1) / 2 - (lines.length - 1) * 6)
      .attr('text-anchor', 'end')
      .attr('dominant-baseline', 'middle')
      .style('font-size', '11px')
      .style('fill', '#666')
      .style(
        'pointer-events',
        incomingLink && incomingLink.transformation ? 'auto' : 'none'
      )
      .style(
        'cursor',
        incomingLink && incomingLink.transformation ? 'pointer' : 'default'
      )
      .on('click', function () {
        if (!incomingLink || !incomingLink.dropdownTrigger) {
          return;
        }
        incomingLink.dropdownTrigger.dispatchEvent(
          new MouseEvent('click', { bubbles: true, cancelable: true })
        );
      });

    lines.forEach((line, index) => {
      textElement
        .append('tspan')
        .attr('x', d.x0 - 10)
        .attr('dy', index === 0 ? 0 : '1.2em')
        .text(line);
    });
  });

  // Calculer et afficher les coûts totaux
  if (window.teamData) {
    const costsData = calculateCosts(nodes, links);
    displayCostsTable(costsData);
  }

  // Demander un redimensionnement via la fonction commune exposée par index.html
  setTimeout(() => {
    if (window._resizeIframe && typeof window._resizeIframe === 'function') {
      window._resizeIframe();
    }
  }, 50);
}

// Gestion du changement de dimension
// SUPPRIMÉ: document.getElementById('dimension-selector').addEventListener('change', function(e) {
//     updateSankey(e.target.value);
// });

// Initialisation avec la première dimension
// SUPPRIMÉ: document.getElementById('dimension-selector').value = 'format';

// Gestion du redimensionnement
window.addEventListener('resize', function () {
  width = window.innerWidth - margin.left - margin.right;
  // Ne pas recalculer height depuis le container, elle sera recalculée dans updateSankey
  updateSankey(window.currentDimension);
});

// Fonction principale pour lancer le Sankey depuis le HTML
function runSankey({ lot, scenario, dimension = 'format' }) {
  // Stocker le lot globalement pour les callbacks
  window.lotType = lot;

  // Migrer le scénario s'il n'a pas encore été migré (ajouter _nodeId, supprimer _path)
  if (scenario && !scenario._migrated) {
    console.log('Migration du scénario...');
    migrateExistingScenario(scenario);
    scenario._migrated = true;

    // Valider la structure après migration
    const validation = validateScenarioStructure(scenario);
    if (!validation.isValid) {
      console.warn('Erreurs de validation après migration:', validation.errors);
    } else {
      console.log(
        `Scénario migré avec succès: ${validation.nodeIdCount} transformations`
      );
    }
  }

  // Appliquer le scénario au lot
  const sankeyScenario = applyScenario(lot, scenario);

  // Stocker dans le global pour compatibilité temporaire
  window.sankeyScenario = sankeyScenario;

  // Vérifier et mettre à jour les versions des techs si la team est chargée
  // Ne le faire qu'une seule fois pour éviter les boucles
  if (
    window.teamData &&
    window.checkAndUpdateTechVersionsGlobal &&
    !window._techVersionsCheckInProgress &&
    !window._techVersionsChecked
  ) {
    window._techVersionsCheckInProgress = true;

    // Afficher notification de mise à jour
    const updatingNotification = showNotification(
      i18next.t('updatingTechs'),
      5000
    );

    // Effectuer la vérification de manière asynchrone
    checkAndUpdateTechVersionsGlobal()
      .then(result => {
        window._techVersionsCheckInProgress = false;
        window._techVersionsChecked = true;

        // Fermer la notification de mise à jour
        if (updatingNotification && updatingNotification.parentNode) {
          updatingNotification.style.opacity = '0';
          updatingNotification.style.transform = 'translateX(100%)';
          setTimeout(() => {
            if (updatingNotification.parentNode) {
              updatingNotification.parentNode.removeChild(updatingNotification);
            }
          }, 300);
        }

        if (result.hasUpdates) {
          // Afficher notification de succès
          showNotification(
            `${i18next.t('techsUpdated')} (${result.updatedCount})`,
            3000
          );

          // Relancer le Sankey pour afficher les mises à jour
          setTimeout(() => {
            const updatedSankeyScenario = applyScenario(lot, scenario);
            window.sankeyScenario = updatedSankeyScenario;
            if (typeof updateSankey === 'function') {
              updateSankey(dimension);
            }
          }, 500);
        } else {
          // Techs déjà à jour, pas besoin de notification
        }
      })
      .catch(error => {
        window._techVersionsCheckInProgress = false;
        window._techVersionsChecked = true;

        console.error('Erreur lors de la vérification des versions:', error);
        // Afficher notification d'erreur
        showNotification(i18next.t('errorUpdatingTechs'), 3000);

        // Fermer la notification de mise à jour
        if (updatingNotification && updatingNotification.parentNode) {
          updatingNotification.style.opacity = '0';
          updatingNotification.style.transform = 'translateX(100%)';
          setTimeout(() => {
            if (updatingNotification.parentNode) {
              updatingNotification.parentNode.removeChild(updatingNotification);
            }
          }, 300);
        }
      });
  }

  // Mettre à jour le Sankey (même si la vérification est en cours)
  if (typeof updateSankey === 'function') {
    updateSankey(dimension);
  } else {
    console.error('updateSankey non défini');
  }
}

// Callback global pour la sauvegarde des transformations
window.onTransformationSave = (nodeId, transformation) => {
  console.log('onTransformationSave called:', { nodeId, transformation });

  // Trouver le scénario courant
  const scenarioIdx = window.currentScenarioIdx;
  const scenario = window.scenarios[scenarioIdx]?.scenario;
  if (!scenario) {
    console.error('No scenario found');
    return;
  }

  // Trouver le nœud et mettre à jour sa transformation
  let path = null;
  let index = null;

  // Parcourir les transformations pour trouver le bon nœud
  const findTransformation = (
    transformations,
    currentPath = ['main', 'transformations']
  ) => {
    if (!transformations) return false;
    for (let i = 0; i < transformations.length; i++) {
      const t = transformations[i];

      // Si on trouve le nœud, on met à jour la transformation
      if (t._nodeId === nodeId) {
        path = currentPath;
        index = i;
        return true;
      }

      // Sinon on cherche dans les sous-scénarios
      if (t.scenario?.transformations) {
        if (
          findTransformation(t.scenario.transformations, [
            ...currentPath,
            i,
            'scenario',
            'transformations',
          ])
        ) {
          return true;
        }
      }

      // Chercher aussi dans les coproducts des sous-scénarios
      if (t.scenario?.coproduct_scenario?.transformations) {
        if (
          findTransformation(t.scenario.coproduct_scenario.transformations, [
            ...currentPath,
            i,
            'scenario',
            'coproduct_scenario',
            'transformations',
          ])
        ) {
          return true;
        }
      }
    }
    return false;
  };

  // Chercher d'abord dans les transformations principales
  if (
    findTransformation(
      scenario.main?.transformations || scenario.transformations
    )
  ) {
    // Transformation trouvée dans les transformations principales
  } else {
    // Chercher dans les coproducts du scénario racine
    findTransformation(scenario.coproduct_scenario?.transformations || [], [
      'coproduct_scenario',
      'transformations',
    ]);
  }

  console.log('Found path and index:', { path, index });

  if (path && typeof index === 'number') {
    // Mettre à jour la transformation en gardant les métadonnées
    window.updateTransformation(scenario, path, index, {
      ...transformation,
    });

    // Relancer le Sankey
    const lot = window.lotType;
    const dimension = window.currentDimension;
    if (typeof runSankey === 'function' && lot && scenario) {
      runSankey({ lot, scenario, containerId: 'sankey-container', dimension });
    }

    // Activer le bouton Enregistrer
    if (typeof setScenarioModifie === 'function') {
      setScenarioModifie(true);
    }
  } else {
    console.error('Could not find transformation to update');
  }
};

// Callback global pour l'ajout de transformations
window.onTransformationAdd = (nodeId, transformation) => {
  console.log('onTransformationAdd called:', { nodeId, transformation });

  // Vérifier que window.scenarios existe
  if (!window.scenarios) {
    console.error('window.scenarios is not defined');
    return;
  }

  // Trouver le scénario courant
  const scenarioIdx = window.currentScenarioIdx;
  const scenario = window.scenarios[scenarioIdx]?.scenario;
  console.log('Found scenario:', { scenarioIdx, scenario: !!scenario });
  if (!scenario) {
    console.error('No scenario found');
    return;
  }

  // Utiliser le path fourni dans la transformation ou le path par défaut
  const path = transformation._path || ['transformations'];
  console.log('Using path:', path);

  // Ajouter la transformation
  console.log('Calling addTransformation...');
  window.addTransformation(scenario, path, {
    ...transformation,
  });

  // Relancer le Sankey
  const lot = window.lotType;
  const dimension = window.currentDimension;

  if (typeof runSankey === 'function' && lot && scenario) {
    console.log('Calling runSankey...');
    runSankey({ lot, scenario, containerId: 'sankey-container', dimension });
  } else {
    console.error('Cannot reload Sankey:', {
      hasRunSankey: typeof runSankey === 'function',
      hasLot: !!lot,
      hasScenario: !!scenario,
    });
  }

  // Activer le bouton Enregistrer
  if (typeof setScenarioModifie === 'function') {
    setScenarioModifie(true);
  }
};

// Expose addTransformation sur window si ce n'est pas déjà fait
window.addTransformation = function (scenario, path, transformation) {
  console.log('addTransformation called with:', {
    scenario,
    path,
    transformation,
  });
  console.log('Scenario before adding:', JSON.stringify(scenario, null, 2));

  // Naviguer jusqu'au bon tableau de transformations
  let arr = scenario;
  for (let i = 0; i < path.length; i++) {
    const key = path[i];
    if (Array.isArray(arr)) {
      arr = arr[key];
    } else if (arr && typeof arr === 'object') {
      if (!(key in arr)) arr[key] = key === 'transformations' ? [] : {};
      arr = arr[key];
    }
  }
  if (Array.isArray(arr)) {
    arr.push(transformation);
  } else {
    console.error(
      "Impossible d'ajouter la transformation, chemin invalide",
      path
    );
  }
};

// Callback global pour monter une transformation
window.onTransformationMoveUp = (nodeId, transformation) => {
  console.log('⬆️ onTransformationMoveUp called:', { nodeId, transformation });

  // Vérifier que window.scenarios existe
  if (!window.scenarios) {
    console.error('window.scenarios is not defined');
    return;
  }

  // Trouver le scénario courant
  const scenarioIdx = window.currentScenarioIdx;
  const scenario = window.scenarios[scenarioIdx]?.scenario;
  if (!scenario) {
    console.error('No scenario found');
    return;
  }

  // Trouver le _nodeId de la transformation à déplacer
  let transformationNodeId = transformation && transformation._nodeId;

  console.log('🔍 Debug transformation object:', {
    transformation,
    hasNodeId: !!transformationNodeId,
    transformationKeys: transformation
      ? Object.keys(transformation)
      : 'no transformation',
  });

  if (!transformationNodeId) {
    console.error('NodeId manquant pour le déplacement vers le haut');
    console.error('Objet transformation reçu:', transformation);
    return;
  }

  console.log(
    '🔍 Déplacement vers le haut de la transformation avec nodeId:',
    transformationNodeId
  );

  // Utiliser la nouvelle fonction de déplacement
  const success = moveTransformationUpByNodeId(scenario, transformationNodeId);

  if (!success) {
    console.error('Erreur lors du déplacement vers le haut');
    return;
  }

  // Publier le scénario après déplacement vers le haut
  publishScenario(scenario, 'DÉPLACEMENT VERS LE HAUT');

  // Relancer le Sankey
  const lot = window.lotType;
  const dimension = window.currentDimension;
  if (typeof runSankey === 'function' && lot && scenario) {
    runSankey({ lot, scenario, containerId: 'sankey-container', dimension });
  }

  // Activer le bouton Enregistrer
  if (typeof setScenarioModifie === 'function') {
    setScenarioModifie(true);
  }
};

// Callback global pour descendre une transformation
window.onTransformationMoveDown = (nodeId, transformation) => {
  console.log('⬇️ onTransformationMoveDown called:', {
    nodeId,
    transformation,
  });

  // Vérifier que window.scenarios existe
  if (!window.scenarios) {
    console.error('window.scenarios is not defined');
    return;
  }

  // Trouver le scénario courant
  const scenarioIdx = window.currentScenarioIdx;
  const scenario = window.scenarios[scenarioIdx]?.scenario;
  if (!scenario) {
    console.error('No scenario found');
    return;
  }

  // Trouver le _nodeId de la transformation à déplacer
  let transformationNodeId = transformation && transformation._nodeId;

  if (!transformationNodeId) {
    console.error('NodeId manquant pour le déplacement vers le bas');
    return;
  }

  console.log(
    '🔍 Déplacement vers le bas de la transformation avec nodeId:',
    transformationNodeId
  );

  // Utiliser la nouvelle fonction de déplacement
  const success = moveTransformationDownByNodeId(
    scenario,
    transformationNodeId
  );

  if (!success) {
    console.error('Erreur lors du déplacement vers le bas');
    return;
  }

  // Publier le scénario après déplacement vers le bas
  publishScenario(scenario, 'DÉPLACEMENT VERS LE BAS');

  // Relancer le Sankey
  const lot = window.lotType;
  const dimension = window.currentDimension;
  if (typeof runSankey === 'function' && lot && scenario) {
    runSankey({ lot, scenario, containerId: 'sankey-container', dimension });
  }

  // Activer le bouton Enregistrer
  if (typeof setScenarioModifie === 'function') {
    setScenarioModifie(true);
  }
};

// Initialisation automatique quand le DOM est prêt
document.addEventListener('DOMContentLoaded', function () {
  initializeFromUrl();
  // Attendre que les données de la team soient chargées avant de continuer
  loadTeamData()
    .then(() => {
      console.log('Données de la team chargées, lancement du Sankey');
    })
    .catch(error => {
      console.error('Erreur lors du chargement de la team:', error);
    });
});

// Écouter les changements d'URL pour recharger le Sankey
window.addEventListener('popstate', function () {
  initializeFromUrl();
});

function applyScenario(
  lot,
  scenario,
  parentNodeId = '0',
  nodes = null,
  links = null,
  idGenObj = null,
  isRoot = true,
  transformations_appliquees = [],
  depth = 0,
  pathNum = '1',
  pathArr = ['transformations']
) {
  if (!nodes) {
    const lotInit = JSON.parse(JSON.stringify(lot));
    lotInit.titre = 'lot Type';
    nodes = [
      {
        id: parentNodeId,
        name: 'Lot initial',
        lot: lotInit,
        transformations_appliquees: [],
        _path: ['transformations'],
      },
    ];
  }
  if (!links) links = [];
  if (!idGenObj) idGenObj = { id: 1 };

  let resteLot = JSON.parse(JSON.stringify(lot));
  const parentTotal = lot.total;
  let totalChildren = 0;

  (scenario.main?.transformations || scenario.transformations || []).forEach(
    (transfo, idx) => {
      // 🔑 CLÉ : Sauvegarder le lot d'entrée AVANT d'appliquer la transformation
      const entryLotForThisTransfo = JSON.parse(JSON.stringify(resteLot));

      let result;
      // Support nouvelle structure : type et keys sont des tableaux
      const type = Array.isArray(transfo.type) ? transfo.type[0] : transfo.type;
      const keys = transfo.keys || [];

      // --- Marquage de l'index sur la transformation ---
      if (typeof transfo._index !== 'number') transfo._index = idx;

      if (type === 'selectByFormat') {
        result = window.processes['selectByFormat'](resteLot, keys || []);
      } else if (type === 'selectByType') {
        result = window.processes['selectByType'](resteLot, keys || []);
      } else if (type === 'selectByMatiere') {
        result = window.processes['selectByMatiere'](resteLot, keys || []);
      } else if (type === 'selectByQualite') {
        result = window.processes['selectByQualite'](resteLot, keys || []);
      } else if (type === 'selectByCouleur') {
        result = window.processes['selectByCouleur'](resteLot, keys || []);
      } else if (type === 'selectByFibre') {
        if ('threshold' in transfo && 'condition' in transfo) {
          result = window.processes['selectByFibre'](
            resteLot,
            keys || [],
            transfo.threshold,
            transfo.condition
          );
        } else {
          result = window.processes['selectByFibre'](resteLot, keys || []);
        }
      } else if (type === 'selectByProprete') {
        result = window.processes['selectByProprete'](resteLot, keys || []);
      } else if (type === 'selectByPerturbateur') {
        result = window.processes['selectByPerturbateur'](resteLot, keys || []);
      } else if (type === 'dynamic_transfo') {
        // Gestion des transformations dynamiques (format .md)
        try {
          // Extraire l'ID de la transformation depuis la transformation
          const bubbleId = transfo.dynamic_transfo_id;

          // Récupérer les détails de la transformation depuis le cache (synchrone)
          console.log('Recherche de la transformation dynamique:', bubbleId);
          console.log('Cache des transformations:', window.transformationUtils);
          console.log(
            'Cache dynamicTransfosCache:',
            window.dynamicTransfosCache
          );

          const transfoDetails =
            window.transformationUtils.getDynamicTransfoDetailsSync(bubbleId);
          console.log('Détails de la transformation trouvés:', transfoDetails);

          if (!transfoDetails) {
            console.error(
              'Cache vide ou transformation non trouvée. Tentative de chargement...'
            );
            throw new Error(
              `Transformation dynamique non trouvée: ${bubbleId}`
            );
          }

          // Mettre à jour la version si nécessaire
          if (transfoDetails.version > (transfo.dynamic_transfo_version || 0)) {
            transfo.dynamic_transfo_version = transfoDetails.version;
          }

          // ← NOUVEAU : Ajouter le titre et la step de la transformation
          const params = getUrlParams();
          const lang = params.lang || 'fr_fr';
          const dynamicTitle =
            lang === 'en_gb' && transfoDetails?.en_gb
              ? transfoDetails.en_gb
              : transfoDetails.title;
          transfo.title = dynamicTitle || 'Transformation dynamique';
          if (transfoDetails.step) {
            transfo.step = transfoDetails.step; // garantit l'icône correcte
          } else if (!transfo.step) {
            console.warn(
              '[Sankey] Dynamic transfo details without step, fallback to sorting',
              transfoDetails
            );
            transfo.step = 'sorting';
          }

          // Précharger les couleurs pour cette transformation dynamique
          if (window.preloadColorsForTransfo) {
            window.preloadColorsForTransfo(transfoDetails).catch(console.warn);
          }

          // Appeler la fonction de transformation dynamique (synchrone)
          result = window.processes['executeDynamicTransfo'](
            resteLot,
            transfoDetails
          );
        } catch (error) {
          console.error(
            "Erreur lors de l'exécution de la transformation dynamique:",
            error
          );
          // Fallback : créer un lot vide en cas d'erreur
          result = {
            targetLot: {
              ...resteLot,
              total: 0,
              formats: {},
              types: {},
              matieres: {},
              fibres: {},
              couleurs: {},
              perturbateurs: {},
              proprete: {},
              qualite: {},
            },
            coProductLot: resteLot,
          };
        }
      } else if (type.startsWith('translation_')) {
        const translationKey = type.replace('translation_', '');
        const translationConfig =
          window.translationTypes && window.translationTypes[translationKey];
        if (!translationConfig) {
          throw new Error(`Translation non trouvée: ${translationKey}`);
        }

        // Ajouter le titre et la step de la translation
        const params = getUrlParams();
        const lang = params.lang || 'fr_fr';
        const translationTitle =
          lang === 'en_gb' && translationConfig.en_gb
            ? translationConfig.en_gb
            : translationConfig.label;
        transfo.title = translationTitle || 'Translation';
        if (translationConfig.step) {
          transfo.step = translationConfig.step;
        } else if (!transfo.step) {
          transfo.step = 'sorting';
        }

        result = window.processes['executeTranslation'](
          resteLot,
          translationConfig
        );
      } else if (window.processes && window.processes[type]) {
        const params = { yield: transfo.yield };
        const { targetLot, coProductLot } = window.processes[type](
          resteLot,
          keys,
          params
        );
        result = { targetLot, coProductLot };
      } else {
        throw new Error('Type de transformation non géré : ' + type);
      }
      const { targetLot, coProductLot } = result;
      if (!targetLot) return;

      // Ajout de la target au lot si elle existe dans le scénario
      if (transfo.scenario && transfo.scenario.target) {
        targetLot.target = transfo.scenario.target;
      }

      // Utiliser le title de la transformation s'il existe, sinon générer un titre unique
      const titre = transfo.title || `${pathNum}.${idx + 1}`;
      if (!targetLot.title) targetLot.title = titre;
      const nodeId = `${idGenObj.id++}`;
      // On pousse une copie enrichie avec entryLot (pas de clone direct du scénario)
      const transfoWithEntryLot = {
        ...transfo,
        entryLot: entryLotForThisTransfo,
      };
      const newTransformations = [
        ...transformations_appliquees,
        transfoWithEntryLot,
      ];
      // Gérer le cas où keys est undefined pour les transformations dynamiques
      let nodeName;
      if (type === 'dynamic_transfo') {
        // Pour les transformations dynamiques, utiliser le titre de la transformation
        const transfoTitle = transfo.title || 'Transformation dynamique';
        nodeName = targetLot.target
          ? `${transfoTitle} → ${targetLot.target}`
          : transfoTitle;
      } else {
        // Pour les transformations statiques, utiliser keys comme avant
        const keysArray = Array.isArray(keys) ? keys : [];
        // Préfixer le nom avec un titre unique (ex: 1.2) pour garantir l’unicité visuelle
        const base = `${type}: ${keysArray.join(' + ')}`;
        nodeName = targetLot.target
          ? `${titre} — ${base} → ${targetLot.target}`
          : `${titre} — ${base}`;
      }

      // On crée d'abord le nœud
      // Note: _nodeId ne doit pas être généré ici, il doit être persistant

      const nodePath = [...pathArr, idx];
      nodes.push({
        id: nodeId,
        name: nodeName,
        lot: targetLot,
        transformations_appliquees: newTransformations,
        _path: nodePath, // Ajout explicite du path unique pour ce node
        _nodeId: transfo._nodeId, // Ajouter le _nodeId de la transformation
      });

      // Puis le lien qui part du parent vers ce nœud
      links.push({
        source: parentNodeId,
        target: nodeId,
        value: targetLot.total,
        inputLot: JSON.parse(JSON.stringify(resteLot)), // Le lot avant transformation
        targetLot: JSON.parse(JSON.stringify(targetLot)), // Le reste après cette transformation
        outputLot: JSON.parse(JSON.stringify(coProductLot)), // Le lot après transformation
        transformation: transfo, // La transformation qui part du parent vers ce nœud (annotée)
      });
      totalChildren += targetLot.total;

      // Sous-scenario récursif (sur le lot sélectionné, relié à ce nœud)
      if (
        transfo.scenario &&
        transfo.scenario.transformations &&
        transfo.scenario.transformations.length > 0
      ) {
        // On passe le path étendu pour le sous-scenario
        const subPath = [...pathArr, idx, 'scenario', 'transformations'];
        applyScenario(
          targetLot,
          transfo.scenario,
          nodeId,
          nodes,
          links,
          idGenObj,
          false,
          newTransformations,
          depth + 1,
          titre,
          subPath
        );
      }
      // On retire cette part du reste global
      resteLot = JSON.parse(JSON.stringify(coProductLot));
    }
  );

  // Gestion du coproduit (reste)
  if (resteLot && resteLot.total > 0.1) {
    const titre =
      scenario.coproduct_scenario?.title ||
      `${pathNum}.${(scenario.main?.transformations || scenario.transformations || []).length + 1}`;
    if (!resteLot.title) resteLot.title = titre;
    if (scenario.coproduct_scenario && scenario.coproduct_scenario.target) {
      resteLot.target = scenario.coproduct_scenario.target;
    }
    const coproductNodeId = `${idGenObj.id++}`;
    let coproductPath;

    // Si pathArr se termine par 'transformations', coproduct_scenario est au même niveau
    if (
      pathArr.length >= 1 &&
      pathArr[pathArr.length - 1] === 'transformations'
    ) {
      // Retirer 'transformations' et ajouter 'coproduct_scenario', 'transformations'
      const parentPath = pathArr.slice(0, -1);
      coproductPath = [...parentPath, 'coproduct_scenario', 'transformations'];
    } else if (isRoot) {
      // Cas racine pur (pas de transformations encore)
      coproductPath = ['coproduct_scenario', 'transformations'];
    } else {
      // pathArr se termine par un INDEX (number)
      // Ajouter 'scenario' puis 'coproduct_scenario', 'transformations'
      coproductPath = [
        ...pathArr,
        'scenario',
        'coproduct_scenario',
        'transformations',
      ];
    }
    // Note: _path ne doit plus être stocké
    const nodeName = resteLot.target ? `Reste → ${resteLot.target}` : 'Reste';
    nodes.push({
      id: coproductNodeId,
      name: nodeName,
      lot: resteLot,
      transformations_appliquees: transformations_appliquees,
      _path: coproductPath, // Ajouté ici aussi pour accès direct côté Sankey
      isCoproduct: true, // Flag pour identifier les nœuds de coproduit
      _nodeId: scenario.coproduct_scenario?.transformations?.[0]?._nodeId, // Ajouter le _nodeId de la première transformation du coproduit
    });
    // On annote la première transformation du coproduit si elle existe
    if (
      scenario.coproduct_scenario &&
      scenario.coproduct_scenario.transformations &&
      scenario.coproduct_scenario.transformations.length > 0
    ) {
      scenario.coproduct_scenario.transformations.forEach(
        (coproTransfo, cidx) => {
          // Toujours mettre à jour l'index pour s'assurer qu'il est correct
          coproTransfo._index = cidx;
          // Note: _nodeId et _path ne doivent plus être générés ici
        }
      );
    }
    links.push({
      source: parentNodeId,
      target: coproductNodeId,
      value: resteLot.total,
      transformation: scenario.coproduct_scenario?.transformations?.[0] || null, // La transformation du coproduit si elle existe (annotée)
    });
    totalChildren += resteLot.total;
    if (
      scenario.coproduct_scenario &&
      scenario.coproduct_scenario.transformations &&
      scenario.coproduct_scenario.transformations.length > 0
    ) {
      applyScenario(
        resteLot,
        scenario.coproduct_scenario,
        coproductNodeId,
        nodes,
        links,
        idGenObj,
        false,
        transformations_appliquees,
        depth + 1,
        titre,
        coproductPath // Utiliser coproductPath au lieu de coproPath
      );
    }
  }

  // Correction des proportions
  if (
    !isRoot &&
    Math.abs(totalChildren - parentTotal) > 0.1 &&
    nodes.length > 1
  ) {
    const lastNode = nodes[nodes.length - 1];
    const diff = parentTotal - totalChildren;
    lastNode.lot.total += diff;
    const lastLink = links[links.length - 1];
    lastLink.value += diff;
  }

  return { nodes, links };
}
window.applyScenario = applyScenario;

// Fonction obsolète supprimée : getPathForNewTransformation()
// Remplacée par calculatePathForNewTransformation() qui utilise les _nodeId
function getPathForNewTransformation_OBSOLETE(node) {
  // NOUVELLE LOGIQUE : Utiliser le _path du nœud lui-même comme base
  // Cela permet de distinguer les différents niveaux de coproduits

  console.log('🔍 getPathForNewTransformation called for node:', {
    id: node.id,
    name: node.name,
    isCoproduct: node.isCoproduct,
    _path: node._path,
    transformations_appliquees_length:
      node.transformations_appliquees?.length || 0,
  });

  if (node._path && Array.isArray(node._path)) {
    // Si le nœud a un _path défini, l'utiliser comme base
    // Pour les coproduits, on veut pointer vers leurs propres transformations
    if (node.isCoproduct) {
      // Le nœud coproduit doit pointer vers ses propres transformations
      // Si le _path se termine par 'transformations', on reste au même niveau
      if (node._path[node._path.length - 1] === 'transformations') {
        const result = [...node._path];
        console.log(
          '✅ Coproduit avec path se terminant par transformations:',
          result
        );
        return result;
      }
      // Sinon, on ajoute 'transformations' à la fin
      else {
        const result = [...node._path, 'transformations'];
        console.log('✅ Coproduit avec path étendu:', result);
        return result;
      }
    }
    // Pour les nœuds normaux, pointer vers le sous-scénario
    else {
      // Vérifier si le path se termine déjà par 'transformations'
      if (node._path[node._path.length - 1] === 'transformations') {
        const result = [...node._path];
        console.log(
          '✅ Nœud normal avec path déjà terminé par transformations:',
          result
        );
        return result;
      } else {
        const result = [...node._path, 'transformations'];
        console.log('✅ Nœud normal avec path étendu:', result);
        return result;
      }
    }
  }

  // Fallback : utiliser la logique basée sur transformations_appliquees
  if (
    node.transformations_appliquees &&
    node.transformations_appliquees.length > 0
  ) {
    const lastTransfo =
      node.transformations_appliquees[
        node.transformations_appliquees.length - 1
      ];
    if (
      lastTransfo &&
      lastTransfo._path &&
      typeof lastTransfo._index === 'number'
    ) {
      // Si c'est un coproduit, pointer vers le coproduit
      if (node.isCoproduct) {
        const result = [
          ...lastTransfo._path,
          lastTransfo._index,
          'scenario',
          'coproduct_scenario',
          'transformations',
        ];
        console.log(
          '🔄 Fallback coproduit basé sur transformations_appliquees:',
          result
        );
        return result;
      }
      // Sinon, pointer vers le sous-scénario
      else {
        const result = [
          ...lastTransfo._path,
          lastTransfo._index,
          'scenario',
          'transformations',
        ];
        console.log(
          '🔄 Fallback nœud normal basé sur transformations_appliquees:',
          result
        );
        return result;
      }
    }
  }

  // Cas spécial : coproduit racine (nœud avec flag isCoproduct sans transformations_appliquees)
  if (
    node.isCoproduct &&
    (!node.transformations_appliquees ||
      node.transformations_appliquees.length === 0)
  ) {
    console.log('🏠 Coproduit racine sans transformations_appliquees');
    return ['coproduct_scenario', 'transformations'];
  }

  // Fallback : racine
  console.log('🏠 Fallback racine');
  return ['transformations'];
}

// Fonction pour afficher la popup "transfo tech"
function showTransfoTechPopup(nodeId, transformation) {
  console.log('🔧 [POPUP TECH] showTransfoTechPopup appelée:', {
    nodeId,
    nodeIdType: typeof nodeId,
    transformation,
    transformationNodeId: transformation?._nodeId,
    transformationNodeIdType: typeof transformation?._nodeId,
    transformationKeys: transformation ? Object.keys(transformation) : [],
  });

  // Utiliser la nouvelle popup des techs
  if (window.showTechPopup) {
    // Trouver le _nodeId de la transformation
    let transformationNodeId = transformation && transformation._nodeId;

    if (!transformationNodeId) {
      console.error('❌ [POPUP TECH] _nodeId manquant pour la popup tech', {
        transformation,
        hasTransformation: !!transformation,
        transformationKeys: transformation ? Object.keys(transformation) : [],
      });
      return;
    }

    console.log('✅ [POPUP TECH] Ouverture popup tech avec nodeId:', {
      transformationNodeId,
      transformationNodeIdType: typeof transformationNodeId,
      transformation,
    });

    // Créer un ref avec le _nodeId de la transformation
    const ref = {
      nodeId: transformationNodeId, // Utiliser le _nodeId de la transformation, pas le nodeId du nœud
      transformation: transformation,
    };

    // Déterminer le mode : 'edit' si il y a déjà une tech, 'add' sinon
    const hasExistingTech = transformation?.tech;
    const mode = hasExistingTech ? 'edit' : 'add';

    console.log('🔧 [POPUP TECH] Création ref pour showTechPopup:', {
      ref,
      mode,
      hasExistingTech,
    });

    window.showTechPopup(ref, mode);
  } else {
    console.error('❌ [POPUP TECH] TechPopup non disponible');
  }
}

// --- Fonction utilitaire pour créer un dropdown standardisé ---
function createDropdown(button, options, positionOffset = 0) {
  let dropdownMenu = null;
  let dropdownOpen = false;

  const closeDropdown = () => {
    if (dropdownMenu) {
      dropdownMenu.remove();
      dropdownMenu = null;
      dropdownOpen = false;
    }
    document.removeEventListener('mousedown', onClickOutside);
  };

  const onClickOutside = e => {
    if (
      dropdownMenu &&
      !dropdownMenu.contains(e.target) &&
      e.target !== button
    ) {
      closeDropdown();
    }
  };

  const toggleDropdown = event => {
    console.log('🔍 createDropdown toggleDropdown called!');
    event.stopPropagation();

    // Vérifier si on est en mode éditable
    if (!window.isEditable) {
      console.log('🔍 Mode lecture seule - dropdown désactivé');
      return;
    }

    // Toggle dropdown
    if (dropdownOpen) {
      closeDropdown();
      return;
    }

    // Créer le menu dropdown
    dropdownMenu = document.createElement('div');
    dropdownMenu.className =
      'absolute z-50 mt-1 right-0 bg-white rounded-xl shadow-xl py-1 flex flex-col gap-0 border border-gray-200';
    dropdownMenu.style.width = '170px';
    dropdownMenu.style.position = 'absolute';
    dropdownMenu.style.padding = '0';
    dropdownMenu.style.overflow = 'hidden';
    const rect = button.getBoundingClientRect();
    dropdownMenu.style.top = rect.bottom + window.scrollY + 'px';

    // Utiliser la même logique de positionnement que les icônes de transformation
    if (positionOffset !== 0) {
      // Pour les boutons +, utiliser la même logique que les icônes de transformation
      dropdownMenu.style.left = rect.right - STACKBAR_WIDTH - 28 + 'px';
    } else {
      // Positionnement par défaut
      dropdownMenu.style.left = rect.right - 170 + 'px';
    }

    // Générer les options du dropdown
    dropdownMenu.innerHTML = options
      .map(
        option => `
      <button class="flex items-center gap-2 px-3 py-2 text-sm ${option.disabled ? 'text-gray-400 cursor-not-allowed' : 'text-gray-700 hover:bg-gray-100 transition-colors'}" ${option.disabled ? 'disabled' : ''}>
        ${getIconSVG(option.icon, 'w-4 h-4')}
        <span>${option.label}</span>
      </button>
    `
      )
      .join('');

    // Event listeners pour les options
    options.forEach((option, index) => {
      if (!option.disabled && option.onClick) {
        const optionButton = dropdownMenu.querySelector(
          `button:nth-child(${index + 1})`
        );
        optionButton.addEventListener('click', () => {
          console.log(
            '🔍 Dropdown option clicked:',
            option.label,
            'onClick exists:',
            typeof option.onClick
          );
          closeDropdown();
          option.onClick();
        });
      }
    });

    document.body.appendChild(dropdownMenu);
    dropdownOpen = true;
    document.addEventListener('mousedown', onClickOutside);
  };

  return toggleDropdown;
}

// Fonction globale pour calculer les coûts totaux
/**
 * Calcule les coûts totaux du scénario
 * @param {Array} nodes - Nœuds du Sankey
 * @param {Array} links - Liens du Sankey
 * @returns {Object} {
 *   totalCost: number,           // Coût total en €
 *   totalEnergyCost: number,     // Coût énergie en €
 *   totalLaborCost: number,      // Coût RH en €
 *   totalEnergyConsumption: number, // Consommation en kWh
 *   totalTime: number,           // Temps total RH en heures (⚠️ PAS temps machine)
 *   totalEquipmentCost: number,  // Coût équipement (amortissement) en €
 *   totalConsumablesCost: number, // Coût consommables en €
 *   totalEquipmentTime: number,  // Temps total machine en heures
 *   nodeCosts: Array            // Détails par nœud
 * }
 */
function calculateCosts(nodes, links) {
  let totalCost = 0;
  let totalEnergyCost = 0;
  let totalLaborCost = 0;
  let totalEnergyConsumption = 0;
  let totalTimeRH = 0;
  let totalEquipmentCost = 0;
  let totalConsumablesCost = 0;
  let totalEquipmentTime = 0;
  let nodeCosts = [];
  const uniqueTransformations = new Map();
  let totalTransformationsCount = 0;
  let assignedToolsCount = 0;

  // ← NOUVEAU : Validation des données de base
  if (!window.teamData || !window.teamData.profils) {
    console.warn('Aucune donnée de profils RH trouvée dans window.teamData');
    return {
      totalCost: 0,
      totalEnergyCost: 0,
      totalLaborCost: 0,
      totalEnergyConsumption: 0,
      totalTime: 0,
      totalEquipmentCost: 0,
      totalConsumablesCost: 0,
      totalEquipmentTime: 0,
      nodeCosts: [],
    };
  }

  // Parcourir tous les nœuds pour trouver les transformations avec tech
  const transformationsTraitees = new Set(); // Pour éviter de traiter 2x la même transformation

  nodes.forEach(node => {
    if (
      node.transformations_appliquees &&
      node.transformations_appliquees.length > 0
    ) {
      // Parcourir TOUTES les transformations du nœud, pas seulement la dernière
      node.transformations_appliquees.forEach(transformation => {
        if (!transformation) {
          return;
        }

        const transformationId =
          transformation._nodeId != null
            ? String(transformation._nodeId)
            : `missing-${uniqueTransformations.size + 1}`;
        const hasAssignedTech = !!(
          transformation.tech &&
          (transformation.tech.details || transformation.tech.bubble_id)
        );

        if (!uniqueTransformations.has(transformationId)) {
          uniqueTransformations.set(transformationId, {
            hasAssignedTech,
          });
          totalTransformationsCount += 1;
          if (hasAssignedTech) {
            assignedToolsCount += 1;
          }
        } else if (
          hasAssignedTech &&
          !uniqueTransformations.get(transformationId).hasAssignedTech
        ) {
          uniqueTransformations.get(transformationId).hasAssignedTech = true;
          assignedToolsCount += 1;
        }

        if (
          hasAssignedTech &&
          transformation.tech.details &&
          !transformationsTraitees.has(transformationId) // Éviter les doublons
        ) {
          // Créer une transformation avec le volume du lot d'entrée correct
          const transformationWithVolume = {
            ...transformation,
            lot_input_volume: transformation.entryLot?.total || 0,
          };

          // Calculer les coûts pour cette transformation
          const costs = calculateTransformationCosts(
            transformationWithVolume,
            transformation.tech.details,
            window.teamData
          );

          if (costs) {
            totalCost += costs.cout_total;
            totalEnergyCost += costs.cout_energie;
            totalLaborCost += costs.couts_rh;
            totalEnergyConsumption += costs.consommation_totale;
            totalEquipmentCost += costs.cout_amortissement || 0;
            totalConsumablesCost += costs.cout_consommables || 0;
            totalEquipmentTime += costs.temps_utile || 0;

            // ← NOUVEAU : Calculer le temps total RH pour cette transformation
            let tempsRHTransfo = 0;
            if (
              transformation.tech.details.profils &&
              window.teamData.profils
            ) {
              // ← NOUVEAU : Vérifier que les profils de la tech existent dans la team
              const profilsManquants = Object.keys(
                transformation.tech.details.profils
              ).filter(profilName => !window.teamData.profils[profilName]);
              if (profilsManquants.length > 0) {
                console.warn(
                  `Profils RH manquants dans la team pour la transformation ${transformation._nodeId}: ${profilsManquants.join(', ')}`
                );
              }

              Object.entries(transformation.tech.details.profils).forEach(
                ([profilName, profilData]) => {
                  const profilTempsUtile = costs.temps_utile * profilData.timeh;
                  tempsRHTransfo += profilTempsUtile;
                }
              );
            }
            totalTimeRH += tempsRHTransfo;

            // Stocker les détails pour l'affichage
            nodeCosts.push({
              nodeName: transformation._nodeId,
              transformation: transformation,
              costs: costs,
            });

            // Marquer cette transformation comme traitée
            transformationsTraitees.add(transformationId);
          }
        }
      });
    }
  });

  return {
    totalCost,
    totalEnergyCost,
    totalLaborCost,
    totalEnergyConsumption,
    totalTime: totalTimeRH, // ← MODIFIÉ : retourner le temps RH total
    totalEquipmentCost,
    totalConsumablesCost,
    totalEquipmentTime,
    nodeCosts,
    totalTransformationsCount,
    assignedToolsCount,
  };
}

// Fonction pour formater le temps en heures et minutes
function formatTime(hours) {
  const totalHours = Math.floor(hours);
  const totalMinutes = Math.round((hours - totalHours) * 60);
  let formatted = '';
  if (totalHours > 0) {
    formatted += `${totalHours}h`;
  }
  if (totalMinutes > 0) {
    formatted += `${totalMinutes}min`;
  }
  if (totalHours === 0 && totalMinutes === 0) {
    formatted = '< 1min';
  }
  return formatted;
}

// Fonction pour afficher le tableau des coûts
function displayCostsTable(costsData) {
  // Supprimer l'ancien tableau s'il existe
  const existingTable = document.getElementById('costs-table');
  if (existingTable) {
    existingTable.remove();
  }

  // Créer le nouveau tableau
  const tableContainer = document.createElement('div');
  tableContainer.id = 'costs-table';
  tableContainer.className =
    'mt-6 p-4 bg-white border border-gray-200 rounded-lg shadow-sm';
  tableContainer.style.marginTop = '20px';

  // Formater les temps
  const totalOperationTimeFormatted = formatTime(
    costsData.totalEquipmentTime || 0
  );
  const equipmentTimeFormatted = formatTime(costsData.totalEquipmentTime || 0);

  // Calculer les détails des profils RH
  let profilsDetails = '';
  if (costsData.nodeCosts.length > 0) {
    // Collecter tous les profils utilisés
    const profilsMap = new Map();

    costsData.nodeCosts.forEach(nodeCost => {
      if (nodeCost.transformation.tech.details.profils) {
        Object.entries(nodeCost.transformation.tech.details.profils).forEach(
          ([profilName, profilData]) => {
            if (!profilsMap.has(profilName)) {
              profilsMap.set(profilName, { tempsTotal: 0, coutTotal: 0 });
            }
            const profilTempsUtile =
              nodeCost.costs.temps_utile * profilData.timeh;
            const teamProfilData = window.teamData.profils[profilName];
            if (teamProfilData) {
              const prix = teamProfilData.pricerate * profilTempsUtile;
              profilsMap.get(profilName).tempsTotal += profilTempsUtile;
              profilsMap.get(profilName).coutTotal += prix;
            }
          }
        );
      }
    });

    // Générer le HTML pour les profils
    if (profilsMap.size > 0) {
      profilsDetails = `<div class="mt-3"><div class="text-xs text-green-600 font-medium mb-2">${i18next.t('laborCostDetails')}</div>`;
      profilsMap.forEach((details, profilName) => {
        const profilTempsFormate = formatTime(details.tempsTotal);
        profilsDetails += `<div class="py-1 flex justify-between"><span class="text-xs text-green-700 font-medium">${profilName}</span><div class="text-right"><div class="text-xs text-green-600">${profilTempsFormate}</div><div class="text-xs font-medium text-green-800">${details.coutTotal.toFixed(2)}€</div></div></div>`;
      });
      profilsDetails += '</div>';
    }
  }

  const totalTransformations = costsData.totalTransformationsCount || 0;
  const assignedTools = costsData.assignedToolsCount || 0;
  const progressPercent =
    totalTransformations > 0
      ? Math.min(100, Math.round((assignedTools / totalTransformations) * 100))
      : 0;

  const headerHtml = `
    <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
      <h3 class="text-lg font-semibold text-gray-800">${i18next.t('totalCostsTitle')}</h3>
      <div class="flex flex-col gap-1 md:items-end">
        <span class="text-sm font-medium text-gray-600 md:text-right">
          ${assignedTools}/${totalTransformations} ${i18next.t('toolsAssignedLabel')}
        </span>
        <div class="w-full md:w-48 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div class="h-full bg-blue-500 transition-all" style="width: ${progressPercent}%;"></div>
        </div>
      </div>
    </div>
  `;

  const tableHTML = `
    ${headerHtml}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
      <!-- Colonne 1: Total Cost + Total operation time -->
      <div class="bg-blue-50 p-4 rounded-lg">
        <div class="text-sm text-blue-600 font-medium mb-2">${i18next.t('totalCost')}</div>
        <div class="text-xl font-bold text-blue-800 mb-3">${costsData.totalCost.toFixed(2)}€</div>
        <div class="text-xs text-blue-600 font-medium">${i18next.t('totalOperationTime')}</div>
        <div class="text-sm font-semibold text-blue-800">${totalOperationTimeFormatted}</div>
      </div>

      <!-- Colonne 2: Equipment costs + Equipment time -->
      <div class="bg-purple-50 p-4 rounded-lg">
        <div class="text-sm text-purple-600 font-medium mb-2">${i18next.t('equipmentCosts')}</div>
        <div class="text-xl font-bold text-purple-800 mb-3">${(costsData.totalEquipmentCost || 0).toFixed(2)}€</div>
        <div class="text-xs text-purple-600 font-medium">${i18next.t('equipmentTime')}</div>
        <div class="text-sm font-semibold text-purple-800">${equipmentTimeFormatted}</div>
      </div>

      <!-- Colonne 3: Energy costs + Energy consumption -->
      <div class="bg-yellow-50 p-4 rounded-lg">
        <div class="text-sm text-yellow-600 font-medium mb-2">${i18next.t('energyCosts')}</div>
        <div class="text-xl font-bold text-yellow-800 mb-3">${costsData.totalEnergyCost.toFixed(2)}€</div>
        <div class="text-xs text-yellow-600 font-medium">${i18next.t('energyConsumption')}</div>
        <div class="text-sm font-semibold text-yellow-800">${costsData.totalEnergyConsumption.toFixed(2)} kWh</div>
      </div>

      <!-- Colonne 4: Labor costs + Liste des profils -->
      <div class="bg-green-50 p-4 rounded-lg">
        <div class="text-sm text-green-600 font-medium mb-2">${i18next.t('laborCosts')}</div>
        <div class="text-xl font-bold text-green-800 mb-3">${costsData.totalLaborCost.toFixed(2)}€</div>
        ${profilsDetails}
      </div>

      <!-- Colonne 5: Other costs + Consumables -->
      <div class="bg-orange-50 p-4 rounded-lg">
        <div class="text-sm text-orange-600 font-medium mb-2">${i18next.t('otherCosts')}</div>
        <div class="text-xl font-bold text-orange-800 mb-3">${(costsData.totalConsumablesCost || 0).toFixed(2)}€</div>
        <div class="text-xs text-orange-600 font-medium">${i18next.t('consumables')}</div>
        <div class="text-sm font-semibold text-orange-800">${(costsData.totalConsumablesCost || 0).toFixed(2)}€</div>
      </div>
    </div>
  `;

  tableContainer.innerHTML = tableHTML;

  // Insérer le tableau après le bouton Enregistrer
  const saveBtnContainer = document.getElementById('save-btn-container');
  if (saveBtnContainer) {
    saveBtnContainer.parentNode.insertBefore(
      tableContainer,
      saveBtnContainer.nextSibling
    );
  }
}

// Fonction pour publier le scénario dans la console
function publishScenario(scenario, action = 'Modification') {
  console.log(
    `📋 SCÉNARIO COMPLET APRÈS ${action.toUpperCase()}:`,
    JSON.stringify(scenario, null, 2)
  );
}

// Exposer les fonctions globalement
window.calculateCosts = calculateCosts;
window.publishScenario = publishScenario;
window.displayCostsTable = displayCostsTable;
window.updateTransformationByNodeId = updateTransformationByNodeId;
