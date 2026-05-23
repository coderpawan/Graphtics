/**
 * Courier presets for admin fulfillment (India-first + common intl carriers).
 * `value` is stored as Firestore `trackingCarrier` and used by `buildTrackingUrl`.
 */

export const ADMIN_SHIPPING_CARRIER_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Select carrier…' },
  { value: 'Blue Dart', label: 'Blue Dart' },
  { value: 'Delhivery', label: 'Delhivery' },
  { value: 'DTDC', label: 'DTDC' },
  { value: 'Ecom Express', label: 'Ecom Express' },
  { value: 'XpressBees', label: 'XpressBees' },
  { value: 'Shadowfax', label: 'Shadowfax' },
  { value: 'India Post', label: 'India Post' },
  { value: 'FedEx', label: 'FedEx' },
  { value: 'DHL', label: 'DHL' },
  { value: 'UPS', label: 'UPS' },
  { value: 'USPS', label: 'USPS' },
  { value: 'Other', label: 'Other (type in custom field)' },
];
