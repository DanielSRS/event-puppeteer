/**
 * Outline of a totem, the design's device glyph (no matching Material icon).
 *
 * @module
 */

/** The glyph, decorative (`aria-hidden`), in the current text colour. */
export function DeviceGlyph({ size = 20 }: { size?: number }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="2" width="14" height="20" rx="3" />
      <path d="M10 18h4" />
    </svg>
  );
}
