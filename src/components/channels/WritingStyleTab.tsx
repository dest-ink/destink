'use client';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { TagInput } from '@/components/ui/tag-input';
import type { ContentTypeStyle } from '@/db/schema';

interface WritingStyleTabProps {
  channelId: string;
}

const NOTE_DEFAULTS: ContentTypeStyle = {
  lengthMin: 150, lengthMax: 300,
  vocabularyLevel: 'accessible', jargonHandling: 'explain',
  preferredPhrases: [], avoidedPhrases: [],
  useEmDashes: true, useOxfordComma: true, useSemicolons: false,
  useExclamationMarks: false, useEllipsis: false, useParenheticals: true,
  headlineCase: 'sentence', emphasisStyle: 'bold', useAllCaps: false,
  paragraphLength: 'short', useSubheadings: false, useBulletLists: false,
  useNumberedLists: false, useBlockquotes: false,
  humorLevel: 'none', formalityLevel: 'conversational',
  opinionStrength: 'balanced', ctaStyle: 'question',
};

const ARTICLE_DEFAULTS: ContentTypeStyle = {
  lengthMin: 800, lengthMax: 2000,
  vocabularyLevel: 'accessible', jargonHandling: 'explain',
  preferredPhrases: [], avoidedPhrases: [],
  useEmDashes: true, useOxfordComma: true, useSemicolons: false,
  useExclamationMarks: false, useEllipsis: false, useParenheticals: true,
  headlineCase: 'sentence', emphasisStyle: 'bold', useAllCaps: false,
  paragraphLength: 'medium', useSubheadings: true, useBulletLists: true,
  useNumberedLists: false, useBlockquotes: true,
  humorLevel: 'none', formalityLevel: 'conversational',
  opinionStrength: 'balanced', ctaStyle: 'question',
};

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/50">
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function Toggle({ label, description, checked, onChange }: { label: string; description?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="h-4 w-4 rounded border-border mt-0.5" />
      <div>
        <span className="text-sm font-medium text-foreground">{label}</span>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
    </label>
  );
}

