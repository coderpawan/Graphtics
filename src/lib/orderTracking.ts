/**
 * Build a carrier tracking URL from optional carrier hint + tracking number.
 */

const CARRIER_ALIASES: Record<string, string> = {
  ups: 'ups',
  fedex: 'fedex',
  usps: 'usps',
  dhl: 'dhl',
  'amazon logistics': 'amazon',
  amazon: 'amazon',
  'blue dart': 'bluedart',
  bluedart: 'bluedart',
  delhivery: 'delhivery',
  dtdc: 'dtdc',
  'ecom express': 'ecom',
  ecom: 'ecom',
  xpressbees: 'xpressbees',
  shadowfax: 'shadowfax',
  'india post': 'indiapost',
  indiapost: 'indiapost',
};

function normalizeCarrier(raw: string | undefined): string {
  const key = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (!key) return '';
  return CARRIER_ALIASES[key] ?? key;
}

export function buildTrackingUrl(trackingNumber: string, carrier?: string): string {
  const tn = String(trackingNumber ?? '').trim();
  if (!tn) return '';
  const c = normalizeCarrier(carrier);
  const enc = encodeURIComponent(tn);
  if (c === 'ups') return `https://www.ups.com/track?tracknum=${enc}`;
  if (c === 'fedex') return `https://www.fedex.com/fedextrack/?trknbr=${enc}`;
  if (c === 'usps') return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${enc}`;
  if (c === 'dhl') return `https://www.dhl.com/en/express/tracking.html?AWB=${enc}`;
  if (c === 'amazon') return `https://www.google.com/search?q=${encodeURIComponent(`Amazon tracking ${tn}`)}`;
  if (c === 'bluedart')
    return `https://www.bluedart.com/web/guest/trackdartresult?trackFor=0&trackNo=${enc}`;
  if (c === 'delhivery') return `https://www.delhivery.com/track/package/${enc}`;
  if (c === 'dtdc') return `https://www.dtdc.in/tracking.asp?strCnno=${enc}`;
  if (c === 'ecom') return `https://ecomexpress.in/tracking/?awb_field=${enc}&s=`;
  if (c === 'xpressbees') return `https://www.xpressbees.com/track?isawbTracking=true&trackid=${enc}`;
  if (c === 'shadowfax')
    return `https://www.google.com/search?q=${encodeURIComponent(`Shadowfax tracking ${tn}`)}`;
  if (c === 'indiapost')
    return `https://www.google.com/search?q=${encodeURIComponent(`India Post tracking ${tn}`)}`;
  return `https://www.google.com/search?q=${encodeURIComponent(`track package ${tn}`)}`;
}
