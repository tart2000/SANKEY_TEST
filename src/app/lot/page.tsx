'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import type { Lot } from '@/types/lot';
import { LotEditor } from '@/components/lot/LotEditor';
import { SkeletonLoader } from '@/components/lot/SkeletonLoader';
import { useLotAPI } from '@/hooks/lot/useLotAPI';
import { useTranslation } from '@/lib/i18n';

function LotPageContent() {
  const searchParams = useSearchParams();
  const [lot, setLot] = useState<Lot | null>(null);
  const [loading, setLoading] = useState(true);
  const [d3Loaded, setD3Loaded] = useState(false);

  // Lire les paramètres URL
  const lang = searchParams.get('lang') || 'fr_fr';
  const lotId = searchParams.get('id') || '';
  const isLive = searchParams.get('isLive') === 'true';
  const isEditable = searchParams.get('isEditable') !== 'false';
  const width = searchParams.get('width') || '100%';

  const { fetchLot } = useLotAPI();
  const { t } = useTranslation(lang);

  // Charger D3 et Phosphor Icons
  useEffect(() => {
    // Charger D3
    if (typeof window !== 'undefined' && !(window as { d3?: unknown }).d3) {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/d3@7';
      script.async = true;
      script.onload = () => {
        setD3Loaded(true);
      };
      document.head.appendChild(script);
    } else {
      setD3Loaded(true);
    }

    // Charger Phosphor Icons
    if (!document.querySelector('link[href*="phosphor-icons"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.type = 'text/css';
      link.href =
        'https://cdn.jsdelivr.net/npm/@phosphor-icons/web@2.1.1/src/regular/style.css';
      document.head.appendChild(link);
    }
  }, []);

  // Appliquer la width configurable
  useEffect(() => {
    if (width) {
      document.documentElement.style.setProperty('--iframe-width', width);
    }
  }, [width]);

  // Charger le lot depuis l'API
  useEffect(() => {
    if (!lotId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    fetchLot(lotId, isLive)
      .then(loadedLot => {
        if (loadedLot) {
          setLot(loadedLot);
        }
        setLoading(false);
      })
      .catch(error => {
        console.error('Erreur lors du chargement du lot:', error);
        setLoading(false);
      });
  }, [lotId, isLive, fetchLot]);

  // Écouter les messages postMessage du parent (pour compatibilité Bubble)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'LOT_DATA') {
        setLot(event.data.data);
        setLoading(false);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Gérer les changements de lot pour notifier le parent
  // NOTE: Ne pas mettre à jour le state local pour éviter de réinitialiser isModified
  // On notifie seulement le parent via postMessage
  const handleLotChange = (newLot: Lot) => {
    // Ne pas appeler setLot ici car cela réinitialiserait isModified dans useLot
    // On notifie seulement le parent
    if (window.parent !== window) {
      window.parent.postMessage(
        {
          type: 'LOT_UPDATED',
          data: newLot,
        },
        '*'
      );
    }
  };

  return (
    <>
      {!d3Loaded && <div style={{ display: 'none' }}>Chargement...</div>}
      <div
        className="lot-container"
        style={{ position: 'relative', margin: 0, padding: 0 }}
      >
        {loading ? (
          <SkeletonLoader />
        ) : lot ? (
          <LotEditor
            lot={lot}
            lotId={lotId}
            isLive={isLive}
            isEditable={isEditable}
            lang={lang}
            onLotChange={handleLotChange}
            t={t}
          />
        ) : (
          <div className="p-4 text-center text-gray-500">Aucun lot chargé</div>
        )}
      </div>
    </>
  );
}

export default function LotPage() {
  return (
    <Suspense fallback={<SkeletonLoader />}>
      <LotPageContent />
    </Suspense>
  );
}
