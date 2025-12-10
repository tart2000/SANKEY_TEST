import { memo } from 'react';
import type { StackbarSegment as StackbarSegmentType } from '@/types/lot';
import {
  getSegmentColor,
  isSpecialSegment,
  formatRGBA,
  getSpecialSegmentStyles,
} from '@/services/lot/colorUtils';

interface StackbarSegmentProps {
  segment: StackbarSegmentType;
  index: number;
  totalSegments: number;
  dimension: string;
  isSelected: boolean;
  isDisabled: boolean;
  isFirst: boolean;
  isLast: boolean;
  onClick: () => void;
  displayName: string;
}

export const StackbarSegment = memo(function StackbarSegment({
  segment,
  index,
  totalSegments,
  dimension,
  isSelected,
  isDisabled,
  isFirst,
  isLast,
  onClick,
  displayName,
}: StackbarSegmentProps) {
  const isSpecial = isSpecialSegment(segment.name);
  const color = getSegmentColor(dimension, index, totalSegments, segment.color);

  const styles: React.CSSProperties = {
    width: '100%',
    height: '100%',
    letterSpacing: '0.5px',
    cursor: 'pointer',
    opacity: isDisabled ? 0.4 : 1,
  };

  if (isSpecial) {
    const specialStyles = getSpecialSegmentStyles();
    Object.assign(styles, specialStyles);
    // Appliquer les border-radius pour suivre l'arrondi du conteneur (12px) + border (1px) = 14px
    if (isFirst) {
      styles.borderTopLeftRadius = '14px';
      styles.borderBottomLeftRadius = '14px';
    }
    if (isLast) {
      styles.borderTopRightRadius = '14px';
      styles.borderBottomRightRadius = '14px';
    }
  } else {
    styles.background = formatRGBA(color, 0.8);
    styles.border = `2px solid ${formatRGBA(color, 1)}`;
    if (isSelected) {
      styles.border = `4px solid ${formatRGBA(color, 1)}`;
    }
    if (isFirst) {
      styles.borderTopLeftRadius = '12px';
      styles.borderBottomLeftRadius = '12px';
    }
    if (isLast) {
      styles.borderTopRightRadius = '12px';
      styles.borderBottomRightRadius = '12px';
    }
  }

  return (
    <div
      className="flex items-center justify-center relative font-bold text-base transition-all duration-200"
      style={styles}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      aria-label={`Segment ${displayName}, ${segment.percent.toFixed(1)}%`}
    >
      <div className="w-full h-full text-center px-1 flex flex-col items-center justify-center overflow-hidden">
        <span
          className="text-black font-medium text-xs leading-tight truncate w-full"
          title={displayName}
        >
          {displayName}
        </span>
        <span className="text-black font-normal text-xs leading-tight truncate w-full">
          {segment.percent.toFixed(1)}%
        </span>
      </div>
    </div>
  );
});
