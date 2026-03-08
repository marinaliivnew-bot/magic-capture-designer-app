import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BUCKET = "style-images";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { queries } = await req.json();
    // queries: Record<string, string> — key → unsplash search query

    const UNSPLASH_ACCESS_KEY = Deno.env.get("UNSPLASH_ACCESS_KEY");
    if (!UNSPLASH_ACCESS_KEY) {
      return new Response(
        JSON.stringify({ error: "UNSPLASH_ACCESS_KEY is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const results: Record<string, { url: string; attribution: string }> = {};

    for (const [key, query] of Object.entries(queries as Record<string, string>)) {
      const fileName = `${key}.jpg`;

      // Check cache first
      const { data: existing } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(fileName, 60);

      // Try to get public URL — if file exists, use it
      const { data: publicUrlData } = supabase.storage
        .from(BUCKET)
        .getPublicUrl(fileName);

      // Check if file exists by listing
      const { data: fileList } = await supabase.storage
        .from(BUCKET)
        .list("", { search: fileName, limit: 1 });

      if (fileList && fileList.length > 0 && fileList[0].name === fileName) {
        results[key] = {
          url: publicUrlData.publicUrl,
          attribution: "", // cached, attribution was stored on first fetch
        };
        continue;
      }

      // Fetch from Unsplash
      const unsplashResp = await fetch(
        `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`,
        {
          headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` },
        }
      );

      if (!unsplashResp.ok) {
        console.error(`Unsplash error for "${key}":`, unsplashResp.status);
        results[key] = { url: "", attribution: "" };
        continue;
      }

      const unsplashData = await unsplashResp.json();
      const photo = unsplashData.results?.[0];
      if (!photo) {
        results[key] = { url: "", attribution: "" };
        continue;
      }

      const imageUrl = photo.urls?.regular || photo.urls?.small;
      const attribution = `Photo by ${photo.user?.name} on Unsplash`;

      // Download image
      const imgResp = await fetch(imageUrl);
      if (!imgResp.ok) {
        results[key] = { url: imageUrl, attribution };
        continue;
      }

      const imgBlob = await imgResp.arrayBuffer();

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(fileName, imgBlob, {
          contentType: "image/jpeg",
          upsert: true,
        });

      if (uploadError) {
        console.error(`Upload error for "${key}":`, uploadError);
        // Fallback to direct unsplash URL
        results[key] = { url: imageUrl, attribution };
        continue;
      }

      const { data: finalUrl } = supabase.storage
        .from(BUCKET)
        .getPublicUrl(fileName);

      results[key] = {
        url: finalUrl.publicUrl,
        attribution,
      };
    }

    return new Response(JSON.stringify({ images: results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("fetch-style-images error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
