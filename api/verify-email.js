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
    // Look up customers by email
    const custRes = await fetch(
      `https://api.stripe.com/v1/customers?email=${encodeURIComponent(email.trim().toLowerCase())}&limit=5`,
      { headers }
    );
    const custData = await custRes.json();

    if (!custData.data || custData.data.length === 0) {
      return res.json({ isPro: false });
    }

    // Check TympanIQ price IDs
    const tiqPrices = new Set([
      process.env.STRIPE_PRICE_MONTHLY,
      process.env.STRIPE_PRICE_YEARLY,
    ].filter(Boolean));

    // Check each customer for an active/trialing TympanIQ subscription
    for (const customer of custData.data) {
      const subRes = await fetch(
        `https://api.stripe.com/v1/subscriptions?customer=${customer.id}&status=active&limit=10`,
        { headers }
      );
      const subData = await subRes.json();

      for (const sub of (subData.data || [])) {
        const priceId = sub.items?.data?.[0]?.price?.id;
        if (priceId && tiqPrices.has(priceId)) {
          return res.json({ isPro: true, customerId: customer.id });
        }
        if (sub.metadata?.project === 'tympaniq') {
          return res.json({ isPro: true, customerId: customer.id });
        }
      }

      // Also check trialing
      const trialRes = await fetch(
        `https://api.stripe.com/v1/subscriptions?customer=${customer.id}&status=trialing&limit=10`,
        { headers }
      );
      const trialData = await trialRes.json();

      for (const sub of (trialData.data || [])) {
        const priceId = sub.items?.data?.[0]?.price?.id;
        if (priceId && tiqPrices.has(priceId)) {
          return res.json({ isPro: true, customerId: customer.id });
        }
        if (sub.metadata?.project === 'tympaniq') {
          return res.json({ isPro: true, customerId: customer.id });
        }
      }
    }

    return res.json({ isPro: false });
  } catch (err) {
    console.error('Verify email error:', err);
    res.status(500).json({ error: err.message });
  }
};
