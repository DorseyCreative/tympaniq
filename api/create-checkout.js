module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const sk = process.env.STRIPE_SECRET_KEY;
    if (!sk) {
      return res.status(500).json({ error: 'STRIPE_SECRET_KEY not configured' });
    }

    const { plan } = req.body || {};
    const priceId = plan === 'yearly'
      ? process.env.STRIPE_PRICE_YEARLY
      : process.env.STRIPE_PRICE_MONTHLY;

    if (!priceId) {
      return res.status(500).json({ error: `Price ID not configured for plan: ${plan}` });
    }

    const origin = req.headers.origin || 'https://tympaniq.vercel.app';

    const params = new URLSearchParams();
    params.append('mode', 'subscription');
    params.append('payment_method_types[]', 'card');
    params.append('line_items[0][price]', priceId);
    params.append('line_items[0][quantity]', '1');
    params.append('subscription_data[trial_period_days]', '7');
    params.append('ui_mode', 'embedded');
    params.append('return_url', `${origin}?payment=success&session_id={CHECKOUT_SESSION_ID}`);

    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sk}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'Stripe error', detail: data.error });
    }

    res.json({ clientSecret: data.client_secret });
  } catch (err) {
    console.error('Checkout error:', err);
    res.status(500).json({ error: err.message });
  }
};
