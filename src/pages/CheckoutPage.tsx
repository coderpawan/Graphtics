import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';

const checkoutSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  address: z.string().min(10),
  city: z.string().min(2),
  zip: z.string().min(4),
  card: z.string().min(16).max(19),
});

type CheckoutForm = z.infer<typeof checkoutSchema>;

export default function CheckoutPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<CheckoutForm>({ resolver: zodResolver(checkoutSchema) });

  const onSubmit = async (values: CheckoutForm) => {
    setLoading(true);
    await new Promise(resolve => setTimeout(resolve, 900));
    setLoading(false);
    navigate('/orders');
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-4xl font-semibold text-white">Checkout</h1>
      <p className="mt-3 max-w-2xl text-slate-400">Complete your order with secure payment flow and shipment preferences for fast delivery.</p>
      <Card className="mt-10 p-8">
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
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-200">Shipping address</label>
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
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-200">Payment details</label>
            <Input placeholder="4242 4242 4242 4242" {...register('card')} />
            {errors.card && <p className="mt-2 text-sm text-rose-400">{errors.card.message}</p>}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-slate-400">Secure payment with Stripe / Razorpay-ready architecture.</p>
            </div>
            <Button type="submit" disabled={loading} className="w-full sm:w-auto">
              {loading ? 'Processing...' : 'Place order'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
