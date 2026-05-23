/**
 * Orders — filter by fulfillment `status` (same field as storefront). Process shipments with tracking #.
 */

import { useMemo, useState } from 'react';
import { Download, Truck } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { AdminErrorBoundary } from '../../components/AdminErrorBoundary';
import { DataTable, Button, Badge, Modal, FormInput, FormSelect } from '../../components/shared/Components';
import { useAdminOrders } from '../../hooks/useAdmin';
import { formatCurrency, coerceDate, exportToCSV } from '../../utils/helpers';
import type { StoreOrder, StoreOrderStatus } from '../../types/store';
import { orderService } from '../../services/orderService';
import { canProcessShipment, isAwaitingShipment } from '../../../lib/orderFirestoreStatus';
import { buildTrackingUrl } from '../../../lib/orderTracking';
import { ADMIN_SHIPPING_CARRIER_OPTIONS } from '../../../lib/shippingCarriers';

const LIST_TABS = ['pending', 'shipped', 'delivered', 'returned', 'cancelled'] as const;

function parseListQuery(value: string | null): { awaitingShipment?: boolean; status?: StoreOrderStatus } {
  if (!value) return {};
  if (value === 'pending') return { awaitingShipment: true };
  if ((LIST_TABS as readonly string[]).includes(value)) {
    return { status: value as StoreOrderStatus };
  }
  return {};
}

