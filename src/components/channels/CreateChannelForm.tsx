'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function CreateChannelForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [platform, setPlatform] = useState<'linkedin' | 'substack'>('linkedin');
  const [platformId, setPlatformId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Name is required'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, platform, platformId: platformId || null }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to create channel');
        return;
      }
      const ch = await res.json();
      router.push('/channels');
    } catch (e) {
      console.error('[CreateChannelForm] submit failed:', e);
      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="name" className="text-sm font-medium">Channel name</Label>
        <Input
          id="name"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="My LinkedIn Profile"
          className="bg-card border-border"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="platform" className="text-sm font-medium">Platform</Label>
        <Select value={platform} onValueChange={v => setPlatform(v as 'linkedin' | 'substack')}>
          <SelectTrigger className="bg-card border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-card border-border">
            <SelectItem value="linkedin">LinkedIn</SelectItem>
            <SelectItem value="substack">Substack</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="platformId" className="text-sm font-medium">
          {platform === 'linkedin' ? 'LinkedIn handle (optional)' : 'Substack subdomain (optional)'}
        </Label>
        <Input
          id="platformId"
          value={platformId}
          onChange={e => setPlatformId(e.target.value)}
          placeholder={platform === 'linkedin' ? 'yourname' : 'yourpub'}
          className="bg-card border-border font-mono text-sm"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-3 pt-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
          className="text-muted-foreground"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={loading}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {loading ? 'Creating...' : 'Create Channel →'}
        </Button>
      </div>
    </form>
  );
}
