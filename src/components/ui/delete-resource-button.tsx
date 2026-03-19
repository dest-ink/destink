'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

interface DeleteResourceButtonProps {
  resourceName: string;
  deleteUrl: string;
  redirectTo: string;
  description: string;
}

export function DeleteResourceButton({ resourceName, deleteUrl, redirectTo, description }: DeleteResourceButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const handleDelete = async () => {
    try {
      const res = await fetch(deleteUrl, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) {
        const data = await res.json().catch(() => ({}));
        toast.error((data as { error?: string }).error ?? 'Failed to delete');
        return;
      }
      toast.success(`Deleted "${resourceName}"`);
      router.push(redirectTo);
      router.refresh();
    } catch {
      toast.error('Failed to delete');
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
      >
        <Trash2 className="w-4 h-4 mr-1.5" />
        Delete
      </Button>

      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`Delete "${resourceName}"?`}
        description={description}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </>
  );
}
