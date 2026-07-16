import type { ReactNode } from 'react';

import { Brand, Radius } from '@/lib/theme';

/**
 * The signed-out / not-yet-recognised card shell — the visual language shared by Login,
 * Pending, and CenterSetup. These three are the only screens rendered outside the app
 * Layout, so they carry their own full-page background.
 */
export function AuthCard({ children, width = 420 }: { children: ReactNode; width?: number }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
        background: `radial-gradient(1200px 600px at 50% -10%, ${Brand.primaryContainer}, ${Brand.background})`,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: width,
          background: Brand.white,
          border: `1px solid ${Brand.outlineVariant}`,
          borderRadius: Radius.xl,
          padding: 32,
          boxShadow: 'var(--shadow-pop)',
        }}
      >
        {children}
      </div>
    </div>
  );
}

/** Inline error/notice line, matching the Login card's error treatment. */
export function ErrorLine({ text }: { text: string }) {
  return (
    <div
      style={{
        marginTop: 12,
        background: Brand.errorContainer,
        color: Brand.onErrorContainer,
        borderRadius: Radius.md,
        padding: '8px 12px',
        fontSize: 13,
      }}
    >
      {text}
    </div>
  );
}
