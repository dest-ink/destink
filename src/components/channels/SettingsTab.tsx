'use client';

import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { HelpModal } from '@/components/ui/help-modal';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ConfigField {
  key: string;
  label: string;
  type: 'string' | 'secret' | 'url' | 'number';
  required: boolean;
  helpText?: string;
  helpDetail?: {
    title: string;
    steps: string[];
  };
}

interface SettingsTabProps {
  channelId: string;
  platform: string;
  channelData: {
    platformId: string | null;
    name: string;
  };
}

function maskValue(value: string): string {
  if (value.length <= 4) return '******';
  return value.slice(0, 4) + '******';
}

export function SettingsTab({ channelId, platform, channelData }: SettingsTabProps) {
  const [schema, setSchema] = useState<ConfigField[]>([]);
  const [providerDescription, setProviderDescription] = useState('');
  const [savedValues, setSavedValues] = useState<Record<string, string>>({});
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [helpDetail, setHelpDetail] = useState<{ title: string; steps: string[] } | null>(null);
  const [providerOauth, setProviderOauth] = useState<{
    authPath: string; statusPath: string; buttonLabel: string;
    helpText: string; notConfiguredMessage: string;
    setupGuide?: { title: string; steps: string[] };
  } | null>(null);

  // OAuth state
  const [oauthAvailable, setOauthAvailable] = useState(false);
  const [showManualCreds, setShowManualCreds] = useState(false);

  const isConfigured = Object.keys(savedValues).length > 0;

  // Sort schema: non-secret fields first, then secrets
  const sortedSchema = useMemo(
    () => [...schema].sort((a, b) => {
      if (a.type === 'secret' && b.type !== 'secret') return 1;
      if (a.type !== 'secret' && b.type === 'secret') return -1;
      return 0;
    }),
    [schema],
  );

  useEffect(() => {
    Promise.all([
      fetch(`/api/providers/${platform}`).then(r => r.json()),
      fetch(`/api/channels/${channelId}/credentials`).then(r => r.json()),
    ]).then(([providerData, credData]) => {
      setSchema(providerData.configSchema ?? []);
      setProviderDescription(providerData.description ?? '');
      setProviderOauth(providerData.oauth ?? null);
      setSavedValues(credData.values ?? {});

      if (providerData.oauth?.statusPath) {
        fetch(providerData.oauth.statusPath)
          .then((r: Response) => r.json())
          .then((d: { available?: boolean }) => { if (d.available) setOauthAvailable(true); })
          .catch(() => {});
      }
    }).catch(() => {
      toast.error('Failed to load provider configuration');
    }).finally(() => setLoading(false));
  }, [channelId, platform]);

  function startEditing() {
    // Pre-fill edit form with saved non-secret values
    const prefilled: Record<string, string> = {};
    for (const field of schema) {
      if (field.type !== 'secret' && savedValues[field.key]) {
        prefilled[field.key] = savedValues[field.key];
      } else if (field.key === 'publicationUrl' && !savedValues[field.key] && channelData.platformId) {
        prefilled[field.key] = channelData.platformId;
      }
    }
    setEditValues(prefilled);
    setEditing(true);
  }

  function cancelEditing() {
    setEditValues({});
    setEditing(false);
  }

  async function handleSave() {
    for (const field of schema) {
      if (field.required && !editValues[field.key]?.trim()) {
        toast.error(`${field.label} is required`);
        return;
      }
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/channels/${channelId}/credentials`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editValues),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? 'Failed to save credentials');
        return;
      }

      toast.success('Credentials saved');
      setSavedValues(editValues);
      setEditing(false);
      setEditValues({});
    } catch {
      toast.error('Failed to save credentials');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground py-8">Loading configuration...</p>;
  }

  if (schema.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        No credentials configuration needed for this platform.
      </div>
    );
  }

  // ── Read-only view ──────────────────────────────────────────────────────────
  if (!editing) {
    if (!isConfigured) {
      return (
        <div className="space-y-6 max-w-lg">
          <div>
            <h3 className="text-sm font-medium text-foreground mb-1">Publishing Credentials</h3>
            <p className="text-xs text-muted-foreground">{providerDescription}</p>
          </div>
          <div className="rounded-md border border-dashed border-border px-4 py-8 text-center">
            <p className="text-sm text-muted-foreground mb-3">No credentials configured yet.</p>
            <Button size="sm" onClick={startEditing}>Configure Credentials</Button>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6 max-w-lg">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-sm font-medium text-foreground mb-1">Publishing Credentials</h3>
            <p className="text-xs text-muted-foreground">{providerDescription}</p>
          </div>
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={startEditing}>
            <Pencil className="h-3.5 w-3.5 mr-1.5" />
            Edit
          </Button>
        </div>

        <div className="rounded-md border border-border divide-y divide-border">
          {sortedSchema.map(field => {
            const value = savedValues[field.key];
            if (!value) return null;
            const display = field.type === 'secret' ? maskValue(value) : value;
            return (
              <div key={field.key} className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-muted-foreground">{field.label}</span>
                <span className="text-sm text-foreground font-mono">{display}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Edit mode ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h3 className="text-sm font-medium text-foreground mb-1">Publishing Credentials</h3>
        <p className="text-xs text-muted-foreground">{providerDescription}</p>
      </div>

      {/* OAuth option (provider-driven) */}
      {providerOauth && oauthAvailable && !showManualCreds && (
        <div className="space-y-3">
          <Button
            asChild
            size="sm"
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <a href={`${providerOauth.authPath}?channelId=${channelId}`}>
              {providerOauth.buttonLabel}
            </a>
          </Button>
          <p className="text-[11px] text-muted-foreground/70">
            {providerOauth.helpText}
          </p>
          <button
            type="button"
            onClick={() => setShowManualCreds(true)}
            className="text-[11px] text-primary hover:underline"
          >
            Enter credentials manually
          </button>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={cancelEditing}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Manual credential form */}
      {(!providerOauth || !oauthAvailable || showManualCreds) && (
        <div className="space-y-4">
          {providerOauth && !oauthAvailable && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 space-y-1">
              <p className="text-xs text-amber-200/80">{providerOauth.notConfiguredMessage}</p>
              {providerOauth.setupGuide && (
                <button
                  type="button"
                  onClick={() => setHelpDetail(providerOauth!.setupGuide!)}
                  className="text-[11px] text-primary hover:underline"
                >
                  How to set this up
                </button>
              )}
            </div>
          )}
          {oauthAvailable && showManualCreds && (
            <button
              type="button"
              onClick={() => setShowManualCreds(false)}
              className="text-[11px] text-primary hover:underline"
            >
              Connect with OAuth
            </button>
          )}
          {sortedSchema.map(field => {
            const isSecret = field.type === 'secret';
            const inputType = isSecret ? 'password' : field.type === 'number' ? 'number' : 'text';

            return (
              <div key={field.key} className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Label htmlFor={`cred-${field.key}`} className="text-sm">{field.label}</Label>
                  {field.helpDetail && (
                    <button
                      type="button"
                      onClick={() => setHelpDetail(field.helpDetail!)}
                      className="text-[11px] text-primary hover:underline"
                    >
                      How to find this
                    </button>
                  )}
                </div>
                <Input
                  id={`cred-${field.key}`}
                  type={inputType}
                  value={editValues[field.key] ?? ''}
                  onChange={e => setEditValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                />
                {field.helpText && (
                  <p className="text-[11px] text-muted-foreground/70">{field.helpText}</p>
                )}
              </div>
            );
          })}

          <div className="flex gap-2 pt-2">
            <Button onClick={handleSave} disabled={saving} size="sm">
              {saving ? 'Saving...' : 'Save Credentials'}
            </Button>
            <Button variant="outline" size="sm" onClick={cancelEditing} disabled={saving}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {helpDetail && (
        <HelpModal title={helpDetail.title} steps={helpDetail.steps} onClose={() => setHelpDetail(null)} />
      )}
    </div>
  );
}