export default function OrdersList() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const listFilters = parseListQuery(searchParams.get('status'));
  const { orders, loading, error, refetch } = useAdminOrders(listFilters);

  const [modalOrder, setModalOrder] = useState<StoreOrder | null>(null);
  const [tracking, setTracking] = useState('');
  const [carrierSelect, setCarrierSelect] = useState('');
  const [customCarrier, setCustomCarrier] = useState('');
  const [trackingUrlOverride, setTrackingUrlOverride] = useState('');
  const [processing, setProcessing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: orders.length };
    for (const t of LIST_TABS) {
      c[t] = orders.filter((o) =>
        t === 'pending' ? isAwaitingShipment(o.status) : o.status === t
      ).length;
    }
    return c;
  }, [orders]);

  const openShip = (o: StoreOrder) => {
    setModalOrder(o);
    setTracking(o.trackingNumber || '');
    setTrackingUrlOverride('');
    const tc = o.trackingCarrier?.trim() ?? '';
    const preset = ADMIN_SHIPPING_CARRIER_OPTIONS.find(
      x => x.value === tc && x.value !== '' && x.value !== 'Other'
    );
    if (preset) {
      setCarrierSelect(preset.value);
      setCustomCarrier('');
    } else if (tc) {
      setCarrierSelect('Other');
      setCustomCarrier(tc);
    } else {
      setCarrierSelect('');
      setCustomCarrier('');
    }
    setActionError(null);
  };

  const effectiveCarrier =
    carrierSelect === 'Other' ? customCarrier.trim() : carrierSelect.trim();

  const submitShip = async () => {
    if (!modalOrder) return;
    if (!canProcessShipment(modalOrder.status)) {
      setActionError('Pack the order first (Confirm → Print → Pack on the order detail page).');
      return;
    }
    if (!tracking.trim()) {
      setActionError('Tracking number is required');
      return;
    }
    try {
      setProcessing(true);
      await orderService.shipOrder(
        modalOrder.id,
        tracking.trim(),
        effectiveCarrier || undefined,
        trackingUrlOverride.trim() || undefined
      );
      setModalOrder(null);
      await refetch();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to ship');
    } finally {
      setProcessing(false);
    }
  };

  const exportVisible = () => {
    exportToCSV(
      orders.map((o) => ({
        orderId: o.orderId,
        customerName: o.customerName,
        customerEmail: o.customerEmail,
        totalAmount: o.totalAmount,
        paymentStatus: o.paymentStatus,
        status: o.status,
        trackingNumber: o.trackingNumber,
        createdAt: coerceDate(o.createdAt).toISOString(),
      })),
      'orders-export.csv'
    );
  };

  const shippingFromQuery = searchParams.get('status');

  const columns = [
    { key: 'orderId' as const, label: 'Order #', sortable: true },
    {
      key: 'createdAt' as const,
      label: 'Date',
      render: (v: unknown) => coerceDate(v).toLocaleDateString(),
    },
    { key: 'customerName' as const, label: 'Customer' },
    { key: 'customerEmail' as const, label: 'Email' },
    {
      key: 'totalAmount' as const,
      label: 'Amount',
      render: (v: number) => formatCurrency(v),
    },
    {
      key: 'paymentStatus' as const,
      label: 'Payment',
      render: (s: string) => (
        <Badge
          text={s}
          variant={s === 'paid' ? 'success' : s === 'failed' ? 'error' : 'warning'}
        />
      ),
    },
    {
      key: 'status' as const,
      label: 'Fulfillment',
      render: (s: string) => (
        <Badge
          text={s}
          variant={
            s === 'delivered'
              ? 'success'
              : s === 'returned'
                ? 'warning'
                : s === 'shipped'
                  ? 'info'
                  : s === 'cancelled'
                    ? 'error'
                    : 'default'
          }
        />
      ),
    },
    {
      key: 'trackingNumber' as const,
      label: 'Tracking',
      render: (t: string) => <span className="font-mono text-xs text-slate-600">{t || '—'}</span>,
    },
    {
      key: 'customerId' as const,
      label: 'Actions',
      render: (_: unknown, o: StoreOrder) => (
        <div className="flex flex-wrap items-center gap-2">
          {isAwaitingShipment(o.status) &&
            (canProcessShipment(o.status) ? (
              <Button size="sm" variant="secondary" onClick={() => openShip(o)}>
                <Truck className="mr-1 h-3 w-3" />
                Process
              </Button>
            ) : (
              <span className="text-xs text-slate-600" title="Use Confirm → Print → Pack on the order page first">
                Not packed
              </span>
            ))}
          <button
            type="button"
            className="text-xs font-medium text-violet-600 hover:underline"
            onClick={() => navigate(`/admin/orders/${o.id}`)}
          >
            Details
          </button>
        </div>
      ),
    },
  ];

  return (
    <AdminLayout>
      <AdminErrorBoundary>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Orders</h1>
              <p className="mt-1 text-slate-600">Filtered by fulfillment status (Firestore `status`)</p>
            </div>
            <Button variant="secondary" size="lg" onClick={exportVisible}>
              <Download className="mr-2 h-4 w-4" />
              Export view
            </Button>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
          )}

          <div className="flex flex-wrap gap-2">
            {[
              { value: '', label: 'All', count: counts.all },
              { value: 'pending', label: 'Pending', count: counts.pending },
              { value: 'shipped', label: 'Shipped', count: counts.shipped },
              { value: 'delivered', label: 'Delivered', count: counts.delivered },
              { value: 'returned', label: 'Returned', count: counts.returned },
              { value: 'cancelled', label: 'Cancelled', count: counts.cancelled },
            ].map((tab) => (
              <button
                key={tab.value || 'all'}
                type="button"
                onClick={() => {
                  if (tab.value) navigate(`/admin/orders?status=${tab.value}`);
                  else navigate('/admin/orders');
                }}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  (shippingFromQuery ?? '') === tab.value ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {tab.label}
                <span className="ml-2 text-xs opacity-80">({tab.count})</span>
              </button>
            ))}
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <DataTable
              columns={columns}
              data={orders}
              loading={loading}
              searchPlaceholder="Search order #, customer…"
            />
          </div>

          <Modal
            isOpen={!!modalOrder}
            title="Process order"
            onClose={() => setModalOrder(null)}
            footer={
              <>
                <Button variant="ghost" onClick={() => setModalOrder(null)}>
                  Cancel
                </Button>
                <Button
                  loading={processing}
                  disabled={!modalOrder || !canProcessShipment(modalOrder.status)}
                  onClick={() => void submitShip()}
                >
                  Mark shipped
                </Button>
              </>
            }
          >
            {modalOrder && (
              <div className="space-y-3 text-sm text-slate-700">
                <p>
                  Order <span className="font-mono font-semibold">{modalOrder.orderId}</span> —{' '}
                  {modalOrder.customerName}
                </p>
                {modalOrder && !canProcessShipment(modalOrder.status) ? (
                  <p className="text-sm text-amber-800">
                    Pack the order on the detail page (Confirm → Print → Pack) before dispatch.
                  </p>
                ) : null}
                <FormSelect
                  label="Courier"
                  value={carrierSelect}
                  onChange={e => setCarrierSelect(e.target.value)}
                  options={ADMIN_SHIPPING_CARRIER_OPTIONS}
                />
                {carrierSelect === 'Other' ? (
                  <FormInput
                    label="Carrier name"
                    value={customCarrier}
                    onChange={e => setCustomCarrier(e.target.value)}
                    placeholder="Carrier name"
                  />
                ) : null}
                <FormInput
                  label="AWB / tracking number"
                  value={tracking}
                  onChange={e => setTracking(e.target.value)}
                  placeholder="Waybill or tracking #"
                />
                <FormInput
                  label="Tracking URL override (optional)"
                  value={trackingUrlOverride}
                  onChange={e => setTrackingUrlOverride(e.target.value)}
                  placeholder="Auto-built from courier + AWB if left blank"
                />
                {tracking.trim() && !trackingUrlOverride.trim() ? (
                  <p className="text-xs text-slate-500 break-all">
                    Preview: {buildTrackingUrl(tracking.trim(), effectiveCarrier || undefined) || '—'}
                  </p>
                ) : null}
                {actionError && <p className="text-sm text-red-600">{actionError}</p>}
              </div>
            )}
          </Modal>
        </div>
      </AdminErrorBoundary>
    </AdminLayout>
  );
}
