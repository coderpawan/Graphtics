import type { MarketplaceLinks, Product, ProductVariant, Review } from '../types';

type RawRecord = Record<string, unknown>;

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map(x => String(x ?? '').trim()).filter(Boolean);
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map(s => s.trim()).filter(Boolean))];
}

/** Firestore `imagesByColor`: map of color -> string[] or legacy single string per color. */
function parseImagesByColorMap(v: unknown): Record<string, string[]> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
  const out: Record<string, string[]> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    const key = String(k ?? '').trim();
    if (!key) continue;
    if (Array.isArray(val)) {
      const urls = val.map(x => String(x ?? '').trim()).filter(Boolean);
      if (urls.length) out[key] = urls;
    } else if (typeof val === 'string' && val.trim()) {
      out[key] = [val.trim()];
    }
  }
  return out;
}

function parseMarketplaceLinks(raw: RawRecord): MarketplaceLinks | undefined {
  const m = raw.marketplaceLinks;
  if (!m || typeof m !== 'object') return undefined;
  const o = m as RawRecord;
  const pick = (k: string) => {
    const s = typeof o[k] === 'string' ? o[k].trim() : '';
    return s.length > 0 ? s : undefined;
  };
  const out: MarketplaceLinks = {
    amazon: pick('amazon'),
    flipkart: pick('flipkart'),
    meesho: pick('meesho'),
    myntra: pick('myntra'),
  };
  const has = Boolean(out.amazon || out.flipkart || out.meesho || out.myntra);
  return has ? out : undefined;
}

function defaultSeo(name: string, description: string): Product['seo'] {
  return {
    title: name,
    description: description.slice(0, 160),
    keywords: [],
  };
}

function isLegacyVariant(v: RawRecord): boolean {
  return typeof v.id === 'string' && v.id.length > 0;
}

/**
 * Maps Firestore product documents to the storefront `Product` shape.
 * Supports legacy seed data (`price`, `category`, `slug`, rich variants) and
 * admin clothing schema (`basePrice`, `salePrice`, `categories[]`, variant rows with size/color/sku/stock).
 */
