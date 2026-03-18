import { CreateChannelForm } from '@/components/channels/CreateChannelForm';

export default function NewChannelPage() {
  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="px-6 py-5 border-b border-border shrink-0">
        <h1 className="text-xl font-semibold text-foreground">New Channel</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Connect a LinkedIn profile or Substack publication.
        </p>
      </div>

      <div className="flex-1 p-6 overflow-y-auto">
        <CreateChannelForm />
      </div>
    </div>
  );
}
