import { useEffect, useMemo, useState, useRef } from 'react';
import type {
  Lot,
  CheminSelection,
  Dimension,
  DimensionValue,
  BaseDataItem,
} from '@/types/lot';
import { useLot } from '@/hooks/lot/useLot';
import { useNavigation } from '@/hooks/lot/useNavigation';
import { useDimensions } from '@/hooks/lot/useDimensions';
import { useIframeCommunication } from '@/hooks/lot/useIframeCommunication';
import {
  getDimensionsFromNode,
  getTitreAffiche,
  getNodeAtPath,
  getDimensionLabel,
} from '@/services/lot/dimensionUtils';
import { getPercent, calculerPoidsNiveau } from '@/services/lot/lotUtils';
import {
  ajouterElementEtRepartir,
  supprimerNoeudEtRepartir,
} from '@/services/lot/lotTransformations';
import { StackbarHeader } from './StackbarHeader';
import { Stackbar } from './Stackbar';
import { AddItemModal } from './AddItemModal';
import { SaveButton } from './SaveButton';

interface LotEditorProps {
  lot: Lot | null;
  lotId: string;
  isLive: boolean;
  isEditable: boolean;
  lang: string;
  onLotChange?: (lot: Lot) => void;
  t: (key: string, params?: Record<string, string>) => string;
}

interface HeaderInfo {
  niveau: number;
  nodeParent: Lot | Dimension | null;
  dimension: string;
  valeur: string;
  nom: string;
  nomCle: string;
  itemObj: DimensionValue | null;
  pct: number;
  kg: number;
}

