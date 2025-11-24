import { useCallback, useRef, useEffect } from 'react';
import type { Lot } from '@/types/lot';

export function useIframeCommunication() {
  const heightTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Envoyer la hauteur au parent
  const sendHeight = useCallback((height: number) => {
    if (typeof window === 'undefined' || window.parent === window) {
      return; // Pas dans une iframe
    }

    // Debounce pour éviter trop de messages
    if (heightTimeoutRef.current) {
      clearTimeout(heightTimeoutRef.current);
    }

    heightTimeoutRef.current = setTimeout(() => {
      window.parent.postMessage({ type: 'IFRAME_HEIGHT', height }, '*');
    }, 100);
  }, []);

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

  // Nettoyer le timeout au démontage
  useEffect(() => {
    return () => {
      if (heightTimeoutRef.current) {
        clearTimeout(heightTimeoutRef.current);
      }
    };
  }, []);

  return {
    sendHeight,
    sendLotUpdated,
  };
}
