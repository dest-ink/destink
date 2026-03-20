'use client';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TagInput } from '@/components/ui/tag-input';

interface WritingStyleTabProps {
  channelId: string;
}

interface Prefs {
  noteLengthMin: number;
  noteLengthMax: number;
  articleLengthMin: number;
  articleLengthMax: number;
  vocabularyLevel: string;
  jargonHandling: string;
  preferredPhrases: string[];
  avoidedPhrases: string[];
  useEmDashes: boolean;
  useOxfordComma: boolean;
  useSemicolons: boolean;
  useExclamationMarks: boolean;
  useEllipsis: boolean;
  useParenheticals: boolean;
  headlineCase: string;
  emphasisStyle: string;
  useAllCaps: boolean;
  paragraphLength: string;
  useSubheadings: boolean;
  useBulletLists: boolean;
  useNumberedLists: boolean;
  useBlockquotes: boolean;
  humorLevel: string;
  formalityLevel: string;
  opinionStrength: string;
  ctaStyle: string;
}

const DEFAULTS: Prefs = {
  noteLengthMin: 150, noteLengthMax: 300,
  articleLengthMin: 800, articleLengthMax: 2000,
  vocabularyLevel: 'accessible', jargonHandling: 'explain',
  preferredPhrases: [], avoidedPhrases: [],
  useEmDashes: true, useOxfordComma: true, useSemicolons: false,
  useExclamationMarks: false, useEllipsis: false, useParenheticals: true,
  headlineCase: 'sentence', emphasisStyle: 'bold', useAllCaps: false,
  paragraphLength: 'short', useSubheadings: true, useBulletLists: true,
  useNumberedLists: false, useBlockquotes: false,
  humorLevel: 'none', formalityLevel: 'conversational',
  opinionStrength: 'balanced', ctaStyle: 'question',
};

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/50"
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function ToggleField({ label, description, checked, onChange }: { label: string; description?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-border mt-0.5"
      />
      <div>
        <span className="text-sm font-medium text-foreground">{label}</span>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
    </label>
  );
}

