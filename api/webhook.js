const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Vercel doesn't parse body for webhook verification — need raw body
module.exports.config = { api: { bodyParser: false } };

function buffer(readable) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    readable.on('data', chunk => chunks.push(chunk));
    readable.on('end', () => resolve(Buffer.concat(chunks)));
    readable.on('error', reject);
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const buf = await buffer(req);
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      console.log(`[TympanIQ] Subscription created: ${session.subscription} for ${session.customer_email}`);
      // In production: store subscription status in database
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object;
      console.log(`[TympanIQ] Subscription canceled: ${sub.id}`);
      // In production: revoke pro access
      break;
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object;
      console.log(`[TympanIQ] Subscription updated: ${sub.id}, status: ${sub.status}`);
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object;
      console.log(`[TympanIQ] Payment failed for subscription: ${invoice.subscription}`);
      break;
    }
  }

  res.json({ received: true });
};
