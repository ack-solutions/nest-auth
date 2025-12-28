'use client';

import { useState } from 'react';
import { useNestAuth } from '@ackplus/nest-auth-react';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle2, Loader2, Server } from 'lucide-react';

export function ApiCallDemo() {
  const { client } = useNestAuth();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const callApi = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // client.verifySession() is a protected endpoint call example
      // In a real app, you would use client.request can call your own endpoints
      // auth-client configuration handles token attachment automatically
      const response = await client.verifySession();
      setResult(response);
    } catch (err: any) {
      setError(err.message || 'Failed to call API');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Server className="w-5 h-5 text-gray-500" />
        <h3 className="font-medium">API Call Demo</h3>
      </div>
      
      <p className="text-sm text-gray-500">
        Click to verify session with the backend. This sends a request with the attached access token (or cookie).
      </p>

      <Button onClick={callApi} disabled={loading} size="sm" variant="outline">
        {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        Call Protected Endpoint
      </Button>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 p-3 rounded-md text-sm flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {result && (
        <div className="bg-green-50 dark:bg-green-900/10 text-green-600 dark:text-green-400 p-3 rounded-md text-sm">
          <div className="flex items-center gap-2 mb-2 font-medium">
            <CheckCircle2 className="w-4 h-4" />
            <span>Success</span>
          </div>
          <pre className="text-xs overflow-auto bg-white/50 dark:bg-black/20 p-2 rounded">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
