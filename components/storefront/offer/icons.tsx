// The /offer icon set.
//
// Inline stroke SVGs, not emoji. context/ui-context.md is explicit that the
// storefront does not use emoji as UI icons, and the previous version of this
// page was carrying 🛒 💵 🚚 ✅ 📞 through every CTA and trust card — which is
// the single loudest thing standing between this page and looking expensive.
// Emoji also render as a different typeface on every device, so the one
// element repeated most often on the page was the one nothing could style.
//
// One shape language: 1.5 stroke, round caps and joins, 24-box, currentColor.
// Sized by the caller through `width`/`height` on the class, never here.

type P = { className?: string };

function Svg({ className, children }: P & { children: React.ReactNode }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

/** The order CTA's mark — a shopping bag, not a supermarket trolley. */
export function BagIcon({ className }: P) {
  return (
    <Svg className={className}>
      <path d="M4.5 8h15l-1.1 11.2a2 2 0 0 1-2 1.8H7.6a2 2 0 0 1-2-1.8L4.5 8Z" />
      <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
    </Svg>
  );
}

/** Cash on delivery. */
export function CashIcon({ className }: P) {
  return (
    <Svg className={className}>
      <rect x="2.5" y="6" width="19" height="12" rx="2.5" />
      <circle cx="12" cy="12" r="2.6" />
      <path d="M6 10v4M18 10v4" />
    </Svg>
  );
}

/** Delivery to all 58 wilayas. */
export function TruckIcon({ className }: P) {
  return (
    <Svg className={className}>
      <path d="M2.5 7.5A1.5 1.5 0 0 1 4 6h9.5v10H2.5V7.5Z" />
      <path d="M13.5 10H17l3 3v3h-6.5" />
      <circle cx="7" cy="18" r="1.8" />
      <circle cx="17" cy="18" r="1.8" />
    </Svg>
  );
}

/** Genuine products. */
export function ShieldIcon({ className }: P) {
  return (
    <Svg className={className}>
      <path d="M12 2.8 5 5.4v5.4c0 4.4 2.9 8.3 7 9.5 4.1-1.2 7-5.1 7-9.5V5.4L12 2.8Z" />
      <path d="m9 11.6 2.1 2.1L15 9.9" />
    </Svg>
  );
}

/** The confirmation call before a parcel leaves. */
export function PhoneIcon({ className }: P) {
  return (
    <Svg className={className}>
      <path d="M7.7 3.6 9.4 7 7.8 9c.9 1.9 2.4 3.4 4.3 4.3l2-1.6 3.4 1.7v3.1a2 2 0 0 1-2.2 2A15.6 15.6 0 0 1 3.6 5.8a2 2 0 0 1 2-2.2h2.1Z" />
    </Svg>
  );
}

export function CheckIcon({ className }: P) {
  return (
    <Svg className={className}>
      <path d="m4.5 12.6 4.6 4.6 10.4-10.4" />
    </Svg>
  );
}

/** Points to the inline-start on an RTL page: the "keep reading" direction. */
export function ArrowIcon({ className }: P) {
  return (
    <Svg className={className}>
      <path d="M19.5 12h-15" />
      <path d="m11 4.5-6.5 7.5L11 19.5" />
    </Svg>
  );
}

/** Filled star for review ratings — the only filled glyph in the set, because
 *  a hollow star reads as "not awarded" beside a filled one. */
export function StarIcon({ className, filled }: P & { filled: boolean }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m12 3.6 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9L12 3.6Z" />
    </svg>
  );
}
