const ALLOWED_ORIGINS = new Set([
  "https://sorasukt.com",
  "https://www.sorasukt.com",
]);

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
};

function cors(origin) {
  return {
    "access-control-allow-origin": ALLOWED_ORIGINS.has(origin) ? origin : "https://sorasukt.com",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "Content-Type",
    "access-control-max-age": "86400",
    vary: "Origin",
  };
}

function reply(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...cors(origin) },
  });
}

function isUuid(value) {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("origin") || "";

    if (request.method === "OPTIONS") {
      if (!ALLOWED_ORIGINS.has(origin)) return new Response(null, { status: 403 });
      return new Response(null, { status: 204, headers: cors(origin) });
    }

    if (url.pathname === "/health" && request.method === "GET") {
      return reply({ ok: true, service: "sorasukt-support" }, 200, origin);
    }

    if (url.pathname !== "/checkout" || request.method !== "POST") {
      return reply({ error: { code: "NOT_FOUND", message: "Not found" } }, 404, origin);
    }

    if (!ALLOWED_ORIGINS.has(origin)) {
      return reply({ error: { code: "ORIGIN_NOT_ALLOWED", message: "Origin not allowed" } }, 403, origin);
    }

    if (!env.STRIPE_SECRET_KEY) {
      console.error("STRIPE_SECRET_KEY is not configured");
      return reply({ error: { code: "SERVICE_UNAVAILABLE", message: "Payment service is not configured" } }, 503, origin);
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return reply({ error: { code: "INVALID_JSON", message: "Invalid request body" } }, 400, origin);
    }

    const amount = Number(payload?.amount);
    const requestId = payload?.requestId;
    if (!Number.isSafeInteger(amount) || amount < 50 || amount > 100000) {
      return reply({ error: { code: "INVALID_AMOUNT", message: "Amount must be between 50 and 100,000 THB" } }, 400, origin);
    }
    if (!isUuid(requestId)) {
      return reply({ error: { code: "INVALID_REQUEST_ID", message: "A valid request ID is required" } }, 400, origin);
    }
    if (payload?.accepted !== true) {
      return reply({ error: { code: "TERMS_REQUIRED", message: "Terms must be accepted" } }, 400, origin);
    }

    const params = new URLSearchParams();
    params.set("mode", "payment");
    params.set("locale", "auto");
    params.set("submit_type", "donate");
    params.set("success_url", "https://sorasukt.com/donate/thankyou.html?session_id={CHECKOUT_SESSION_ID}");
    params.set("cancel_url", "https://sorasukt.com/support/?canceled=1");
    params.append("payment_method_types[]", "card");
    params.append("payment_method_types[]", "promptpay");
    params.set("line_items[0][price_data][currency]", "thb");
    params.set("line_items[0][price_data][unit_amount]", String(amount * 100));
    params.set("line_items[0][price_data][product_data][name]", "Support /sorasukt");
    params.set("line_items[0][price_data][product_data][description]", "Voluntary support for educational and creative projects");
    params.set("line_items[0][quantity]", "1");
    params.set("metadata[context]", "personal_support");
    params.set("metadata[request_id]", requestId);
    params.set("payment_intent_data[metadata][context]", "personal_support");
    params.set("payment_intent_data[metadata][request_id]", requestId);

    let stripeResponse;
    try {
      stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: {
          authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
          "content-type": "application/x-www-form-urlencoded",
          "idempotency-key": `sorasukt-support-${requestId}`,
        },
        body: params,
      });
    } catch (error) {
      console.error("Stripe request failed", error);
      return reply({ error: { code: "PAYMENT_NETWORK_ERROR", message: "Unable to contact payment provider" } }, 502, origin);
    }

    const data = await stripeResponse.json().catch(() => null);
    if (!stripeResponse.ok) {
      console.error("Stripe rejected checkout", {
        status: stripeResponse.status,
        type: data?.error?.type,
        code: data?.error?.code,
      });
      return reply({ error: { code: "CHECKOUT_FAILED", message: "Unable to start checkout" } }, 502, origin);
    }

    if (typeof data?.url !== "string" || !data.url.startsWith("https://checkout.stripe.com/")) {
      return reply({ error: { code: "INVALID_PROVIDER_RESPONSE", message: "Invalid checkout response" } }, 502, origin);
    }

    return reply({ url: data.url }, 200, origin);
  },
};
