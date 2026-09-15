/** Reach's arc mark — two nodes and the reach between them. Colour via currentColor. */
export function ReachMark({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M3.5 18.5 C3.5 9.5, 10.5 4.5, 20.5 4.5" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" />
      <circle cx="20.5" cy="4.5" r="2.6" fill="currentColor" />
      <circle cx="3.5" cy="18.5" r="2.6" fill="currentColor" />
    </svg>
  );
}
