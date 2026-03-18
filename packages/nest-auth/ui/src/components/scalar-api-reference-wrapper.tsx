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

export const ScalarApiReferenceWrapper: React.FC<ScalarApiReferenceWrapperProps> = ({ spec }) => {
  return (
    <Box sx={{ overflow: 'hidden' }}>
      <Suspense fallback={
        <Box sx={{ p: 3 }}>
          <Typography color="text.secondary">Loading API reference…</Typography>
        </Box>
      }>
        <ScalarApiReference
          configuration={{
            spec: { content: spec },
          }}
        />
      </Suspense>
    </Box>
  );
};
