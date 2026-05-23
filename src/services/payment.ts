export const initiateStripePayment = async (amount: number, currency = 'inr') => {
  // In production, call a Firebase Cloud Function or server endpoint.
  const response = await fetch('/.netlify/functions/createStripeSession', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount, currency }),
  });
  return response.json();
};

export const initiateRazorpayPayment = async (amount: number, currency = 'INR') => {
  // Placeholder to wire into secure backend payment processing.
  const response = await fetch('/api/razorpay/create-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount, currency }),
  });
  return response.json();
};
