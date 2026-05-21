import { useMemo } from 'react';
import { ChartBar, ShoppingCart, Users, Tag } from 'lucide-react';
import { Card } from '../components/ui/Card';

const stats = [
  { label: 'Revenue', value: '$42.6K', icon: ChartBar },
  { label: 'Orders', value: '212', icon: ShoppingCart },
  { label: 'Customers', value: '1.8K', icon: Users },
  { label: 'Inventory', value: '84 items', icon: Tag },
];

export default function AdminPage() {
  const dashboard = useMemo(() => stats, []);
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-4xl font-semibold text-white">Admin dashboard</h1>
      <p className="mt-3 text-slate-400">Analytics, inventory status, and order management for the Graphtics operations team.</p>
      <div className="mt-10 grid gap-6 lg:grid-cols-2 xl:grid-cols-4">
        {dashboard.map(item => {
          const Icon = item.icon;
          return (
            <Card key={item.label} className="p-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-3xl bg-violet-500/10 text-violet-300">
                  <Icon className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm text-slate-400">{item.label}</p>
                  <p className="mt-2 text-3xl font-semibold text-white">{item.value}</p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
      <section className="mt-10 grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-white">Product analytics</h2>
          <p className="mt-3 text-sm text-slate-400">Monitor views, trending scores, and drop conversion across product categories.</p>
        </Card>
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-white">Inventory health</h2>
          <p className="mt-3 text-sm text-slate-400">Track blank stock levels, color counts, print queue velocity, and reorders.</p>
        </Card>
      </section>
    </div>
  );
}
