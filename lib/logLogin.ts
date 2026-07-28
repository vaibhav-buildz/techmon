import { supabase } from "./supabase";

function parseUserAgent(ua: string) {
  let browser = "Unknown Browser";
  let os = "Unknown OS";
  let device = "Desktop";

  // OS detection
  if (/windows/i.test(ua)) os = "Windows";
  else if (/macintosh|mac os x/i.test(ua)) os = "macOS";
  else if (/linux/i.test(ua) && !/android/i.test(ua)) os = "Linux";
  else if (/iphone|ipad|ipod/i.test(ua)) {
    os = "iOS";
    device = "Mobile";
  } else if (/android/i.test(ua)) {
    os = "Android";
    device = "Mobile";
  }

  // Browser detection
  if (/edg/i.test(ua)) browser = "Edge";
  else if (/chrome/i.test(ua) && !/edg/i.test(ua)) browser = "Chrome";
  else if (/firefox/i.test(ua)) browser = "Firefox";
  else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = "Safari";
  else if (/opera|opr/i.test(ua)) browser = "Opera";

  return { browser, os, device };
}

async function getIpAndLocation() {
  try {
    const res = await fetch("https://ipapi.co/json/", { cache: "no-store" });
    if (!res.ok) throw new Error("ipapi request failed");
    const data = await res.json();
    return {
      ip: data.ip || "Unknown IP",
      city: data.city || "Unknown City",
      region: data.region || "Unknown Region",
      country: data.country_name || data.country || "Unknown Country",
    };
  } catch (err) {
    console.warn("[logLogin] IP location API fetch failed:", err);
    return {
      ip: "Unknown IP",
      city: "Unknown City",
      region: "Unknown Region",
      country: "Unknown Country",
    };
  }
}

export function clearLoginSessionFlags(userId?: string) {
  if (typeof window === "undefined") return;
  if (userId) {
    sessionStorage.removeItem(`techmon_logged_login_${userId}`);
    localStorage.removeItem(`techmon_last_login_${userId}`);
  } else {
    Object.keys(sessionStorage).forEach((key) => {
      if (key.startsWith("techmon_logged_login_")) {
        sessionStorage.removeItem(key);
      }
    });
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith("techmon_last_login_")) {
        localStorage.removeItem(key);
      }
    });
  }
}

export async function logLogin(userId: string) {
  if (!userId || typeof window === "undefined") return;

  const sessionKey = `techmon_logged_login_${userId}`;
  if (sessionStorage.getItem(sessionKey)) {
    return;
  }

  try {
    const ua = navigator.userAgent;
    const { browser, os, device } = parseUserAgent(ua);

    // Deduplication check: compare timestamps to prevent logging if a login history row exists within the last 60 seconds
    const sixtySecondsAgo = new Date(Date.now() - 60 * 1000).toISOString();
    const { data: recentLogins, error: checkError } = await supabase
      .from("login_history")
      .select("id, created_at, browser, os, device")
      .eq("user_id", userId)
      .gte("created_at", sixtySecondsAgo)
      .limit(1);

    if (checkError) {
      console.error("[logLogin] Error checking recent login_history:", checkError);
    }

    if (recentLogins && recentLogins.length > 0) {
      // Mark session logged so subsequent triggers in this browser session skip early
      sessionStorage.setItem(sessionKey, "true");
      return;
    }

    sessionStorage.setItem(sessionKey, "true");
    localStorage.setItem(`techmon_last_login_${userId}`, Date.now().toString());

    const { ip, city, region, country } = await getIpAndLocation();

    // 1. Insert into login_history table
    const { error: historyError } = await supabase.from("login_history").insert({
      user_id: userId,
      device,
      browser,
      os,
      ip_address: ip,
      city,
      region,
      country,
    });

    if (historyError) {
      console.error("[logLogin] Error inserting into login_history:", historyError);
    }

    // 2. Insert into notifications table
    const locationString = city !== "Unknown City" && country !== "Unknown Country"
      ? `${city}, ${country}`
      : "Unknown location";

    const message = `New login from ${browser} on ${os} in ${locationString}`;

    const { error: notifError } = await supabase.from("notifications").insert({
      recipient_id: userId,
      actor_id: userId,
      type: "login_alert",
      message,
      read: false,
    });

    if (notifError) {
      console.error("[logLogin] Error inserting login_alert notification:", notifError);
    }
  } catch (err) {
    console.error("[logLogin] Unexpected error:", err);
  }
}
