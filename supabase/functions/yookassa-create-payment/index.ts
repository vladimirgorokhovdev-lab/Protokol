import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeadersForRequest, handleCorsPreflight } from "../_shared/cors.ts";

const TIER_PRICES: Record<string, number> = {
  basic: 200000,
  pro: 1000000,
  team: 2500000,
};

const TIER_LABELS: Record<string, string> = {
  basic: "Базовый тариф — 5 расшифровок/мес, до 10 часов",
  pro: "Про тариф — без ограничений, до 50 часов/мес",
  team: "Командный тариф — до 5 пользователей, 100 расшифровок/мес",
};

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  const corsHeaders = corsHeadersForRequest(req);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Не авторизован" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Не авторизован" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { tier } = await req.json();
    if (!tier || !TIER_PRICES[tier]) {
      return new Response(JSON.stringify({ error: "Неверный тариф" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const shopId = Deno.env.get("YOOKASSA_SHOP_ID");
    const secretKey = Deno.env.get("YOOKASSA_SECRET_KEY");

    if (!shopId || !secretKey) {
      return new Response(
        JSON.stringify({ error: "Платёжная система не настроена" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const amount = (TIER_PRICES[tier] / 100).toFixed(2);
    const idempotencyKey = crypto.randomUUID();

    const allowedOrigins = (Deno.env.get("SUPABASE_ALLOWED_ORIGINS") || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const rawOrigin = req.headers.get("origin") || "";
    const returnUrl = allowedOrigins.includes(rawOrigin)
      ? rawOrigin
      : Deno.env.get("SITE_URL") ||
        allowedOrigins[0] ||
        "https://xn--j1achabchr0f.xn--p1ai";

    const paymentBody = {
      amount: {
        value: amount,
        currency: "RUB",
      },
      confirmation: {
        type: "redirect",
        return_url: `${returnUrl}/pricing?payment=success`,
      },
      capture: true,
      description: TIER_LABELS[tier],
      receipt: {
        customer: {
          email: user.email,
        },
        items: [
          {
            description: TIER_LABELS[tier].slice(0, 128),
            quantity: "1.00",
            amount: {
              value: amount,
              currency: "RUB",
            },
            vat_code: 1,
            payment_mode: "full_payment",
            payment_subject: "service",
          },
        ],
      },
      metadata: {
        user_id: user.id,
        tier,
      },
    };

    const yooResponse = await fetch("https://api.yookassa.ru/v3/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotence-Key": idempotencyKey,
        Authorization: `Basic ${btoa(`${shopId}:${secretKey}`)}`,
      },
      body: JSON.stringify(paymentBody),
    });

    const yooData = await yooResponse.json();

    if (!yooResponse.ok) {
      console.error("YooKassa error:", yooData);
      return new Response(
        JSON.stringify({ error: "Ошибка создания платежа" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    await adminClient.from("payments").insert({
      user_id: user.id,
      amount: TIER_PRICES[tier],
      currency: "RUB",
      status: "pending",
      tier,
      yookassa_payment_id: yooData.id,
    });

    return new Response(
      JSON.stringify({
        confirmation_url: yooData.confirmation.confirmation_url,
        payment_id: yooData.id,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Payment creation error:", error);
    return new Response(
      JSON.stringify({ error: "Внутренняя ошибка сервера" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
