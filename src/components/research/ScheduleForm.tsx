'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { INTERVAL_PRESETS, getNextRunAt } from '@/lib/cron-utils';

interface ScheduleData {
  id: string;
  name: string | null;
  cronExpression: string;
  enabled: boolean;
  nextRunAt: string | null;
  autoDraft: boolean | null;
  maxDraftsPerRun: number | null;
}

interface ScheduleFormProps {
  mode: 'create' | 'edit';
  schedule?: ScheduleData;
  researcherId: string;
  researcherDefaults: {
    maxDraftsPerRun: number;
    autoDraft: boolean;
  };
  onSave: () => void;
  onCancel: () => void;
}

function formatNextRun(cron: string): string | null {
  const next = getNextRunAt(cron);
  if (!next) return null;
  return next.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function ScheduleForm({
  mode,
  schedule,
  researcherId,
  researcherDefaults,
  onSave,
  onCancel,
}: ScheduleFormProps) {
  const initialPreset =
    mode === 'edit' && schedule
      ? (INTERVAL_PRESETS.find((p) => p.cron === schedule.cronExpression) ?? INTERVAL_PRESETS[1])
      : INTERVAL_PRESETS[1]; // Default to "Daily"

  const [selectedCron, setSelectedCron] = useState(
    mode === 'edit' && schedule ? schedule.cronExpression : INTERVAL_PRESETS[1].cron,
  );
  const [name, setName] = useState(mode === 'edit' && schedule ? (schedule.name ?? '') : '');
  const [autoDraftChecked, setAutoDraftChecked] = useState<boolean | null>(
    mode === 'edit' && schedule ? schedule.autoDraft : null,
  );
  const [maxDraftsInput, setMaxDraftsInput] = useState<string>(
    mode === 'edit' && schedule && schedule.maxDraftsPerRun != null
      ? String(schedule.maxDraftsPerRun)
      : '',
  );
  const [submitting, setSubmitting] = useState(false);
  const [nextRunPreview, setNextRunPreview] = useState<string | null>(() => formatNextRun(selectedCron));

  // Keep selected preset label in sync
  const [presetValue, setPresetValue] = useState<string>(initialPreset.cron);

  useEffect(() => {
    setNextRunPreview(formatNextRun(selectedCron));
  }, [selectedCron]);

  async function handleSave() {
    setSubmitting(true);
    try {
      const maxDrafts = maxDraftsInput === '' ? null : parseInt(maxDraftsInput, 10);
      if (maxDraftsInput !== '' && (isNaN(maxDrafts!) || maxDrafts! <= 0)) {
        toast.error('Max drafts must be a positive number');
        setSubmitting(false);
        return;
      }

      const payload = {
        cronExpression: selectedCron,
        name: name.trim() || null,
        autoDraft: autoDraftChecked,
        maxDraftsPerRun: maxDrafts,
      };

      let url: string;
      let method: string;

      if (mode === 'create') {
        url = `/api/researchers/${researcherId}/schedules`;
        method = 'POST';
      } else {
        url = `/api/researchers/${researcherId}/schedules/${schedule!.id}`;
        method = 'PUT';
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? 'Failed to save schedule');
        return;
      }

      toast.success(mode === 'create' ? 'Schedule created' : 'Schedule updated');
      onSave();
    } catch {
      toast.error('Failed to save schedule');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Interval picker */}
      <div className="space-y-1.5">
        <Label htmlFor="interval">Interval</Label>
        <Select
          value={presetValue}
          onValueChange={(val) => {
            setPresetValue(val);
            setSelectedCron(val);
          }}
        >
          <SelectTrigger id="interval">
            <SelectValue placeholder="Select interval" />
          </SelectTrigger>
          <SelectContent>
            {INTERVAL_PRESETS.map((preset) => (
              <SelectItem key={preset.cron} value={preset.cron}>
                {preset.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {nextRunPreview && (
          <p className="text-xs text-muted-foreground">Next run: {nextRunPreview}</p>
        )}
      </div>

      {/* Name */}
      <div className="space-y-1.5">
        <Label htmlFor="schedule-name">Name (optional)</Label>
        <Input
          id="schedule-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Weekend research"
        />
      </div>

      {/* Auto-draft override */}
      <div className="space-y-1.5">
        <Label className="flex items-center gap-2">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-input"
            checked={autoDraftChecked === true}
            onChange={(e) => setAutoDraftChecked(e.target.checked ? true : null)}
          />
          Auto-draft
          <span className="text-xs text-muted-foreground font-normal">
            (default: {researcherDefaults.autoDraft ? 'on' : 'off'})
          </span>
        </Label>
        {autoDraftChecked === null && (
          <p className="text-xs text-muted-foreground">Leave unchecked to inherit researcher default</p>
        )}
      </div>

      {/* Max drafts override */}
      <div className="space-y-1.5">
        <Label htmlFor="max-drafts">
          Max drafts per run
          <span className="ml-1 text-xs text-muted-foreground font-normal">
            (default: {researcherDefaults.maxDraftsPerRun})
          </span>
        </Label>
        <Input
          id="max-drafts"
          type="number"
          min={1}
          value={maxDraftsInput}
          onChange={(e) => setMaxDraftsInput(e.target.value)}
          placeholder={`(default: ${researcherDefaults.maxDraftsPerRun})`}
        />
        {maxDraftsInput === '' && (
          <p className="text-xs text-muted-foreground">Leave empty to inherit researcher default</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={submitting}>
          {submitting ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </div>
  );
}
