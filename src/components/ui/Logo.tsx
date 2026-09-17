import Image from "next/image";

const LOGO_SOURCES = {
  // Neutral dark-gray mark — used across the signed-in app, auth pages, and
  // lookup flow, since there's no dark-mode surface for the pale variant
  // to sit on outside two small marketing-page sections.
  dark: "/brand/logo-dark.png",
  // Pale/near-white mark, for dark backgrounds only (e.g. the marketing
  // page's navy sections) — not currently wired into any component.
  light: "/brand/logo-light.png",
  // Full-color (teal/blue) mark — used on the marketing site for more
  // visual presence.
  color: "/brand/logo-color.png",
} as const;

// Matches the exported artwork's own aspect ratio (2160x710) so sizing by
// height alone never distorts the mark.
const LOGO_ASPECT_RATIO = 2160 / 710;

export function Logo({
  variant = "dark",
  height = 32,
  className,
}: {
  variant?: keyof typeof LOGO_SOURCES;
  height?: number;
  className?: string;
}) {
  return (
    <Image
      src={LOGO_SOURCES[variant]}
      alt="Sophie Educational Assistant"
      height={height}
      width={Math.round(height * LOGO_ASPECT_RATIO)}
      className={className}
    />
  );
}
