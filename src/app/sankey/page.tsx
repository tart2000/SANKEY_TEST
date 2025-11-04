'use client';
import { AppNavbar } from '@/components/ui/AppNavbar';
import { useEffect, useState } from 'react';
import { lots } from '@/data/lots';
import { scenarios } from '@/data/scenarios';
import { teams } from '@/data/teams';
import { availableLanguages, type LanguageCode } from '@/data/lang';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';

type Scenario = { title: string; scenario: Record<string, unknown> };

// Déclarer le type global pour window.scenarios
declare global {
  interface Window {
    scenarios?: Scenario[];
  }
}

export default function SankeyPage() {
  const [scenarioIdx, setScenarioIdx] = useState(0);
  const [selectedLot, setSelectedLot] = useState<(typeof lots)[0] | null>(
    lots[0]
  );
  const [selectedScenario, setSelectedScenario] = useState<
    (typeof scenarios)[0] | null
  >(scenarios[0]);
  const [selectedTeam, setSelectedTeam] = useState<(typeof teams)[0] | null>(
    teams[0]
  );
  const [isEditable, setIsEditable] = useState(true);
  const [selectedLanguage, setSelectedLanguage] =
    useState<LanguageCode>('fr_fr');
  const [iframeKey, setIframeKey] = useState(0);
  const [iframeHeight, setIframeHeight] = useState<number>(800);

  // Forcer le rechargement de l'iframe quand les paramètres changent
  useEffect(() => {
    setIframeKey(prev => prev + 1);
  }, [
    scenarioIdx,
    selectedLot,
    selectedScenario,
    selectedTeam,
    isEditable,
    selectedLanguage,
  ]);

  // Gérer le redimensionnement de l'iframe
  useEffect(() => {
    function handleResizeMessage(event: MessageEvent) {
      if (
        event.data &&
        event.data.type === 'IFRAME_HEIGHT' &&
        typeof event.data.height === 'number'
      ) {
        setIframeHeight(event.data.height);
      }
    }
    window.addEventListener('message', handleResizeMessage);
    return () => window.removeEventListener('message', handleResizeMessage);
  }, []);

  // Gérer les messages de l'iframe pour visualiser les lots
  useEffect(() => {
    function handleLotMessage(event: MessageEvent) {
      // Vérifier que le message provient bien de l'iframe Sankey
      if (
        event.data.id === 'sankey-lot-visualization' &&
        event.data.type === 'showLotDetails'
      ) {
        console.log("Message reçu depuis l'iframe Sankey:", event.data);
        console.log('Détails du lot:', {
          nodeId: event.data.payload.nodeId,
          nodeName: event.data.payload.nodeName,
          lotData: event.data.payload.lotData,
          timestamp: event.data.payload.timestamp,
        });

        // TODO: Intégrer avec Bubble pour afficher le popup de visualisation du lot
        // Exemple: window.bubbleAPI.showLotDetails(event.data.payload);
      }
    }
    window.addEventListener('message', handleLotMessage);
    return () => window.removeEventListener('message', handleLotMessage);
  }, []);

  // Construire l'URL de l'iframe avec tous les paramètres (sans dimension)
  const iframeSrc = `/sankey/index.html?lang=${selectedLanguage}&scenarioIdx=${scenarioIdx}&isEditable=${isEditable}&lotId=${selectedLot?.bubbleId || ''}&scenarioId=${selectedScenario?.bubbleId || ''}&teamId=${selectedTeam?.bubbleId || ''}&isLive=${selectedLot?.isLive || false}`;

  return (
    <div className="min-h-screen bg-gray-50">
      <AppNavbar />

      <div className="">
        {/* Header avec les contrôles */}
        <div className="bg-white border border-gray-200 p-6">
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-2">
              <label className="font-semibold">Scénario :</label>
              <Select
                value={selectedScenario?.bubbleId || ''}
                onValueChange={v => {
                  const scenario = scenarios.find(s => s.bubbleId === v);
                  setSelectedScenario(scenario || null);
                  setScenarioIdx(scenarios.findIndex(s => s.bubbleId === v));
                }}
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Choisir un scénario" />
                </SelectTrigger>
                <SelectContent>
                  {scenarios.map(scenario => (
                    <SelectItem
                      value={scenario.bubbleId}
                      key={scenario.bubbleId}
                    >
                      {scenario.nom} ({scenario.isLive ? 'Live' : 'Test'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <label className="font-semibold">Lot :</label>
              <Select
                value={selectedLot?.bubbleId || ''}
                onValueChange={v => {
                  const lot = lots.find(l => l.bubbleId === v);
                  setSelectedLot(lot || null);
                }}
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Choisir un lot" />
                </SelectTrigger>
                <SelectContent>
                  {lots.map(lot => (
                    <SelectItem value={lot.bubbleId} key={lot.bubbleId}>
                      {lot.nom} ({lot.isLive ? 'Live' : 'Test'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <label className="font-semibold">Team :</label>
              <Select
                value={selectedTeam?.bubbleId || ''}
                onValueChange={v => {
                  const team = teams.find(t => t.bubbleId === v);
                  setSelectedTeam(team || null);
                }}
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Choisir une team" />
                </SelectTrigger>
                <SelectContent>
                  {teams.map(team => (
                    <SelectItem value={team.bubbleId} key={team.bubbleId}>
                      {team.nom} ({team.isLive ? 'Live' : 'Test'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <label className="font-semibold">Édition :</label>
              <input
                type="checkbox"
                checked={isEditable}
                onChange={e => setIsEditable(e.target.checked)}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
              />
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
        </div>

        {/* Iframe Sankey */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <iframe
            key={iframeKey}
            src={iframeSrc}
            className="w-full border-0"
            style={{
              minHeight: 400,
              height: iframeHeight,
              display: 'block',
              overflow: 'hidden', // Pas de scrollbar interne - la hauteur est calculée précisément
            }}
            title="Visualisation Sankey"
          />
        </div>
      </div>
    </div>
  );
}
