import { useState, useEffect } from 'react';
import { useLotAPI } from '@/hooks/lot/useLotAPI';
import type { Lot } from '@/types/lot';

interface SaveButtonProps {
  lotId: string;
  lot: Lot | null;
  isLive: boolean;
  isModified: boolean;
  isEditable: boolean;
  onSaveSuccess?: () => void;
  t: (key: string) => string;
}

export function SaveButton({
  lotId,
  lot,
  isLive,
  isModified,
  isEditable,
  onSaveSuccess,
  t,
}: SaveButtonProps) {
  const { saveLot, loading } = useLotAPI();
  const [saveState, setSaveState] = useState<
    'idle' | 'saving' | 'saved' | 'error'
  >('idle');

  // Réinitialiser l'état quand isModified change
  useEffect(() => {
    if (!isModified && saveState !== 'idle') {
      setSaveState('idle');
    }
  }, [isModified, saveState]);

  const handleSave = async () => {
    if (!lot || !isModified) return;

    setSaveState('saving');
    const success = await saveLot(lotId, lot, isLive);

    if (success) {
      setSaveState('saved');
      onSaveSuccess?.();
      setTimeout(() => {
        setSaveState('idle');
      }, 1500);
    } else {
      setSaveState('error');
      setTimeout(() => {
        setSaveState('idle');
      }, 2000);
    }
  };

  if (!isEditable) {
    return null;
  }

  const getButtonText = () => {
    switch (saveState) {
      case 'saving':
        return t('saving') || 'Enregistrement...';
      case 'saved':
        return t('saved') || 'Enregistré !';
      case 'error':
        return t('error') || 'Erreur';
      default:
        return t('save') || 'Enregistrer';
    }
  };

  const isDisabled = !isModified || loading || saveState === 'saving';

  return (
    <div className="flex justify-end pb-4" id="save-btn-container">
      <button
        id="save-lot-btn"
        disabled={isDisabled}
        onClick={handleSave}
        className="px-6 py-2 bg-blue-600 text-white border-none rounded text-base cursor-pointer transition-opacity disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700"
        style={{
          opacity: isDisabled ? 0.5 : 1,
        }}
      >
        {getButtonText()}
      </button>
    </div>
  );
}
