import type { ReactNode } from 'react';
import { RootProvider } from 'fumadocs-ui/provider';
import 'fumadocs-ui/style.css';

export const metadata = {
  title: {
    default: 'Nest Auth — Documentation',
    template: '%s · Nest Auth',
  },
  description:
    'Full-featured authentication for NestJS, JS, and React. Sessions, MFA, OAuth, multi-tenant, RBAC, and more.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
