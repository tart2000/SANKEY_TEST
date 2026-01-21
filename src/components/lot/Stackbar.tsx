import { useRef, useMemo } from 'react';
import type { Dimension, DimensionValue, Lot } from '@/types/lot';
import { StackbarSegment } from './StackbarSegment';
import { getTitreAffiche } from '@/services/lot/dimensionUtils';
import { useStackbar } from '@/hooks/lot/useStackbar';

interface StackbarProps {
  dimension: Dimension | null;
  dimensionKey: string;
  lot: Lot | Dimension | null;
  cheminSelection: Array<{ dimension: string; valeur: string | null }>;
  selectedKey: string | null;
  isEditable: boolean;
  lang: string;
  onSegmentClick: (key: string) => void;
  onUpdate: (updater: (dim: Dimension) => Dimension) => void;
  hasAvailableDimensions: boolean;
  onAdd: () => void;
  t?: (key: string, params?: Record<string, string>) => string;
}

export function Stackbar({
  dimension,
  dimensionKey,
  lot,
  cheminSelection,
  selectedKey,
  isEditable,
  lang,
  onSegmentClick,
  onUpdate,
  hasAvailableDimensions,
  onAdd,
  t,
}: StackbarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { segments, handleDragStart } = useStackbar(
    dimension,
    dimensionKey,
    isEditable,
    onUpdate
  );

  // Calculer les noms affichés pour chaque segment
  const displayNames = useMemo(() => {
    if (!lot || !dimension) return {};

    // Naviguer jusqu'au nœud parent
    let node: Lot | Dimension | null = lot;
    for (let i = 0; i < cheminSelection.length; i++) {
      const { dimension: dim, valeur } = cheminSelection[i];
      if (dim === dimensionKey) break;
      if (!valeur || !node || typeof node !== 'object') {
        node = null;
        break;
      }
      const nodeObj = node as Record<string, unknown>;
      if (!(dim in nodeObj)) {
        node = null;
        break;
      }
      const dimValue = nodeObj[dim];
      if (
        typeof dimValue !== 'object' ||
        dimValue === null ||
        Array.isArray(dimValue)
      ) {
        node = null;
        break;
      }
      const dimObj = dimValue as Record<string, unknown>;
      if (!(valeur in dimObj)) {
        node = null;
        break;
      }
      const value = dimObj[valeur];
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        node = null;
        break;
      }
      node = value as Lot | Dimension;
    }

    const names: Record<string, string> = {};
    segments.forEach(seg => {
      const itemObj =
        node && dimension && dimension[seg.key]
          ? (dimension[seg.key] as DimensionValue)
          : null;
      names[seg.key] = getTitreAffiche(seg.name, itemObj, lang);
    });

    return names;
  }, [lot, dimension, cheminSelection, dimensionKey, segments, lang]);

  // Si pas de dimension ou pas de segments, vérifier si on doit afficher l'état vide
  if (!dimension) {
    return null;
  }

  // Si pas de segments mais qu'il y a des dimensions disponibles, afficher l'état vide grisé
  if (segments.length === 0) {
    // Si aucune dimension disponible, on est à une feuille, ne pas afficher
    if (!hasAvailableDimensions) {
      return null;
    }

    // Ne pas afficher la barre vide si on n'est pas en mode éditable
    if (!isEditable) {
      return null;
    }

    // Afficher la stackbar vide grisée
    const showAddButton = isEditable && hasAvailableDimensions;
    const emptyText = t ? t('emptyDimension', {}) : 'Dimension vide';

    return (
      <div className="flex items-center mb-5">
        <div
          className="flex flex-1 h-16 overflow-hidden rounded-xl shadow-sm bg-gray-100 border border-gray-300 relative"
          style={{ pointerEvents: 'none' }}
        >
          {/* Texte "Dimension vide" au centre, même style que les segments */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-full h-full text-center px-1 flex flex-col items-center justify-center overflow-hidden">
              <span
                className="text-black font-medium text-xs leading-tight truncate w-full"
                title={emptyText}
              >
                {emptyText}
              </span>
            </div>
          </div>
        </div>
        {showAddButton && (
          <div className="flex items-center justify-center h-16 w-10">
            <button
              type="button"
              className="w-7 h-7 bg-white border border-gray-300 rounded-full shadow flex items-center justify-center hover:bg-gray-50 active:scale-95 transition cursor-pointer"
              aria-label="Ajouter"
              onClick={onAdd}
            >
              <i className="ph ph-plus w-4 h-4"></i>
            </button>
          </div>
        )}
      </div>
    );
  }

  let cumulatedPercent = 0;
  const handles: Array<{ index: number; percent: number }> = [];
  const showAddButton = isEditable && hasAvailableDimensions;

  return (
    <div className="flex items-center mb-5">
      <div
        id="stackbar-container"
        ref={containerRef}
        className="flex flex-1 h-16 overflow-hidden rounded-xl shadow-sm relative"
      >
        {segments.map((segment, index) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const _segmentStart = cumulatedPercent;
          cumulatedPercent += segment.percent;

          // Stocker la position de la poignée pour ce segment
          if (isEditable && index < segments.length - 1) {
            handles.push({ index, percent: cumulatedPercent });
          }

          return (
            <div
              key={segment.key}
              className="relative"
              style={{ width: `${segment.percent}%` }}
            >
              <StackbarSegment
                segment={segment}
                index={index}
                totalSegments={segments.length}
                dimension={dimensionKey}
                isSelected={selectedKey === segment.key}
                isDisabled={selectedKey !== null && selectedKey !== segment.key}
                isFirst={index === 0}
                isLast={index === segments.length - 1}
                onClick={() => onSegmentClick(segment.key)}
                displayName={displayNames[segment.key] || segment.name}
              />
            </div>
          );
        })}

        {/* Poignées de drag positionnées absolument par rapport au conteneur */}
        {isEditable &&
          handles.map(({ index, percent }) => (
            <button
              key={`handle-${index}`}
              type="button"
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-7 h-7 bg-white border border-gray-300 rounded-full shadow flex items-center justify-center hover:bg-gray-50 active:scale-95 transition z-50 cursor-ew-resize"
              style={{
                left: `${percent}%`,
                zIndex: 50,
                pointerEvents: 'auto',
              }}
              onMouseDown={e => {
                e.preventDefault();
                if (containerRef.current) {
                  handleDragStart(index, e.clientX);
                }
              }}
              aria-label="Ajuster la répartition"
            >
              <svg width="18" height="18" fill="none" viewBox="0 0 18 18">
                <path
                  d="M7 5l-3 4 3 4"
                  stroke="#888"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M11 5l3 4-3 4"
                  stroke="#888"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          ))}
      </div>

      {showAddButton && (
        <div className="flex items-center justify-center h-16 w-10">
          <button
            type="button"
            className="w-7 h-7 bg-white border border-gray-300 rounded-full shadow flex items-center justify-center hover:bg-gray-50 active:scale-95 transition cursor-pointer"
            aria-label="Ajouter"
            onClick={onAdd}
          >
            <i className="ph ph-plus w-4 h-4"></i>
          </button>
        </div>
      )}
    </div>
  );
}
