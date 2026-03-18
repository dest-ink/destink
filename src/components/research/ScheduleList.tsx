'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScheduleCard } from '@/components/research/ScheduleCard';
import { ScheduleForm } from '@/components/research/ScheduleForm';

interface ScheduleData {
  id: string;
  name: string | null;
  cronExpression: string;
  enabled: boolean;
  nextRunAt: string | null;
  autoDraft: boolean | null;
  maxDraftsPerRun: number | null;
}

interface ScheduleListProps {
  initialSchedules: ScheduleData[];
  researcherId: string;
  researcherDefaults: {
    maxDraftsPerRun: number;
    autoDraft: boolean;
  };
}

export function ScheduleList({
  initialSchedules,
  researcherId,
  researcherDefaults,
}: ScheduleListProps) {
  const router = useRouter();
  const [schedules, setSchedules] = useState<ScheduleData[]>(initialSchedules);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ScheduleData | null>(null);

  async function handleSave() {
    setShowAddForm(false);
    setEditingSchedule(null);
    try {
      const res = await fetch(`/api/researchers/${researcherId}/schedules`);
      if (res.ok) {
        setSchedules(await res.json());
      }
    } catch {
      // fall back to server refresh
      router.refresh();
    }
  }

  function handleDelete(scheduleId: string) {
    setSchedules((prev) => prev.filter((s) => s.id !== scheduleId));
    router.refresh();
  }

  function handleToggle(scheduleId: string, enabled: boolean) {
    setSchedules((prev) =>
      prev.map((s) => (s.id === scheduleId ? { ...s, enabled } : s)),
    );
    router.refresh();
  }

  function handleEdit(schedule: ScheduleData) {
    setEditingSchedule(schedule);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {schedules.length === 0
            ? 'No automation schedules configured'
            : `${schedules.length} schedule${schedules.length === 1 ? '' : 's'}`}
        </p>
        <Button size="sm" onClick={() => setShowAddForm(true)}>
          Add Schedule
        </Button>
      </div>

      {schedules.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed border-border rounded-lg">
          <p className="text-muted-foreground mb-4">
            No automation schedules yet. Add one to start running research automatically.
          </p>
          <Button onClick={() => setShowAddForm(true)}>Add Schedule</Button>
        </div>
      )}

      {schedules.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {schedules.map((schedule) => (
            <ScheduleCard
              key={schedule.id}
              schedule={schedule}
              researcherId={researcherId}
              researcherDefaults={researcherDefaults}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onToggle={handleToggle}
            />
          ))}
        </div>
      )}

      {/* Add schedule dialog */}
      <Dialog open={showAddForm} onOpenChange={(open) => !open && setShowAddForm(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Automation Schedule</DialogTitle>
          </DialogHeader>
          <ScheduleForm
            mode="create"
            researcherId={researcherId}
            researcherDefaults={researcherDefaults}
            onSave={handleSave}
            onCancel={() => setShowAddForm(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Edit schedule dialog */}
      <Dialog
        open={editingSchedule !== null}
        onOpenChange={(open) => !open && setEditingSchedule(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Schedule</DialogTitle>
          </DialogHeader>
          {editingSchedule && (
            <ScheduleForm
              mode="edit"
              schedule={editingSchedule}
              researcherId={researcherId}
              researcherDefaults={researcherDefaults}
              onSave={handleSave}
              onCancel={() => setEditingSchedule(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
