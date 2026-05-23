/**
 * Historical orders → CSV download.
 */

import { useState } from 'react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { AdminErrorBoundary } from '../../components/AdminErrorBoundary';
import { Button, FormTextarea } from '../../components/shared/Components';
import { reportService } from '../../services/reportService';

export default function ReportsExportPage() {
  const [from, setFrom] = useState(() => new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [to, setTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [csv, setCsv] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    try {
      setLoading(true);
      setError(null);
      const start = new Date(from);
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      const out = await reportService.buildOrdersCsvForRange(start, end);
      setCsv(out);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Query failed');
    } finally {
      setLoading(false);
    }
  };

  const download = () => {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orders-${from}-to-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminLayout>
      <AdminErrorBoundary>
        <div className="mx-auto max-w-4xl space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Reports</h1>
            <p className="mt-1 text-slate-600">Query orders between two dates and export CSV.</p>
          </div>
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
          )}
          <div className="flex flex-wrap items-end gap-4 rounded-lg border border-slate-200 bg-white p-6">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">From</label>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="admin-control-inline min-w-[10rem]"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">To</label>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="admin-control-inline min-w-[10rem]"
              />
            </div>
            <Button loading={loading} onClick={() => void run()}>
              Run query
            </Button>
            <Button variant="secondary" disabled={!csv} onClick={download}>
              Download CSV
            </Button>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">CSV preview</label>
            <FormTextarea readOnly rows={14} value={csv} className="font-mono text-xs" />
          </div>
        </div>
      </AdminErrorBoundary>
    </AdminLayout>
  );
}
