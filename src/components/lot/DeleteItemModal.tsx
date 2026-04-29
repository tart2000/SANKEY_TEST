import { useState, useEffect } from 'react';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';

interface DeleteItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (mode: 'percentage' | 'weight') => void;
  nomElement: string;
  dimensionLabel: string;
  poidsElement: number;
  t: (key: string, params?: Record<string, string>) => string;
}

export function DeleteItemModal({
  isOpen,
  onClose,
  onConfirm,
  nomElement,
  dimensionLabel,
  poidsElement,
  t,
}: DeleteItemModalProps) {
  const [mode, setMode] = useState<'percentage' | 'weight'>('percentage');

  // Réinitialiser à l'ouverture pour ne pas garder le choix précédent
  useEffect(() => {
    if (isOpen) {
      setMode('percentage');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const dimensionTraduite = (dimensionLabel || '').toLowerCase();
  const poidsAffiche = Number.isFinite(poidsElement)
    ? poidsElement.toFixed(1)
    : '0';

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
            {t('deleteItemTitle', { dimension: dimensionTraduite })}
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
          {/* Élément à supprimer mis en évidence */}
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
            <div className="text-xs text-gray-500">{dimensionLabel}</div>
            <div className="text-base font-semibold text-gray-900 break-words">
              {nomElement}
            </div>
          </div>

          {/* Phrase de confirmation */}
          <p className="text-sm text-gray-700">{t('deleteItemMessage')}</p>

          {/* Sélecteur de mode */}
          <div>
            <label
              htmlFor="deleteMode"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              {t('deleteMode')}
            </label>
            <Select
              value={mode}
              onValueChange={(value: 'percentage' | 'weight') => setMode(value)}
            >
              <SelectTrigger
                id="deleteMode"
                className="w-full border border-gray-300 shadow-sm bg-white hover:bg-gray-50 cursor-pointer"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="percentage">
                  {t('deleteModePercentage')}
                </SelectItem>
                <SelectItem value="weight">{t('deleteModeWeight')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Info contextuelle selon le mode */}
          <div className="rounded-md bg-blue-50 border border-blue-100 px-3 py-2 text-xs text-blue-900">
            {mode === 'weight'
              ? t('aboutToRemoveWeight', { weight: poidsAffiche })
              : t('aboutToRemovePercentage')}
          </div>
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
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 border border-transparent rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 cursor-pointer"
            onClick={() => onConfirm(mode)}
          >
            {t('confirmDeleteItem')}
          </button>
        </div>
      </div>
    </div>
  );
}
