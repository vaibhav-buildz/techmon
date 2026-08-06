import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  try {
    // 1. Verify Authorization header from Vercel Cron
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret) {
      if (authHeader !== `Bearer ${cronSecret}`) {
        console.warn("[Cron Cleanup] Unauthorized cron attempt:", authHeader);
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    // 2. Initialize Supabase Admin/Service Role Client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("[Cron Cleanup] Missing Supabase URL or Service Role key.");
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // 3. Execute cleanup_expired_stories RPC
    const { data: cleanedUpCount, error } = await supabaseAdmin.rpc("cleanup_expired_stories");

    if (error) {
      console.error("[Cron Cleanup] Error running cleanup_expired_stories RPC:", error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    console.log(`[Cron Cleanup] Successfully cleaned up ${cleanedUpCount} expired stories.`);

    return NextResponse.json({
      success: true,
      cleanedUpCount: cleanedUpCount ?? 0,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("[Cron Cleanup] Unexpected error in cron endpoint:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
