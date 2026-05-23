import type { Order } from '../types';
import { formatInr } from './formatCurrency';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Simple HTML invoice suitable for "Download" (save as .html) or print-to-PDF in the browser.
 */
export function buildOrderInvoiceHtml(order: Order): string {
  const displayId = order.orderId ?? order.id;
  const lines = order.items
    .map(
      (it, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${escapeHtml(it.name ?? it.productId)}</td>
        <td>${escapeHtml(it.sku ?? '—')}</td>
        <td>${escapeHtml(it.size)} / ${escapeHtml(it.color)}</td>
        <td style="text-align:right">${it.quantity}</td>
        <td style="text-align:right">${escapeHtml(formatInr(it.price))}</td>
        <td style="text-align:right">${escapeHtml(formatInr(it.price * it.quantity))}</td>
      </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Invoice ${escapeHtml(displayId)}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 24px auto; color: #0f172a; }
    h1 { font-size: 1.5rem; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th, td { border: 1px solid #e2e8f0; padding: 8px; font-size: 0.875rem; }
    th { background: #f8fafc; text-align: left; }
    .meta { margin-top: 12px; font-size: 0.9rem; color: #475569; }
    .totals { margin-top: 16px; width: 280px; margin-left: auto; font-size: 0.9rem; }
    .totals div { display: flex; justify-content: space-between; padding: 4px 0; }
    .grand { font-weight: 700; border-top: 2px solid #0f172a; margin-top: 8px; padding-top: 8px; }
  </style>
</head>
<body>
  <h1>Graphtics — Order invoice</h1>
  <p class="meta"><strong>Order:</strong> ${escapeHtml(displayId)}<br />
  <strong>Date:</strong> ${escapeHtml(new Date(order.placedAt).toLocaleString())}<br />
  <strong>Status:</strong> ${escapeHtml(order.status)}<br />
  ${order.customerName ? `<strong>Bill to:</strong> ${escapeHtml(order.customerName)}<br />` : ''}
  ${order.customerEmail ? `<strong>Email:</strong> ${escapeHtml(order.customerEmail)}<br />` : ''}
  ${order.customerPhone ? `<strong>Phone:</strong> ${escapeHtml(order.customerPhone)}<br />` : ''}
  ${order.customerPhoneAlt ? `<strong>Alt phone:</strong> ${escapeHtml(order.customerPhoneAlt)}<br />` : ''}
  <strong>Ship to:</strong> ${escapeHtml(order.shippingAddress)}</p>

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Item</th>
        <th>SKU</th>
        <th>Variant</th>
        <th style="text-align:right">Qty</th>
        <th style="text-align:right">Unit</th>
        <th style="text-align:right">Line</th>
      </tr>
    </thead>
    <tbody>${lines}</tbody>
  </table>

  <div class="totals">
    <div><span>Subtotal</span><span>${escapeHtml(formatInr(order.subtotal))}</span></div>
    <div><span>Shipping</span><span>${escapeHtml(formatInr(order.shipping))}</span></div>
    <div><span>Tax (GST)</span><span>${escapeHtml(formatInr(order.tax))}</span></div>
    <div><span>Discount</span><span>-${escapeHtml(formatInr(order.discount))}</span></div>
    <div class="grand"><span>Total</span><span>${escapeHtml(formatInr(order.total))}</span></div>
  </div>
  <p class="meta" style="margin-top:32px">Thank you for your order.</p>
</body>
</html>`;
}

export function downloadOrderInvoiceHtml(order: Order): void {
  const html = buildOrderInvoiceHtml(order);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `invoice-${order.orderId ?? order.id}.html`;
  a.click();
  URL.revokeObjectURL(url);
}
