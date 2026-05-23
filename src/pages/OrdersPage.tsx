import { useMemo, useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useAuth } from '../context/AuthContext';
import {
  appendCustomerOrderComplaintMessage,
  customerCancelOrder,
  customerRequestOrderReturn,
  getOrdersByUser,
  getOrderComplaintsByUser,
  hasCustomerSubmittedReview,
  submitCustomerProductReview,
  createOrderComplaint,
} from '../firebase/firestore';
import { LoadingScreen } from '../components/ui/LoadingScreen';
import { useToast } from '../components/ui/Toast';
import { downloadOrderInvoiceHtml } from '../lib/orderInvoice';
import { buildTrackingUrl } from '../lib/orderTracking';
import { isAwaitingShipment } from '../lib/orderFirestoreStatus';
import { distinctProductIdsFromOrder } from '../lib/orderDistinctProducts';
import { formatInr } from '../lib/formatCurrency';
import type { Order, OrderComplaint, OrderComplaintStatus, OrderFulfillmentEvent } from '../types';

const filters = ['all', 'pending', 'confirmed', 'shipped', 'delivered', 'cancelled', 'returned'] as const;

const complaintStatusLabel: Record<OrderComplaintStatus, string> = {
  open: 'Open',
  in_progress: 'In progress',
  resolved: 'Resolved',
  closed: 'Closed',
};

function displayOrderId(order: Order): string {
  return order.orderId ?? order.id;
}

function sortedEvents(order: Order): OrderFulfillmentEvent[] {
  const ev = order.fulfillmentEvents ?? [];
  return [...ev].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}

function orderForInvoice(order: Order): Order {
  return {
    ...order,
    items: order.items.map(it => ({
      ...it,
      name: it.name ?? it.productId,
      sku: it.sku || '—',
    })),
  };
}