export function WritingStyleTab({ channelId }: WritingStyleTabProps) {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/channels/${channelId}/draft-preferences`)
      .then(r => r.json())
      .then(data => {
        if (data.channelId) {
          setPrefs({ ...DEFAULTS, ...data });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [channelId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/channels/${channelId}/draft-preferences`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prefs),
      });
      if (!res.ok) {
        toast.error('Failed to save');
        return;
      }
      toast.success('Writing style saved');
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const update = <K extends keyof Prefs>(key: K, value: Prefs[K]) => {
    setPrefs(prev => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground py-8">Loading...</p>;
  }

  return (
    <div className="space-y-8">
      {/* Length Preferences */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Content Length</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Note min words</Label>
            <Input type="number" value={prefs.noteLengthMin} onChange={e => update('noteLengthMin', Number(e.target.value))} className="bg-background" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Note max words</Label>
            <Input type="number" value={prefs.noteLengthMax} onChange={e => update('noteLengthMax', Number(e.target.value))} className="bg-background" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Article min words</Label>
            <Input type="number" value={prefs.articleLengthMin} onChange={e => update('articleLengthMin', Number(e.target.value))} className="bg-background" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Article max words</Label>
            <Input type="number" value={prefs.articleLengthMax} onChange={e => update('articleLengthMax', Number(e.target.value))} className="bg-background" />
          </div>
        </div>
      </section>

      <div className="border-t border-border" />

      {/* Vocabulary & Language */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Vocabulary & Language</h3>
        <div className="grid grid-cols-2 gap-4">
          <SelectField
            label="Vocabulary level"
            value={prefs.vocabularyLevel}
            onChange={v => update('vocabularyLevel', v)}
            options={[
              { value: 'simple', label: 'Simple — everyday words' },
              { value: 'accessible', label: 'Accessible — clear but not dumbed down' },
              { value: 'technical', label: 'Technical — industry terminology' },
              { value: 'academic', label: 'Academic — formal and precise' },
            ]}
          />
          <SelectField
            label="Jargon handling"
            value={prefs.jargonHandling}
            onChange={v => update('jargonHandling', v)}
            options={[
              { value: 'avoid', label: 'Avoid jargon entirely' },
              { value: 'explain', label: 'Use but explain on first use' },
              { value: 'assume-knowledge', label: 'Assume reader knows it' },
            ]}
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm">Preferred phrases</Label>
          <TagInput value={prefs.preferredPhrases} onChange={v => update('preferredPhrases', v)} label="phrase" placeholder="e.g. here's the thing" />
        </div>
        <div className="space-y-2">
          <Label className="text-sm">Avoided phrases</Label>
          <TagInput value={prefs.avoidedPhrases} onChange={v => update('avoidedPhrases', v)} label="phrase" placeholder="e.g. game-changer, paradigm shift" />
        </div>
      </section>

      <div className="border-t border-border" />

      {/* Punctuation */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Punctuation</h3>
        <div className="grid grid-cols-2 gap-3">
          <ToggleField label="Em dashes (—)" description="Use em dashes for asides" checked={prefs.useEmDashes} onChange={v => update('useEmDashes', v)} />
          <ToggleField label="Oxford comma" description="Comma before 'and' in lists" checked={prefs.useOxfordComma} onChange={v => update('useOxfordComma', v)} />
          <ToggleField label="Semicolons" description="Allow semicolons" checked={prefs.useSemicolons} onChange={v => update('useSemicolons', v)} />
          <ToggleField label="Exclamation marks" description="Allow exclamation marks" checked={prefs.useExclamationMarks} onChange={v => update('useExclamationMarks', v)} />
          <ToggleField label="Ellipsis (...)" description="Allow trailing ellipsis" checked={prefs.useEllipsis} onChange={v => update('useEllipsis', v)} />
          <ToggleField label="Parentheticals" description="Allow parenthetical asides" checked={prefs.useParenheticals} onChange={v => update('useParenheticals', v)} />
        </div>
      </section>

      <div className="border-t border-border" />

      {/* Capitalization & Emphasis */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Capitalization & Emphasis</h3>
        <div className="grid grid-cols-2 gap-4">
          <SelectField
            label="Headline case"
            value={prefs.headlineCase}
            onChange={v => update('headlineCase', v)}
            options={[
              { value: 'sentence', label: 'Sentence case' },
              { value: 'title', label: 'Title Case' },
              { value: 'lowercase', label: 'all lowercase' },
              { value: 'uppercase', label: 'ALL UPPERCASE' },
            ]}
          />
          <SelectField
            label="Emphasis style"
            value={prefs.emphasisStyle}
            onChange={v => update('emphasisStyle', v)}
            options={[
              { value: 'bold', label: '**Bold**' },
              { value: 'italic', label: '*Italic*' },
              { value: 'caps', label: 'ALL CAPS for key words' },
              { value: 'none', label: 'No emphasis formatting' },
            ]}
          />
        </div>
        <ToggleField label="ALL CAPS emphasis" description="Use ALL CAPS for 1-2 key words per post (common on LinkedIn)" checked={prefs.useAllCaps} onChange={v => update('useAllCaps', v)} />
      </section>

      <div className="border-t border-border" />

      {/* Structure */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Structure</h3>
        <SelectField
          label="Paragraph length"
          value={prefs.paragraphLength}
          onChange={v => update('paragraphLength', v)}
          options={[
            { value: 'short', label: 'Short — 2-3 sentences' },
            { value: 'medium', label: 'Medium — 4-5 sentences' },
            { value: 'long', label: 'Long — 6+ sentences' },
          ]}
        />
        <div className="grid grid-cols-2 gap-3">
          <ToggleField label="Subheadings" description="Use ## headings in articles" checked={prefs.useSubheadings} onChange={v => update('useSubheadings', v)} />
          <ToggleField label="Bullet lists" description="Use - bullet lists" checked={prefs.useBulletLists} onChange={v => update('useBulletLists', v)} />
          <ToggleField label="Numbered lists" description="Use 1. 2. 3. lists" checked={prefs.useNumberedLists} onChange={v => update('useNumberedLists', v)} />
          <ToggleField label="Blockquotes" description="Use > blockquotes" checked={prefs.useBlockquotes} onChange={v => update('useBlockquotes', v)} />
        </div>
      </section>

      <div className="border-t border-border" />

      {/* Tone */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Tone</h3>
        <div className="grid grid-cols-2 gap-4">
          <SelectField
            label="Humor"
            value={prefs.humorLevel}
            onChange={v => update('humorLevel', v)}
            options={[
              { value: 'none', label: 'No humor' },
              { value: 'subtle', label: 'Subtle / dry' },
              { value: 'moderate', label: 'Moderate — occasional jokes' },
              { value: 'heavy', label: 'Heavy — comedy-forward' },
            ]}
          />
          <SelectField
            label="Formality"
            value={prefs.formalityLevel}
            onChange={v => update('formalityLevel', v)}
            options={[
              { value: 'formal', label: 'Formal' },
              { value: 'professional', label: 'Professional' },
              { value: 'conversational', label: 'Conversational' },
              { value: 'casual', label: 'Casual' },
            ]}
          />
          <SelectField
            label="Opinion strength"
            value={prefs.opinionStrength}
            onChange={v => update('opinionStrength', v)}
            options={[
              { value: 'neutral', label: 'Neutral — present facts' },
              { value: 'balanced', label: 'Balanced — have a take but acknowledge other sides' },
              { value: 'strong', label: 'Strong — clear thesis' },
              { value: 'provocative', label: 'Provocative — contrarian' },
            ]}
          />
          <SelectField
            label="Call-to-action style"
            value={prefs.ctaStyle}
            onChange={v => update('ctaStyle', v)}
            options={[
              { value: 'question', label: 'End with a question' },
              { value: 'directive', label: 'Direct CTA (share, comment, etc.)' },
              { value: 'soft', label: 'Soft nudge' },
              { value: 'none', label: 'No CTA' },
            ]}
          />
        </div>
      </section>

      <Button onClick={handleSave} disabled={saving} className="bg-primary text-primary-foreground hover:bg-primary/90">
        {saving ? 'Saving...' : 'Save writing style'}
      </Button>
    </div>
  );
}
