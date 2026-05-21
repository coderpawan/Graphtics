import { useMemo } from 'react';
import { useCartStore } from '../store/cartStore';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';

export default function CartPage() {
  const { items, removeItem, updateQuantity } = useCartStore();
  const subtotal = useMemo(() => items.reduce((sum, item) => sum + item.quantity * item.price, 0), [items]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-4xl font-semibold text-white">My cart</h1>
      <p className="mt-3 text-slate-400">Review your drop, manage quantities, and proceed to checkout with confidence.</p>
      <div className="mt-10 grid gap-8 lg:grid-cols-[2.2fr_1fr]">
        <div className="space-y-4">
          {items.length === 0 ? (
            <Card className="p-8 text-center text-slate-400">Your cart is empty. Add a selection from the shop to get started.</Card>
          ) : (
            items.map(item => (
              <Card key={item.variantId} className="flex flex-wrap items-center gap-4 p-6">
                <img src={item.image} alt={item.name} className="h-24 w-24 rounded-3xl object-cover" />
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-semibold text-white truncate">{item.name}</h2>
                  <p className="mt-2 text-sm text-slate-400">Size: {item.size} · Color: {item.color}</p>
                  <p className="mt-2 text-sm text-slate-300">${item.price.toFixed(2)} each</p>
                </div>
                <div className="flex flex-col items-end gap-4">
                  <div className="flex items-center gap-2 rounded-full bg-slate-900/90 px-3 py-2 text-sm text-slate-200">
                    <button onClick={() => updateQuantity(item.variantId, Math.max(1, item.quantity - 1))}>-</button>
                    <span>{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.variantId, item.quantity + 1)}>+</button>
                  </div>
                  <button onClick={() => removeItem(item.variantId)} className="text-sm text-violet-300 hover:text-white">Remove</button>
                </div>
              </Card>
            ))
          )}
        </div>
        <Card className="space-y-6 p-6">
          <div>
            <p className="text-sm uppercase tracking-[0.28em] text-slate-500">Summary</p>
            <h2 className="mt-3 text-3xl font-semibold text-white">${subtotal.toFixed(2)}</h2>
          </div>
          <div className="space-y-3 text-sm text-slate-400">
            <div className="flex items-center justify-between">
              <span>Subtotal</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Shipping</span>
              <span>$5.00</span>
            </div>
            <div className="flex items-center justify-between text-white">
              <span>Total</span>
              <span>${(subtotal + 5).toFixed(2)}</span>
            </div>
          </div>
          <Button className="w-full">Proceed to checkout</Button>
        </Card>
      </div>
    </div>
  );
}
