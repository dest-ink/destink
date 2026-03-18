'use client';

import { useState, useMemo } from 'react';
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
import {
  INTERVAL_PRESETS,
  buildCronExpression,
  identifyPreset,
  parseScheduleTime,
  computeNextRun,
} from '@/lib/cron-presets';

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
  const next = computeNextRun(cron);
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

function getInitialPreset(schedule?: ScheduleData) {
  if (!schedule) return INTERVAL_PRESETS[1]; // Daily
  return identifyPreset(schedule.cronExpression) ?? INTERVAL_PRESETS[1];
}

function getInitialTime(schedule?: ScheduleData): { hour: number; minute: number } {
  if (!schedule) {
    // Default to 9:00 AM
    return { hour: 9, minute: 0 };
  }
  return parseScheduleTime(schedule.cronExpression) ?? { hour: 9, minute: 0 };
}

export function ScheduleForm({
  mode,
  schedule,
  researcherId,
  researcherDefaults,
  onSave,
  onCancel,
}: ScheduleFormProps) {
  const initialPreset = getInitialPreset(schedule);
  const initialTime = getInitialTime(schedule);

  const [presetHours, setPresetHours] = useState(String(initialPreset.hours));
  const [timeValue, setTimeValue] = useState(
    `${String(initialTime.hour).padStart(2, '0')}:${String(initialTime.minute).padStart(2, '0')}`,
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

  // Build cron from current selections
  const cronExpression = useMemo(() => {
    const [h, m] = timeValue.split(':').map(Number);
    return buildCronExpression(Number(presetHours), h ?? 9, m ?? 0);
  }, [presetHours, timeValue]);

  const nextRunPreview = useMemo(() => formatNextRun(cronExpression), [cronExpression]);

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
        cronExpression,
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
        <Select value={presetHours} onValueChange={setPresetHours}>
          <SelectTrigger id="interval">
            <SelectValue placeholder="Select interval" />
          </SelectTrigger>
          <SelectContent>
            {INTERVAL_PRESETS.map((preset) => (
              <SelectItem key={preset.hours} value={String(preset.hours)}>
                {preset.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Time of day */}
      <div className="space-y-1.5">
        <Label htmlFor="schedule-time">
          {Number(presetHours) === 12 ? 'First run time' : 'Scheduled time'}
        </Label>
        <Input
          id="schedule-time"
          type="time"
          value={timeValue}
          onChange={(e) => setTimeValue(e.target.value)}
        />
        {Number(presetHours) === 12 && (
          <p className="text-xs text-muted-foreground">
            Also runs 12 hours later
          </p>
        )}
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