function StyleForm({ style, onChange, sliderMin = 50, sliderMax = 5000, sliderStep = 10 }: { style: ContentTypeStyle; onChange: (s: ContentTypeStyle) => void; sliderMin?: number; sliderMax?: number; sliderStep?: number }) {
  const u = <K extends keyof ContentTypeStyle>(key: K, value: ContentTypeStyle[K]) => onChange({ ...style, [key]: value });

  return (
    <div className="space-y-6">
      {/* Length */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm">Length</Label>
          <span className="text-sm font-mono text-muted-foreground tabular-nums">{style.lengthMin}–{style.lengthMax} words</span>
        </div>
        <Slider min={sliderMin} max={sliderMax} step={sliderStep} minStepsBetweenThumbs={1} value={[style.lengthMin, style.lengthMax]}
          onValueChange={([min, max]) => onChange({ ...style, lengthMin: min, lengthMax: max })} />
      </div>

      {/* Vocabulary */}
      <div className="grid grid-cols-2 gap-4">
        <SelectField label="Vocabulary" value={style.vocabularyLevel} onChange={v => u('vocabularyLevel', v as ContentTypeStyle['vocabularyLevel'])}
          options={[{ value: 'simple', label: 'Simple' }, { value: 'accessible', label: 'Accessible' }, { value: 'technical', label: 'Technical' }, { value: 'academic', label: 'Academic' }]} />
        <SelectField label="Jargon" value={style.jargonHandling} onChange={v => u('jargonHandling', v as ContentTypeStyle['jargonHandling'])}
          options={[{ value: 'avoid', label: 'Avoid entirely' }, { value: 'explain', label: 'Explain on first use' }, { value: 'assume-knowledge', label: 'Assume reader knows' }]} />
      </div>
      <div className="space-y-2">
        <Label className="text-sm">Preferred phrases</Label>
        <TagInput value={style.preferredPhrases} onChange={v => u('preferredPhrases', v)} label="phrase" placeholder="e.g. here's the thing" />
      </div>
      <div className="space-y-2">
        <Label className="text-sm">Avoided phrases</Label>
        <TagInput value={style.avoidedPhrases} onChange={v => u('avoidedPhrases', v)} label="phrase" placeholder="e.g. game-changer" />
      </div>

      <div className="border-t border-border" />

      {/* Punctuation */}
      <div className="grid grid-cols-2 gap-3">
        <Toggle label="Em dashes (—)" checked={style.useEmDashes} onChange={v => u('useEmDashes', v)} />
        <Toggle label="Oxford comma" checked={style.useOxfordComma} onChange={v => u('useOxfordComma', v)} />
        <Toggle label="Semicolons" checked={style.useSemicolons} onChange={v => u('useSemicolons', v)} />
        <Toggle label="Exclamation marks" checked={style.useExclamationMarks} onChange={v => u('useExclamationMarks', v)} />
        <Toggle label="Ellipsis (...)" checked={style.useEllipsis} onChange={v => u('useEllipsis', v)} />
        <Toggle label="Parentheticals" checked={style.useParenheticals} onChange={v => u('useParenheticals', v)} />
      </div>

      <div className="border-t border-border" />

      {/* Capitalization */}
      <div className="grid grid-cols-2 gap-4">
        <SelectField label="Headline case" value={style.headlineCase} onChange={v => u('headlineCase', v as ContentTypeStyle['headlineCase'])}
          options={[{ value: 'sentence', label: 'Sentence case' }, { value: 'title', label: 'Title Case' }, { value: 'lowercase', label: 'all lowercase' }, { value: 'uppercase', label: 'ALL UPPERCASE' }]} />
        <SelectField label="Emphasis" value={style.emphasisStyle} onChange={v => u('emphasisStyle', v as ContentTypeStyle['emphasisStyle'])}
          options={[{ value: 'bold', label: '**Bold**' }, { value: 'italic', label: '*Italic*' }, { value: 'caps', label: 'ALL CAPS' }, { value: 'none', label: 'None' }]} />
      </div>
      <Toggle label="ALL CAPS emphasis" description="Use ALL CAPS for key words" checked={style.useAllCaps} onChange={v => u('useAllCaps', v)} />

      <div className="border-t border-border" />

      {/* Structure */}
      <SelectField label="Paragraph length" value={style.paragraphLength} onChange={v => u('paragraphLength', v as ContentTypeStyle['paragraphLength'])}
        options={[{ value: 'short', label: 'Short (2-3 sentences)' }, { value: 'medium', label: 'Medium (4-5 sentences)' }, { value: 'long', label: 'Long (6+ sentences)' }]} />
      <div className="grid grid-cols-2 gap-3">
        <Toggle label="Subheadings" checked={style.useSubheadings} onChange={v => u('useSubheadings', v)} />
        <Toggle label="Bullet lists" checked={style.useBulletLists} onChange={v => u('useBulletLists', v)} />
        <Toggle label="Numbered lists" checked={style.useNumberedLists} onChange={v => u('useNumberedLists', v)} />
        <Toggle label="Blockquotes" checked={style.useBlockquotes} onChange={v => u('useBlockquotes', v)} />
      </div>

      <div className="border-t border-border" />

      {/* Tone */}
      <div className="grid grid-cols-2 gap-4">
        <SelectField label="Humor" value={style.humorLevel} onChange={v => u('humorLevel', v as ContentTypeStyle['humorLevel'])}
          options={[{ value: 'none', label: 'None' }, { value: 'subtle', label: 'Subtle' }, { value: 'moderate', label: 'Moderate' }, { value: 'heavy', label: 'Heavy' }]} />
        <SelectField label="Formality" value={style.formalityLevel} onChange={v => u('formalityLevel', v as ContentTypeStyle['formalityLevel'])}
          options={[{ value: 'formal', label: 'Formal' }, { value: 'professional', label: 'Professional' }, { value: 'conversational', label: 'Conversational' }, { value: 'casual', label: 'Casual' }]} />
        <SelectField label="Opinion strength" value={style.opinionStrength} onChange={v => u('opinionStrength', v as ContentTypeStyle['opinionStrength'])}
          options={[{ value: 'neutral', label: 'Neutral' }, { value: 'balanced', label: 'Balanced' }, { value: 'strong', label: 'Strong' }, { value: 'provocative', label: 'Provocative' }]} />
        <SelectField label="CTA style" value={style.ctaStyle} onChange={v => u('ctaStyle', v as ContentTypeStyle['ctaStyle'])}
          options={[{ value: 'question', label: 'End with a question' }, { value: 'directive', label: 'Direct CTA' }, { value: 'soft', label: 'Soft nudge' }, { value: 'none', label: 'None' }]} />
      </div>
    </div>
  );
}

export function WritingStyleTab({ channelId }: WritingStyleTabProps) {
  const [tab, setTab] = useState<'note' | 'article'>('note');
  const [noteStyle, setNoteStyle] = useState<ContentTypeStyle>(NOTE_DEFAULTS);
  const [articleStyle, setArticleStyle] = useState<ContentTypeStyle>(ARTICLE_DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/channels/${channelId}/draft-preferences`)
      .then(r => r.json())
      .then(data => {
        if (data.noteStyle) setNoteStyle({ ...NOTE_DEFAULTS, ...data.noteStyle });
        if (data.articleStyle) setArticleStyle({ ...ARTICLE_DEFAULTS, ...data.articleStyle });
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
        body: JSON.stringify({ noteStyle, articleStyle }),
      });
      if (!res.ok) { toast.error('Failed to save'); return; }
      toast.success('Writing style saved');
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = (from: 'note' | 'article') => {
    if (from === 'note') {
      setArticleStyle({ ...noteStyle, lengthMin: articleStyle.lengthMin, lengthMax: articleStyle.lengthMax });
      setTab('article');
      toast.success('Copied note style to articles (kept article length)');
    } else {
      setNoteStyle({ ...articleStyle, lengthMin: noteStyle.lengthMin, lengthMax: noteStyle.lengthMax });
      setTab('note');
      toast.success('Copied article style to notes (kept note length)');
    }
  };

  if (loading) return <p className="text-sm text-muted-foreground py-8">Loading...</p>;

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 p-1 rounded-lg bg-secondary w-fit">
          <button onClick={() => setTab('note')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${tab === 'note' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
            Notes
          </button>
          <button onClick={() => setTab('article')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${tab === 'article' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
            Articles
          </button>
        </div>

        <Button variant="outline" size="sm" onClick={() => handleCopy(tab === 'note' ? 'note' : 'article')}
          className="text-xs text-muted-foreground">
          <Copy className="w-3.5 h-3.5 mr-1.5" />
          Copy to {tab === 'note' ? 'articles' : 'notes'}
        </Button>
      </div>

      {/* Form */}
      {tab === 'note' && <StyleForm style={noteStyle} onChange={setNoteStyle} sliderMin={50} sliderMax={1000} sliderStep={10} />}
      {tab === 'article' && <StyleForm style={articleStyle} onChange={setArticleStyle} sliderMin={300} sliderMax={5000} sliderStep={50} />}

      <Button onClick={handleSave} disabled={saving} className="bg-primary text-primary-foreground hover:bg-primary/90">
        {saving ? 'Saving...' : 'Save writing style'}
      </Button>
    </div>
  );
}
