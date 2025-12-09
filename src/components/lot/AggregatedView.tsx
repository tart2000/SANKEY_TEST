import { useMemo } from 'react';
import type { Lot } from '@/types/lot';
import { getAggregatedValues } from '@/services/lot/lotUtils';

interface AggregatedViewProps {
  lot: Lot;
  dimension: string;
  lang: string;
  t: (key: string, params?: Record<string, string>) => string;
}

export function AggregatedView({
  lot,
  dimension,
  lang,
  t,
}: AggregatedViewProps) {
  const aggregatedRows = useMemo(() => {
    return getAggregatedValues(lot, dimension, lang);
  }, [lot, dimension, lang]);

  if (aggregatedRows.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        {t('detailsNotAvailable')}
      </div>
    );
  }

  return (
    <div className="w-full mb-4">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-gray-300">
            <th className="text-left py-2 px-4 font-semibold text-sm text-gray-700">
              {t('element')}
            </th>
            <th className="text-right py-2 px-4 font-semibold text-sm text-gray-700">
              {t('totalWeight')}
            </th>
            <th className="text-right py-2 px-4 font-semibold text-sm text-gray-700">
              {t('totalPercentage')}
            </th>
          </tr>
        </thead>
        <tbody>
          {aggregatedRows.map(row => {
            const isNA = row.bubbleId === null;
            const bgColor = isNA ? undefined : row.color;
            const bgStyle = bgColor
              ? {
                  backgroundColor: bgColor,
                  opacity: 0.2,
                  width: `${row.totalPercentage}%`,
                }
              : {
                  backgroundImage: `repeating-linear-gradient(
                    45deg,
                    #e5e7eb,
                    #e5e7eb 10px,
                    #d1d5db 10px,
                    #d1d5db 20px
                  )`,
                  width: `${row.totalPercentage}%`,
                };

            return (
              <tr
                key={row.bubbleId || 'na'}
                className="border-b border-gray-200 relative"
                style={{ height: '48px' }}
              >
                <td className="px-4 py-2 relative z-10 font-medium">
                  {row.name}
                </td>
                <td className="px-4 py-2 text-right relative z-10">
                  {row.totalKg.toFixed(1)} kg
                </td>
                <td className="px-4 py-2 text-right relative z-10">
                  {row.totalPercentage.toFixed(1)}%
                </td>
                {/* Progress bar background */}
                <td
                  className="absolute left-0 top-0 bottom-0 z-0 pointer-events-none"
                  style={bgStyle}
                />
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
