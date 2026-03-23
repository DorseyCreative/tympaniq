module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const sk = process.env.STRIPE_SECRET_KEY;
  if (!sk) return res.status(500).json({ error: 'Not configured' });

  const { email } = req.body || {};
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email required' });
  }

  const headers = { 'Authorization': `Bearer ${sk}` };

  try {
    // Find customer by email
    const custRes = await fetch(
      `https://api.stripe.com/v1/customers?email=${encodeURIComponent(email.trim().toLowerCase())}&limit=1`,
      { headers }
    );
    const custData = await custRes.json();

    if (!custData.data || custData.data.length === 0) {
      return res.status(404).json({ error: 'No customer found' });
    }

    const customerId = custData.data[0].id;
    const origin = req.headers.origin || 'https://tympaniq.vercel.app';

    // Create billing portal session
    const params = new URLSearchParams();
    params.append('customer', customerId);
    params.append('return_url', origin);

    const portalRes = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sk}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const portalData = await portalRes.json();

    if (!portalRes.ok) {
      return res.status(portalRes.status).json({ error: portalData.error?.message || 'Portal error' });
    }

    res.json({ url: portalData.url });
  } catch (err) {
    console.error('Customer portal error:', err);
    res.status(500).json({ error: err.message });
  }
};
