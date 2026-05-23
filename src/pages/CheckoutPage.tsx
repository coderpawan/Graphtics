import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';
import { useCartStore } from '../store/cartStore';
import { createOrder, generateOrderReference, upsertCustomerFromOrder } from '../firebase/firestore';
import { useToast } from '../components/ui/Toast';
import { formatInr } from '../lib/formatCurrency';
import { gstInrFromSubtotal, shippingInrFromSubtotal } from '../lib/checkoutPricing';

const phoneSchema = z
  .string()
  .min(8, 'Enter a valid phone number')
  .max(24, 'Phone number is too long')
  .regex(/^[\d+\s().-]+$/, 'Use digits (and optional + / spaces)');

const checkoutSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: phoneSchema,
  phoneAlt: z.string().max(24).default(''),
  address: z.string().min(10),
  city: z.string().min(2),
  zip: z.string().min(4),
});

type CheckoutForm = z.infer<typeof checkoutSchema>;

export default function CheckoutPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { user, loading: authLoading, updateProfile } = useAuth();
  const items = useCartStore(s => s.items);
  const clearCart = useCartStore(s => s.clearCart);
  const [submitting, setSubmitting] = useState(false);

  const totals = useMemo(() => {
    const subtotal = items.reduce((acc, i) => acc + i.price * i.quantity, 0);
    const shipping = shippingInrFromSubtotal(subtotal);
    const tax = gstInrFromSubtotal(subtotal);
    const discount = 0;
    const total = Math.round((subtotal + shipping + tax - discount) * 100) / 100;
    return { subtotal, shipping, tax, discount, total };
  }, [items]);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CheckoutForm>({
    resolver: zodResolver(checkoutSchema) as any,
    defaultValues: {
      name: user?.name ?? '',
      email: user?.email ?? '',
      phone: user?.phone ?? '',
      phoneAlt: user?.phoneAlt ?? '',
      address: '',
      city: '',
      zip: '',
    },
  });

  useEffect(() => {
    if (user) {
      reset({
        name: user.name,
        email: user.email,
        phone: user.phone ?? '',
        phoneAlt: user.phoneAlt ?? '',
        address: '',
        city: '',
        zip: '',
      });
    }
  }, [user, reset]);

  const onSubmit = async (values: CheckoutForm) => {
    if (!user) {
      toast.showToast('Sign in to place an order.', 'info');
      return;
    }
    if (!items.length) {
      toast.showToast('Your cart is empty.', 'info');
      return;
    }

    setSubmitting(true);
    try {
      const shippingAddress = `${values.address}, ${values.city} ${values.zip}`;
      const estimated = new Date(Date.now() + 7 * 86400000).toLocaleDateString();

      await createOrder({
        userId: user.uid,
        orderId: generateOrderReference(),
        customerName: values.name,
        customerEmail: values.email.trim().toLowerCase(),
        customerPhone: values.phone.trim(),
        customerPhoneAlt: values.phoneAlt?.trim() || '',
        paymentStatus: 'pending',
        items: items.map(i => ({
          productId: i.productId,
          quantity: i.quantity,
          size: i.size,
          color: i.color,
          price: i.price,
          name: i.name,
          sku: i.lineSku?.trim() || '',
        })),
        subtotal: totals.subtotal,
        shipping: totals.shipping,
        tax: totals.tax,
        discount: totals.discount,
        total: totals.total,
        status: 'pending',
        placedAt: new Date().toISOString(),
        estimatedDelivery: estimated,
        shippingAddress,
      });

      await upsertCustomerFromOrder({
        uid: user.uid,
        email: values.email.trim().toLowerCase(),
        name: values.name,
        phone: values.phone.trim(),
        phoneAlt: values.phoneAlt?.trim(),
        orderTotal: totals.total,
      });

      await updateProfile({
        name: values.name.trim(),
        email: values.email.trim().toLowerCase(),
        phone: values.phone.trim(),
        phoneAlt: values.phoneAlt?.trim() || '',
      });

      clearCart();
      await queryClient.invalidateQueries({ queryKey: ['userOrders', user.uid] });
      toast.showToast('Order placed successfully', 'success');
      navigate('/orders');
    } catch (e) {
      console.error(e);
      toast.showToast('Could not place order. Check Firestore rules and your connection.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <p className="text-slate-400">Loading…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <h1 className="text-4xl font-semibold text-white">Checkout</h1>
        <Card className="mt-8 p-8 text-slate-300">
          <p>Sign in to complete your purchase.</p>
          <Link to="/auth" className="mt-4 inline-block text-violet-300 hover:text-white">
            Go to sign in
          </Link>
        </Card>
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <h1 className="text-4xl font-semibold text-white">Checkout</h1>
        <Card className="mt-8 p-8 text-slate-300">
          <p>Your cart is empty.</p>
          <Link to="/shop" className="mt-4 inline-block text-violet-300 hover:text-white">
            Continue shopping
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-4xl font-semibold text-white">Checkout</h1>
      <p className="mt-3 max-w-2xl text-slate-400">
        Shipping details are saved with your order in Firestore. New orders use payment <strong>pending</strong> until a
        gateway or your team marks them paid (COD can ship first; marking delivered in admin still requires{' '}
        <strong>paid</strong>). Connect Stripe or Razorpay when you are ready for live charges.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_280px]">
        <Card className="p-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-200">Full name</label>
                <Input placeholder="Alex Mercer" {...register('name')} />
                {errors.name && <p className="mt-2 text-sm text-rose-400">{errors.name.message}</p>}
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-200">Email</label>
                <Input placeholder="you@example.com" {...register('email')} />
                {errors.email && <p className="mt-2 text-sm text-rose-400">{errors.email.message}</p>}
              </div>
            </div>
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-200">Phone (required)</label>
                <Input placeholder="+1 555 0100" {...register('phone')} />
                {errors.phone && <p className="mt-2 text-sm text-rose-400">{errors.phone.message}</p>}
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-200">Alternate phone (optional)</label>
                <Input placeholder="Backup contact" {...register('phoneAlt')} />
              </div>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-200">Street address</label>
              <Input placeholder="123 Creative Ave, Apt 4" {...register('address')} />
              {errors.address && <p className="mt-2 text-sm text-rose-400">{errors.address.message}</p>}
            </div>
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-200">City</label>
                <Input placeholder="Brooklyn" {...register('city')} />
                {errors.city && <p className="mt-2 text-sm text-rose-400">{errors.city.message}</p>}
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-200">ZIP code</label>
                <Input placeholder="10012" {...register('zip')} />
                {errors.zip && <p className="mt-2 text-sm text-rose-400">{errors.zip.message}</p>}
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
                {submitting ? 'Placing order…' : 'Place order'}
              </Button>
            </div>
          </form>
        </Card>

        <Card className="h-fit p-6 text-sm text-slate-300">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Summary</p>
          <ul className="mt-4 space-y-2">
            {items.map(i => (
              <li key={`${i.variantId}-${i.size}`} className="flex justify-between gap-2">
                <span className="truncate">{i.quantity}× {i.name}</span>
                <span className="shrink-0 text-white">{formatInr(i.price * i.quantity)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 space-y-1 border-t border-white/10 pt-4">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{formatInr(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>Shipping</span>
              <span>{totals.shipping === 0 ? 'Free' : formatInr(totals.shipping)}</span>
            </div>
            <div className="flex justify-between">
              <span>Tax (GST est.)</span>
              <span>{formatInr(totals.tax)}</span>
            </div>
            <div className="flex justify-between font-semibold text-white">
              <span>Total</span>
              <span>{formatInr(totals.total)}</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
