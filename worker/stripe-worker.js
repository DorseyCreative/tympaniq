/**
 * TympanIQ — Stripe Webhook + Checkout API
 * Deploy to Cloudflare Workers
 *
 * Environment variables needed:
 *   STRIPE_SECRET_KEY — sk_live_... or sk_test_...
 *   STRIPE_WEBHOOK_SECRET — whsec_...
 *   STRIPE_PRICE_MONTHLY — price_... (your $4.99/mo price ID)
 *   STRIPE_PRICE_YEARLY — price_... (your $29.99/yr price ID)
 *   ALLOWED_ORIGIN — https://yourdomain.com
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const corsHeaders = {
      'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      if (url.pathname === '/create-checkout' && request.method === 'POST') {
        return await handleCreateCheckout(request, env, corsHeaders);
      }

      if (url.pathname === '/webhook' && request.method === 'POST') {
        return await handleWebhook(request, env);
      }

      if (url.pathname === '/verify' && request.method === 'POST') {
        return await handleVerify(request, env, corsHeaders);
      }

      return new Response('Not found', { status: 404 });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  },
};

async function handleCreateCheckout(request, env, corsHeaders) {
  const { plan } = await request.json();
  const priceId = plan === 'yearly' ? env.STRIPE_PRICE_YEARLY : env.STRIPE_PRICE_MONTHLY;

  // Create a Stripe PaymentIntent for the subscription
  const params = new URLSearchParams();
  params.append('mode', 'subscription');
  params.append('payment_method_types[]', 'card');
  params.append('line_items[0][price]', priceId);
  params.append('line_items[0][quantity]', '1');
  params.append('subscription_data[trial_period_days]', '7');
  params.append('ui_mode', 'embedded');
  params.append('return_url', `${env.ALLOWED_ORIGIN}?payment=success&session_id={CHECKOUT_SESSION_ID}`);

  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  const session = await res.json();

  return new Response(JSON.stringify({ clientSecret: session.client_secret }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleWebhook(request, env) {
  const body = await request.text();
  const sig = request.headers.get('stripe-signature');

  // In production, verify the webhook signature using STRIPE_WEBHOOK_SECRET
  // For now, parse the event directly
  const event = JSON.parse(body);

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      // Store subscription status — in production, save to Supabase or KV
      // For MVP, the client checks payment=success redirect param
      console.log(`Subscription created: ${session.subscription} for ${session.customer_email}`);
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object;
      console.log(`Subscription canceled: ${sub.id}`);
      // Revoke pro access in your database
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object;
      console.log(`Payment failed for subscription: ${invoice.subscription}`);
      break;
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

async function handleVerify(request, env, corsHeaders) {
  const { sessionId } = await request.json();

  const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
    headers: {
      'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
    },
  });

  const session = await res.json();
  const isPro = session.payment_status === 'paid' || session.status === 'complete';

  return new Response(JSON.stringify({ isPro, customerId: session.customer }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
