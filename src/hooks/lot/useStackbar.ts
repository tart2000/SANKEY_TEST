import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type { StackbarSegment, Dimension } from '@/types/lot';
import {
  getPercent,
  setPercent,
  clampPercent,
  normaliserDistribution,
} from '@/services/lot/lotUtils';

export function useStackbar(
  dimension: Dimension | null,
  dimensionKey: string,
  isEditable: boolean,
  onUpdate: (updater: (dim: Dimension) => Dimension) => void
) {
  const [segments, setSegments] = useState<StackbarSegment[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const onUpdateRef = useRef(onUpdate);
  const isUpdatingRef = useRef(false);
  const segmentsRef = useRef<StackbarSegment[]>([]);

  // Mettre à jour la ref de onUpdate
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  // Calculer les segments depuis la dimension (memoized pour éviter les recalculs inutiles)
  const calculatedSegments = useMemo(() => {
    if (!dimension) return [];

    const keys = Object.keys(dimension).filter(k => k !== 'title');
    return keys.map(key => {
      const val = dimension[key];
      // Vérifier que val est un DimensionValue (pas string ni undefined)
      if (val === undefined || typeof val === 'string') {
        return { name: key, key, percent: 0, color: undefined };
      }
      const percent = getPercent(val);
      const color =
        typeof val === 'object' && val !== null && 'color' in val
          ? (val as { color?: string }).color
          : undefined;

      return {
        name: key,
        key,
        percent,
        color,
      };
    });
  }, [dimension]);

  // Créer une clé de comparaison stable
  const segmentsKey = useMemo(() => {
    return calculatedSegments
      .map(s => `${s.key}:${s.percent.toFixed(1)}`)
      .join('|');
  }, [calculatedSegments]);

  const segmentsKeyRef = useRef<string>('');

  // Mettre à jour les segments seulement si les valeurs calculées ont changé
  useEffect(() => {
    // Si on est en train de drag, ne pas synchroniser
    if (dragStateRef.current?.isDragging || isUpdatingRef.current) {
      return;
    }

    // Comparer avec la clé pour éviter les comparaisons d'objets
    if (segmentsKey !== segmentsKeyRef.current) {
      segmentsKeyRef.current = segmentsKey;
      setSegments(calculatedSegments);
      segmentsRef.current = calculatedSegments;
    }
  }, [segmentsKey, calculatedSegments]);

  // Mettre à jour deux segments adjacents (pour le drag) - seulement l'affichage
  const updateTwoSegments = useCallback(
    (index1: number, percent1: number, index2: number, percent2: number) => {
      if (!dimension) return;

      isUpdatingRef.current = true;

      setSegments(prevSegments => {
        const newSegments = [...prevSegments];

        // Mettre à jour seulement les deux segments adjacents
        newSegments[index1] = { ...newSegments[index1], percent: percent1 };
        newSegments[index2] = { ...newSegments[index2], percent: percent2 };

        // Ne pas toucher aux autres segments pendant le drag
        // La normalisation se fera à la fin du drag

        // Mettre à jour la ref des segments
        segmentsRef.current = newSegments;
        isUpdatingRef.current = false;

        return newSegments;
      });
    },
    [dimension]
  );

  // Gérer le drag & drop
  const dragStateRef = useRef<{
    isDragging: boolean;
    segmentIndex: number;
    startX: number;
    startPercentLeft: number;
    startPercentRight: number;
  } | null>(null);

  const handleDragMove = useCallback(
    (clientX: number, containerWidth: number) => {
      if (!dragStateRef.current || !dragStateRef.current.isDragging) return;

      const { segmentIndex, startX, startPercentLeft, startPercentRight } =
        dragStateRef.current;

      const dx = clientX - startX;
      const dPct = (dx / containerWidth) * 100;

      let newPctLeft = startPercentLeft + dPct;
      let newPctRight = startPercentRight - dPct;

      // Clamp pour que chaque segment ait au moins 1%
      const total = startPercentLeft + startPercentRight;
      newPctLeft = clampPercent(newPctLeft, 1, total - 1);
      newPctRight = total - newPctLeft;

      // Mettre à jour les deux segments en même temps
      updateTwoSegments(
        segmentIndex,
        newPctLeft,
        segmentIndex + 1,
        newPctRight
      );
    },
    [updateTwoSegments]
  );

  const handleDragEnd = useCallback(() => {
    if (dragStateRef.current) {
      const wasDragging = dragStateRef.current.isDragging;
      dragStateRef.current.isDragging = false;

      // Mettre à jour le lot avec les valeurs finales depuis la ref
      const currentSegments = segmentsRef.current;
      if (currentSegments.length > 0 && wasDragging) {
        isUpdatingRef.current = true;

        // Calculer le total actuel
        const total = currentSegments.reduce(
          (sum, seg) => sum + seg.percent,
          0
        );

        // Normaliser les pourcentages pour que la somme fasse 100
        const normalizedSegments = currentSegments.map(seg => ({
          ...seg,
          percent: total > 0 ? (seg.percent * 100) / total : seg.percent,
        }));

        // Ajuster le dernier pour que la somme fasse exactement 100
        if (normalizedSegments.length > 0) {
          const lastIdx = normalizedSegments.length - 1;
          const sum = normalizedSegments.reduce((s, seg, idx) => {
            if (idx === lastIdx) return s;
            return s + Math.round(seg.percent * 10) / 10;
          }, 0);
          normalizedSegments[lastIdx].percent =
            Math.round((100 - sum) * 10) / 10;
        }

        // Mettre à jour le lot (les segments seront mis à jour via le useEffect)
        onUpdateRef.current((dim: Dimension) => {
          const newDim = { ...dim };
          normalizedSegments.forEach(seg => {
            const val = newDim[seg.key];
            // Vérifier que val est un DimensionValue (pas string ni undefined)
            if (val !== undefined && typeof val !== 'string') {
              newDim[seg.key] = setPercent(val, seg.percent);
            }
          });
          normaliserDistribution(newDim);
          // Réinitialiser le flag après un court délai pour laisser le useEffect se déclencher
          setTimeout(() => {
            isUpdatingRef.current = false;
          }, 50);
          return newDim;
        });
      }

      dragStateRef.current = null;
    }
    document.body.style.userSelect = '';
  }, []);

  const handleDragStart = useCallback(
    (segmentIndex: number, clientX: number) => {
      const currentSegments = segmentsRef.current;
      if (!isEditable || segmentIndex >= currentSegments.length - 1) return;

      dragStateRef.current = {
        isDragging: true,
        segmentIndex,
        startX: clientX,
        startPercentLeft: currentSegments[segmentIndex].percent,
        startPercentRight: currentSegments[segmentIndex + 1].percent,
      };

      document.body.style.userSelect = 'none';

      // Attacher les événements directement ici
      const handleMouseMove = (e: MouseEvent) => {
        if (!dragStateRef.current?.isDragging) return;
        const container = document.getElementById('stackbar-container');
        if (container) {
          handleDragMove(e.clientX, container.offsetWidth);
        }
      };

      const handleMouseUp = () => {
        handleDragEnd();
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [isEditable, handleDragMove, handleDragEnd]
  );

  return {
    segments,
    selectedKey,
    setSelectedKey,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
  };
}
