import { useCallback } from 'react';
import type { Lot } from '@/types/lot';

export function useIframeCommunication() {
  // Envoyer un message LOT_UPDATED
  const sendLotUpdated = useCallback((lot: Lot) => {
    if (typeof window === 'undefined' || window.parent === window) {
      return; // Pas dans une iframe
    }

    window.parent.postMessage(
      {
        type: 'LOT_UPDATED',
        data: lot,
      },
      '*'
    );
  }, []);

  return {
    sendLotUpdated,
  };
}
