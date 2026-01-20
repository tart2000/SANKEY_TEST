import type {
  Lot,
  Dimension,
  DimensionValue,
  CheminSelection,
  DimensionLabels,
} from '@/types/lot';
import { getDimensionLabel } from '@/services/lot/dimensionUtils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface StackbarHeaderProps {
  niveau: number;
  nom: string;
  nomCle: string;
  itemObj: DimensionValue | null;
  pct: number;
  kg: number;
  lot: Lot;
  cheminSelection: CheminSelection;
  availableDimensions: string[];
  dimensionsLabels: DimensionLabels | null;
  lang: string;
  isEditable: boolean;
  frequency?: 'récurrent' | 'ponctuel';
  viewMode?: 'detailed' | 'aggregated';
  showViewToggle?: boolean;
  aggregatedDimension?: string;
  allDimensions?: string[];
  onNavigateSibling: (niveau: number, direction: -1 | 1) => void;
  onDimensionChange: (dimension: string) => void;
  onAggregatedDimensionChange?: (dimension: string) => void;
  onDelete: () => void;
  onClose: () => void;
  onFrequencyChange: (frequency: 'récurrent' | 'ponctuel') => void;
  onViewModeChange?: (mode: 'detailed' | 'aggregated') => void;
  onUpdateLot: (updater: (lot: Lot) => Lot) => void;
  onLotChange: (lot: Lot) => void;
  t?: (key: string, params?: Record<string, string>) => string;
}

