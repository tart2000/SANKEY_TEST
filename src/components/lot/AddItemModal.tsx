import { useState, useEffect, useMemo } from 'react';
import type { BaseData, BaseDataItem, DimensionValue } from '@/types/lot';
import { getTitreAffiche } from '@/services/lot/dimensionUtils';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';

interface AddItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (
    bubbleId: string,
    pourcentage: number,
    donneesBase: BaseDataItem,
    poidsKg?: number
  ) => void;
  dimension: string;
  dimensionLabel: string;
  loadBaseData: (dimension: string) => Promise<BaseData | null>;
  existingKeys: string[];
  lang: string;
  fetchItemComplete: (bubbleId: string) => Promise<BaseDataItem | null>;
  t: (key: string, params?: Record<string, string>) => string;
  poidsNiveau?: number;
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
  poidsNiveau = 0,
}: AddItemModalProps) {
  const [selectedElement, setSelectedElement] = useState<string>('');
  const [valeur, setValeur] = useState<string>('');
  const [unite, setUnite] = useState<'percentage' | 'weight'>('percentage');
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

  // Réinitialiser le champ valeur quand on change d'unité
  useEffect(() => {
    setValeur('');
  }, [unite]);

  // Valider le formulaire
  useEffect(() => {
    let valid = !!selectedElement;

    if (!isFirstElement) {
      const val = parseFloat(valeur);
      if (unite === 'percentage') {
        valid = valid && !isNaN(val) && val >= 0 && val <= 100;
      } else {
        // Pour les kg, on accepte n'importe quelle valeur positive
        valid = valid && !isNaN(val) && val >= 0;
      }
    }

    setIsValid(valid);
  }, [selectedElement, valeur, isFirstElement, unite]);

  // Réinitialiser quand la modal s'ouvre
  useEffect(() => {
    if (isOpen) {
      setSelectedElement('');
      setValeur('');
      setUnite('percentage');
      setIsValid(false);
    }
  }, [isOpen]);

  const handleAdd = async () => {
    if (!isValid || !baseData || !selectedElement) return;

    let pct: number;
    let poidsKg: number | undefined;

    if (isFirstElement) {
      pct = 100;
    } else if (unite === 'percentage') {
      pct = parseFloat(valeur);
      poidsKg = undefined;
    } else {
      // Mode kg : on calcule le pourcentage
      poidsKg = parseFloat(valeur);
      if (poidsNiveau > 0) {
        pct = (poidsKg / poidsNiveau) * 100;
      } else {
        // Si poids du niveau = 0, on met à 100%
        pct = 100;
      }
    }

    const bubbleId = baseData[selectedElement]?.bubble_id || selectedElement;

    // Essayer de récupérer l'élément complet
    const elementComplet = await fetchItemComplete(bubbleId);
    if (elementComplet) {
      // Extraire la clé et la valeur
      const nomLisible = Object.keys(elementComplet)[0];
      const data = elementComplet[nomLisible] as BaseDataItem;
      onAdd(nomLisible, pct, data, poidsKg);
    } else {
      // Fallback : utiliser les données de base
      const baseItem = baseData[selectedElement];
      if (baseItem) {
        onAdd(selectedElement, pct, baseItem, poidsKg);
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
          <div className="text-center">{t('loading')}</div>
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
            className="text-gray-400 hover:text-gray-500 focus:outline-none cursor-pointer"
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
                htmlFor="valeur"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                {unite === 'percentage' ? t('percentage') : t('weight')}
              </label>
              <div className="relative">
                <input
                  type="number"
                  id="valeur"
                  value={valeur}
                  onChange={e => setValeur(e.target.value)}
                  className="block w-full px-3 py-2.5 pr-20 text-base border border-gray-300 rounded-lg bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                  placeholder="0"
                  min="0"
                  max={unite === 'percentage' ? '100' : undefined}
                  step={unite === 'percentage' ? '0.1' : '0.01'}
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-1">
                  <Select
                    value={unite}
                    onValueChange={(value: 'percentage' | 'weight') =>
                      setUnite(value)
                    }
                  >
                    <SelectTrigger className="h-8 w-16 border border-gray-200 shadow-none bg-white hover:bg-gray-50 focus:ring-0 cursor-pointer">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">%</SelectItem>
                      <SelectItem value="weight">kg</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t">
          <button
            type="button"
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 cursor-pointer"
            onClick={onClose}
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            disabled={!isValid}
            className={`px-4 py-2 text-sm font-medium border border-transparent rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
              isValid
                ? 'text-white bg-blue-600 hover:bg-blue-700 cursor-pointer'
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
