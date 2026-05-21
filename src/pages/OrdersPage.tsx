import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';
import { getOrdersByUser } from '../firebase/firestore';
import { LoadingScreen } from '../components/ui/LoadingScreen';

const filters = ['all', 'delivered', 'cancelled', 'processing', 'returned'] as const;

export default function OrdersPage() {
  const { user, loading } = useAuth();
  const [activeFilter, setActiveFilter] = useState<(typeof filters)[number]>('all');

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['userOrders', user?.uid],
    queryFn: () => (user ? getOrdersByUser(user.uid) : Promise.resolve([])),
    enabled: Boolean(user),
  });

  const filteredOrders = useMemo(() => {
    if (activeFilter === 'all') return orders;
    return orders.filter(order => order.status === activeFilter);
  }, [activeFilter, orders]);

  if (loading || isLoading) {
    return <LoadingScreen />;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-4xl font-semibold text-white">My orders</h1>
          <p className="mt-3 text-slate-400">Track shipments, view invoices, and manage returns from your order history.</p>
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
          filteredOrders.map(order => (
            <Card key={order.id} className="p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.25em] text-slate-500">Order {order.id}</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{order.status.toUpperCase()}</p>
                </div>
                <Badge variant={order.status === 'delivered' ? 'success' : 'accent'}>{order.status}</Badge>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-3 text-sm text-slate-300">
                <div>
                  <p className="text-slate-400">Placed</p>
                  <p>{new Date(order.placedAt).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-slate-400">Total</p>
                  <p>${order.total.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-slate-400">Delivery</p>
                  <p>{order.estimatedDelivery}</p>
                </div>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-4 text-sm text-slate-300">
                  <p className="text-slate-400">Shipping address</p>
                  <p className="mt-2">{order.shippingAddress}</p>
                </div>
                <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-4 text-sm text-slate-300">
                  <p className="text-slate-400">Payment</p>
                  <p className="mt-2">${order.total.toFixed(2)} charged</p>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                <p className="text-sm uppercase tracking-[0.18em] text-slate-500">Items</p>
                <div className="grid gap-3">
                  {order.items.slice(0, 3).map((item, index) => (
                    <div key={`${item.productId}-${index}`} className="rounded-3xl border border-white/10 bg-slate-950/70 p-4 text-sm text-slate-300">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <p>{item.quantity} × {item.productId}</p>
                        <p className="text-white">${item.price.toFixed(2)}</p>
                      </div>
                      <p className="text-slate-400">Size: {item.size || 'N/A'} • Color: {item.color || 'N/A'}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <Button className="bg-white/5">Download invoice</Button>
                <Button className="bg-white/5">Track package</Button>
                <Button className="bg-white/5">Request return</Button>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
