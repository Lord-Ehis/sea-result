import Image from "next/image";

const LOGO_SOURCES = {
  // Full-color (teal/blue) mark — the default everywhere, app chrome
  // included, for brand presence over a strictly neutral look.
  color: "/brand/logo-color.png",
  // Neutral dark-gray mark — kept available for spots where the color
  // mark would clash (e.g. printed/monochrome contexts), not currently
  // used anywhere live.
  dark: "/brand/logo-dark.png",
  // Pale/near-white mark, for dark backgrounds only (e.g. the marketing
  // page's navy sections) — not currently wired into any component.
  light: "/brand/logo-light.png",
} as const;

// Matches the exported artwork's own aspect ratio (2160x710) so sizing by
// height alone never distorts the mark.
const LOGO_ASPECT_RATIO = 2160 / 710;

// The icon-only mark (no wordmark) — a separate export, since the full
// lockup's icon and "S" overlap in the source art with no clean way to
// crop one out of the other. Only exists in color.
const ICON_SRC = "/brand/icon-color.png";
const ICON_ASPECT_RATIO = 1332 / 1138;

export function Logo({
  variant = "color",
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

// For compact square spots (e.g. a collapsed sidebar rail) where the full
// wordmark lockup doesn't fit.
export function LogoIcon({ height = 32, className }: { height?: number; className?: string }) {
  return (
    <Image
      src={ICON_SRC}
      alt="Sophie Educational Assistant"
      height={height}
      width={Math.round(height * ICON_ASPECT_RATIO)}
      className={className}
    />
  );
}