export function StackbarHeader({
  niveau,
  nom,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  nomCle: _nomCle,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  itemObj: _itemObj,
  pct,
  kg,
  lot,
  cheminSelection,
  availableDimensions,
  dimensionsLabels,
  lang,
  isEditable,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  frequency: _frequency,
  viewMode = 'detailed',
  showViewToggle = false,
  aggregatedDimension,
  allDimensions = [],
  onNavigateSibling,
  onDimensionChange,
  onAggregatedDimensionChange,
  onDelete,
  onClose,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onFrequencyChange: _onFrequencyChange,
  onViewModeChange,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onUpdateLot: _onUpdateLot,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onLotChange: _onLotChange,
  t,
}: StackbarHeaderProps) {
  const currentDimension = cheminSelection[niveau]?.dimension;

  // Calculer le nombre de siblings pour masquer les flèches si un seul élément
  const hasSiblings = (() => {
    if (niveau === 0) return false; // Pas de flèches au niveau 0
    if (!cheminSelection[niveau - 1]?.dimension) return false;

    // Récupérer le nœud parent
    let nodeParent: Lot | Dimension | null = lot;
    for (let i = 0; i < niveau - 1; i++) {
      const { dimension, valeur } = cheminSelection[i];
      if (!valeur || !nodeParent || typeof nodeParent !== 'object') {
        return false;
      }
      const nodeObj = nodeParent as Record<string, unknown>;
      if (!(dimension in nodeObj)) {
        return false;
      }
      const dimValue = nodeObj[dimension];
      if (
        typeof dimValue !== 'object' ||
        dimValue === null ||
        Array.isArray(dimValue)
      ) {
        return false;
      }
      const dimObj = dimValue as Record<string, unknown>;
      if (!(valeur in dimObj)) {
        return false;
      }
      const value = dimObj[valeur];
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return false;
      }
      nodeParent = value as Lot | Dimension;
    }

    // Récupérer les siblings
    const parentDimension = cheminSelection[niveau - 1].dimension;
    if (!nodeParent || !parentDimension) return false;

    const nodeObj = nodeParent as Record<string, unknown>;
    if (!(parentDimension in nodeObj)) return false;

    const dimValue = nodeObj[parentDimension];
    if (
      typeof dimValue !== 'object' ||
      dimValue === null ||
      Array.isArray(dimValue)
    ) {
      return false;
    }

    const siblings = Object.keys(dimValue).filter(k => k !== 'title');
    return siblings.length > 1; // Afficher les flèches seulement s'il y a plus d'un sibling
  })();

  return (
    <div className="font-bold mb-4 flex items-center justify-between">
      <div className="flex items-center justify-between w-full">
        {/* Groupe gauche : Poids (non éditable) pour niveau 0, Navigation + titre + % + kg pour niveau > 0 */}
        {niveau === 0 ? (
          <div className="inline-flex rounded-lg border border-gray-300 bg-white shadow-sm items-stretch h-10 overflow-hidden">
            <span className="px-3 h-full text-sm flex items-center">
              {kg ? `${kg.toFixed(1)} kg` : ''}
            </span>
          </div>
        ) : (
          <div className="inline-flex rounded-lg border border-gray-300 bg-white shadow-sm items-stretch h-10 overflow-hidden">
            {hasSiblings && (
              <>
                <button
                  className="px-3 h-full hover:bg-gray-100 focus:outline-none focus:bg-gray-100 flex items-center justify-center cursor-pointer"
                  aria-label="Précédent"
                  onClick={() => onNavigateSibling(niveau - 1, -1)}
                >
                  <i className="ph ph-caret-left w-4 h-4"></i>
                </button>
                <button
                  className="border-l border-gray-300 px-3 h-full hover:bg-gray-100 focus:outline-none focus:bg-gray-100 flex items-center justify-center cursor-pointer"
                  aria-label="Suivant"
                  onClick={() => onNavigateSibling(niveau - 1, 1)}
                >
                  <i className="ph ph-caret-right w-4 h-4"></i>
                </button>
              </>
            )}

            <span
              className={`${niveau > 0 && hasSiblings ? 'border-l border-gray-300' : ''} px-4 h-full font-bold text-base flex items-center`}
            >
              {nom}
            </span>

            <span className="border-l border-gray-300 px-3 h-full text-sm flex items-center">
              {pct.toFixed(1)}%
            </span>

            <span className="border-l border-gray-300 px-3 h-full text-sm flex items-center">
              {kg ? `${kg.toFixed(1)} kg` : ''}
            </span>
          </div>
        )}

        {/* Groupe centre : Button group dimensions ou Select en vue agrégée */}
        <div className="flex-1 flex justify-center items-center">
          {viewMode === 'aggregated' &&
          onAggregatedDimensionChange &&
          t &&
          allDimensions.length > 0 ? (
            <div className="inline-flex rounded-lg border border-blue-200 bg-white shadow items-center h-10 overflow-hidden px-4">
              <Select
                value={aggregatedDimension || 'formats'}
                onValueChange={onAggregatedDimensionChange}
              >
                <SelectTrigger className="h-10 min-w-[200px] border-0 !border-0 bg-transparent shadow-none focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:border-0 px-0 text-base font-semibold">
                  <SelectValue placeholder={t('selectDimension')} />
                </SelectTrigger>
                <SelectContent>
                  {allDimensions.map(dim => (
                    <SelectItem key={dim} value={dim}>
                      {getDimensionLabel(dim, dimensionsLabels, lang)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            availableDimensions.length > 0 && (
              <div className="inline-flex rounded-lg border border-blue-200 bg-white shadow items-center h-10 overflow-hidden">
                {availableDimensions.map((dim, idx) => {
                  const isSelected = dim === currentDimension;
                  return (
                    <button
                      key={dim}
                      className={`h-10 min-w-[90px] px-4 text-base font-semibold focus:outline-none cursor-pointer ${
                        isSelected
                          ? 'bg-blue-50 text-blue-600 border-blue-200 shadow'
                          : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-100'
                      } ${idx > 0 ? 'border-l border-gray-200' : ''}`}
                      style={{ borderRadius: 0 }}
                      onClick={() => onDimensionChange(dim)}
                    >
                      {getDimensionLabel(dim, dimensionsLabels, lang)}
                    </button>
                  );
                })}
              </div>
            )
          )}
        </div>

        {/* Groupe droite : Bouton vue et boutons actions */}
        <div
          className={`flex items-center ${viewMode === 'aggregated' && (!isEditable || availableDimensions.length === 0) ? '' : 'gap-2'}`}
        >
          {/* Button group vue - visible si showViewToggle */}
          {showViewToggle && onViewModeChange && t && (
            <div className="inline-flex rounded-lg border border-blue-200 bg-white shadow items-center h-10 overflow-hidden">
              <button
                type="button"
                className={`h-10 px-4 text-base font-semibold focus:outline-none cursor-pointer flex items-center gap-2 ${
                  viewMode === 'detailed'
                    ? 'bg-blue-50 text-blue-600 border-blue-200 shadow'
                    : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-100'
                }`}
                style={{ borderRadius: 0 }}
                onClick={() => onViewModeChange('detailed')}
              >
                <i className="ph ph-list-magnifying-glass w-4 h-4"></i>
                <span>{t('viewDetailed')}</span>
              </button>
              <button
                type="button"
                className={`h-10 px-4 text-base font-semibold focus:outline-none cursor-pointer flex items-center gap-2 border-l border-gray-200 ${
                  viewMode === 'aggregated'
                    ? 'bg-blue-50 text-blue-600 border-blue-200 shadow'
                    : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-100'
                }`}
                style={{ borderRadius: 0 }}
                onClick={() => onViewModeChange('aggregated')}
              >
                <i className="ph ph-chart-bar-horizontal w-4 h-4"></i>
                <span>{t('viewAggregated')}</span>
              </button>
            </div>
          )}

          {/* Boutons actions */}
          {isEditable && viewMode !== 'aggregated' && niveau > 0 && (
            <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden bg-white shadow-sm items-center h-10">
              <button
                className="h-full px-3 py-2 hover:bg-gray-100 focus:outline-none focus:bg-gray-100 border-r border-gray-300 cursor-pointer rounded-l-lg"
                aria-label="Supprimer"
                onClick={onDelete}
              >
                <i className="ph ph-trash w-4 h-4"></i>
              </button>
              <button
                className="h-full px-3 py-2 hover:bg-gray-100 focus:outline-none focus:bg-gray-100 rounded-r-lg cursor-pointer"
                aria-label="Fermer"
                onClick={onClose}
              >
                <i className="ph ph-x w-4 h-4"></i>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
