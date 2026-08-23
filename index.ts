// supabase/functions/send-push/index.ts
//
// Sends a push notification through OneSignal to one user, targeted by the
// external_id that the app sets via OneSignal.login(user.id) at login time.
//
// Required secrets (set with `supabase secrets set ...`, see the guide):
//   ONESIGNAL_APP_ID        - OneSignal dashboard -> Settings -> Keys & IDs
//   ONESIGNAL_REST_API_KEY  - OneSignal dashboard -> Settings -> Keys & IDs (REST API key)

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  try {
    const { toUserId, title, body } = await req.json();

    if (!toUserId || !body) {
      return new Response(
        JSON.stringify({ error: "toUserId and body are required" }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
      );
    }

    const ONESIGNAL_APP_ID = Deno.env.get("ONESIGNAL_APP_ID");
    const ONESIGNAL_REST_API_KEY = Deno.env.get("ONESIGNAL_REST_API_KEY");

    if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
      console.error("Missing ONESIGNAL_APP_ID or ONESIGNAL_REST_API_KEY secret");
      return new Response(
        JSON.stringify({ error: "Server not configured" }),
        { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
      );
    }

    const onesignalRes = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Authorization": `Key ${ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        include_aliases: { external_id: [String(toUserId)] },
        target_channel: "push",
        headings: { en: title || "MANDALEDITZ" },
        contents: { en: body },
      }),
    });

    const result = await onesignalRes.json();

    if (!onesignalRes.ok) {
      console.error("OneSignal error", result);
      return new Response(JSON.stringify({ error: "OneSignal request failed", details: result }), {
        status: 502,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, result }), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-push failed", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
