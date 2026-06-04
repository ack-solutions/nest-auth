import React, { Suspense } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import '@scalar/api-reference-react/style.css';

const ScalarApiReference = React.lazy(async () => {
  const mod: any = await import('@scalar/api-reference-react');
  return {
    default: mod.ApiReference || mod.ApiReferenceReact || mod.default,
  };
});

interface ScalarApiReferenceWrapperProps {
  spec: any;
}

/**
 * Light-touch CSS so the embedded Scalar reference feels native inside the
 * admin shell: rounded container, no full-page background takeover, and a
 * sidebar that scrolls independently instead of pushing the page height.
 */
const SCALAR_EMBED_CSS = `
.nest-auth-scalar .scalar-api-reference {
  --scalar-radius: 10px;
}
.nest-auth-scalar .scalar-api-reference,
.nest-auth-scalar .references-rendered {
  background: transparent;
}
/* Keep the reference inside the admin content column rather than going edge-to-edge */
.nest-auth-scalar .references-layout {
  border: 1px solid var(--scalar-border-color, rgba(0,0,0,0.08));
  border-radius: 12px;
  overflow: hidden;
}
`;

export const ScalarApiReferenceWrapper: React.FC<ScalarApiReferenceWrapperProps> = ({ spec }) => {
  return (
    <Box className="nest-auth-scalar" sx={{ overflow: 'hidden', borderRadius: 2 }}>
      <Suspense
        fallback={
          <Box sx={{ p: 3 }}>
            <Typography color="text.secondary">Loading API reference…</Typography>
          </Box>
        }
      >
        <ScalarApiReference
          configuration={{
            // Embed the OpenAPI document directly (top-level `content` — the
            // `spec: { content }` form is deprecated in current Scalar).
            content: spec,
            // On-brand NestJS theme + the modern three-column layout.
            theme: 'nestjs',
            layout: 'modern',
            // Navigation & discoverability.
            showSidebar: true,
            defaultOpenAllTags: false,
            // Keep schemas ("Models") visible — they document every request/response body.
            hideModels: false,
            // Let users try requests straight from the docs against the running API.
            hideTestRequestButton: false,
            // We already expose a "Download JSON" button in the page header.
            hideDownloadButton: true,
            // Default the code samples to a sensible client.
            defaultHttpClient: { targetKey: 'shell', clientKey: 'curl' },
            withDefaultFonts: true,
            customCss: SCALAR_EMBED_CSS,
            metaData: {
              title: 'nest-auth API Reference',
              description:
                'Interactive reference for every @ackplus/nest-auth endpoint — authentication, MFA, and the admin console.',
            },
          }}
        />
      </Suspense>
    </Box>
  );
};
