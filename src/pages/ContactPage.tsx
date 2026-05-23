import { Mail, MapPin, Phone } from 'lucide-react';

const CONTACTS = [
  {
    role: 'Operations & bulk orders',
    name: 'Management desk',
    email: 'bulk@graphtics.example.com',
    phone: '+91 00000 00000',
    hours: 'Mon–Sat, 10:00–18:00 IST',
  },
  {
    role: 'Customer relations',
    name: 'Support lead',
    email: 'hello@graphtics.example.com',
    phone: '+91 00000 00001',
    hours: 'Same hours — mention your product and quantity for a faster quote.',
  },
];

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <p className="text-sm uppercase tracking-[0.3em] text-violet-300">Graphtics</p>
      <h1 className="mt-3 text-4xl font-semibold text-white">Contact & bulk orders</h1>
      <p className="mt-4 text-lg text-slate-300">
        For quantities larger than we have in stock, custom runs, or wholesale, reach the team below. Include product name,
        colour, sizes, and the quantity you need.
      </p>

      <ul className="mt-10 space-y-6">
        {CONTACTS.map((c) => (
          <li
            key={c.email}
            className="rounded-[28px] border border-white/10 bg-slate-950/80 p-6 shadow-xl backdrop-blur-sm"
          >
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{c.role}</p>
            <p className="mt-2 text-xl font-medium text-white">{c.name}</p>
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              <a href={`mailto:${c.email}`} className="flex items-center gap-3 transition hover:text-white">
                <Mail className="h-4 w-4 shrink-0 text-violet-400" />
                {c.email}
              </a>
              <a href={`tel:${c.phone.replace(/\s/g, '')}`} className="flex items-center gap-3 transition hover:text-white">
                <Phone className="h-4 w-4 shrink-0 text-violet-400" />
                {c.phone}
              </a>
              <p className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-violet-400" />
                {c.hours}
              </p>
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-8 text-sm text-slate-500">
        Replace the example emails and phone numbers in <code className="text-slate-400">ContactPage.tsx</code> with your real
        management contacts when you go live.
      </p>
    </div>
  );
}
