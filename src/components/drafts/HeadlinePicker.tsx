interface HeadlinePickerProps {
  headlines: string[];
  activeIndex: number;
  onSelect: (index: number) => void;
}

export function HeadlinePicker({ headlines, activeIndex, onSelect }: HeadlinePickerProps) {
  return (
    <section>
      <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-0.5">
        Headlines
      </h3>
      <p className="text-xs text-muted-foreground mb-2">Pick one to use as the title</p>
      <div className="flex flex-col gap-1.5">
        {headlines.map((headline, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onSelect(i)}
            className={[
              'w-full text-left rounded-md px-3 py-2 text-sm transition-colors border flex items-start gap-2.5',
              i === activeIndex
                ? 'border-primary/50 bg-primary/5 text-foreground'
                : 'border-transparent hover:border-border hover:bg-secondary text-muted-foreground hover:text-foreground',
            ].join(' ')}
          >
            {/* Radio indicator */}
            <span className="mt-0.5 shrink-0 w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center border-current">
              {i === activeIndex && (
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              )}
            </span>
            <span>{headline}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