export function LotEditor({
  lot: initialLot,
  lotId,
  isLive,
  isEditable,
  lang,
  onLotChange,
  t,
}: LotEditorProps) {
  const { lot, isModified, updateLot, setLot, markAsSaved } =
    useLot(initialLot);
  const {
    cheminSelection,
    navigateTo,
    navigateUp,
    navigateSibling,
    setChemin,
  } = useNavigation(lot);
  const {
    dimensionsLabels,
    loadDimensionsLabels,
    loadBaseData,
    fetchItemComplete,
  } = useDimensions();
  const { sendHeight, sendLotUpdated } = useIframeCommunication();
  const [modalOpen, setModalOpen] = useState(false);
  const [modalNiveau, setModalNiveau] = useState(0);
  const [modalDimension, setModalDimension] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const userActionRef = useRef(false);
  const prevLotJsonRef = useRef<string>('');

  // Charger les labels de dimensions au montage
  useEffect(() => {
    console.log('[LotEditor] useEffect loadDimensionsLabels déclenché', {
      isLive,
      lotId,
      timestamp: new Date().toISOString(),
    });
    loadDimensionsLabels(isLive);
  }, [loadDimensionsLabels, isLive]);

  // Logger quand dimensionsLabels change
  useEffect(() => {
    console.log('[LotEditor] dimensionsLabels a changé', {
      dimensionsLabels,
      keys: dimensionsLabels ? Object.keys(dimensionsLabels) : null,
      timestamp: new Date().toISOString(),
    });
  }, [dimensionsLabels]);

  // Initialiser le chemin si vide
  useEffect(() => {
    if (lot && cheminSelection.length === 0) {
      const dims = getDimensionsFromNode(lot);
      if (dims.length > 0) {
        navigateTo(dims[0], null);
      }
    }
  }, [lot, cheminSelection.length, navigateTo]);

  // Notifier les changements de lot seulement si c'est une modification utilisateur
  useEffect(() => {
    if (!lot) return;

    const lotJson = JSON.stringify(lot);

    // Si le lot a changé et que c'était une action utilisateur, notifier
    if (lotJson !== prevLotJsonRef.current && userActionRef.current) {
      prevLotJsonRef.current = lotJson;
      userActionRef.current = false; // Réinitialiser le flag

      if (onLotChange) {
        onLotChange(lot);
      }
      sendLotUpdated(lot);
    } else if (lotJson !== prevLotJsonRef.current) {
      // Le lot a changé depuis l'extérieur, juste mettre à jour la ref
      prevLotJsonRef.current = lotJson;
      userActionRef.current = false;
    }
  }, [lot, onLotChange, sendLotUpdated]);

  // Calculer les infos de header pour chaque niveau
  const headerInfos = useMemo((): HeaderInfo[] => {
    if (!lot) return [];

    const infos: HeaderInfo[] = [];
    let node: Lot | Dimension | null = lot;
    const totalKg = lot.total || 0;

    for (let niveau = 0; niveau < cheminSelection.length; niveau++) {
      const niveauCourant = cheminSelection[niveau] || {};
      const dimension = niveauCourant.dimension || '';
      const valeur = niveauCourant.valeur || '';

      let nom = '';
      let nomCle = '';
      let itemObj: DimensionValue | null = null;
      let pct = 100;
      let kg = 0;

      if (niveau === 0) {
        nom = lot.title || 'Lot';
        nomCle = nom;
        pct = 100;
        kg = lot.total || 0;
      } else {
        nomCle = cheminSelection[niveau - 1]?.valeur || '';

        // Récupérer l'objet complet de l'item
        let nodeParent2: Lot | Dimension | null = lot;
        for (let i = 0; i < niveau - 1; i++) {
          const { dimension: dim, valeur: val } = cheminSelection[i];
          if (!val || !nodeParent2 || typeof nodeParent2 !== 'object') {
            nodeParent2 = null;
            break;
          }
          const nodeObj = nodeParent2 as Record<string, unknown>;
          if (!(dim in nodeObj)) {
            nodeParent2 = null;
            break;
          }
          const dimValue = nodeObj[dim];
          if (
            typeof dimValue !== 'object' ||
            dimValue === null ||
            Array.isArray(dimValue)
          ) {
            nodeParent2 = null;
            break;
          }
          const dimObj = dimValue as Record<string, unknown>;
          if (!(val in dimObj)) {
            nodeParent2 = null;
            break;
          }
          const value = dimObj[val];
          if (
            typeof value !== 'object' ||
            value === null ||
            Array.isArray(value)
          ) {
            nodeParent2 = null;
            break;
          }
          nodeParent2 = value as Lot | Dimension;
        }

        const parent = cheminSelection[niveau - 1];
        if (
          parent &&
          parent.dimension &&
          parent.valeur &&
          nodeParent2 &&
          typeof nodeParent2 === 'object' &&
          parent.dimension in nodeParent2
        ) {
          const dimObj = nodeParent2[parent.dimension] as Record<
            string,
            unknown
          >;
          if (parent.valeur in dimObj) {
            const valNode = dimObj[parent.valeur];
            if (
              typeof valNode === 'object' &&
              valNode !== null &&
              !Array.isArray(valNode)
            ) {
              itemObj = valNode as DimensionValue;
              pct = getPercent(itemObj);
            } else if (typeof valNode === 'number') {
              pct = valNode;
            }
          }
        }

        nom = getTitreAffiche(nomCle, itemObj, lang);

        // Calcul du poids réel
        let nodeTmp: Lot | Dimension | null = lot;
        let pctCumulTmp = 100;
        for (let i = 0; i <= niveau - 1; i++) {
          const { dimension: dim, valeur: val } = cheminSelection[i];
          if (!val || !nodeTmp || typeof nodeTmp !== 'object') break;
          const nodeObj = nodeTmp as Record<string, unknown>;
          if (!(dim in nodeObj)) break;
          const dimValue = nodeObj[dim];
          if (
            typeof dimValue !== 'object' ||
            dimValue === null ||
            Array.isArray(dimValue)
          ) {
            break;
          }
          const dimObj = dimValue as Record<string, unknown>;
          if (!(val in dimObj)) break;
          const n = dimObj[val];
          if (
            typeof n === 'object' &&
            n !== null &&
            !Array.isArray(n) &&
            'pourcentage' in n
          ) {
            pctCumulTmp =
              (pctCumulTmp * (n as { pourcentage: number }).pourcentage) / 100;
          } else if (typeof n === 'number') {
            pctCumulTmp = (pctCumulTmp * n) / 100;
          }
          nodeTmp = n as Lot | Dimension;
        }
        kg = (totalKg * pctCumulTmp) / 100;
      }

      // Calculer nodeParent pour ce niveau
      let nodeParent: Lot | Dimension | null = lot;
      for (let i = 0; i < niveau; i++) {
        const { dimension: dim, valeur: val } = cheminSelection[i];
        if (!val || !nodeParent || typeof nodeParent !== 'object') {
          nodeParent = null;
          break;
        }
        const nodeObj = nodeParent as Record<string, unknown>;
        if (!(dim in nodeObj)) {
          nodeParent = null;
          break;
        }
        const dimValue = nodeObj[dim];
        if (
          typeof dimValue !== 'object' ||
          dimValue === null ||
          Array.isArray(dimValue)
        ) {
          nodeParent = null;
          break;
        }
        const dimObj = dimValue as Record<string, unknown>;
        if (!(val in dimObj)) {
          nodeParent = null;
          break;
        }
        const value = dimObj[val];
        if (
          typeof value !== 'object' ||
          value === null ||
          Array.isArray(value)
        ) {
          nodeParent = null;
          break;
        }
        nodeParent = value as Lot | Dimension;
      }

      infos.push({
        niveau,
        nodeParent,
        dimension,
        valeur,
        nom,
        nomCle,
        itemObj,
        pct,
        kg,
      });

      // Avancer dans l'arbre
      if (valeur && node && typeof node === 'object' && dimension in node) {
        const nodeObj = node as Record<string, unknown>;
        const dimValue = nodeObj[dimension];
        if (
          typeof dimValue === 'object' &&
          dimValue !== null &&
          !Array.isArray(dimValue)
        ) {
          const dimObj = dimValue as Record<string, unknown>;
          if (valeur in dimObj) {
            const valNode = dimObj[valeur];
            if (
              typeof valNode === 'object' &&
              valNode !== null &&
              !Array.isArray(valNode)
            ) {
              node = valNode as Lot | Dimension;
            }
          }
        }
      }
    }

    // Ajouter le header du niveau suivant si nécessaire (nœud feuille)
    if (cheminSelection.length > 0) {
      const lastNiveau = cheminSelection.length - 1;
      const last = cheminSelection[lastNiveau];
      if (last && last.valeur) {
        const nodeValue = getNodeAtPath(lot, cheminSelection);
        const dims = getDimensionsFromNode(nodeValue);
        if (!nodeValue || dims.length === 0) {
          // Feuille : afficher le header du niveau suivant
          const niveauCourant = cheminSelection[lastNiveau] || {};
          const dimension = niveauCourant.dimension || '';
          const valeur = niveauCourant.valeur || '';
          let nom = '';
          let nomCle = '';
          let itemObj: DimensionValue | null = null;
          let pct = 100;
          let kg = 0;

          nomCle = valeur;
          let nodeParent2: Lot | Dimension | null = lot;
          for (let i = 0; i < lastNiveau; i++) {
            const { dimension: dim, valeur: val } = cheminSelection[i];
            if (!val || !nodeParent2 || typeof nodeParent2 !== 'object') {
              nodeParent2 = null;
              break;
            }
            const nodeObj = nodeParent2 as Record<string, unknown>;
            if (!(dim in nodeObj)) {
              nodeParent2 = null;
              break;
            }
            const dimValue = nodeObj[dim];
            if (
              typeof dimValue !== 'object' ||
              dimValue === null ||
              Array.isArray(dimValue)
            ) {
              nodeParent2 = null;
              break;
            }
            const dimObj = dimValue as Record<string, unknown>;
            if (!(val in dimObj)) {
              nodeParent2 = null;
              break;
            }
            const value = dimObj[val];
            if (
              typeof value !== 'object' ||
              value === null ||
              Array.isArray(value)
            ) {
              nodeParent2 = null;
              break;
            }
            nodeParent2 = value as Lot | Dimension;
          }

          if (
            nodeParent2 &&
            typeof nodeParent2 === 'object' &&
            dimension in nodeParent2
          ) {
            const dimObj = (nodeParent2 as Record<string, unknown>)[
              dimension
            ] as Record<string, unknown>;
            if (dimObj && valeur in dimObj) {
              const valNode = dimObj[valeur];
              if (
                typeof valNode === 'object' &&
                valNode !== null &&
                !Array.isArray(valNode)
              ) {
                itemObj = valNode as DimensionValue;
                pct = getPercent(itemObj);
              }
            }
          }

          nom = getTitreAffiche(nomCle, itemObj, lang);

          let nodeTmp: Lot | Dimension | null = lot;
          let pctCumulTmp = 100;
          for (let i = 0; i <= lastNiveau; i++) {
            const { dimension: dim, valeur: val } = cheminSelection[i];
            if (!val || !nodeTmp || typeof nodeTmp !== 'object') break;
            const nodeObj = nodeTmp as Record<string, unknown>;
            if (!(dim in nodeObj)) break;
            const dimValue = nodeObj[dim];
            if (
              typeof dimValue !== 'object' ||
              dimValue === null ||
              Array.isArray(dimValue)
            ) {
              break;
            }
            const dimObj = dimValue as Record<string, unknown>;
            if (!(val in dimObj)) break;
            const n = dimObj[val];
            if (
              typeof n === 'object' &&
              n !== null &&
              !Array.isArray(n) &&
              'pourcentage' in n
            ) {
              pctCumulTmp =
                (pctCumulTmp * (n as { pourcentage: number }).pourcentage) /
                100;
            } else if (typeof n === 'number') {
              pctCumulTmp = (pctCumulTmp * n) / 100;
            }
            nodeTmp = n as Lot | Dimension;
          }
          kg = ((lot.total || 0) * pctCumulTmp) / 100;

          // IMPORTANT : utiliser nodeValue (nœud feuille) au lieu de nodeParent
          // pour que getDimensionsFromNode retourne un tableau vide
          infos.push({
            niveau: lastNiveau + 1,
            nodeParent: nodeValue, // Utiliser le nœud feuille, pas le parent
            dimension: '',
            valeur: '',
            nom,
            nomCle,
            itemObj,
            pct,
            kg,
          });
        }
      }
    }

    return infos;
  }, [lot, cheminSelection, lang]);

  // Calculer et envoyer la hauteur de l'iframe
  useEffect(() => {
    if (!lot || !containerRef.current) return;

    // Calculer la hauteur en fonction du nombre de niveaux
    // Base: 20px (padding container)
    // Chaque niveau: 120px (header + stackbar)
    // Gap entre niveaux: 20px
    // Bouton Save: 60px (avec padding pr-5 pb-5)
    const nombreNiveaux = headerInfos.length;
    const baseHeight = 20; // Padding container
    const hauteurParNiveau = 120; // Header + stackbar
    const gapEntreNiveaux = 20;
    const hauteurSaveButton = 60; // Bouton + padding

    let height = baseHeight;
    if (nombreNiveaux > 0) {
      height += nombreNiveaux * hauteurParNiveau;
      height += (nombreNiveaux - 1) * gapEntreNiveaux;
      height += hauteurSaveButton;
    } else {
      height = 400; // Hauteur minimale si pas de contenu
    }

    // Appliquer un minimum de 400px quand isEditable = true (pour éviter les problèmes avec la popup d'ajout)
    if (isEditable && height < 400) {
      height = 400;
    }

    sendHeight(height);
  }, [lot, headerInfos.length, sendHeight, isEditable]);

  // Gérer l'ajout d'un élément
  const handleAdd = async (
    bubbleId: string,
    pourcentage: number,
    donneesBase: BaseDataItem,
    poidsKg?: number
  ) => {
    if (!lot) return;

    // Extraire le nom lisible si nécessaire
    const nomLisible =
      Object.keys(donneesBase).length === 1
        ? Object.keys(donneesBase)[0]
        : bubbleId;

    let newLot: Lot;

    // Si on ajoute en kg, il faut :
    // 1. Ajouter le poids au total du lot
    // 2. Calculer le pourcentage par rapport au poids du niveau
    // 3. Normaliser les pourcentages
    if (poidsKg !== undefined && poidsKg > 0) {
      // Calculer le poids du niveau avant ajout
      const poidsNiveauAvant = calculerPoidsNiveau(
        lot,
        cheminSelection,
        modalNiveau
      );

      // Ajouter le poids au total du lot
      const nouveauTotal = (lot.total || 0) + poidsKg;
      const lotAvecNouveauTotal = { ...lot, total: nouveauTotal };

      // Calculer le nouveau poids du niveau
      const nouveauPoidsNiveau = poidsNiveauAvant + poidsKg;

      // Calculer le nouveau pourcentage
      const nouveauPourcentage =
        nouveauPoidsNiveau > 0 ? (poidsKg / nouveauPoidsNiveau) * 100 : 100;

      // Ajouter l'élément avec le nouveau pourcentage
      newLot = ajouterElementEtRepartir(
        lotAvecNouveauTotal,
        cheminSelection,
        modalNiveau,
        modalDimension,
        nomLisible,
        nouveauPourcentage,
        donneesBase
      );
    } else {
      // Comportement normal en pourcentage
      newLot = ajouterElementEtRepartir(
        lot,
        cheminSelection,
        modalNiveau,
        modalDimension,
        nomLisible,
        pourcentage,
        donneesBase
      );
    }

    userActionRef.current = true; // Marquer comme action utilisateur
    setLot(newLot);

    // Naviguer vers l'élément ajouté
    const newChemin = [...cheminSelection.slice(0, modalNiveau + 1)];
    newChemin[modalNiveau] = {
      dimension: modalDimension,
      valeur: nomLisible,
    };

    // Vérifier si l'élément ajouté a des dimensions enfants et naviguer vers la première
    const nodeAdded = getNodeAtPath(newLot, newChemin);
    if (nodeAdded) {
      const dimensions = getDimensionsFromNode(nodeAdded);
      if (dimensions.length > 0) {
        newChemin.push({
          dimension: dimensions[0],
          valeur: null, // Afficher la stackbar sans sélectionner de segment
        });
      }
    }

    setChemin(newChemin);
  };

  // Gérer la suppression
  const handleDelete = (niveau: number) => {
    if (!lot) return;

    const { lot: newLot, newChemin } = supprimerNoeudEtRepartir(
      lot,
      cheminSelection,
      niveau
    );

    userActionRef.current = true; // Marquer comme action utilisateur
    setLot(newLot);
    setChemin(newChemin);
  };

  // Gérer le changement de dimension
  const handleDimensionChange = (dimension: string, niveau: number) => {
    // Trouver l'index de la dimension dans le chemin (si elle existe déjà)
    const dimIndex = cheminSelection.findIndex(
      item => item.dimension === dimension
    );

    let newChemin: CheminSelection;
    if (dimIndex === -1) {
      // Nouvelle dimension : tronquer jusqu'au niveau et ajouter
      newChemin = cheminSelection.slice(0, niveau);
      newChemin.push({ dimension, valeur: null });
    } else {
      // Dimension existante : tronquer jusqu'à cet index et remplacer
      newChemin = cheminSelection.slice(0, dimIndex);
      newChemin.push({ dimension, valeur: null });
    }

    // Si une seule valeur possible, la sélectionner automatiquement
    if (lot) {
      let nodeParent: Lot | Dimension | null = lot;
      const targetNiveau = dimIndex === -1 ? niveau : dimIndex;

      for (let i = 0; i < targetNiveau; i++) {
        const { dimension: dim, valeur } = newChemin[i];
        if (!valeur || !nodeParent || typeof nodeParent !== 'object') {
          nodeParent = null;
          break;
        }
        const nodeObj = nodeParent as Record<string, unknown>;
        if (!(dim in nodeObj)) {
          nodeParent = null;
          break;
        }
        const dimValue = nodeObj[dim];
        if (
          typeof dimValue !== 'object' ||
          dimValue === null ||
          Array.isArray(dimValue)
        ) {
          nodeParent = null;
          break;
        }
        const dimObj = dimValue as Record<string, unknown>;
        if (!(valeur in dimObj)) {
          nodeParent = null;
          break;
        }
        const value = dimObj[valeur];
        if (
          typeof value !== 'object' ||
          value === null ||
          Array.isArray(value)
        ) {
          nodeParent = null;
          break;
        }
        nodeParent = value as Lot | Dimension;
      }

      if (
        nodeParent &&
        typeof nodeParent === 'object' &&
        dimension in nodeParent
      ) {
        const dimValue = (nodeParent as Record<string, unknown>)[dimension];
        if (
          typeof dimValue === 'object' &&
          dimValue !== null &&
          !Array.isArray(dimValue)
        ) {
          const keys = Object.keys(dimValue).filter(k => k !== 'title');
          if (keys.length === 1) {
            const lastIndex = newChemin.length - 1;
            newChemin[lastIndex].valeur = keys[0];
          }
        }
      }
    }

    setChemin(newChemin);
  };

  // Gérer le clic sur un segment
  const handleSegmentClick = (
    niveau: number,
    dimensionKey: string,
    key: string
  ) => {
    if (cheminSelection.length === 0) return;

    // Mettre à jour la valeur au niveau spécifié et tronquer après
    const newChemin: CheminSelection = [
      ...cheminSelection.slice(0, niveau),
      { dimension: dimensionKey, valeur: key },
    ];

    // Chercher la dimension enfant éventuelle
    if (lot) {
      const node = getNodeAtPath(lot, newChemin);
      if (node) {
        const dimsEnfant = getDimensionsFromNode(node);
        if (dimsEnfant.length > 0) {
          // Vérifier si la dimension enfant n'est pas déjà dans le chemin
          const hasChildDim = newChemin.some(
            item => item.dimension === dimsEnfant[0]
          );
          if (!hasChildDim) {
            newChemin.push({ dimension: dimsEnfant[0], valeur: null });
          }
        }
      }
    }

    setChemin(newChemin);
  };

  // Gérer la mise à jour d'une dimension (pour le drag & drop)
  const handleDimensionUpdate = (
    dimensionKey: string,
    updater: (dim: Dimension) => Dimension
  ) => {
    if (!lot) return;

    userActionRef.current = true; // Marquer comme action utilisateur
    updateLot(lot => {
      const newLot = { ...lot };
      let node: Lot | Dimension = newLot;

      // Naviguer jusqu'à la dimension
      for (let i = 0; i < cheminSelection.length; i++) {
        const { dimension, valeur } = cheminSelection[i];
        if (dimension === dimensionKey) break;
        if (!valeur || !node || typeof node !== 'object') {
          return newLot;
        }
        const nodeObj = node as Record<string, unknown>;
        if (!(dimension in nodeObj)) {
          return newLot;
        }
        const dimValue = nodeObj[dimension];
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
        node = dimObj[valeur] as Lot | Dimension;
      }

      if (node && typeof node === 'object' && dimensionKey in node) {
        const dim = (node as Record<string, unknown>)[
          dimensionKey
        ] as Dimension;
        if (typeof dim === 'object' && dim !== null && !Array.isArray(dim)) {
          (node as Record<string, unknown>)[dimensionKey] = updater(
            dim as Dimension
          );
        }
      }

      return newLot;
    });
  };

  if (!lot) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className="lot-container"
      style={{ position: 'relative' }}
    >
      {headerInfos.map((info, idx) => {
        // Calculer les dimensions disponibles pour ce niveau
        // Toujours utiliser le nodeParent calculé dans headerInfos (comme dans le code original)
        const dimsForLevel = info.nodeParent
          ? getDimensionsFromNode(info.nodeParent)
          : getDimensionsFromNode(lot);

        return (
          <div key={idx}>
            <StackbarHeader
              niveau={info.niveau}
              nom={info.nom}
              nomCle={info.nomCle}
              itemObj={info.itemObj}
              pct={info.pct}
              kg={info.kg}
              lot={lot}
              cheminSelection={cheminSelection}
              availableDimensions={dimsForLevel}
              dimensionsLabels={dimensionsLabels}
              lang={lang}
              isEditable={isEditable}
              frequency={lot.frequency}
              onNavigateSibling={navigateSibling}
              onDimensionChange={dim => handleDimensionChange(dim, info.niveau)}
              onAdd={() => {
                setModalNiveau(info.niveau);
                setModalDimension(info.dimension || dimsForLevel[0] || '');
                setModalOpen(true);
              }}
              onDelete={() => handleDelete(info.niveau)}
              onClose={() => navigateUp(info.niveau)}
              onFrequencyChange={frequency => {
                userActionRef.current = true; // Marquer comme action utilisateur
                updateLot(lot => ({ ...lot, frequency }));
              }}
              onUpdateLot={updater => {
                userActionRef.current = true; // Marquer comme action utilisateur
                updateLot(updater);
              }}
              onLotChange={lot => {
                userActionRef.current = true; // Marquer comme action utilisateur
                setLot(lot);
                // Ne pas appeler onLotChange ici, le useEffect s'en chargera
              }}
            />

            {/* Afficher la stackbar pour ce niveau si on a une dimension */}
            {info.dimension &&
              info.niveau < cheminSelection.length &&
              (() => {
                const nodeForStackbar = getNodeAtPath(
                  lot,
                  cheminSelection.slice(0, info.niveau)
                );
                if (!nodeForStackbar || typeof nodeForStackbar !== 'object')
                  return null;

                const nodeObj = nodeForStackbar as Record<string, unknown>;
                if (!(info.dimension in nodeObj)) return null;

                const dimValue = nodeObj[info.dimension];
                if (
                  typeof dimValue !== 'object' ||
                  dimValue === null ||
                  Array.isArray(dimValue)
                ) {
                  return null;
                }

                const dimension = dimValue as Dimension;
                const keys = Object.keys(dimension).filter(k => k !== 'title');
                if (keys.length === 0) return null;

                return (
                  <Stackbar
                    dimension={dimension}
                    dimensionKey={info.dimension}
                    lot={lot}
                    cheminSelection={cheminSelection.slice(0, info.niveau)}
                    selectedKey={
                      info.valeur && keys.includes(info.valeur)
                        ? info.valeur
                        : null
                    }
                    isEditable={isEditable}
                    lang={lang}
                    onSegmentClick={key =>
                      handleSegmentClick(info.niveau, info.dimension, key)
                    }
                    onUpdate={dim => handleDimensionUpdate(info.dimension, dim)}
                  />
                );
              })()}
          </div>
        );
      })}

      {/* Modal d'ajout */}
      {modalOpen && (
        <AddItemModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          onAdd={handleAdd}
          dimension={modalDimension}
          dimensionLabel={getDimensionLabel(
            modalDimension,
            dimensionsLabels,
            lang
          )}
          loadBaseData={dimension => loadBaseData(dimension, isLive)}
          existingKeys={(() => {
            if (!lot) return [];
            const node = getNodeAtPath(
              lot,
              cheminSelection.slice(0, modalNiveau)
            );
            if (!node || typeof node !== 'object') return [];
            const nodeObj = node as Record<string, unknown>;
            if (!(modalDimension in nodeObj)) return [];
            const dimValue = nodeObj[modalDimension];
            if (
              typeof dimValue !== 'object' ||
              dimValue === null ||
              Array.isArray(dimValue)
            ) {
              return [];
            }
            return Object.keys(dimValue).filter(k => k !== 'title');
          })()}
          lang={lang}
          fetchItemComplete={bubbleId => fetchItemComplete(bubbleId, isLive)}
          t={t}
          poidsNiveau={(() => {
            if (!lot) return 0;
            return calculerPoidsNiveau(lot, cheminSelection, modalNiveau);
          })()}
        />
      )}

      {/* Bouton Enregistrer */}
      <SaveButton
        lotId={lotId}
        lot={lot}
        isLive={isLive}
        isModified={isModified}
        isEditable={isEditable}
        onSaveSuccess={() => {
          // Marquer le lot comme sauvegardé (remet isModified à false)
          markAsSaved();
        }}
        t={t}
      />
    </div>
  );
}
