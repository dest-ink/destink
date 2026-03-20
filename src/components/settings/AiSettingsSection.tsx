'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Bot, ChevronDown, ChevronRight, DollarSign, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ModelInfo {
  id: string;
  displayName: string;
  description?: string;
  pricing: { inputPer1M: number; outputPer1M: number } | null;
  maxInputTokens: number | null;
  maxOutputTokens: number | null;
  provider: string;
  tags: string[];
  bestFor: string[];
}

interface UseCase {
  label: string;
  description: string;
}

interface AiSettings {
  [key: string]: string;
}

const TAG_COLORS: Record<string, string> = {
  Writing: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  Reasoning: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  Coding: 'bg-green-500/10 text-green-500 border-green-500/20',
  Fast: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  Cheap: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  Cheapest: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  Affordable: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  Premium: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  Versatile: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
  Agents: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
  Thinking: 'bg-violet-500/10 text-violet-500 border-violet-500/20',
};

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: 'Anthropic',
  openrouter: 'OpenRouter',
};

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

  if (loading) {
    return (
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">AI Settings</h2>
        <div className="h-16 bg-card border border-border rounded-lg animate-pulse" />
      </div>
    );
  }

  const useCaseKeys = Object.keys(useCases);

  // Group models by provider for the selector
  const providerGroups = new Map<string, ModelInfo[]>();
  for (const m of models) {
    const group = providerGroups.get(m.provider) ?? [];
    group.push(m);
    providerGroups.set(m.provider, group);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">AI Settings</h2>
        <Link href="/audit" className="text-xs text-primary hover:underline">View usage & costs →</Link>
      </div>

      {/* Collapsed */}
      {!expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-border bg-card hover:border-primary/20 transition-colors text-left"
        >
          <div className="flex items-center gap-3">
            <Bot className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="text-sm text-foreground">Model configuration</p>
              <p className="text-xs text-muted-foreground">{models.length} models available · {useCaseKeys.length} use cases</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>
      )}

      {/* Expanded */}
      {expanded && (
        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
          <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
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
                <div key={key} className="px-5 py-4 space-y-3">
                  {/* Use case header */}
                  <div>
                    <p className="text-sm font-medium text-foreground">{uc.label}</p>
                    <p className="text-xs text-muted-foreground">{uc.description}</p>
                  </div>

                  {/* Model selector */}
                  <select
                    value={currentModel}
                    onChange={e => setSettings(prev => ({ ...prev, [key]: e.target.value }))}
                    className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    {Array.from(providerGroups.entries()).map(([provider, groupModels]) => (
                      <optgroup key={provider} label={PROVIDER_LABELS[provider] ?? provider}>
                        {groupModels.map(m => (
                          <option key={m.id} value={m.id}>
                            {m.displayName} — ${m.pricing?.inputPer1M}/${m.pricing?.outputPer1M} per 1M
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>

                  {/* Selected model details */}
                  {currentModelInfo && (
                    <div className="rounded-lg bg-secondary/30 px-3 py-2.5 space-y-2">
                      {/* Description */}
                      <p className="text-xs text-foreground leading-relaxed">{currentModelInfo.description}</p>

                      {/* Tags */}
                      {currentModelInfo.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {currentModelInfo.tags.map(tag => (
                            <span
                              key={tag}
                              className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${TAG_COLORS[tag] ?? 'bg-secondary text-muted-foreground border-border'}`}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Best for */}
                      {currentModelInfo.bestFor.length > 0 && (
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Star className="w-3 h-3 text-amber-500" />
                          Best for: {currentModelInfo.bestFor.join(', ')}
                        </p>
                      )}

                      {/* Pricing & specs */}
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                        {currentModelInfo.pricing && (
                          <span className="flex items-center gap-0.5">
                            <DollarSign className="w-3 h-3" />
                            ${currentModelInfo.pricing.inputPer1M}/1M in · ${currentModelInfo.pricing.outputPer1M}/1M out
                          </span>
                        )}
                        {currentModelInfo.maxOutputTokens && (
                          <span>{(currentModelInfo.maxOutputTokens / 1000).toFixed(0)}K max output</span>
                        )}
                        {currentModelInfo.maxInputTokens && (
                          <span>{(currentModelInfo.maxInputTokens / 1000).toFixed(0)}K context</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="px-5 py-3.5 border-t border-border">
            <Button onClick={handleSave} disabled={saving} size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
              {saving ? 'Saving...' : 'Save settings'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
