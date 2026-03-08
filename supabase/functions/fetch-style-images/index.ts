import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BUCKET = "style-images";

// Tags/descriptions that indicate the photo contains people prominently
const PEOPLE_KEYWORDS = [
  "portrait", "woman", "man", "girl", "boy", "person", "people",
  "model", "fashion", "couple", "family", "child", "baby", "face",
  "selfie", "wedding", "bride", "groom",
];

// Tags that indicate the photo is actually an interior
const INTERIOR_KEYWORDS = [
  "interior", "room", "living", "bedroom", "kitchen", "bathroom",
  "furniture", "sofa", "chair", "table", "lamp", "decor", "design",
  "apartment", "house", "home", "wall", "floor", "ceiling",
  "couch", "shelf", "cabinet", "dining", "office", "studio",
  "architecture", "space", "minimal", "modern", "classic",
];

function hasPeople(photo: any): boolean {
  const desc = (photo.description || "").toLowerCase();
  const altDesc = (photo.alt_description || "").toLowerCase();
  const tags = (photo.tags || []).map((t: any) => (t.title || "").toLowerCase());
  const allText = [desc, altDesc, ...tags].join(" ");
  return PEOPLE_KEYWORDS.some((kw) => allText.includes(kw));
}

function interiorScore(photo: any): number {
  const desc = (photo.description || "").toLowerCase();
  const altDesc = (photo.alt_description || "").toLowerCase();
  const tags = (photo.tags || []).map((t: any) => (t.title || "").toLowerCase());
  const allText = [desc, altDesc, ...tags].join(" ");
  let score = 0;
  for (const kw of INTERIOR_KEYWORDS) {
    if (allText.includes(kw)) score++;
  }
  // Prefer landscape aspect ratio (width > height)
  if (photo.width && photo.height && photo.width > photo.height) {
    score += 2;
  }
  return score;
}

function pickBestPhoto(photos: any[]): any | null {
  if (!photos || photos.length === 0) return null;

  // Filter out photos with people
  const filtered = photos.filter((p) => !hasPeople(p));

  // If all filtered out, use originals but still try to pick best
  const candidates = filtered.length > 0 ? filtered : photos;

  // Sort by interior relevance score (descending)
  candidates.sort((a, b) => interiorScore(b) - interiorScore(a));

  return candidates[0];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { queries } = await req.json();

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
      const queryHash = Array.from(new TextEncoder().encode(query)).reduce((h, b) => ((h << 5) - h + b) | 0, 0).toString(36);
      const fileName = `${key}_${queryHash}.jpg`;

      // Check cache
      const { data: fileList } = await supabase.storage
        .from(BUCKET)
        .list("", { search: fileName, limit: 1 });

      if (fileList && fileList.length > 0 && fileList[0].name === fileName) {
        const { data: publicUrlData } = supabase.storage
          .from(BUCKET)
          .getPublicUrl(fileName);
        results[key] = { url: publicUrlData.publicUrl, attribution: "" };
        continue;
      }

      // Fetch 10 photos from Unsplash for better selection
      const unsplashResp = await fetch(
        `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=10&orientation=landscape&content_filter=high`,
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
      const photo = pickBestPhoto(unsplashData.results);

      if (!photo) {
        results[key] = { url: "", attribution: "" };
        continue;
      }

      const imageUrl = photo.urls?.regular || photo.urls?.small;
      const attribution = `Photo by ${photo.user?.name} on Unsplash`;

      // Download and cache
      const imgResp = await fetch(imageUrl);
      if (!imgResp.ok) {
        results[key] = { url: imageUrl, attribution };
        continue;
      }

      const imgBlob = await imgResp.arrayBuffer();

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(fileName, imgBlob, {
          contentType: "image/jpeg",
          upsert: true,
        });

      if (uploadError) {
        console.error(`Upload error for "${key}":`, uploadError);
        results[key] = { url: imageUrl, attribution };
        continue;
      }

      const { data: finalUrl } = supabase.storage
        .from(BUCKET)
        .getPublicUrl(fileName);

      results[key] = { url: finalUrl.publicUrl, attribution };
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
