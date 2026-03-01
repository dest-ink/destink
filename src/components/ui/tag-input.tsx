'use client';
import { useState, type KeyboardEvent } from 'react';
import { Input } from '@/components/ui/input';

interface TagInputProps {
  value: string[];
  onChange: (value: string[]) => void;
  label: string;
  placeholder?: string;
}

export function TagInput({ value, onChange, label, placeholder }: TagInputProps) {
  const [draft, setDraft] = useState('');

  const addTag = () => {
    const trimmed = draft.trim();
    if (!trimmed || value.includes(trimmed)) return;
    onChange([...value, trimmed]);
    setDraft('');
  };

  const removeTag = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {value.map((tag, i) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-md bg-primary/10 text-primary px-2 py-0.5 text-xs font-medium"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(i)}
              className="text-primary/60 hover:text-primary ml-0.5"
            >
              &times;
            </button>
          </span>
        ))}
      </div>
      <Input
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder ?? `Add ${label.toLowerCase()}...`}
        className="bg-card border-border"
      />
    </div>
  );
}
