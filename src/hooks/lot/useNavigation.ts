import { useState, useCallback, useMemo } from 'react';
import type { Lot, CheminSelection, Dimension } from '@/types/lot';
import {
  getNodeAtPath,
  getDimensionsFromNode,
  getAvailableDimensionsFromHierarchy,
} from '@/services/lot/dimensionUtils';

export function useNavigation(lot: Lot | null) {
  const [cheminSelection, setCheminSelection] = useState<CheminSelection>([]);

  // Calculer le nœud courant depuis le chemin
  const currentNode = useMemo(() => {
    if (!lot) return null;
    return getNodeAtPath(lot, cheminSelection);
  }, [lot, cheminSelection]);

  // Calculer les dimensions disponibles au niveau courant
  const availableDimensions = useMemo(() => {
    if (!currentNode) return [];
    return getDimensionsFromNode(currentNode);
  }, [currentNode]);

  // Naviguer vers une dimension et valeur
  const navigateTo = useCallback((dimension: string, valeur: string | null) => {
    setCheminSelection(prev => {
      // Trouver l'index de la dimension dans le chemin
      const dimIndex = prev.findIndex(item => item.dimension === dimension);

      if (dimIndex === -1) {
        // Nouvelle dimension : ajouter à la fin
        return [...prev, { dimension, valeur }];
      } else {
        // Dimension existante : remplacer à partir de cet index
        return [...prev.slice(0, dimIndex), { dimension, valeur }];
      }
    });
  }, []);

  // Naviguer vers le niveau supérieur
  const navigateUp = useCallback((niveau: number) => {
    setCheminSelection(prev => {
      if (niveau <= 0 || niveau >= prev.length) return prev;

      // Tronquer le chemin et mettre la valeur du niveau précédent à null
      const newChemin = prev.slice(0, niveau);
      if (newChemin.length > 0) {
        newChemin[newChemin.length - 1] = {
          ...newChemin[newChemin.length - 1],
          valeur: null,
        };
      }
      return newChemin;
    });
  }, []);

  // Naviguer entre les éléments frères d'un niveau
  const navigateSibling = useCallback(
    (niveau: number, direction: -1 | 1) => {
      if (!lot) return;

      setCheminSelection(prev => {
        const niveauCourant = prev[niveau];
        if (!niveauCourant || !niveauCourant.valeur) return prev;

        // Récupérer le nœud parent
        let nodeParent: Lot | Dimension | null = lot;
        for (let i = 0; i < niveau; i++) {
          const { dimension, valeur } = prev[i];
          if (!valeur || !nodeParent || typeof nodeParent !== 'object') {
            return prev;
          }

          const nodeObj = nodeParent as Record<string, unknown>;
          if (!(dimension in nodeObj)) {
            return prev;
          }

          const dimValue = nodeObj[dimension];
          if (
            typeof dimValue !== 'object' ||
            dimValue === null ||
            Array.isArray(dimValue)
          ) {
            return prev;
          }

          const dimObj = dimValue as Record<string, unknown>;
          if (!(valeur in dimObj)) {
            return prev;
          }

          const value = dimObj[valeur];
          if (
            typeof value !== 'object' ||
            value === null ||
            Array.isArray(value)
          ) {
            return prev;
          }

          nodeParent = value as Lot | Dimension;
        }

        // Récupérer les siblings (frères) du niveau courant
        let siblings: string[] = [];
        if (nodeParent && niveauCourant.dimension) {
          const nodeObj = nodeParent as Record<string, unknown>;
          if (niveauCourant.dimension in nodeObj) {
            const dimValue = nodeObj[niveauCourant.dimension];
            if (
              typeof dimValue === 'object' &&
              dimValue !== null &&
              !Array.isArray(dimValue)
            ) {
              siblings = Object.keys(dimValue).filter(k => k !== 'title');
            }
          }
        } else if (niveau === 0 && niveauCourant.dimension) {
          // Cas spécial pour le niveau 0
          const lotObj = lot as Record<string, unknown>;
          if (niveauCourant.dimension in lotObj) {
            const dimValue = lotObj[niveauCourant.dimension];
            if (
              typeof dimValue === 'object' &&
              dimValue !== null &&
              !Array.isArray(dimValue)
            ) {
              siblings = Object.keys(dimValue).filter(k => k !== 'title');
            }
          }
        }

        if (siblings.length === 0) return prev;

        // Trouver l'index du sibling courant
        const idx = siblings.indexOf(niveauCourant.valeur);
        if (idx === -1) return prev;

        // Calculer le nouvel index
        let newIdx = idx + direction;
        if (newIdx < 0) newIdx = siblings.length - 1;
        if (newIdx >= siblings.length) newIdx = 0;

        // Mettre à jour le chemin avec la nouvelle valeur
        const newChemin = prev.slice(0, niveau + 1);
        newChemin[niveau] = {
          dimension: niveauCourant.dimension,
          valeur: siblings[newIdx],
        };

        // Vérifier s'il y a une dimension enfant et l'ajouter automatiquement
        let node: Lot | Dimension = lot;
        for (let i = 0; i < newChemin.length; i++) {
          const { dimension, valeur } = newChemin[i];
          if (!valeur || !node || typeof node !== 'object') {
            break;
          }

          const nodeObj = node as Record<string, unknown>;
          if (!(dimension in nodeObj)) {
            break;
          }

          const dimValue = nodeObj[dimension];
          if (
            typeof dimValue !== 'object' ||
            dimValue === null ||
            Array.isArray(dimValue)
          ) {
            break;
          }

          const dimObj = dimValue as Record<string, unknown>;
          if (!(valeur in dimObj)) {
            break;
          }

          const value = dimObj[valeur];
          if (
            typeof value !== 'object' ||
            value === null ||
            Array.isArray(value)
          ) {
            break;
          }

          node = value as Lot | Dimension;
        }

        // Ajouter automatiquement le niveau suivant s'il y a des dimensions disponibles
        if (node && typeof node === 'object' && !Array.isArray(node)) {
          // 1. Essayer de récupérer les dimensions réellement présentes dans le nœud
          let dimensions = getDimensionsFromNode(node);

          // 2. Si aucune dimension présente, utiliser la hiérarchie pour savoir
          //    quelles dimensions PEUVENT exister sous la dimension courante
          if (dimensions.length === 0) {
            const parentDimension =
              newChemin[newChemin.length - 1]?.dimension || null;
            dimensions = getAvailableDimensionsFromHierarchy(parentDimension);
          }

          if (dimensions.length > 0) {
            // Ajouter automatiquement la première dimension disponible
            newChemin.push({
              dimension: dimensions[0],
              valeur: null, // Pas de valeur sélectionnée, on affiche juste la stackbar
            });
          }
        }

        return newChemin;
      });
    },
    [lot]
  );

  // Réinitialiser le chemin
  const resetChemin = useCallback(() => {
    setCheminSelection([]);
  }, []);

  // Définir le chemin directement
  const setChemin = useCallback((chemin: CheminSelection) => {
    setCheminSelection(chemin);
  }, []);

  return {
    cheminSelection,
    currentNode,
    availableDimensions,
    navigateTo,
    navigateUp,
    navigateSibling,
    resetChemin,
    setChemin,
  };
}
