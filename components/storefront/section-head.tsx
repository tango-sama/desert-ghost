export function SectionHead({
  label,
  title,
  sub,
}: {
  label: string;
  title: string;
  sub?: string;
}) {
  return (
    <div className="mx-auto mb-12 max-w-[560px] text-center">
      <span className="mb-3.5 inline-block rounded-full border border-[rgba(217,168,108,.5)] bg-[rgba(217,168,108,.14)] px-4.5 py-1.5 text-[0.74rem] font-extrabold tracking-[.3px] text-[var(--rose-deep)]">
        {label}
      </span>
      <h2 className="inline-block bg-gradient-to-br from-[var(--rose-deep)] to-[var(--gold)] bg-clip-text text-[clamp(1.8rem,4vw,2.7rem)] leading-[1.15] font-black text-transparent">
        {title}
      </h2>
      <div className="mx-auto mt-3.5 h-[3px] w-20 rounded-full bg-gradient-to-r from-[var(--gold)] to-[var(--rose)]" />
      {sub && <p className="mt-4 text-[0.96rem] text-muted-foreground">{sub}</p>}
    </div>
  );
}
