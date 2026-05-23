/**
 * Complaints & suggestions — triage customer submissions tied to orders.
 */

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { AdminErrorBoundary } from '../../components/AdminErrorBoundary';
import { Button, Badge, FormTextarea } from '../../components/shared/Components';
import { getAllOrderComplaints, updateOrderComplaintAdmin } from '../../../firebase/firestore';
import type { OrderComplaint, OrderComplaintStatus } from '../../../types';
import { Link } from 'react-router-dom';

const statusVariant = (s: OrderComplaintStatus) => {
  if (s === 'resolved' || s === 'closed') return 'success';
  if (s === 'in_progress') return 'info';
  return 'warning';
};

const STATUS_LABEL: Record<OrderComplaintStatus, string> = {
  open: 'Open',
  in_progress: 'In progress',
  resolved: 'Resolved',
  closed: 'Closed',
};

const ALL_STATUSES: OrderComplaintStatus[] = ['open', 'in_progress', 'resolved', 'closed'];

export default function ComplaintsPage() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [statusDraft, setStatusDraft] = useState<OrderComplaintStatus>('open');
  const [category, setCategory] = useState<OrderComplaintStatus | 'all'>('all');

  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ['adminOrderComplaints'],
    queryFn: getAllOrderComplaints,
  });

  const sorted = useMemo(
    () => [...rows].sort((a, b) => new Date(b.updatedAt ?? b.createdAt ?? 0).getTime() - new Date(a.updatedAt ?? a.createdAt ?? 0).getTime()),
    [rows],
  );

  const counts = useMemo(() => {
    const c: Record<OrderComplaintStatus | 'all', number> = {
      all: sorted.length,
      open: 0,
      in_progress: 0,
      resolved: 0,
      closed: 0,
    };
    for (const r of sorted) {
      const s: OrderComplaintStatus = ALL_STATUSES.includes(r.status) ? r.status : 'open';
      c[s]++;
    }
    return c;
  }, [sorted]);

  const filtered = useMemo(() => {
    if (category === 'all') return sorted;
    return sorted.filter(r => r.status === category);
  }, [sorted, category]);

  const selected = useMemo(
    () => (selectedId ? sorted.find(c => c.id === selectedId) ?? null : null),
    [sorted, selectedId],
  );

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedId) return;
      await updateOrderComplaintAdmin(selectedId, {
        status: statusDraft,
        ...(replyDraft.trim() ? { newAdminMessage: replyDraft.trim() } : {}),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['adminOrderComplaints'] });
      setSelectedId(null);
      setReplyDraft('');
    },
  });

  const openManage = (c: OrderComplaint) => {
    setSelectedId(c.id);
    setReplyDraft('');
    setStatusDraft(c.status);
  };

  return (
    <AdminErrorBoundary>
      <AdminLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Complaints & redressal</h1>
            <p className="mt-2 text-slate-600">
              Customer messages from <strong>Complaints & suggestions</strong> on each order. Conversations are threaded;
              changing status and sending a reply updates the customer view on their orders page.
            </p>
          </div>

          {error ? (
            <p className="text-sm text-rose-600">{error instanceof Error ? error.message : 'Failed to load'}</p>
          ) : null}

          {isLoading ? <p className="text-slate-500">Loading…</p> : null}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setCategory('all')}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                category === 'all' ? 'border-violet-600 bg-violet-50 text-violet-900' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              All ({counts.all})
            </button>
            {ALL_STATUSES.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => setCategory(s)}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                  category === s ? 'border-violet-600 bg-violet-50 text-violet-900' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {STATUS_LABEL[s]} ({counts[s]})
              </button>
            ))}
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Order</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Customer</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Phone</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Status</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Updated</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-slate-800">{c.orderHumanId}</span>
                      <div className="text-xs text-slate-500">{c.orderFirestoreId}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{c.customerName}</div>
                      <div className="text-xs text-slate-500">{c.customerEmail}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-700">
                      <div>{c.phone}</div>
                      {c.phoneAlt ? <div className="text-slate-500">Alt: {c.phoneAlt}</div> : null}
                    </td>
                    <td className="px-4 py-3">
                      <Badge text={STATUS_LABEL[c.status] ?? c.status} variant={statusVariant(c.status)} />
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {c.updatedAt ? new Date(c.updatedAt).toLocaleString() : c.createdAt ? new Date(c.createdAt).toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button type="button" className="text-xs" onClick={() => openManage(c)}>
                        Manage
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!isLoading && filtered.length === 0 ? (
              <p className="px-4 py-8 text-center text-slate-500">
                {sorted.length === 0 ? 'No complaints yet.' : 'No complaints in this category.'}
              </p>
            ) : null}
          </div>

          <p className="text-xs text-slate-500">
            Tip: open the linked order for context —{' '}
            <Link to="/admin/orders" className="text-violet-600 hover:underline">
              Orders
            </Link>
            .
          </p>
        </div>

        {selected ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
              <h2 className="text-lg font-semibold text-slate-900">Complaint detail</h2>
              <p className="mt-1 text-xs text-slate-500">Order {selected.orderHumanId}</p>

              <div className="mt-4 max-h-64 space-y-3 overflow-y-auto rounded-lg border border-slate-100 bg-slate-50 p-3">
                {(selected.thread ?? []).length === 0 ? (
                  <p className="text-sm text-slate-500">No thread (legacy record).</p>
                ) : (
                  (selected.thread ?? []).map(m => (
                    <div
                      key={m.id}
                      className={`flex flex-col rounded-lg px-3 py-2 text-sm ${
                        m.author === 'admin' ? 'ml-6 bg-violet-100 text-slate-900' : 'mr-6 bg-white text-slate-800 shadow-sm'
                      }`}
                    >
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        {m.author === 'admin' ? 'Admin' : 'Customer'}
                        {m.createdAt ? ` · ${new Date(m.createdAt).toLocaleString()}` : ''}
                      </span>
                      <p className="mt-1 whitespace-pre-wrap">{m.body}</p>
                    </div>
                  ))
                )}
              </div>

              <label className="mt-4 block text-sm font-medium text-slate-700">Status</label>
              <select
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={statusDraft}
                onChange={e => setStatusDraft(e.target.value as OrderComplaintStatus)}
              >
                <option value="open">Open</option>
                <option value="in_progress">In progress</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>

              <label className="mt-4 block text-sm font-medium text-slate-700">Reply to customer (appends to thread)</label>
              <FormTextarea
                className="mt-1 min-h-[100px]"
                value={replyDraft}
                onChange={e => setReplyDraft(e.target.value)}
                placeholder="Type your message — it appears in the customer’s complaint status view…"
              />

              <div className="mt-4 flex justify-end gap-2">
                <Button type="button" className="border border-slate-300 bg-white text-slate-800" onClick={() => setSelectedId(null)}>
                  Cancel
                </Button>
                <Button type="button" disabled={updateMutation.isPending} onClick={() => updateMutation.mutate()}>
                  {updateMutation.isPending ? 'Saving…' : 'Save'}
                </Button>
              </div>
              {updateMutation.isError ? (
                <p className="mt-2 text-xs text-rose-600">
                  {(updateMutation.error as Error)?.message ?? 'Save failed — check Firestore rules.'}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
      </AdminLayout>
    </AdminErrorBoundary>
  );
}
