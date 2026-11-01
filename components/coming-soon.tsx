export function ComingSoon({ title, phase, blurb }: { title: string; phase: number; blurb: string }) {
  return (
    <div className="py-10">
      <h1 className="text-3xl font-semibold">{title}</h1>
      <p className="mt-2 max-w-md text-muted-foreground">{blurb}</p>
      <p className="mt-6 inline-block rounded-full bg-accent px-3 py-1 text-xs text-accent-foreground">
        Arrives in Phase {phase}
      </p>
    </div>
  );
}
