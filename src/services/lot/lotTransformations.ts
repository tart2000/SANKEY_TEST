import type {
  Lot,
  CheminSelection,
  BaseDataItem,
  Dimension,
} from '@/types/lot';
import {
  normaliserDistribution,
  getPercent,
  setPercent,
  calculerPoidsNiveau,
} from './lotUtils';
import { deepCopy } from './lotUtils';
import {
  calculerMassesParents,
  propagerDeltaKgVersAncetres,
} from './lotKgPropagation';

/**
 * Ajoute un élément à une dimension et répartit les pourcentages
 * Retourne un nouveau lot (immutable)
 */
export function ajouterElementEtRepartir(
  lot: Lot,
  cheminSelection: CheminSelection,
  niveau: number,
  dimension: string,
  nom: string,
  pourcentage: number,
  donneesBase: BaseDataItem
): Lot {
  // Deep copy pour immutabilité
  const newLot = deepCopy(lot);

  // Naviguer jusqu'au nœud parent
  let node: Lot | Dimension | null = newLot;
  for (let i = 0; i < niveau; i++) {
    const { dimension: dim, valeur } = cheminSelection[i];
    if (!valeur || !node || typeof node !== 'object') {
      return newLot; // Erreur de navigation
    }

    const nodeObj = node as Record<string, unknown>;
    if (!(dim in nodeObj)) {
      return newLot;
    }

    const dimValue = nodeObj[dim];
    if (
      typeof dimValue !== 'object' ||
      dimValue === null ||
      Array.isArray(dimValue)
    ) {
      return newLot;
    }

    const dimObj = dimValue as Record<string, unknown>;
    if (!(valeur in dimObj)) {
      return newLot;
    }

    const value = dimObj[valeur];
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return newLot;
    }

    node = value as Lot | Dimension;
  }

  // Vérifier que la dimension existe
  if (!node || typeof node !== 'object') {
    return newLot;
  }

  const nodeObj = node as Record<string, unknown>;
  if (!(dimension in nodeObj)) {
    return newLot;
  }

  const dimensionValue = nodeObj[dimension];
  if (
    typeof dimensionValue !== 'object' ||
    dimensionValue === null ||
    Array.isArray(dimensionValue)
  ) {
    return newLot;
  }

  const dimensionObj = dimensionValue as Dimension;

  // Vérifier que l'élément n'existe pas déjà
  if (nom in dimensionObj) {
    return newLot;
  }

  // Calculer le total avant ajout
  const keys = Object.keys(dimensionObj).filter(k => k !== 'title');
  let totalAvant = 0;
  keys.forEach(k => {
    const val = dimensionObj[k];
    // Vérifier que val est un DimensionValue (pas string ni undefined)
    if (val !== undefined && typeof val !== 'string') {
      totalAvant += getPercent(val);
    }
  });

  // Si c'est le premier élément, mettre à 100%
  if (totalAvant === 0) {
    dimensionObj[nom] = {
      ...donneesBase,
      pourcentage: 100,
    };
    return newLot;
  }

  // Appliquer la normalisation proportionnelle
  const facteur = (100 - pourcentage) / totalAvant;
  let somme = pourcentage;

  // Mettre à jour les autres éléments (sauf le dernier)
  const autresSansDernier = keys.filter((_, idx) => idx < keys.length - 1);
  autresSansDernier.forEach(k => {
    const val = dimensionObj[k];
    // Vérifier que val est un DimensionValue (pas string ni undefined)
    if (val !== undefined && typeof val !== 'string') {
      const pct = getPercent(val) * facteur;
      dimensionObj[k] = setPercent(val, pct);
      somme += pct;
    }
  });

  // Ajuster le dernier élément pour que la somme fasse 100
  if (keys.length > 0) {
    const dernierKey = keys[keys.length - 1];
    if (dernierKey !== nom) {
      const val = dimensionObj[dernierKey];
      // Vérifier que val est un DimensionValue (pas string ni undefined)
      if (val !== undefined && typeof val !== 'string') {
        const pct = 100 - somme;
        dimensionObj[dernierKey] = setPercent(val, pct);
      }
    }
  }

  // Ajouter le nouvel élément
  dimensionObj[nom] = {
    ...donneesBase,
    pourcentage: pourcentage,
  };

  // Normaliser la distribution
  normaliserDistribution(dimensionObj);

  return newLot;
}

/**
 * Supprime un nœud et réajuste la distribution.
 *
 * Mode 'weight' (par défaut) : retire la masse du nœud du total du lot et
 * propage aux ancêtres (miroir de l'ajout en kg) ; les frères hors-chemin
 * gardent leur masse en kg inchangée.
 *
 * Mode 'percentage' : suppression purement locale ; total et ancêtres figés ;
 * les frères directs absorbent le 100 % via normaliserDistribution.
 *
 * Retourne un nouveau lot (immutable) et le nouveau chemin.
 */
