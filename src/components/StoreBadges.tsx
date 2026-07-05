/**
 * App Store / Google Play download badges.
 *
 * The recognizable store glyphs (Apple mark, Google Play triangle) are inline SVG so
 * they are self-contained — no remote badge image to hotlink and no network dependency.
 * The standard badge wording ("Download on the App Store" / "Get it on Google Play") is
 * rendered as HTML text so it uses the app font and scales cleanly with the badge height.
 */
import type { ReactNode } from 'react';

import { FONT_FAMILY } from '@/lib/theme';

const APP_STORE_URL = 'https://apps.apple.com/my/app/kinders/id6781074029';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=my.kinders.app';

type BadgeProps = { height?: number };

function AppleGlyph({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
      <path d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.572-2.27 1.206-2.98.804-.94 2.142-1.64 3.248-1.68.03.13.05.28.05.43zm4.565 15.71c-.03.07-.463 1.58-1.518 3.12-.945 1.34-1.94 2.71-3.43 2.71-1.517 0-1.9-.88-3.63-.88-1.698 0-2.302.91-3.67.91-1.377 0-2.332-1.26-3.428-2.8-1.287-1.82-2.323-4.63-2.323-7.28 0-4.28 2.797-6.55 5.552-6.55 1.448 0 2.675.95 3.6.95.865 0 2.222-1.01 3.902-1.01.635 0 2.935.06 4.45 2.22-.116.083-2.585 1.51-2.585 4.5 0 3.45 3.03 4.68 3.06 4.69z" />
    </svg>
  );
}

function GooglePlayGlyph({ size }: { size: number }) {
  return (
    <svg height={size} width={size * (256 / 283)} viewBox="0 0 256 283" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M1.06 23.487A31.9 31.9 0 0 0 0 31.61v219.327a32 32 0 0 0 1.06 8.124l122.555-121.315z"
      />
      <path
        fill="#34A853"
        d="m120.436 141.372 61.328-60.933L48.879 3.633A32.17 32.17 0 0 0 1.06 23.472l119.376 117.9z"
      />
      <path
        fill="#EA4335"
        d="M119.553 134.916 1.06 259.061a32.14 32.14 0 0 0 47.062 19.316l133.043-76.535z"
      />
      <path
        fill="#FBBC04"
        d="m239.37 113.814-57.605-33.35-64.766 57.65 65.014 64.98 57.196-33.146a31.913 31.913 0 0 0 .132-56.134z"
      />
    </svg>
  );
}

function StoreBadge({
  href,
  label,
  glyph,
  top,
  topSpacing,
  bottom,
  height,
}: {
  href: string;
  label: string;
  glyph: ReactNode;
  top: string;
  topSpacing: number;
  bottom: string;
  height: number;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: Math.round(height * 0.18),
        height,
        padding: `0 ${Math.round(height * 0.28)}px`,
        background: '#000',
        color: '#fff',
        borderRadius: Math.round(height * 0.19),
        border: '1px solid #A6A6A6',
        textDecoration: 'none',
        boxSizing: 'border-box',
        fontFamily: FONT_FAMILY,
        userSelect: 'none',
      }}
    >
      {glyph}
      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.05 }}>
        <span style={{ fontSize: Math.round(height * 0.2), fontWeight: 400, letterSpacing: topSpacing }}>
          {top}
        </span>
        <span
          style={{
            fontSize: Math.round(height * 0.4),
            fontWeight: 600,
            letterSpacing: 0.2,
            marginTop: Math.round(height * 0.02),
          }}
        >
          {bottom}
        </span>
      </span>
    </a>
  );
}

export function AppStoreBadge({ height = 46 }: BadgeProps) {
  return (
    <StoreBadge
      href={APP_STORE_URL}
      label="Download on the App Store"
      glyph={<AppleGlyph size={Math.round(height * 0.52)} />}
      top="Download on the"
      topSpacing={0.2}
      bottom="App Store"
      height={height}
    />
  );
}

export function GooglePlayBadge({ height = 46 }: BadgeProps) {
  return (
    <StoreBadge
      href={PLAY_STORE_URL}
      label="Get it on Google Play"
      glyph={<GooglePlayGlyph size={Math.round(height * 0.5)} />}
      top="GET IT ON"
      topSpacing={1.2}
      bottom="Google Play"
      height={height}
    />
  );
}