export function normalizeFirestoreProduct(id: string, raw: RawRecord): Product {
  const name = String(raw.name ?? 'Untitled');
  const description = String(raw.description ?? '');

  const legacyPrice = typeof raw.price === 'number' ? raw.price : Number(raw.price);
  const basePrice = Number(raw.basePrice ?? 0);
  const salePrice = Number(raw.salePrice ?? 0);

  let price: number;
  let compareAtPrice: number | undefined;

  const looksLikeAdminPricing = basePrice > 0 || salePrice > 0;
  const legacyPriceOk = Number.isFinite(legacyPrice) && legacyPrice > 0;

  if (legacyPriceOk && !looksLikeAdminPricing) {
    price = legacyPrice;
    const cap = typeof raw.compareAtPrice === 'number' ? raw.compareAtPrice : Number(raw.compareAtPrice);
    compareAtPrice = Number.isFinite(cap) && cap > 0 ? cap : undefined;
  } else {
    const onSale = salePrice > 0 && basePrice > 0 && salePrice < basePrice;
    price = onSale ? salePrice : basePrice > 0 ? basePrice : salePrice > 0 ? salePrice : 0;
    compareAtPrice = onSale && basePrice > price ? basePrice : undefined;
  }

  if (!Number.isFinite(price) || price < 0) price = 0;

  const legacyCategory = String(raw.category ?? '').trim();
  const categories = asStringArray(raw.categories);
  const category = legacyCategory || categories[0] || 'General';

  const tags = uniqueStrings([...asStringArray(raw.tags), ...categories, legacyCategory]);

  const images = asStringArray(raw.images);
  const imagesByColor = parseImagesByColorMap(raw.imagesByColor);
  const defaultDisplayColor = String(raw.defaultDisplayColor ?? '').trim();

  const rawVariants = Array.isArray(raw.variants) ? (raw.variants as RawRecord[]) : [];

  const adminStyleRows = rawVariants.filter(v => !isLegacyVariant(v));
  const legacyRows = rawVariants.filter(v => isLegacyVariant(v));

  let variants: ProductVariant[];

  if (legacyRows.length > 0) {
    variants = legacyRows.map(v => ({
      id: String(v.id),
      color: String(v.color ?? ''),
      image: String(v.image ?? images[0] ?? ''),
      stock: Number(v.stock ?? 0),
    }));
  } else if (adminStyleRows.length > 0) {
    variants = adminStyleRows.map((v, idx) => {
      const sku = String(v.sku ?? idx);
      const suffix = sku || String(idx);
      const size = String(v.size ?? '').trim();
      const colorLabel = String(v.color ?? 'Default').trim();
      const perColorUrls = colorLabel ? imagesByColor[colorLabel] : undefined;
      const perColorFirst = perColorUrls?.[0] ?? '';
      return {
        id: `${id}-${suffix}`,
        color: String(v.color ?? 'Default'),
        size: size || undefined,
        sku: sku || undefined,
        image: String(v.image ?? perColorFirst ?? images[0] ?? ''),
        stock: Number(v.stock ?? 0),
      };
    });
  } else {
    const fallbackStock = Number(raw.stock ?? 0);
    variants = [
      {
        id: `${id}-default`,
        color: 'Default',
        image: images[0] ?? '',
        stock: Number.isFinite(fallbackStock) ? fallbackStock : 0,
      },
    ];
  }

  const sizesFromAdmin = adminStyleRows.map(v => String(v.size ?? '').trim()).filter(Boolean);
  const colorsFromAdmin = adminStyleRows.map(v => String(v.color ?? '').trim()).filter(Boolean);

  let sizes = uniqueStrings(asStringArray(raw.sizes).length ? asStringArray(raw.sizes) : sizesFromAdmin);
  let colors = uniqueStrings(asStringArray(raw.colors).length ? asStringArray(raw.colors) : colorsFromAdmin);

  if (!sizes.length) sizes = ['One size'];
  if (!colors.length) colors = ['Default'];

  if (defaultDisplayColor && colors.includes(defaultDisplayColor)) {
    colors = [defaultDisplayColor, ...colors.filter(c => c !== defaultDisplayColor)];
  }

  const variantStockSum = variants.reduce((sum, v) => sum + (Number.isFinite(v.stock) ? v.stock : 0), 0);
  const topStock = Number(raw.stock ?? 0);
  const stock = Number.isFinite(topStock) && topStock > 0 ? topStock : variantStockSum;

  const sku =
    String(raw.sku ?? '').trim() ||
    (adminStyleRows[0] ? String(adminStyleRows[0].sku ?? '').trim() : '') ||
    id.slice(0, 8);

  const slugFromDoc = String(raw.slug ?? '').trim();
  const slug = slugFromDoc || id;

  const rating = Number(raw.rating ?? 0);
  const embeddedReviews = (Array.isArray(raw.reviews) ? raw.reviews : []) as Review[];
  const curatedRaw = Array.isArray(raw.curatedReviews) ? raw.curatedReviews : [];
  const curatedMapped: Review[] = curatedRaw
    .filter((row): row is RawRecord => row != null && typeof row === 'object')
    .map((o, idx) => {
      const images = Array.isArray(o.images)
        ? o.images.map((x) => String(x ?? '').trim()).filter(Boolean)
        : [];
      return {
        id: String(o.id ?? `cur-${idx}`),
        author: String(o.author ?? 'Graphtics'),
        rating: Math.min(5, Math.max(1, Number(o.rating ?? 5))),
        title: String(o.title ?? ''),
        content: String(o.content ?? ''),
        date: String(o.date ?? new Date().toISOString()),
        source: 'admin' as const,
        ...(images.length ? { images } : {}),
      };
    });
  const reviews = [...curatedMapped, ...embeddedReviews];

  const seoRaw = raw.seo;
  const seo: Product['seo'] =
    seoRaw && typeof seoRaw === 'object' && seoRaw !== null && 'title' in (seoRaw as RawRecord)
      ? (seoRaw as Product['seo'])
      : defaultSeo(name, description);

  const highlights = asStringArray(raw.highlights);
  const marketplaceLinks = parseMarketplaceLinks(raw);

  const colorImages =
    Object.keys(imagesByColor).length > 0
      ? imagesByColor
      : undefined;
  const listingDefault =
    defaultDisplayColor && colors.includes(defaultDisplayColor) ? defaultDisplayColor : undefined;

  return {
    id,
    slug,
    name,
    description,
    category,
    tags,
    price,
    compareAtPrice,
    rating: Number.isFinite(rating) ? rating : 0,
    reviews,
    images: images.length ? images : ['https://placehold.co/600x800/1e293b/94a3b8?text=Graphtics'],
    variants,
    sizes,
    colors,
    stock: Number.isFinite(stock) ? stock : 0,
    sku,
    isTrending: Boolean(raw.isTrending),
    isNew: Boolean(raw.isNew),
    isLimited: Boolean(raw.isLimited),
    ...(colorImages ? { colorImages } : {}),
    ...(listingDefault ? { defaultDisplayColor: listingDefault } : {}),
    ...(highlights.length ? { highlights } : {}),
    ...(marketplaceLinks ? { marketplaceLinks } : {}),
    seo,
  };
}

export function isDraftProductData(raw: RawRecord): boolean {
  return raw.status === 'draft';
}
