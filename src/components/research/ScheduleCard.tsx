'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Calendar, Trash2, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { INTERVAL_PRESETS } from '@/lib/cron-utils';

interface ScheduleData {
  id: string;
  name: string | null;
  cronExpression: string;
  enabled: boolean;
  nextRunAt: string | null;
  autoDraft: boolean | null;
  maxDraftsPerRun: number | null;
}

interface ScheduleCardProps {
  schedule: ScheduleData;
  researcherId: string;
  researcherDefaults: {
    maxDraftsPerRun: number;
    autoDraft: boolean;
  };
  onEdit: (schedule: ScheduleData) => void;
  onDelete: (scheduleId: string) => void;
  onToggle: (scheduleId: string, enabled: boolean) => void;
}

function getPresetLabel(cronExpression: string): string {
  const preset = INTERVAL_PRESETS.find((p) => p.cron === cronExpression);
  return preset ? preset.label : cronExpression;
}

function formatNextRunAt(iso: string | null): string {
  if (!iso) return 'Not scheduled';
  const date = new Date(iso);
  return date.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function ScheduleCard({
  schedule,
  researcherId,
  researcherDefaults,
  onEdit,
  onDelete,
  onToggle,
}: ScheduleCardProps) {
  const [toggling, setToggling] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const displayName = schedule.name ?? getPresetLabel(schedule.cronExpression);
  const intervalLabel = getPresetLabel(schedule.cronExpression);

  async function handleToggle() {
    setToggling(true);
    try {
      const res = await fetch(`/api/researchers/${researcherId}/schedules/${schedule.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !schedule.enabled }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? 'Failed to update schedule');
        return;
      }
      onToggle(schedule.id, !schedule.enabled);
    } catch {
      toast.error('Failed to update schedule');
    } finally {
      setToggling(false);
    }
  }

  async function handleDelete() {
    try {
      const res = await fetch(`/api/researchers/${researcherId}/schedules/${schedule.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        toast.error('Failed to delete schedule');
        return;
      }
      onDelete(schedule.id);
      toast.success('Schedule deleted');
    } catch {
      toast.error('Failed to delete schedule');
    }
  }

  return (
    <Card className="border border-border">
      <CardHeader className="pb-2 flex flex-row items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-foreground">{displayName}</p>
            {schedule.name && (
              <p className="text-xs text-muted-foreground">{intervalLabel}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => onEdit(schedule)}
          >
            <Pencil className="h-3.5 w-3.5" />
            <span className="sr-only">Edit</span>
          </Button>
          {!confirmDelete ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-destructive hover:text-destructive"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span className="sr-only">Delete</span>
            </Button>
          ) : (
            <div className="flex items-center gap-1">
              <Button
                variant="destructive"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={handleDelete}
              >
                Confirm
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setConfirmDelete(false)}
              >
                Cancel
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Next run</span>
          <span className="text-foreground">{formatNextRunAt(schedule.nextRunAt)}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Auto-draft</span>
          <span className="text-foreground">
            {schedule.autoDraft === null
              ? `default (${researcherDefaults.autoDraft ? 'on' : 'off'})`
              : schedule.autoDraft
              ? 'on'
              : 'off'}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Max drafts</span>
          <span className="text-foreground">
            {schedule.maxDraftsPerRun === null
              ? `default (${researcherDefaults.maxDraftsPerRun})`
              : schedule.maxDraftsPerRun}
          </span>
        </div>
        <div className="flex items-center justify-between pt-1">
          <span className="text-sm text-muted-foreground">Enabled</span>
          <Button
            variant={schedule.enabled ? 'default' : 'outline'}
            size="sm"
            className="h-7 px-3 text-xs"
            onClick={handleToggle}
            disabled={toggling}
          >
            {toggling ? '...' : schedule.enabled ? 'On' : 'Off'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
