/**
 * Single order — customer snapshot, fulfillment timeline, returns, internal notes, ship / deliver.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Truck,
  PackageCheck,
  ClipboardList,
  RotateCcw,
  ExternalLink,
  ImagePlus,
  Trash2,
  Warehouse,
} from 'lucide-react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { AdminErrorBoundary } from '../../components/AdminErrorBoundary';
import { Button, Badge, Modal, FormInput, FormSelect, FormTextarea } from '../../components/shared/Components';
import { useAdminOrder } from '../../hooks/useAdmin';
import { formatCurrency, coerceDate } from '../../utils/helpers';
import { orderService } from '../../services/orderService';
import { storageService } from '../../services/storageService';
import { canProcessShipment, isAwaitingShipment } from '../../../lib/orderFirestoreStatus';
import { buildTrackingUrl } from '../../../lib/orderTracking';
import { ADMIN_SHIPPING_CARRIER_OPTIONS } from '../../../lib/shippingCarriers';
import type { OrderPackageTrackingPhoto } from '../../../types';

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { order, loading, error, refetch } = useAdminOrder(id ?? '');

  const [shipOpen, setShipOpen] = useState(false);
  const [tracking, setTracking] = useState('');
  const [carrierSelect, setCarrierSelect] = useState('');
  const [customCarrier, setCustomCarrier] = useState('');
  const [trackingUrlOverride, setTrackingUrlOverride] = useState('');
  const [shipEditTracking, setShipEditTracking] = useState('');
  const [shipEditCarrier, setShipEditCarrier] = useState('');
  const [shipEditUrl, setShipEditUrl] = useState('');
  const [packageCaption, setPackageCaption] = useState('');
  const [processing, setProcessing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [returnNote, setReturnNote] = useState('');
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReasonInput, setCancelReasonInput] = useState('');
  /** Required in the cancel modal when `paymentStatus === 'paid'`. */
  const [cancelRefundAcknowledged, setCancelRefundAcknowledged] = useState(false);

  const timeline = useMemo(() => {
    if (!order?.fulfillmentEvents?.length) return [];
    return [...order.fulfillmentEvents].sort(
      (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime()
    );
  }, [order?.fulfillmentEvents]);

  const effectiveCarrier = useMemo(() => {
    if (carrierSelect === 'Other') return customCarrier.trim();
    return carrierSelect.trim();
  }, [carrierSelect, customCarrier]);

  const preShipAdvanceLabel = useMemo(() => {
    const st = order?.status;
    if (st === 'pending') return 'Mark confirmed';
    if (st === 'confirmed') return 'Mark printed';
    if (st === 'printed') return 'Mark packed';
    return 'Advance stage';
  }, [order?.status]);

  useEffect(() => {
    if (!order) return;
    setShipEditTracking(order.trackingNumber || '');
    setShipEditCarrier(order.trackingCarrier || '');
    setShipEditUrl(order.trackingUrl || '');
  }, [order?.id, order?.trackingNumber, order?.trackingCarrier, order?.trackingUrl]);

  const openShipModal = () => {
    if (!order) return;
    setShipOpen(true);
    setTracking(order.trackingNumber || '');
    setTrackingUrlOverride('');
    const tc = order.trackingCarrier?.trim() ?? '';
    const preset = ADMIN_SHIPPING_CARRIER_OPTIONS.find(
      o => o.value === tc && o.value !== '' && o.value !== 'Other'
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

  const submitConfirmPayment = async () => {
    if (!id) return;
    try {
      setProcessing(true);
      setActionError(null);
      await orderService.confirmPaymentReceived(id);
      await refetch();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not confirm payment');
    } finally {
      setProcessing(false);
    }
  };

  const submitShip = async () => {
    if (!order || !id) return;
    if (!canProcessShipment(order.status)) {
      setActionError('Move the order through Confirm → Print → Pack before dispatch.');
      return;
    }
    if (!tracking.trim()) {
      setActionError('Tracking number is required');
      return;
    }
    try {
      setProcessing(true);
      setActionError(null);
      await orderService.shipOrder(
        id,
        tracking.trim(),
        effectiveCarrier || undefined,
        trackingUrlOverride.trim() || undefined
      );
      setShipOpen(false);
      setTracking('');
      setCarrierSelect('');
      setCustomCarrier('');
      setTrackingUrlOverride('');
      await refetch();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to update order');
    } finally {
      setProcessing(false);
    }
  };

  const submitShipmentEdit = async () => {
    if (!id) return;
    try {
      setProcessing(true);
      setActionError(null);
      await orderService.updateShipmentDetails(id, {
        trackingNumber: shipEditTracking,
        trackingCarrier: shipEditCarrier,
        trackingUrl: shipEditUrl,
      });
      await refetch();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to save tracking');
    } finally {
      setProcessing(false);
    }
  };

  const submitAdvancePreShip = async () => {
    if (!id) return;
    try {
      setProcessing(true);
      setActionError(null);
      await orderService.advancePreShipStage(id);
      await refetch();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to advance stage');
    } finally {
      setProcessing(false);
    }
  };

  const onPackagePhotoSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !id || !order) return;
    const v = storageService.validateFile(file);
    if (!v.valid) {
      setActionError(v.error ?? 'Invalid file');
      return;
    }
    try {
      setProcessing(true);
      setActionError(null);
      const url = await storageService.uploadOrderPackagePhoto(id, file);
      const photo: OrderPackageTrackingPhoto = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        url,
        uploadedAt: new Date().toISOString(),
        ...(packageCaption.trim() ? { caption: packageCaption.trim() } : {}),
      };
      await orderService.appendPackageTrackingPhoto(id, photo);
      setPackageCaption('');
      await refetch();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setProcessing(false);
    }
  };

  const removePackagePhoto = async (photo: OrderPackageTrackingPhoto) => {
    if (!id) return;
    try {
      setProcessing(true);
      setActionError(null);
      await orderService.removePackageTrackingPhoto(id, photo.id);
      try {
        await storageService.deleteProductImage(photo.url);
      } catch {
        /* external URL or already removed */
      }
      await refetch();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to remove photo');
    } finally {
      setProcessing(false);
    }
  };

  const submitDelivered = async () => {
    if (!id || !order) return;
    if (order.paymentStatus !== 'paid') {
      setActionError('Payment must be confirmed before marking delivered.');
      return;
    }
    try {
      setProcessing(true);
      setActionError(null);
      await orderService.markDelivered(id);
      await refetch();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to update order');
    } finally {
      setProcessing(false);
    }
  };

  const submitReturned = async () => {
    if (!id) return;
    try {
      setProcessing(true);
      setActionError(null);
      await orderService.markReturnedWithRestock(id);
      await refetch();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to mark returned');
    } finally {
      setProcessing(false);
    }
  };

  const submitReturnDecision = async (decision: 'approved' | 'rejected') => {
    if (!id) return;
    try {
      setProcessing(true);
      setActionError(null);
      await orderService.setReturnRequestDecision(id, decision, returnNote.trim() || undefined);
      setReturnNote('');
      await refetch();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to update return');
    } finally {
      setProcessing(false);
    }
  };

  const submitAdminNote = async () => {
    if (!id || !noteText.trim()) return;
    try {
      setProcessing(true);
      setActionError(null);
      await orderService.appendAdminOrderNote(id, noteText.trim());
      setNoteText('');
      await refetch();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to save note');
    } finally {
      setProcessing(false);
    }
  };

  const submitAdminCancel = async () => {
    if (!id || !order) return;
    const r = cancelReasonInput.trim();
    if (r.length < 3) {
      setActionError('Enter a cancellation reason (at least 3 characters).');
      return;
    }
    if (order.paymentStatus === 'paid' && !cancelRefundAcknowledged) {
      setActionError('Confirm that the customer\'s payment has been refunded before cancelling.');
      return;
    }
    try {
      setProcessing(true);
      setActionError(null);
      await orderService.adminCancelOrder(id, r, {
        paymentRefundConfirmed: order.paymentStatus === 'paid' ? true : undefined,
      });
      setCancelOpen(false);
      setCancelReasonInput('');
      setCancelRefundAcknowledged(false);
      await refetch();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to cancel order');
    } finally {
      setProcessing(false);
    }
  };

  const submitRevertCancellation = async () => {
    if (!id) return;
    try {
      setProcessing(true);
      setActionError(null);
      await orderService.adminRevertCancellation(id);
      await refetch();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not remove cancellation');
    } finally {
      setProcessing(false);
    }
  };

  const openTracking = () => {
    if (!order?.trackingNumber?.trim()) return;
    const url =
      order.trackingUrl?.trim() ||
      buildTrackingUrl(order.trackingNumber, order.trackingCarrier);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  if (!id) {
    return (
      <AdminLayout>
        <p className="text-slate-600">Missing order id.</p>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <AdminErrorBoundary>
        <div className="mx-auto max-w-4xl space-y-6">
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="inline-flex items-center text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back
            </button>
            <Link to="/admin/orders" className="text-sm text-violet-600 hover:underline">
              All orders
            </Link>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
          )}

          {loading && !order ? (
            <p className="text-slate-600">Loading order…</p>
          ) : order ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h1 className="text-3xl font-bold text-slate-900">Order {order.orderId}</h1>
                  <p className="mt-1 text-slate-600">
                    {order.customerName || 'Customer'} · {coerceDate(order.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge
                    text={order.paymentStatus}
                    variant={order.paymentStatus === 'paid' ? 'success' : order.paymentStatus === 'failed' ? 'error' : 'warning'}
                  />
                  <Badge
                    text={order.status}
                    variant={
                      order.status === 'delivered'
                        ? 'success'
                        : order.status === 'returned'
                          ? 'warning'
                          : order.status === 'shipped'
                            ? 'info'
                            : order.status === 'cancelled'
                              ? 'error'
                              : 'default'
                    }
                  />
                </div>
              </div>

              {order.status !== 'returned' && (
                <div
                  className={`rounded-lg border p-4 ${
                    order.status === 'cancelled'
                      ? 'border-red-200 bg-red-50'
                      : 'border-amber-200 bg-amber-50/80'
                  }`}
                >
                  <h2
                    className={`text-sm font-semibold ${
                      order.status === 'cancelled' ? 'text-red-900' : 'text-amber-950'
                    }`}
                  >
                    {order.status === 'cancelled' ? 'Order cancelled' : 'Cancel this order (admin)'}
                  </h2>
                  {order.status === 'cancelled' ? (
                    <>
                      {order.cancelReason ? (
                        <p className="mt-2 whitespace-pre-wrap text-sm text-red-950/95">{order.cancelReason}</p>
                      ) : (
                        <p className="mt-2 text-sm text-red-900/90">No reason was stored on this document.</p>
                      )}
                      {order.cancelledAt ? (
                        <p className="mt-1 text-xs text-red-800/85">Recorded {order.cancelledAt}</p>
                      ) : null}
                      {order.statusBeforeAdminCancel ? (
                        <div className="mt-4 space-y-2">
                          <p className="text-xs text-red-900/90">
                            This order was cancelled from the admin dashboard. You can remove the cancellation to
                            restore fulfillment to <strong>{order.statusBeforeAdminCancel}</strong> and put inventory
                            back on sale (same as checkout).
                          </p>
                          <Button
                            size="sm"
                            variant="secondary"
                            loading={processing}
                            onClick={() => void submitRevertCancellation()}
                          >
                            Remove cancellation
                          </Button>
                        </div>
                      ) : (
                        <p className="mt-3 text-xs text-red-900/85">
                          Customer cancellations (or legacy cancels) cannot be re-opened from this screen — there is no
                          saved prior fulfillment status.
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      <p className="mt-1 text-xs text-amber-900/85">
                        Cancels the order, records your reason, and restocks line items. Shipped or delivered orders are
                        treated like a return for inventory purposes. If payment is <strong>paid</strong>, you must
                        confirm the refund in the cancel dialog before the order can be cancelled.
                      </p>
                      <Button
                        className="mt-3"
                        size="sm"
                        variant="secondary"
                        loading={processing}
                        onClick={() => {
                          setCancelReasonInput('');
                          setCancelRefundAcknowledged(false);
                          setActionError(null);
                          setCancelOpen(true);
                        }}
                      >
                        Cancel order…
                      </Button>
                    </>
                  )}
                </div>
              )}

              {order.paymentStatus !== 'paid' && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                  <p className="font-medium text-amber-900">Payment not recorded as paid</p>
                  <p className="mt-1 text-amber-900/90">
                    You can still run the warehouse pipeline and ship the order (e.g. COD).{' '}
                    <strong>Mark delivered</strong> stays locked until payment is <code className="rounded bg-amber-100/80 px-1">paid</code> — use
                    the button below once the gateway settles or cash is collected (including at delivery for COD).
                  </p>
                  {order.paymentStatus === 'pending' ? (
                    <Button
                      className="mt-3"
                      size="sm"
                      variant="secondary"
                      loading={processing}
                      onClick={() => void submitConfirmPayment()}
                    >
                      Confirm payment received
                    </Button>
                  ) : null}
                </div>
              )}

              {isAwaitingShipment(order.status) && order.status !== 'packed' && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-800">Warehouse pipeline</p>
                  <p className="mt-1 text-xs text-slate-600">
                    Move the order through confirm → print → pack before handing off to Blue Dart or another courier.
                  </p>
                  <Button
                    className="mt-3"
                    size="sm"
                    variant="secondary"
                    loading={processing}
                    onClick={() => void submitAdvancePreShip()}
                  >
                    <Warehouse className="mr-2 h-4 w-4" />
                    {preShipAdvanceLabel}
                  </Button>
                </div>
              )}

              {isAwaitingShipment(order.status) && (
                <div className="rounded-lg border border-violet-200 bg-violet-50 p-4">
                  <p className="text-sm font-medium text-violet-900">This order is awaiting shipment.</p>
                  <Button
                    className="mt-3"
                    size="sm"
                    variant="secondary"
                    disabled={!canProcessShipment(order.status)}
                    onClick={() => openShipModal()}
                  >
                    <Truck className="mr-2 h-4 w-4" />
                    Process shipment
                  </Button>
                  {!canProcessShipment(order.status) ? (
                    <p className="mt-2 text-xs text-violet-800/90">
                      Finish the warehouse steps (Confirm → Print → Pack) before you can enter tracking and ship.
                    </p>
                  ) : null}
                </div>
              )}

              {order.status === 'shipped' && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-sm font-medium text-emerald-900">
                    In transit — mark delivered only after drop-off and payment is recorded as{' '}
                    <code className="rounded bg-emerald-100/80 px-1">paid</code> (online capture or COD collected).
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={processing}
                      disabled={order.paymentStatus !== 'paid'}
                      onClick={() => void submitDelivered()}
                    >
                      <PackageCheck className="mr-2 h-4 w-4" />
                      Mark delivered
                    </Button>
                    {order.trackingNumber ? (
                      <Button size="sm" variant="ghost" onClick={() => openTracking()}>
                        Open tracking
                      </Button>
                    ) : null}
                  </div>
                </div>
              )}

              {(order.status === 'shipped' || order.status === 'delivered') && (
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <p className="text-sm font-medium text-slate-800">Physical return received?</p>
                  <p className="mt-1 text-xs text-slate-500">Restocks inventory from line items (SKU or size/color match).</p>
                  <Button
                    className="mt-3"
                    size="sm"
                    variant="secondary"
                    loading={processing}
                    onClick={() => void submitReturned()}
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Mark returned + restock
                  </Button>
                </div>
              )}

              {order.returnRequest?.status === 'pending' && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <h2 className="text-sm font-semibold text-amber-900">Return request (pending)</h2>
                  <p className="mt-2 text-sm text-amber-950/90 whitespace-pre-wrap">{order.returnRequest.reason}</p>
                  <p className="mt-1 text-xs text-amber-800/80">Requested {order.returnRequest.requestedAt}</p>
                  <FormInput
                    label="Internal note to customer (optional)"
                    value={returnNote}
                    onChange={e => setReturnNote(e.target.value)}
                    placeholder="e.g. Return label sent by email…"
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" loading={processing} onClick={() => void submitReturnDecision('approved')}>
                      Approve
                    </Button>
                    <Button size="sm" variant="secondary" loading={processing} onClick={() => void submitReturnDecision('rejected')}>
                      Reject
                    </Button>
                  </div>
                </div>
              )}

              {actionError && !cancelOpen && !shipOpen && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">{actionError}</div>
              )}

              <div className="rounded-lg border border-slate-200 bg-white p-6">
                <h2 className="mb-3 text-lg font-semibold text-slate-900">Customer</h2>
                <div className="grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase text-slate-500">Name</p>
                    <p>{order.customerName || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase text-slate-500">Email</p>
                    <p>{order.customerEmail || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase text-slate-500">Phone</p>
                    <p>{order.customerPhone || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase text-slate-500">Account id</p>
                    <p className="font-mono text-xs">{order.customerId || '—'}</p>
                    {order.customerId ? (
                      <Link to={`/admin/customers/${order.customerId}`} className="mt-1 inline-block text-xs text-violet-600 hover:underline">
                        Open customer profile
                      </Link>
                    ) : null}
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-xs font-semibold uppercase text-slate-500">Ship to</p>
                    <p className="mt-1 whitespace-pre-wrap">{order.shippingAddress || '—'}</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <h2 className="text-sm font-semibold text-slate-500">Tracking</h2>
                  <p className="mt-1 font-mono text-sm text-slate-900">{order.trackingNumber || '—'}</p>
                  {order.trackingCarrier ? <p className="mt-1 text-xs text-slate-600">Carrier: {order.trackingCarrier}</p> : null}
                  {order.trackingUrl ? (
                    <a
                      href={order.trackingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center text-xs font-medium text-violet-600 hover:underline"
                    >
                      <ExternalLink className="mr-1 h-3 w-3" />
                      Open carrier tracking
                    </a>
                  ) : null}
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <h2 className="text-sm font-semibold text-slate-500">Total</h2>
                  <p className="mt-1 text-2xl font-bold text-slate-900">{formatCurrency(order.totalAmount)}</p>
                </div>
              </div>

              {order.status !== 'cancelled' && order.status !== 'returned' && (
                <div className="rounded-lg border border-slate-200 bg-white p-6">
                  <h2 className="mb-1 text-lg font-semibold text-slate-900">Shipment details</h2>
                  <p className="mb-4 text-xs text-slate-500">
                    Update AWB, courier name, or a direct tracking link (overrides auto-generated URLs when set).
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <FormInput
                      label="Tracking / AWB number"
                      value={shipEditTracking}
                      onChange={e => setShipEditTracking(e.target.value)}
                      placeholder="Waybill number"
                    />
                    <FormInput
                      label="Carrier name"
                      value={shipEditCarrier}
                      onChange={e => setShipEditCarrier(e.target.value)}
                      placeholder="Blue Dart, Delhivery…"
                    />
                    <div className="sm:col-span-2">
                      <FormInput
                        label="Tracking URL (optional)"
                        value={shipEditUrl}
                        onChange={e => setShipEditUrl(e.target.value)}
                        placeholder="https://…"
                      />
                    </div>
                  </div>
                  <Button className="mt-2" size="sm" variant="secondary" loading={processing} onClick={() => void submitShipmentEdit()}>
                    Save shipment details
                  </Button>
                </div>
              )}

              {order.status !== 'cancelled' && order.status !== 'returned' && (
                <div className="rounded-lg border border-slate-200 bg-white p-6">
                  <h2 className="mb-1 text-lg font-semibold text-slate-900">Package & label photos</h2>
                  <p className="mb-4 text-xs text-slate-500">
                    Upload label scans, packed parcel shots, or handover proof — helps your team track the physical package
                    alongside the courier AWB.
                  </p>
                  <div className="mb-4 flex flex-wrap items-end gap-3">
                    <FormInput
                      label="Caption (optional)"
                      value={packageCaption}
                      onChange={e => setPackageCaption(e.target.value)}
                      placeholder="e.g. Packed — 2 cartons"
                      className="min-w-[200px] flex-1"
                    />
                    <label className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-medium text-violet-900 hover:bg-violet-100">
                      <ImagePlus className="mr-2 h-4 w-4" />
                      {processing ? 'Uploading…' : 'Add photo'}
                      <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => void onPackagePhotoSelected(e)} />
                    </label>
                  </div>
                  {order.packageTrackingPhotos?.length ? (
                    <ul className="grid gap-4 sm:grid-cols-2">
                      {order.packageTrackingPhotos.map(photo => (
                        <li key={photo.id} className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                          <a href={photo.url} target="_blank" rel="noopener noreferrer" className="block">
                            <img src={photo.url} alt={photo.caption || 'Package'} className="h-44 w-full object-cover" />
                          </a>
                          <div className="flex items-start justify-between gap-2 p-2">
                            <div className="min-w-0 text-xs text-slate-600">
                              {photo.caption ? <p className="font-medium text-slate-800">{photo.caption}</p> : null}
                              <p className="truncate">{new Date(photo.uploadedAt).toLocaleString()}</p>
                            </div>
                            <button
                              type="button"
                              className="shrink-0 rounded p-1 text-red-600 hover:bg-red-50"
                              title="Remove photo"
                              onClick={() => void removePackagePhoto(photo)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-slate-500">No photos yet.</p>
                  )}
                </div>
              )}

              {timeline.length > 0 && (
                <div className="rounded-lg border border-slate-200 bg-white p-6">
                  <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-slate-900">
                    <ClipboardList className="h-5 w-5 text-violet-600" />
                    Fulfillment timeline
                  </h2>
                  <ul className="space-y-2 border-l-2 border-slate-200 pl-4 text-sm text-slate-700">
                    {timeline.map((ev, idx) => (
                      <li key={`${ev.at}-${idx}`}>
                        <span className="text-slate-500">{new Date(ev.at).toLocaleString()}</span>
                        {ev.actor ? <span className="text-slate-400"> · {ev.actor}</span> : null}
                        {ev.note ? <span> — {ev.note}</span> : <span> — {ev.status}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="rounded-lg border border-slate-200 bg-white p-6">
                <h2 className="mb-3 text-lg font-semibold text-slate-900">Internal notes</h2>
                <p className="text-xs text-slate-500">Use for chargebacks, carrier cases, or VIP follow-ups — visible to admins only.</p>
                <div className="mt-3 space-y-3">
                  {order.adminNotes?.length ? (
                    <ul className="max-h-48 space-y-2 overflow-y-auto text-sm text-slate-700">
                      {[...order.adminNotes]
                        .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
                        .map(n => (
                          <li key={n.id} className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
                            <p className="text-xs text-slate-500">{new Date(n.at).toLocaleString()}</p>
                            <p className="mt-1 whitespace-pre-wrap">{n.text}</p>
                          </li>
                        ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-slate-500">No notes yet.</p>
                  )}
                  <FormInput label="Add note" value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Case #, outcome, next step…" />
                  <Button size="sm" variant="secondary" loading={processing} onClick={() => void submitAdminNote()}>
                    Save note
                  </Button>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-6">
                <h2 className="mb-4 text-lg font-semibold text-slate-900">Line items</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-600">
                        <th className="py-2 pr-2">Product</th>
                        <th className="py-2 pr-2">SKU</th>
                        <th className="py-2 pr-2">Product id</th>
                        <th className="py-2 pr-2">Variant</th>
                        <th className="py-2 pr-2">Qty</th>
                        <th className="py-2 pr-2">Price</th>
                        <th className="py-2 pr-2">Line</th>
                      </tr>
                    </thead>
                    <tbody>
                      {order.items?.map((it, idx) => (
                        <tr key={`${it.productId}-${idx}`} className="border-b border-slate-100">
                          <td className="py-2 pr-2">{it.name || '—'}</td>
                          <td className="py-2 pr-2 font-mono text-xs">{it.sku || '—'}</td>
                          <td className="py-2 pr-2 font-mono text-xs">{it.productId}</td>
                          <td className="py-2 pr-2">
                            {it.size} / {it.color}
                          </td>
                          <td className="py-2 pr-2">{it.quantity}</td>
                          <td className="py-2 pr-2">{formatCurrency(it.price)}</td>
                          <td className="py-2 pr-2 font-medium">{formatCurrency(it.price * it.quantity)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : null}

          <Modal
            isOpen={cancelOpen}
            title="Cancel order"
            onClose={() => {
              if (processing) return;
              setCancelOpen(false);
              setCancelRefundAcknowledged(false);
              setCancelReasonInput('');
            }}
            footer={
              <>
                <Button
                  variant="ghost"
                  disabled={processing}
                  onClick={() => {
                    setCancelOpen(false);
                    setCancelRefundAcknowledged(false);
                    setCancelReasonInput('');
                  }}
                >
                  Close
                </Button>
                <Button
                  loading={processing}
                  disabled={
                    !!order &&
                    order.paymentStatus === 'paid' &&
                    !cancelRefundAcknowledged
                  }
                  onClick={() => void submitAdminCancel()}
                >
                  Confirm cancel
                </Button>
              </>
            }
          >
            <div className="space-y-3 text-sm text-slate-700">
              <p className="text-xs text-slate-500">
                This cannot be undone except with &quot;Remove cancellation&quot; on the order page. Inventory will be
                restocked from the line items.
              </p>
              {order?.paymentStatus === 'paid' ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                  <p className="font-medium text-amber-900">Payment is recorded as paid</p>
                  <p className="mt-1 text-amber-900/95">
                    Process the refund in your gateway or bank workflow first, then confirm below. Cancelling does not
                    trigger an automatic refund from this app.
                  </p>
                </div>
              ) : null}
              <FormTextarea
                label="Reason for cancellation (required)"
                value={cancelReasonInput}
                onChange={e => setCancelReasonInput(e.target.value)}
                placeholder="e.g. Duplicate order, customer requested by phone, fraud check…"
                rows={4}
              />
              {order?.paymentStatus === 'paid' ? (
                <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-800">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                    checked={cancelRefundAcknowledged}
                    onChange={e => setCancelRefundAcknowledged(e.target.checked)}
                  />
                  <span>
                    I confirm the customer&apos;s payment has been refunded (or will be settled per your policy before
                    any payout).
                  </span>
                </label>
              ) : null}
              {actionError ? <p className="text-sm text-red-600">{actionError}</p> : null}
            </div>
          </Modal>

          <Modal
            isOpen={shipOpen}
            title="Dispatch with courier"
            onClose={() => setShipOpen(false)}
            footer={
              <>
                <Button variant="ghost" onClick={() => setShipOpen(false)}>
                  Cancel
                </Button>
                <Button
                  loading={processing}
                  disabled={!order || !canProcessShipment(order.status)}
                  onClick={() => void submitShip()}
                >
                  Mark shipped
                </Button>
              </>
            }
          >
            <div className="space-y-3 text-sm text-slate-700">
              <p className="text-xs text-slate-500">
                Choose your logistics partner (e.g. Blue Dart). A tracking link is generated from the AWB when possible.
              </p>
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
                  placeholder="Enter courier name"
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
                placeholder="Leave blank to auto-build from carrier + AWB"
              />
              {tracking.trim() && !trackingUrlOverride.trim() ? (
                <p className="text-xs text-slate-500">
                  Preview:{' '}
                  <span className="break-all font-mono text-slate-700">
                    {buildTrackingUrl(tracking.trim(), effectiveCarrier || undefined) || '—'}
                  </span>
                </p>
              ) : null}
              {actionError && <p className="text-sm text-red-600">{actionError}</p>}
            </div>
          </Modal>
        </div>
      </AdminErrorBoundary>
    </AdminLayout>
  );
}
