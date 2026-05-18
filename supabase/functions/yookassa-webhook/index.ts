import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const body = await req.json();
    const event = body.event;
    const paymentData = body.object;

    if (!event || !paymentData?.id) {
      return new Response("Invalid payload", { status: 400 });
    }

    const shopId = Deno.env.get("YOOKASSA_SHOP_ID");
    const secretKey = Deno.env.get("YOOKASSA_SECRET_KEY");
    if (!shopId || !secretKey) {
      console.error("YooKassa credentials not configured");
      return new Response("Server misconfigured", { status: 500 });
    }

    const verifyId =
      event === "refund.succeeded" ? paymentData.payment_id : paymentData.id;

    const verifyResp = await fetch(
      `https://api.yookassa.ru/v3/payments/${verifyId}`,
      {
        headers: {
          Authorization: `Basic ${btoa(`${shopId}:${secretKey}`)}`,
        },
      },
    );

    if (!verifyResp.ok) {
      console.error("Payment verification failed:", verifyResp.status);
      return new Response("OK", { status: 200 });
    }

    const verified = await verifyResp.json();
    const verifiedStatus = verified.status as string;
    const verifiedMetadata = verified.metadata || {};

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (event === "payment.succeeded" && verifiedStatus === "succeeded") {
      const userId = verifiedMetadata.user_id;
      const tier = verifiedMetadata.tier;
      const yookassaPaymentId = verified.id;

      if (!userId || !tier) {
        console.error(
          "Missing metadata in verified payment:",
          yookassaPaymentId,
        );
        return new Response("OK", { status: 200 });
      }

      await supabase
        .from("payments")
        .update({ status: "succeeded" })
        .eq("yookassa_payment_id", yookassaPaymentId);

      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setMonth(periodEnd.getMonth() + 1);

      const paymentMethodId: string | undefined = verified.payment_method?.saved
        ? verified.payment_method?.id
        : verified.payment_method?.id;

      if (tier === "team") {
        const { data: existingMembership } = await supabase
          .from("team_members")
          .select("team_id, role")
          .eq("user_id", userId)
          .maybeSingle();

        let teamId: string | null = null;

        if (existingMembership?.role === "owner") {
          teamId = existingMembership.team_id;
        } else if (!existingMembership) {
          const { data: newTeam, error: teamErr } = await supabase
            .from("teams")
            .insert({ owner_id: userId, name: "Моя команда" })
            .select("id")
            .single();

          if (teamErr || !newTeam) {
            console.error("Failed to create team:", teamErr);
            return new Response("OK", { status: 200 });
          }
          teamId = newTeam.id;

          await supabase.from("team_members").insert({
            team_id: teamId,
            user_id: userId,
            role: "owner",
          });
        } else {
          console.error("User already a member of another team:", userId);
          return new Response("OK", { status: 200 });
        }

        const teamSubRow: Record<string, unknown> = {
          user_id: userId,
          team_id: teamId,
          tier: "team",
          status: "active",
          current_period_start: now.toISOString(),
          current_period_end: periodEnd.toISOString(),
          updated_at: now.toISOString(),
        };
        if (paymentMethodId) teamSubRow.payment_method_id = paymentMethodId;

        await supabase
          .from("subscriptions")
          .upsert(teamSubRow, { onConflict: "user_id" });

        console.log(
          `Team subscription activated for user ${userId}, team ${teamId}`,
        );
        return new Response("OK", { status: 200 });
      }

      const subscriptionRow: Record<string, unknown> = {
        user_id: userId,
        tier,
        status: "active",
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
        updated_at: now.toISOString(),
      };
      if (paymentMethodId) {
        subscriptionRow.payment_method_id = paymentMethodId;
      }

      await supabase
        .from("subscriptions")
        .upsert(subscriptionRow, { onConflict: "user_id" });

      console.log(`Subscription activated for user ${userId}: ${tier}`);
    }

    if (event === "payment.canceled" && verifiedStatus === "canceled") {
      await supabase
        .from("payments")
        .update({ status: "cancelled" })
        .eq("yookassa_payment_id", verified.id);
    }

    if (event === "refund.succeeded") {
      await supabase
        .from("payments")
        .update({ status: "refunded" })
        .eq("yookassa_payment_id", verifyId);
    }

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response("Internal error", { status: 500 });
  }
});
