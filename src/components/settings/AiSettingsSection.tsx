'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Bot, ChevronRight, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ModelInfo {
  id: string;
  displayName: string;
  pricing: { inputPer1M: number; outputPer1M: number } | null;
  maxInputTokens: number | null;
  maxOutputTokens: number | null;
}

interface UseCase {
  label: string;
  description: string;
}

interface AiSettings {
  [key: string]: string;
}

export function AiSettingsSection() {
  const [settings, setSettings] = useState<AiSettings>({});
  const [useCases, setUseCases] = useState<Record<string, UseCase>>({});
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/ai-settings').then(r => r.json()),
      fetch('/api/ai-models').then(r => r.json()),
    ]).then(([settingsData, modelsData]) => {
      setSettings(settingsData.settings ?? {});
      setUseCases(settingsData.useCases ?? {});
      if (Array.isArray(modelsData)) setModels(modelsData);
    }).catch(() => {})
    .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/ai-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      });
      if (!res.ok) { toast.error('Failed to save'); return; }
      toast.success('AI settings saved');
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const getModelName = (modelId: string) => {
    return models.find(m => m.id === modelId)?.displayName ?? modelId;
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">AI Settings</h2>
        <div className="h-16 bg-card border border-border rounded-lg animate-pulse" />
      </div>
    );
  }

  const useCaseKeys = Object.keys(useCases);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">AI Settings</h2>
        <Link href="/audit" className="text-xs text-primary hover:underline">View usage & costs →</Link>
      </div>

      {/* Collapsed summary */}
      {!expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-border bg-card hover:border-primary/20 transition-colors text-left"
        >
          <div className="flex items-center gap-3">
            <Bot className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="text-sm text-foreground">Model configuration</p>
              <p className="text-xs text-muted-foreground">
                {useCaseKeys.length} use cases configured
              </p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>
      )}

      {/* Expanded settings */}
      {expanded && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">Model Configuration</span>
            </div>
            <button onClick={() => setExpanded(false)} className="text-xs text-muted-foreground hover:text-foreground">
              Collapse
            </button>
          </div>

          <div className="divide-y divide-border">
            {useCaseKeys.map(key => {
              const uc = useCases[key];
              const currentModel = settings[key] ?? '';
              const currentModelInfo = models.find(m => m.id === currentModel);

              return (
                <div key={key} className="px-4 py-3 space-y-2">
                  <div>
                    <p className="text-sm font-medium text-foreground">{uc.label}</p>
                    <p className="text-xs text-muted-foreground">{uc.description}</p>
                  </div>
                  <select
                    value={currentModel}
                    onChange={e => setSettings(prev => ({ ...prev, [key]: e.target.value }))}
                    className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    {models.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.displayName}
                        {m.pricing ? ` — $${m.pricing.inputPer1M} in / $${m.pricing.outputPer1M} out per 1M tokens` : ''}
                      </option>
                    ))}
                  </select>
                  {currentModelInfo?.pricing && (
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <DollarSign className="w-3 h-3" />
                      ${currentModelInfo.pricing.inputPer1M}/1M input · ${currentModelInfo.pricing.outputPer1M}/1M output
                      {currentModelInfo.maxOutputTokens && ` · ${(currentModelInfo.maxOutputTokens / 1000).toFixed(0)}K max output`}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <div className="px-4 py-3 border-t border-border">
            <Button onClick={handleSave} disabled={saving} size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
              {saving ? 'Saving...' : 'Save settings'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
