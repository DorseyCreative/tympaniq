module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const sk = process.env.STRIPE_SECRET_KEY;
  if (!sk) {
    return res.status(500).json({ error: 'STRIPE_SECRET_KEY not configured' });
  }

  // TympanIQ price IDs — only show subs matching these
  const tiqPrices = new Set([
    process.env.STRIPE_PRICE_MONTHLY,
    process.env.STRIPE_PRICE_YEARLY,
  ].filter(Boolean));

  const authHeader = { 'Authorization': `Bearer ${sk}` };

  async function stripeGet(endpoint, queryString = '') {
    const url = `https://api.stripe.com/v1/${endpoint}${queryString ? '?' + queryString : ''}`;
    const r = await fetch(url, { headers: authHeader });
    return r.json();
  }

  function isTympanIQ(sub) {
    const priceId = sub.items?.data?.[0]?.price?.id;
    if (priceId && tiqPrices.has(priceId)) return true;
    // Also check metadata tag for future-proofing
    if (sub.metadata?.project === 'tympaniq') return true;
    return false;
  }

  try {
    const [activeSubs, trialingSubs, canceledSubs, pastDueSubs] = await Promise.all([
      stripeGet('subscriptions', 'status=active&limit=100&expand[]=data.customer'),
      stripeGet('subscriptions', 'status=trialing&limit=100&expand[]=data.customer'),
      stripeGet('subscriptions', 'status=canceled&limit=100&expand[]=data.customer'),
      stripeGet('subscriptions', 'status=past_due&limit=100&expand[]=data.customer'),
    ]);

    // Filter each group to TympanIQ only
    const active = (activeSubs.data || []).filter(isTympanIQ);
    const trialing = (trialingSubs.data || []).filter(isTympanIQ);
    const canceled = (canceledSubs.data || []).filter(isTympanIQ);
    const pastDue = (pastDueSubs.data || []).filter(isTympanIQ);
    const allSubs = [...active, ...trialing, ...canceled, ...pastDue];

    // Collect TympanIQ customer IDs for revenue filtering
    const tiqCustomerIds = new Set();
    for (const sub of allSubs) {
      const cid = (sub.customer && typeof sub.customer === 'object') ? sub.customer.id : sub.customer;
      if (cid) tiqCustomerIds.add(cid);
    }

    // MRR from active subs
    let mrr = 0;
    let monthlyCount = 0;
    let yearlyCount = 0;

    for (const sub of active) {
      const item = sub.items?.data?.[0];
      if (!item) continue;
      const interval = item.price?.recurring?.interval;
      const amount = item.price?.unit_amount || 0;
      if (interval === 'month') {
        mrr += amount;
        monthlyCount++;
      } else if (interval === 'year') {
        mrr += Math.round(amount / 12);
        yearlyCount++;
      }
    }

    for (const sub of trialing) {
      const item = sub.items?.data?.[0];
      if (!item) continue;
      const interval = item.price?.recurring?.interval;
      if (interval === 'month') monthlyCount++;
      else if (interval === 'year') yearlyCount++;
    }

    // Charges — filter to TympanIQ customers only
    const charges = await stripeGet('charges', 'limit=100');
    let totalRevenue = 0;
    let totalPayments = 0;
    const customerRevenue = {};

    for (const charge of (charges.data || [])) {
      if (charge.paid && !charge.refunded && charge.customer && tiqCustomerIds.has(charge.customer)) {
        totalRevenue += charge.amount || 0;
        totalPayments++;
        customerRevenue[charge.customer] = (customerRevenue[charge.customer] || 0) + (charge.amount || 0);
      }
    }

    // Build subscriber list
    const subscribers = allSubs.map(sub => {
      const item = sub.items?.data?.[0];
      const interval = item?.price?.recurring?.interval || 'unknown';
      const amount = item?.price?.unit_amount || 0;
      const planLabel = interval === 'year'
        ? `Yearly ($${(amount / 100).toFixed(2)}/yr)`
        : `Monthly ($${(amount / 100).toFixed(2)}/mo)`;

      const customer = sub.customer;
      const email = (customer && typeof customer === 'object') ? customer.email : null;
      const customerId = (customer && typeof customer === 'object') ? customer.id : customer;

      return {
        email: email || '—',
        status: sub.status,
        plan: planLabel,
        created: sub.created,
        currentPeriodEnd: sub.current_period_end,
        totalPaid: customerRevenue[customerId] || 0,
      };
    });

    // Recent events — filter to TympanIQ customers
    const [checkoutEvents, cancelEvents, paymentEvents] = await Promise.all([
      stripeGet('events', 'limit=25&type=checkout.session.completed'),
      stripeGet('events', 'limit=15&type=customer.subscription.deleted'),
      stripeGet('events', 'limit=15&type=invoice.payment_succeeded'),
    ]);

    const allEvents = [
      ...(checkoutEvents.data || []),
      ...(cancelEvents.data || []),
      ...(paymentEvents.data || []),
    ].sort((a, b) => b.created - a.created);

    // Filter events to TympanIQ customers
    const recentEvents = [];
    for (const evt of allEvents) {
      if (recentEvents.length >= 30) break;
      const obj = evt.data?.object || {};
      const evtCustomer = obj.customer;
      if (evtCustomer && !tiqCustomerIds.has(evtCustomer)) continue;
      recentEvents.push({
        created: evt.created,
        type: evt.type,
        customerEmail: obj.customer_email || obj.receipt_email || null,
        amount: obj.amount_total || obj.amount_paid || obj.amount || null,
      });
    }

    res.json({
      mrr,
      totalRevenue,
      totalPayments,
      activeCount: active.length,
      trialingCount: trialing.length,
      canceledCount: canceled.length,
      pastDueCount: pastDue.length,
      monthlyCount,
      yearlyCount,
      subscribers,
      recentEvents,
    });

  } catch (err) {
    console.error('Admin API error:', err);
    res.status(500).json({ error: err.message });
  }
};
