import React, { Suspense } from 'react';
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
    <div className="card p-0 overflow-hidden">
      <Suspense fallback={<div className="p-6 text-gray-600">Loading API reference…</div>}>
        <ScalarApiReference
          configuration={{
            spec: { content: spec },
          }}
        />
      </Suspense>
    </div>
  );
};
