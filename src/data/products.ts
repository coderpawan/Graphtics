import type { Product } from '../types';

export const productCatalog: Product[] = [
  {
    id: 'grph-001',
    slug: 'neon-koi-arcade-tee',
    name: 'Neon Koi Arcade Tee',
    description:
      'A premium oversized graphic t-shirt inspired by modern anime streetwear with luminous neon details and soft cotton feel.',
    category: 'Anime',
    tags: ['anime', 'streetwear', 'limited drop'],
    price: 44,
    compareAtPrice: 58,
    rating: 4.9,
    reviews: [
      {
        id: 'rev-1',
        author: 'Mika',
        rating: 5,
        title: 'Burning cool vibe',
        content: 'The print quality is insane and the fit feels premium. Perfect for layering.',
        date: '2026-04-12',
      },
    ],
    images: [
      'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=1200&q=80',
    ],
    variants: [
      { id: 'v1', color: 'Neo Magenta', image: '', stock: 27 },
      { id: 'v2', color: 'Night Indigo', image: '', stock: 12 },
    ],
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    colors: ['Neon Pink', 'Midnight Blue', 'Ivory'],
    stock: 67,
    sku: 'GPH-NEON-ARC-001',
    isTrending: true,
    isNew: true,
    isLimited: false,
    seo: {
      title: 'Neon Koi Arcade Tee | Graphtics',
      description: 'Shop the Neon Koi Arcade Tee by Graphtics, a premium streetwear staple for anime and fashion lovers.',
      keywords: ['anime tee', 'streetwear fashion', 'limited edition t-shirt'],
    },
  },
  {
    id: 'grph-002',
    slug: 'retro-glitch-core-tee',
    name: 'Retro Glitch Core Tee',
    description: 'A bold streetwear tee with retro digital aesthetics, designed for creative self-expression and modern energy.',
    category: 'Retro',
    tags: ['retro', 'gaming', 'oversized'],
    price: 36,
    compareAtPrice: 48,
    rating: 4.7,
    reviews: [],
    images: [
      'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=1200&q=80',
    ],
    variants: [
      { id: 'v3', color: 'Blackout', image: '', stock: 32 },
      { id: 'v4', color: 'Frost Gray', image: '', stock: 18 },
    ],
    sizes: ['XS', 'S', 'M', 'L', 'XL'],
    colors: ['Black', 'Gray', 'White'],
    stock: 76,
    sku: 'GPH-RETRO-002',
    isTrending: false,
    isNew: true,
    isLimited: true,
    seo: {
      title: 'Retro Glitch Core Tee | Graphtics',
      description: 'Discover the Retro Glitch Core Tee, a premium streetwear essential with gaming-inspired vibes.',
      keywords: ['retro shirt', 'glitch tee', 'gaming fashion'],
    },
  },
];
