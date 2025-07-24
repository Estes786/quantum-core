// Lokasi file: supabase/functions/main-service/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.0.0";
// Menggunakan library AI yang dirancang untuk berjalan di lingkungan seperti Deno/Cloudflare
import { pipeline } from "https://cdn.jsdelivr.net/npm/@xenova/transformers@2.6.0";

// --- Inisialisasi Model AI ---
// Supabase akan menjalankan ini sekali saat fungsi "bangun" dan menyimpannya di memori.
console.log("STATUS: Memuat model analisis sentimen. Proses ini mungkin butuh waktu saat pertama kali dijalankan..." );
const sentimentPipeline = await pipeline('sentiment-analysis', 'Xenova/distilbert-base-uncased-finetuned-sst-2-english');
console.log("STATUS: Model AI berhasil dimuat dan siap digunakan.");

// --- Fungsi Utama Server ---
serve(async (req) => {
  // Mengizinkan permintaan dari semua sumber (PENTING untuk pengembangan)
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  // Menangani permintaan preflight OPTIONS dari browser
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Membuat Supabase client untuk berinteraksi dengan database di setiap permintaan
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );

    // --- Routing Sederhana ---
    const { url, method } = req;
    const { pathname } = new URL(url);

    // Endpoint utama untuk analisis
    if (pathname.endsWith("/analyze") && method === "POST") {
      const { review_id, text } = await req.json();

      if (!review_id || !text) {
        throw new Error("`review_id` dan `text` wajib diisi.");
      }

      // 1. Lakukan analisis sentimen
      console.log(`Menganalisis review_id: ${review_id}`);
      const results = await sentimentPipeline(text);
      const sentiment = results[0].label;
      const score = results[0].score.toFixed(4);
      console.log(`Hasil analisis: ${sentiment} (Skor: ${score})`);

      // 2. Simpan hasilnya ke tabel 'analysis_results' di Supabase
      const { error } = await supabaseClient
        .from('analysis_results')
        .insert({ review_id, original_text: text, sentiment, confidence_score: score });

      if (error) throw error;

      const responseData = { status: "Analisis selesai", review_id: review_id, sentiment: sentiment };
      return new Response(JSON.stringify(responseData), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Endpoint default jika path tidak cocok
    return new Response(JSON.stringify({ status: "Quantum Hybrida v2 on Supabase is online." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
