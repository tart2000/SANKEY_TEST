'use client';
import { AppNavbar } from '@/components/ui/AppNavbar';
import { lots } from '@/data/lots';
import { availableLanguages, type LanguageCode } from '@/data/lang';
import { useState, useEffect, useRef } from 'react';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';

export default function LotsPage() {
  const [selectedLotIdx, setSelectedLotIdx] = useState(0);
  const [selectedLanguage, setSelectedLanguage] =
    useState<LanguageCode>('fr_fr');
  const [isEditable, setIsEditable] = useState(true);
  const [iframeKey, setIframeKey] = useState(0);
  const lot = lots[selectedLotIdx];
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Construit dynamiquement l'URL de l'iframe avec isEditable et lang
  const iframeSrc = `/lot/index.html?lang=${selectedLanguage}&id=${encodeURIComponent(lot.bubbleId)}&isLive=${lot.isLive}&isEditable=${isEditable}`;

  // Forcer le rechargement de l'iframe quand la langue change
  useEffect(() => {
    setIframeKey(prev => prev + 1);
  }, [selectedLotIdx, selectedLanguage, isEditable]);

  return (
    <div className="h-screen flex flex-col">
      <AppNavbar />
      <div className="px-6 py-4 border-b flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="font-semibold">Choisir un lot :</label>
            <Select
              value={selectedLotIdx.toString()}
              onValueChange={v => setSelectedLotIdx(Number(v))}
            >
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Choisir un lot" />
              </SelectTrigger>
              <SelectContent>
                {lots.map((lot, idx) => (
                  <SelectItem value={idx.toString()} key={lot.bubbleId}>
                    {lot.nom} ({lot.isLive ? 'live' : 'test'})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <label className="font-semibold">Langue :</label>
            <Select
              value={selectedLanguage}
              onValueChange={(value: LanguageCode) =>
                setSelectedLanguage(value)
              }
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Sélectionner une langue" />
              </SelectTrigger>
              <SelectContent>
                {availableLanguages.map(lang => (
                  <SelectItem value={lang.code} key={lang.code}>
                    <span className="flex items-center gap-2">
                      <span>{lang.flag}</span>
                      <span>{lang.name}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label
            htmlFor="isEditable-checkbox"
            className="flex items-center gap-2 text-base font-normal"
          >
            <input
              id="isEditable-checkbox"
              type="checkbox"
              checked={isEditable}
              onChange={e => setIsEditable(e.target.checked)}
              className="accent-blue-600 w-5 h-5"
            />
            Éditable
          </label>
        </div>
      </div>
      <div className="flex-1 p-6 bg-gray-50 overflow-y-auto">
        <div className="max-w-6xl mx-auto bg-white rounded-lg shadow-sm border">
          <iframe
            key={`${iframeKey}-${selectedLanguage}`}
            ref={iframeRef}
            src={iframeSrc}
            className="w-full border-0 rounded-lg"
            style={{ height: '676px', display: 'block' }}
            title="Lots"
          />
        </div>
      </div>
    </div>
  );
}
