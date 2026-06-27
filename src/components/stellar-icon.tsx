import type { SVGProps } from "react";

/** Stellar (XLM) rocket-arrow glyph. */
export function StellarIcon({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
      {...props}
    >
      <path d="M20.94 5.55 5.84 13.24l-2.78-1.41a.34.34 0 0 1 0-.6L20.43 2.5a.34.34 0 0 1 .51.3v2.45a.34.34 0 0 1-.18.3Zm-17.88 8.9 15.1-7.69 2.78 1.41a.34.34 0 0 1 0 .6L3.57 21.5a.34.34 0 0 1-.51-.3v-2.45a.34.34 0 0 1 .18-.3Z" />
    </svg>
  );
}
