'use client';
import React, { useEffect, useState } from 'react';
import { bubbleApiCalls } from './apiCallsConfig';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { AppNavbar } from '@/components/ui/AppNavbar';

interface FormValues {
  isLive: boolean;
  [key: string]: string | boolean | number;
}

export default function ApiTestPage() {
  const [selectedApiIdx, setSelectedApiIdx] = useState(0);
  const [formValues, setFormValues] = useState<FormValues>({ isLive: true });
  const [result, setResult] = useState<unknown>(null);
  const [showModal, setShowModal] = useState(false);
  const [copied, setCopied] = useState(false);

  const selectedApi = bubbleApiCalls[selectedApiIdx];

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormValues((prev: FormValues) => ({
        ...prev,
        [name]: checked,
      }));
    } else {
      setFormValues((prev: FormValues) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const handleRun = async (e: React.FormEvent) => {
    e.preventDefault();

    // Interpoler les paramètres dans l'endpoint
    let endpoint = selectedApi.endpoint
      .replace(/\/{2,}/g, '/')
      .replace(/^\//, '');
    const params: FormValues = { ...formValues };

    // Remplacer les {PARAM} dans l'endpoint par les valeurs
    selectedApi.params.forEach(p => {
      if (params[p.name] !== undefined) {
        endpoint = endpoint.replace(
          new RegExp(`{${p.name}}`, 'g'),
          String(params[p.name])
        );
      }
    });

    // Traiter les paramètres JSON
    selectedApi.params.forEach(p => {
      if (p.type === 'json' && params[p.name]) {
        try {
          params[p.name] = JSON.parse(String(params[p.name]));
        } catch {
          // Laisse la string si parsing échoue
        }
      }
    });

    const res = await fetch('/api/bubble', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint,
        params,
        method: selectedApi.method,
      }),
    });
    const data = await res.json();
    setResult(data);
    setShowModal(true);
  };

  const handleCopy = async () => {
    const rawResult =
      typeof result === 'object'
        ? JSON.stringify(result, null, 2)
        : String(result);
    await navigator.clipboard.writeText(rawResult);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // Charger le CSS Phosphor pour que <i className="ph ph-..."> fonctionne.
  useEffect(() => {
    if (typeof document === 'undefined') return;

    if (!document.querySelector('link[href*="phosphor-icons"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.type = 'text/css';
      link.href =
        'https://cdn.jsdelivr.net/npm/@phosphor-icons/web@2.1.1/src/regular/style.css';
      document.head.appendChild(link);
    }
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-100/60 to-white font-sans">
      <AppNavbar />
      <div className="flex-1 flex items-center justify-center w-full">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle className="text-3xl text-center">
              API Bubble Test
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleRun} className="flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-gray-700 mb-1">
                  Choisir une API
                </label>
                <Select
                  value={selectedApiIdx.toString()}
                  onValueChange={v => {
                    setSelectedApiIdx(Number(v));
                    setFormValues({ isLive: true });
                    setResult(null);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir une API" />
                  </SelectTrigger>
                  <SelectContent>
                    {bubbleApiCalls.map((api, idx) => (
                      <SelectItem value={idx.toString()} key={api.name}>
                        {api.name} ({api.method})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedApi.params.map(param => (
                <div key={param.name} className="flex flex-col gap-2">
                  <label className="text-sm font-semibold text-gray-700 mb-1">
                    {param.label}
                  </label>
                  {param.type === 'boolean' ? (
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        name={param.name}
                        checked={!!formValues[param.name]}
                        onChange={handleChange}
                        className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2 transition"
                      />
                      <span className="text-sm text-gray-600">Oui</span>
                    </div>
                  ) : param.type === 'json' ? (
                    <textarea
                      name={param.name}
                      value={String(formValues[param.name] || '')}
                      onChange={handleChange}
                      rows={4}
                      className="px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm resize-none bg-gray-50"
                      placeholder="{\n  'key': 'value'\n}"
                    />
                  ) : (
                    <input
                      type="text"
                      name={param.name}
                      value={String(formValues[param.name] || '')}
                      onChange={handleChange}
                      className="px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base bg-gray-50"
                    />
                  )}
                </div>
              ))}
              <Button type="submit" className="w-full cursor-pointer" size="lg">
                Run
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
      {showModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-white p-6 rounded-xl shadow-xl min-w-[300px] max-w-2xl max-h-[80vh] overflow-auto relative"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold">Résultat brut</h2>
              <div className="flex items-center gap-2">
                {copied && <span className="text-sm text-green-600">Done</span>}
                <button
                  type="button"
                  onClick={handleCopy}
                  className="p-1 rounded hover:bg-gray-100 transition text-gray-700"
                  aria-label="Copier le JSON"
                  title="Copier le JSON"
                >
                  <i
                    className={`ph ${
                      copied ? 'ph-check' : 'ph-copy'
                    } text-base`}
                  />
                </button>
              </div>
            </div>
            <pre className="bg-gray-100 rounded p-3 text-xs overflow-x-auto whitespace-pre-wrap break-all">
              {typeof result === 'object'
                ? JSON.stringify(result, null, 2)
                : String(result)}
            </pre>
            <button
              onClick={() => setShowModal(false)}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