export function supprimerNoeudEtRepartir(
  lot: Lot,
  cheminSelection: CheminSelection,
  niveau: number,
  mode: 'percentage' | 'weight' = 'weight'
): { lot: Lot; newChemin: CheminSelection } {
  // Vérifier que le niveau est valide
  if (niveau <= 0) {
    return { lot, newChemin: cheminSelection };
  }

  // Deep copy pour immutabilité
  const newLot = deepCopy(lot);
  const chemin = [...cheminSelection];

  const parentCle = chemin[niveau - 1];
  if (!parentCle || parentCle.valeur === null) {
    console.warn(
      'Aucune valeur sélectionnée à ce niveau parent, suppression impossible.'
    );
    return { lot: newLot, newChemin: cheminSelection };
  }

  const dim = parentCle.dimension;
  const keyToDelete = parentCle.valeur;

  // Naviguer jusqu'au parent du parent
  let nodeParent: Lot | Dimension | null = newLot;
  for (let i = 0; i < niveau - 1; i++) {
    const { dimension, valeur } = chemin[i];
    if (!valeur || !nodeParent || typeof nodeParent !== 'object') {
      return { lot: newLot, newChemin: cheminSelection };
    }

    const nodeObj = nodeParent as Record<string, unknown>;
    if (!(dimension in nodeObj)) {
      return { lot: newLot, newChemin: cheminSelection };
    }

    const dimValue = nodeObj[dimension];
    if (
      typeof dimValue !== 'object' ||
      dimValue === null ||
      Array.isArray(dimValue)
    ) {
      return { lot: newLot, newChemin: cheminSelection };
    }

    const dimObj = dimValue as Record<string, unknown>;
    if (!(valeur in dimObj)) {
      return { lot: newLot, newChemin: cheminSelection };
    }

    const value = dimObj[valeur];
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return { lot: newLot, newChemin: cheminSelection };
    }

    nodeParent = value as Lot | Dimension;
  }

  // Vérifier que la dimension existe
  if (!nodeParent || typeof nodeParent !== 'object') {
    return { lot: newLot, newChemin: cheminSelection };
  }

  const nodeObj = nodeParent as Record<string, unknown>;
  if (!dim || !(dim in nodeObj)) {
    return { lot: newLot, newChemin: cheminSelection };
  }

  const dimensionValue = nodeObj[dim];
  if (
    typeof dimensionValue !== 'object' ||
    dimensionValue === null ||
    Array.isArray(dimensionValue)
  ) {
    return { lot: newLot, newChemin: cheminSelection };
  }

  const liste = dimensionValue as Dimension;

  // Vérifier que la clé existe
  if (!(keyToDelete in liste)) {
    return { lot: newLot, newChemin: cheminSelection };
  }

  if (mode === 'weight') {
    // Calculer la masse du sous-arbre supprimé sur le lot ORIGINAL avant delete
    const masseSupprimee = calculerPoidsNiveau(lot, cheminSelection, niveau);

    // Pré-calcul des masses parents avec les pcts originaux du lot
    const S = calculerMassesParents(
      lot,
      cheminSelection,
      niveau - 1,
      lot.total || 0
    );

    // Supprimer la clé
    delete liste[keyToDelete];

    // Renormaliser localement : les frères directs gardent leurs masses en kg
    // car (S - masseSupprimee) × pct_normalisé/100 = ancienne masse_frère.
    normaliserDistribution(liste);

    // Décrémenter le total du lot de la masse réellement retirée
    newLot.total = Math.max(0, (newLot.total || 0) - masseSupprimee);

    // Propager aux ancêtres (delta négatif) pour conserver les masses hors-chemin
    propagerDeltaKgVersAncetres(
      newLot,
      cheminSelection,
      niveau - 1,
      S,
      -masseSupprimee
    );
  } else {
    // Mode 'percentage' : suppression purement locale, total et ancêtres figés
    delete liste[keyToDelete];
    normaliserDistribution(liste);
  }

  // Tronquer le chemin jusqu'au niveau parent (niveau - 1)
  // et mettre la valeur à null à ce niveau
  const newChemin = cheminSelection.slice(0, niveau - 1);
  if (niveau - 1 >= 0 && chemin[niveau - 1]) {
    newChemin.push({
      dimension: chemin[niveau - 1].dimension,
      valeur: null,
    });
  }

  return { lot: newLot, newChemin };
}
