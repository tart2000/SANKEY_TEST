import { useState, useEffect, useMemo } from 'react';
import type { BaseData, BaseDataItem, DimensionValue } from '@/types/lot';
import { getTitreAffiche } from '@/services/lot/dimensionUtils';

interface AddItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (
    bubbleId: string,
    pourcentage: number,
    donneesBase: BaseDataItem
  ) => void;
  dimension: string;
  dimensionLabel: string;
  loadBaseData: (dimension: string) => Promise<BaseData | null>;
  existingKeys: string[];
  lang: string;
  fetchItemComplete: (bubbleId: string) => Promise<BaseDataItem | null>;
  t: (key: string, params?: Record<string, string>) => string;
}

export function AddItemModal({
  isOpen,
  onClose,
  onAdd,
  dimension,
  dimensionLabel,
  loadBaseData,
  existingKeys,
  lang,
  fetchItemComplete,
  t,
}: AddItemModalProps) {
  const [selectedElement, setSelectedElement] = useState<string>('');
  const [pourcentage, setPourcentage] = useState<string>('');
  const [isValid, setIsValid] = useState(false);
  const [baseData, setBaseData] = useState<BaseData | null>(null);
  const [loading, setLoading] = useState(false);

  // Charger les données de base quand la modal s'ouvre
  useEffect(() => {
    if (isOpen && !baseData) {
      setLoading(true);
      loadBaseData(dimension).then(data => {
        setBaseData(data);
        setLoading(false);
      });
    }
  }, [isOpen, dimension, baseData, loadBaseData]);

  // Filtrer les éléments disponibles
  const availableElements = useMemo(() => {
    if (!baseData) return [];

    const elements = Object.keys(baseData).filter(
      key => !existingKeys.includes(key)
    );

    // Trier par ordre alphabétique selon la langue
    elements.sort((a, b) => {
      // getTitreAffiche peut utiliser BaseDataItem car il cherche seulement en_gb
      // On passe null si pas disponible
      const itemA = baseData[a]
        ? (baseData[a] as unknown as DimensionValue)
        : null;
      const itemB = baseData[b]
        ? (baseData[b] as unknown as DimensionValue)
        : null;
      const titreA = getTitreAffiche(a, itemA, lang);
      const titreB = getTitreAffiche(b, itemB, lang);
      return titreA.localeCompare(titreB);
    });

    return elements;
  }, [baseData, existingKeys, lang]);

  const isFirstElement = existingKeys.length === 0;

  // Valider le formulaire
  useEffect(() => {
    let valid = !!selectedElement;

    if (!isFirstElement) {
      const pct = parseFloat(pourcentage);
      valid = valid && !isNaN(pct) && pct >= 0 && pct <= 100;
    }

    setIsValid(valid);
  }, [selectedElement, pourcentage, isFirstElement]);

  // Réinitialiser quand la modal s'ouvre
  useEffect(() => {
    if (isOpen) {
      setSelectedElement('');
      setPourcentage('');
      setIsValid(false);
    }
  }, [isOpen]);

  const handleAdd = async () => {
    if (!isValid || !baseData || !selectedElement) return;

    const pct = isFirstElement ? 100 : parseFloat(pourcentage);
    const bubbleId = baseData[selectedElement]?.bubble_id || selectedElement;

    // Essayer de récupérer l'élément complet
    const elementComplet = await fetchItemComplete(bubbleId);
    if (elementComplet) {
      // Extraire la clé et la valeur
      const nomLisible = Object.keys(elementComplet)[0];
      const data = elementComplet[nomLisible] as BaseDataItem;
      onAdd(nomLisible, pct, data);
    } else {
      // Fallback : utiliser les données de base
      const baseItem = baseData[selectedElement];
      if (baseItem) {
        onAdd(selectedElement, pct, baseItem);
      }
    }

    onClose();
  };

  if (!isOpen) return null;

  const dimensionTraduite = dimensionLabel.toLowerCase();

  if (loading) {
    return (
      <div
        className="fixed inset-0 flex items-center justify-center z-50"
        style={{ background: 'none' }}
        onClick={e => {
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
      >
        <div className="bg-white rounded-lg shadow-2xl p-8">
          <div className="text-center">Chargement...</div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ background: 'none' }}
      onClick={e => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="bg-white rounded-lg shadow-2xl w-full max-w-md mx-4"
        style={{
          boxShadow:
            '0 8px 40px 8px rgba(0,0,0,0.35), 0 1.5px 8px rgba(0,0,0,0.10)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900">
            {t('addItem', { dimension: dimensionTraduite })}
          </h3>
          <button
            type="button"
            className="text-gray-400 hover:text-gray-500 focus:outline-none"
            onClick={onClose}
            aria-label={t('close')}
          >
            <i className="ph ph-x w-5 h-5"></i>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          <div>
            <label
              htmlFor="element"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              {t('element')}
            </label>
            <div className="relative">
              <select
                id="element"
                value={selectedElement}
                onChange={e => setSelectedElement(e.target.value)}
                className="block w-full px-3 py-2.5 text-base border border-gray-300 rounded-lg bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none cursor-pointer"
              >
                <option value="" className="text-gray-500">
                  {t('selectElement')}
                </option>
                {availableElements.map(elem => {
                  // getTitreAffiche peut utiliser BaseDataItem car il cherche seulement en_gb
                  const item = baseData?.[elem]
                    ? (baseData[elem] as unknown as DimensionValue)
                    : null;
                  const titreAffiche = getTitreAffiche(elem, item, lang);
                  // eslint-disable-next-line @typescript-eslint/no-unused-vars
                  const _bubbleId = baseData?.[elem]?.bubble_id || elem;
                  return (
                    <option key={elem} value={elem} className="py-1">
                      {titreAffiche}
                    </option>
                  );
                })}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </div>
            </div>
          </div>

          {!isFirstElement && (
            <div>
              <label
                htmlFor="pourcentage"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                {t('percentage')}
              </label>
              <div className="relative">
                <input
                  type="number"
                  id="pourcentage"
                  value={pourcentage}
                  onChange={e => setPourcentage(e.target.value)}
                  className="block w-full px-3 py-2.5 text-base border border-gray-300 rounded-lg bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0"
                  min="0"
                  max="100"
                  step="0.1"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-2">
                  <span className="bg-white border border-gray-200 rounded-md px-2 py-0.5 text-gray-500 text-sm font-medium">
                    %
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t">
          <button
            type="button"
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            onClick={onClose}
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            disabled={!isValid}
            className={`px-4 py-2 text-sm font-medium border border-transparent rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
              isValid
                ? 'text-white bg-blue-600 hover:bg-blue-700'
                : 'text-gray-400 bg-gray-200 cursor-not-allowed'
            }`}
            onClick={handleAdd}
          >
            {t('add')}
          </button>
        </div>
      </div>
    </div>
  );
}
