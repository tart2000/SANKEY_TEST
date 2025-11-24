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

  if (!dimension || segments.length === 0) {
    return null;
  }

  let cumulatedPercent = 0;
  const handles: Array<{ index: number; percent: number }> = [];

  return (
    <div
      id="stackbar-container"
      ref={containerRef}
      className="flex w-full h-16 overflow-hidden rounded-xl shadow-sm mb-5 relative"
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
  );
}