export default function OrdersPage() {
  const { user, loading } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [activeFilter, setActiveFilter] = useState<(typeof filters)[number]>('all');
  const [returnTarget, setReturnTarget] = useState<Order | null>(null);
  const [returnReason, setReturnReason] = useState('');
  const [cancelTarget, setCancelTarget] = useState<Order | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [reviewTarget, setReviewTarget] = useState<{ order: Order; productId: string } | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewBody, setReviewBody] = useState('');
  const [reviewChecked, setReviewChecked] = useState(false);
  const [reviewAlready, setReviewAlready] = useState(false);
  const [complaintTarget, setComplaintTarget] = useState<Order | null>(null);
  const [complaintPhone, setComplaintPhone] = useState('');
  const [complaintPhoneAlt, setComplaintPhoneAlt] = useState('');
  const [complaintMessage, setComplaintMessage] = useState('');
  const [complaintStatusOrder, setComplaintStatusOrder] = useState<Order | null>(null);
  const [complaintFollowUp, setComplaintFollowUp] = useState('');

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['userOrders', user?.uid],
    queryFn: () => (user ? getOrdersByUser(user.uid) : Promise.resolve([])),
    enabled: Boolean(user),
  });

  const { data: userComplaints = [] } = useQuery({
    queryKey: ['orderComplaints', user?.uid],
    queryFn: () => (user ? getOrderComplaintsByUser(user.uid) : Promise.resolve([])),
    enabled: Boolean(user),
  });

  const complaintByOrderId = useMemo(() => {
    const m = new Map<string, OrderComplaint>();
    for (const c of userComplaints) {
      const prev = m.get(c.orderFirestoreId);
      if (!prev) {
        m.set(c.orderFirestoreId, c);
        continue;
      }
      const ta = new Date(prev.updatedAt ?? prev.createdAt ?? 0).getTime();
      const tb = new Date(c.updatedAt ?? c.createdAt ?? 0).getTime();
      if (tb >= ta) m.set(c.orderFirestoreId, c);
    }
    return m;
  }, [userComplaints]);

  const cancelMutation = useMutation({
    mutationFn: async ({ order, reason }: { order: Order; reason?: string }) => {
      if (!user) throw new Error('Not signed in');
      await customerCancelOrder(order.id, user.uid, reason);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['userOrders', user?.uid] });
      toast.showToast('Order cancelled.', 'success');
      setCancelTarget(null);
      setCancelReason('');
    },
    onError: (e: Error) => toast.showToast(e.message || 'Could not cancel order', 'error'),
  });

  const returnMutation = useMutation({
    mutationFn: async ({ order, reason }: { order: Order; reason: string }) => {
      if (!user) throw new Error('Not signed in');
      await customerRequestOrderReturn(order.id, user.uid, reason);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['userOrders', user?.uid] });
      toast.showToast('Return request submitted. Our team will follow up.', 'success');
      setReturnTarget(null);
      setReturnReason('');
    },
    onError: (e: Error) => toast.showToast(e.message || 'Could not submit return', 'error'),
  });

  const reviewMutation = useMutation({
    mutationFn: async () => {
      if (!user || !reviewTarget) throw new Error('Not signed in');
      await submitCustomerProductReview({
        uid: user.uid,
        orderFirestoreId: reviewTarget.order.id,
        productId: reviewTarget.productId,
        rating: reviewRating,
        title: reviewTitle,
        content: reviewBody,
        authorName: user.name,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['userOrders', user?.uid] });
      await queryClient.invalidateQueries({ queryKey: ['products', 'catalog'] });
      await queryClient.invalidateQueries({ queryKey: ['product'] });
      await queryClient.invalidateQueries({ queryKey: ['product-reviews-firestore'] });
      toast.showToast('Thank you for your review.', 'success');
      setReviewTarget(null);
      setReviewTitle('');
      setReviewBody('');
      setReviewRating(5);
    },
    onError: (e: Error) => toast.showToast(e.message || 'Could not submit review', 'error'),
  });

  const complaintMutation = useMutation({
    mutationFn: async () => {
      if (!user || !complaintTarget) throw new Error('Not signed in');
      const phone = complaintPhone.trim();
      if (phone.length < 8) throw new Error('Enter your phone number (at least 8 characters).');
      await createOrderComplaint({
        uid: user.uid,
        orderFirestoreId: complaintTarget.id,
        orderHumanId: displayOrderId(complaintTarget),
        customerName: complaintTarget.customerName ?? user.name,
        customerEmail: complaintTarget.customerEmail ?? user.email,
        phone,
        phoneAlt: complaintPhoneAlt.trim(),
        message: complaintMessage,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['orderComplaints', user?.uid] });
      toast.showToast('Complaint submitted. Our team will get back to you.', 'success');
      setComplaintTarget(null);
      setComplaintMessage('');
    },
    onError: (e: Error) => toast.showToast(e.message || 'Could not submit complaint', 'error'),
  });

  const complaintFollowUpMutation = useMutation({
    mutationFn: async () => {
      if (!user || !complaintStatusOrder) throw new Error('Not signed in');
      const c = complaintByOrderId.get(complaintStatusOrder.id);
      if (!c) throw new Error('No complaint on file');
      const body = complaintFollowUp.trim();
      if (body.length < 4) throw new Error('Please write at least 4 characters.');
      await appendCustomerOrderComplaintMessage({
        complaintId: c.id,
        uid: user.uid,
        body,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['orderComplaints', user?.uid] });
      toast.showToast('Your message was sent.', 'success');
      setComplaintFollowUp('');
    },
    onError: (e: Error) => toast.showToast(e.message || 'Could not send message', 'error'),
  });

  useEffect(() => {
    if (!reviewTarget || !user) return;
    let cancelled = false;
    setReviewChecked(false);
    void (async () => {
      const exists = await hasCustomerSubmittedReview(user.uid, reviewTarget.order.id, reviewTarget.productId);
      if (!cancelled) {
        setReviewAlready(exists);
        setReviewChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reviewTarget, user]);

  useEffect(() => {
    if (!complaintTarget || !user) return;
    setComplaintPhone(
      (complaintTarget.customerPhone && complaintTarget.customerPhone.trim()) ||
        user.phone?.trim() ||
        '',
    );
    setComplaintPhoneAlt(
      (complaintTarget.customerPhoneAlt && complaintTarget.customerPhoneAlt.trim()) ||
        user.phoneAlt?.trim() ||
        '',
    );
    setComplaintMessage('');
  }, [complaintTarget, user]);

  useEffect(() => {
    if (complaintStatusOrder) setComplaintFollowUp('');
  }, [complaintStatusOrder]);

  const filteredOrders = useMemo(() => {
    if (activeFilter === 'all') return orders;
    if (activeFilter === 'pending') {
      return orders.filter(o => isAwaitingShipment(o.status));
    }
    return orders.filter(order => order.status === activeFilter);
  }, [activeFilter, orders]);

  const openTrack = (order: Order) => {
    const tn = order.trackingNumber?.trim();
    if (!tn) {
      toast.showToast('Tracking is not available yet for this order.', 'info');
      return;
    }
    const url =
      order.trackingUrl?.trim() || buildTrackingUrl(tn, order.trackingCarrier);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  if (loading || isLoading) {
    return <LoadingScreen />;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-4xl font-semibold text-white">My orders</h1>
          <p className="mt-3 text-slate-400">
            Track shipments, download invoices, cancel before dispatch, and request returns after delivery.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {filters.map(filter => (
            <button
              key={filter}
              type="button"
              onClick={() => setActiveFilter(filter)}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${activeFilter === filter ? 'border-violet-500 bg-violet-500/15 text-white' : 'border-white/10 text-slate-300 hover:border-violet-400 hover:bg-white/5'}`}
            >
              {filter === 'all' ? 'All' : filter.charAt(0).toUpperCase() + filter.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-10 space-y-6">
        {filteredOrders.length === 0 ? (
          <Card className="p-8 text-slate-300">
            <p>No orders found for this filter. Start shopping to create your first order.</p>
          </Card>
        ) : (
          filteredOrders.map(order => {
            const oid = displayOrderId(order);
            const events = sortedEvents(order);
            const rr = order.returnRequest;
            const canCancel = isAwaitingShipment(order.status);
            const canReturn =
              (order.status === 'shipped' || order.status === 'delivered') &&
              (!rr || rr.status === 'rejected');

            return (
              <Card key={order.id} className="p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm uppercase tracking-[0.25em] text-slate-500">Order {oid}</p>
                    <p className="mt-2 text-2xl font-semibold text-white">{order.status.toUpperCase()}</p>
                    {order.customerEmail ? (
                      <p className="mt-1 text-sm text-slate-400">Confirmation sent to {order.customerEmail}</p>
                    ) : null}
                  </div>
                  <Badge variant={order.status === 'delivered' ? 'success' : 'accent'}>{order.status}</Badge>
                </div>

                {rr?.status === 'pending' ? (
                  <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                    Return requested — we will review shortly.
                  </div>
                ) : null}
                {rr?.status === 'approved' ? (
                  <div className="mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                    Return approved. Follow any instructions emailed to you.
                  </div>
                ) : null}
                {rr?.status === 'rejected' ? (
                  <div className="mt-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                    Return not approved for this request. Contact support if you need help.
                  </div>
                ) : null}

                {(() => {
                  const complaint = complaintByOrderId.get(order.id);
                  if (!complaint) return null;
                  const addressed = complaint.status === 'resolved' || complaint.status === 'closed';
                  return (
                    <div
                      className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
                        addressed
                          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
                          : 'border-sky-500/30 bg-sky-500/10 text-sky-100'
                      }`}
                    >
                      <p className="font-semibold text-white">Complaint & redressal</p>
                      <p className="mt-1">
                        Status: <strong>{complaintStatusLabel[complaint.status]}</strong>
                        {addressed ? ' — our team has marked this ticket as addressed.' : ' — we are working on your case.'}
                      </p>
                      {complaint.updatedAt ? (
                        <p className="mt-1 text-xs opacity-90">Last update: {new Date(complaint.updatedAt).toLocaleString()}</p>
                      ) : null}
                    </div>
                  );
                })()}

                <div className="mt-6 grid gap-4 sm:grid-cols-3 text-sm text-slate-300">
                  <div>
                    <p className="text-slate-400">Placed</p>
                    <p>{new Date(order.placedAt).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Total</p>
                    <p>{formatInr(order.total)}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Delivery estimate</p>
                    <p>{order.estimatedDelivery}</p>
                  </div>
                </div>

                {order.trackingNumber ? (
                  <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-slate-300">
                    <p className="text-slate-400">Tracking</p>
                    <p className="mt-1 font-mono text-white">{order.trackingNumber}</p>
                    {order.trackingCarrier ? (
                      <p className="mt-1 text-slate-500">Carrier: {order.trackingCarrier}</p>
                    ) : null}
                  </div>
                ) : null}

                {events.length > 0 ? (
                  <div className="mt-6">
                    <p className="text-sm uppercase tracking-[0.18em] text-slate-500">Timeline</p>
                    <ul className="mt-3 space-y-2 border-l border-white/10 pl-4">
                      {events.map((ev, idx) => (
                        <li key={`${ev.at}-${idx}`} className="text-sm text-slate-300">
                          <span className="text-slate-500">{new Date(ev.at).toLocaleString()}</span>
                          {ev.actor ? <span className="text-slate-500"> · {ev.actor}</span> : null}
                          {ev.note ? (
                            <>
                              {' '}
                              — <span className="text-white">{ev.note}</span>
                            </>
                          ) : (
                            <>
                              {' '}
                              — <span className="text-white">{ev.status}</span>
                            </>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-4 text-sm text-slate-300">
                    <p className="text-slate-400">Shipping address</p>
                    <p className="mt-2">{order.shippingAddress}</p>
                  </div>
                  <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-4 text-sm text-slate-300">
                    <p className="text-slate-400">Payment</p>
                    <p className="mt-2">
                      {order.paymentStatus === 'paid' ? 'Paid' : order.paymentStatus ?? 'Recorded'} — {formatInr(order.total)}
                    </p>
                  </div>
                </div>

                <div className="mt-6 space-y-3">
                  <p className="text-sm uppercase tracking-[0.18em] text-slate-500">Items</p>
                  <div className="grid gap-3">
                    {order.items.slice(0, 6).map((item, index) => (
                      <div
                        key={`${item.productId}-${index}`}
                        className="rounded-3xl border border-white/10 bg-slate-950/70 p-4 text-sm text-slate-300"
                      >
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                          <p>
                            {item.quantity} × {item.name ?? item.productId}
                          </p>
                          <p className="text-white">{formatInr(item.price)}</p>
                        </div>
                        <p className="text-slate-400">
                          Size: {item.size || 'N/A'} • Color: {item.color || 'N/A'}
                          {item.sku ? ` • SKU: ${item.sku}` : ''}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {order.status === 'delivered' ? (
                  <div className="mt-6 rounded-3xl border border-violet-500/20 bg-violet-950/10 p-4">
                    <p className="text-sm uppercase tracking-[0.18em] text-violet-300/90">Product reviews</p>
                    <p className="mt-1 text-xs text-slate-400">
                      After delivery, rate each product once per order. Multiple sizes or colours of the same item share one review.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {distinctProductIdsFromOrder(order).map(pid => (
                        <Button
                          key={pid}
                          type="button"
                          className="bg-violet-600/25 text-sm text-violet-100 hover:bg-violet-600/35"
                          onClick={() => setReviewTarget({ order, productId: pid })}
                        >
                          Review — {(order.items.find(i => i.productId === pid)?.name ?? pid).slice(0, 40)}
                        </Button>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="mt-6 flex flex-wrap gap-3">
                  <Button
                    type="button"
                    className="bg-white/5"
                    onClick={() => downloadOrderInvoiceHtml(orderForInvoice({ ...order, orderId: oid }))}
                  >
                    Download invoice
                  </Button>
                  <Button type="button" className="bg-white/5" onClick={() => openTrack(order)}>
                    Track package
                  </Button>
                  <Button type="button" className="bg-white/5" onClick={() => setComplaintStatusOrder(order)}>
                    Show complaint status
                  </Button>
                  <Button
                    type="button"
                    className="bg-white/5"
                    disabled={Boolean(complaintByOrderId.get(order.id))}
                    title={
                      complaintByOrderId.get(order.id)
                        ? 'You already have a complaint for this order. Use “Show complaint status” to view the thread and send more.'
                        : undefined
                    }
                    onClick={() => setComplaintTarget(order)}
                  >
                    Complaints & suggestions
                  </Button>
                  {canReturn ? (
                    <Button type="button" className="bg-white/5" onClick={() => setReturnTarget(order)}>
                      Request return
                    </Button>
                  ) : null}
                  {canCancel ? (
                    <Button type="button" className="border border-white/15 bg-transparent text-rose-300 hover:text-rose-200" onClick={() => setCancelTarget(order)}>
                      Cancel order
                    </Button>
                  ) : null}
                </div>
              </Card>
            );
          })
        )}
      </div>

      {reviewTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <Card className="max-w-lg p-6">
            <h2 className="text-xl font-semibold text-white">Write a review</h2>
            <p className="mt-2 text-sm text-slate-400">
              Order {displayOrderId(reviewTarget.order)} — text only (no images). Rating 1–5.
            </p>
            {!reviewChecked ? (
              <p className="mt-4 text-sm text-slate-400">Loading…</p>
            ) : reviewAlready ? (
              <p className="mt-4 text-sm text-amber-200">You have already submitted a review for this product on this order.</p>
            ) : (
              <>
                <div className="mt-4 flex flex-wrap gap-2">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setReviewRating(n)}
                      className={`rounded-full border px-3 py-1 text-sm font-semibold ${
                        reviewRating === n ? 'border-violet-400 bg-violet-500/20 text-white' : 'border-white/15 text-slate-300'
                      }`}
                    >
                      {n}★
                    </button>
                  ))}
                </div>
                <label className="mt-4 block text-sm text-slate-400">Title (optional)</label>
                <Input className="mt-1" value={reviewTitle} onChange={e => setReviewTitle(e.target.value)} placeholder="Great fit" />
                <label className="mt-4 block text-sm text-slate-400">Your review</label>
                <textarea
                  className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/80 p-3 text-sm text-white placeholder:text-slate-500"
                  rows={4}
                  placeholder="Share your experience…"
                  value={reviewBody}
                  onChange={e => setReviewBody(e.target.value)}
                />
              </>
            )}
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Button type="button" className="border border-white/15 bg-transparent text-slate-200" onClick={() => setReviewTarget(null)}>
                Close
              </Button>
              {reviewChecked && !reviewAlready ? (
                <Button
                  type="button"
                  disabled={reviewMutation.isPending || reviewBody.trim().length < 4}
                  onClick={() => reviewMutation.mutate()}
                >
                  {reviewMutation.isPending ? 'Submitting…' : 'Submit review'}
                </Button>
              ) : null}
            </div>
          </Card>
        </div>
      ) : null}

      {complaintTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <Card className="max-w-lg p-6">
            <h2 className="text-xl font-semibold text-white">Complaints & suggestions</h2>
            <p className="mt-2 text-sm text-slate-400">
              Order {displayOrderId(complaintTarget)} — we will use your phone numbers to follow up.
            </p>
            <label className="mt-4 block text-sm text-slate-400">Phone (required)</label>
            <Input className="mt-1" value={complaintPhone} onChange={e => setComplaintPhone(e.target.value)} placeholder="+1 555 0100" />
            <label className="mt-4 block text-sm text-slate-400">Alternate phone (optional)</label>
            <Input className="mt-1" value={complaintPhoneAlt} onChange={e => setComplaintPhoneAlt(e.target.value)} />
            <label className="mt-4 block text-sm text-slate-400">Message</label>
            <textarea
              className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/80 p-3 text-sm text-white placeholder:text-slate-500"
              rows={4}
              placeholder="Describe your concern or suggestion (at least 8 characters)…"
              value={complaintMessage}
              onChange={e => setComplaintMessage(e.target.value)}
            />
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Button type="button" className="border border-white/15 bg-transparent text-slate-200" onClick={() => setComplaintTarget(null)}>
                Close
              </Button>
              <Button
                type="button"
                disabled={complaintMutation.isPending || complaintMessage.trim().length < 8}
                onClick={() => complaintMutation.mutate()}
              >
                {complaintMutation.isPending ? 'Submitting…' : 'Submit'}
              </Button>
            </div>
          </Card>
        </div>
      ) : null}

      {complaintStatusOrder ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <Card className="max-h-[90vh] w-full max-w-lg overflow-y-auto p-6">
            <h2 className="text-xl font-semibold text-white">Complaint status</h2>
            <p className="mt-2 text-sm text-slate-400">Order {displayOrderId(complaintStatusOrder)}</p>
            {(() => {
              const live = complaintByOrderId.get(complaintStatusOrder.id);
              if (!live) {
                return (
                  <>
                    <p className="mt-4 text-sm text-slate-300">
                      You have not submitted a complaint for this order yet. Use <strong>Complaints & suggestions</strong> to
                      start a conversation with our team.
                    </p>
                    <div className="mt-6 flex flex-wrap justify-end gap-2">
                      <Button
                        type="button"
                        className="border border-white/15 bg-transparent text-slate-200"
                        onClick={() => setComplaintStatusOrder(null)}
                      >
                        Close
                      </Button>
                      <Button
                        type="button"
                        onClick={() => {
                          setComplaintStatusOrder(null);
                          setComplaintTarget(complaintStatusOrder);
                        }}
                      >
                        Start a complaint
                      </Button>
                    </div>
                  </>
                );
              }
              const addressed = live.status === 'resolved' || live.status === 'closed';
              return (
                <>
                  <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-slate-200">
                    <p>
                      Current status:{' '}
                      <strong className="text-white">{complaintStatusLabel[live.status]}</strong>
                    </p>
                    {addressed ? (
                      <p className="mt-2 text-xs text-slate-400">
                        This ticket is marked addressed. If you still need help, send another message below — we will reopen
                        your case.
                      </p>
                    ) : (
                      <p className="mt-2 text-xs text-slate-400">You and our team can exchange messages here.</p>
                    )}
                  </div>
                  <div className="mt-4 max-h-64 space-y-3 overflow-y-auto rounded-2xl border border-white/10 bg-slate-950/50 p-3">
                    {(live.thread ?? []).length === 0 ? (
                      <p className="text-sm text-slate-500">No messages loaded.</p>
                    ) : (
                      (live.thread ?? []).map(m => (
                        <div
                          key={m.id}
                          className={`rounded-xl px-3 py-2 text-sm ${
                            m.author === 'admin'
                              ? 'ml-6 border border-violet-500/25 bg-violet-950/40 text-slate-100'
                              : 'mr-6 border border-white/10 bg-slate-900/80 text-slate-200'
                          }`}
                        >
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                            {m.author === 'admin' ? 'Graphtics support' : 'You'}
                            {m.createdAt ? ` · ${new Date(m.createdAt).toLocaleString()}` : ''}
                          </p>
                          <p className="mt-1 whitespace-pre-wrap">{m.body}</p>
                        </div>
                      ))
                    )}
                  </div>
                  <label className="mt-4 block text-sm text-slate-400">Add a message</label>
                  <textarea
                    className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/80 p-3 text-sm text-white placeholder:text-slate-500"
                    rows={3}
                    placeholder="Type your message (at least 4 characters)…"
                    value={complaintFollowUp}
                    onChange={e => setComplaintFollowUp(e.target.value)}
                  />
                  <div className="mt-4 flex flex-wrap justify-end gap-2">
                    <Button type="button" className="border border-white/15 bg-transparent text-slate-200" onClick={() => setComplaintStatusOrder(null)}>
                      Close
                    </Button>
                    <Button
                      type="button"
                      disabled={complaintFollowUpMutation.isPending || complaintFollowUp.trim().length < 4}
                      onClick={() => complaintFollowUpMutation.mutate()}
                    >
                      {complaintFollowUpMutation.isPending ? 'Sending…' : 'Send message'}
                    </Button>
                  </div>
                </>
              );
            })()}
          </Card>
        </div>
      ) : null}

      {returnTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <Card className="max-w-lg p-6">
            <h2 className="text-xl font-semibold text-white">Request a return</h2>
            <p className="mt-2 text-sm text-slate-400">
              Order {displayOrderId(returnTarget)} — describe the issue (wrong size, defect, changed mind, etc.).
            </p>
            <textarea
              className="mt-4 w-full rounded-2xl border border-white/10 bg-slate-950/80 p-3 text-sm text-white placeholder:text-slate-500"
              rows={4}
              placeholder="At least 8 characters…"
              value={returnReason}
              onChange={e => setReturnReason(e.target.value)}
            />
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Button type="button" className="border border-white/15 bg-transparent text-slate-200" onClick={() => setReturnTarget(null)}>
                Close
              </Button>
              <Button
                type="button"
                disabled={returnMutation.isPending}
                onClick={() => returnMutation.mutate({ order: returnTarget, reason: returnReason })}
              >
                {returnMutation.isPending ? 'Submitting…' : 'Submit request'}
              </Button>
            </div>
          </Card>
        </div>
      ) : null}

      {cancelTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <Card className="max-w-md p-6">
            <h2 className="text-xl font-semibold text-white">Cancel this order?</h2>
            <p className="mt-2 text-sm text-slate-400">
              Order {displayOrderId(cancelTarget)} can still be cancelled before it ships.
            </p>
            <div className="mt-4">
              <label className="text-sm text-slate-400">Reason (optional)</label>
              <Input className="mt-1" value={cancelReason} onChange={e => setCancelReason(e.target.value)} placeholder="Changed plans…" />
            </div>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Button type="button" className="border border-white/15 bg-transparent text-slate-200" onClick={() => setCancelTarget(null)}>
                Keep order
              </Button>
              <Button
                type="button"
                className="bg-rose-600 hover:bg-rose-500"
                disabled={cancelMutation.isPending}
                onClick={() => cancelMutation.mutate({ order: cancelTarget, reason: cancelReason })}
              >
                {cancelMutation.isPending ? 'Cancelling…' : 'Confirm cancel'}
              </Button>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
