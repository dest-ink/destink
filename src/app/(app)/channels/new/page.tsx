import { CreateChannelForm } from '@/components/channels/CreateChannelForm';

export default function NewChannelPage() {
  return (
    <div className="p-6 max-w-lg mx-auto">
      <div className="mb-8">
        <h1 className="text-xl font-semibold">New Channel</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Connect a LinkedIn profile or Substack publication.
        </p>
      </div>
      <CreateChannelForm />
    </div>
  );
}
