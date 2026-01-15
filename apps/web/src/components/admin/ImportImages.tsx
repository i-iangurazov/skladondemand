'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type SyncResult = {
  matched: number;
  updated: number;
  unmatched: number;
  skipped: number;
  errors: number;
  warnings?: string[];
  unmatchedFiles?: string[];
};

type Props = {
  initialFolderId?: string;
};

export default function ImportImages({ initialFolderId }: Props) {
  const [folderId, setFolderId] = useState(initialFolderId ?? '');
  const [result, setResult] = useState<SyncResult | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSync = async () => {
    if (!folderId.trim()) {
      setError('Folder ID is required.');
      return;
    }

    setIsSyncing(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/images/sync-drive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId }),
      });
      const payload = (await response.json()) as SyncResult & { code?: string };
      if (!response.ok) {
        setError(payload.code ?? 'errors.generic');
        return;
      }
      setResult(payload);
    } catch (err) {
      setError('errors.generic');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-base">Google Drive sync</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="flex flex-col gap-2 text-sm">
            <span className="text-sm font-medium">Drive folder ID</span>
            <Input
              value={folderId}
              onChange={(event) => setFolderId(event.target.value)}
              placeholder="Drive folder id"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleSync} disabled={isSyncing}>
              {isSyncing ? 'Syncing...' : 'Sync from Google Drive'}
            </Button>
          </div>
          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      {result && (
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Sync results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="overflow-x-auto rounded-lg border border-border/60">
              <table className="w-full min-w-[768px] text-sm">
                <thead className="bg-muted/50 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">Matched</th>
                    <th className="px-3 py-2 text-left">Updated</th>
                    <th className="px-3 py-2 text-left">Unmatched</th>
                    <th className="px-3 py-2 text-left">Skipped</th>
                    <th className="px-3 py-2 text-left">Errors</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  <tr className="odd:bg-muted/20 hover:bg-muted/30">
                    <td className="px-3 py-2">{result.matched}</td>
                    <td className="px-3 py-2">{result.updated}</td>
                    <td className="px-3 py-2">{result.unmatched}</td>
                    <td className="px-3 py-2">{result.skipped}</td>
                    <td className="px-3 py-2">{result.errors}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {result.warnings?.length ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                {result.warnings.map((warning) => (
                  <div key={warning}>{warning}</div>
                ))}
              </div>
            ) : null}

            <div>
              <div className="text-sm font-medium">Unmatched filenames</div>
              {result.unmatchedFiles?.length ? (
                <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
                  {result.unmatchedFiles.map((name) => (
                    <div key={name}>{name}</div>
                  ))}
                </div>
              ) : (
                <div className="mt-2 text-xs text-muted-foreground">None</div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
