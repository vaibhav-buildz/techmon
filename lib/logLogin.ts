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

/**
 * Returns a persistent device ID stored in localStorage ('techmon_device_id').
 * Generates a new UUID if it does not exist yet.
 */
export function getOrCreateDeviceId(): string {
  if (typeof window === "undefined") return "";
  let deviceId = localStorage.getItem("techmon_device_id");
  if (!deviceId) {
    deviceId =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem("techmon_device_id", deviceId);
  }
  return deviceId;
}

/**
 * Clears active session login keys from localStorage upon sign out,
 * ensuring subsequent logins on this device log fresh alerts.
 */
export function clearLoginSession(userId?: string) {
  if (typeof window === "undefined") return;
  const deviceId = getOrCreateDeviceId();
  if (userId) {
    localStorage.removeItem(`techmon_logged_in_session_${deviceId}_${userId}`);
  } else {
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith(`techmon_logged_in_session_${deviceId}_`)) {
        localStorage.removeItem(key);
      }
    });
  }
}

function isSessionContinuation(
  recentLogins: any[],
  current: { ip: string; os: string; device: string; browser: string; ua: string; city: string; country: string }
): boolean {
  if (!recentLogins || recentLogins.length === 0) return false;

  return recentLogins.some((prev) => {
    // Must match at least OS and Device type (e.g. both iOS Mobile, or both Windows Desktop)
    if (prev.os !== current.os || prev.device !== current.device) {
      return false;
    }

    const sameIp = prev.ip_address && prev.ip_address !== "Unknown IP" && prev.ip_address === current.ip;
    const sameUserAgent = prev.user_agent && prev.user_agent === current.ua;
    const sameLocation = prev.city === current.city && prev.country === current.country && current.country !== "Unknown Country";

    // Case 1: Same IP address and same OS/Device within the 10-minute window.
    // Covers in-app webviews (WhatsApp/Gmail/Instagram) where the User-Agent appends custom headers or alters the browser name, but network and OS match.
    if (sameIp) {
      return true;
    }

    // Case 2: Exactly identical User-Agent string and matching geographical location within 10 minutes.
    // Covers mobile devices changing network connections (e.g. WiFi switching to cellular data handoffs) without alerting.
    if (sameUserAgent && sameLocation) {
      return true;
    }

    return false;
  });
}

/**
 * Logs a login event to login_history and notifications using device/session localStorage deduplication,
 * supplemented by a short-lived server-side recency check for non-persistent webviews.
 */
export async function logLogin(userId: string, accessToken?: string, event?: string) {
  console.log(`[logLogin] Triggered - Auth Event: "${event || 'UNKNOWN'}", UserId: "${userId}"`);

  if (!userId || typeof window === "undefined") return;

  // Strictly filter to ONLY 'SIGNED_IN' events
  if (event && event !== "SIGNED_IN") {
    console.log(`[logLogin] Skipped logging - event "${event}" is not "SIGNED_IN"`);
    return;
  }

  try {
    const deviceId = getOrCreateDeviceId();
    const sessionKey = `techmon_logged_in_session_${deviceId}_${userId}`;

    // Primary fast-path: Deduplication check using localStorage session marker for normal browsers
    const storedSession = localStorage.getItem(sessionKey);
    if (storedSession) {
      console.log(`[logLogin] Ignored duplicate - session already logged for user ${userId} on device ${deviceId}`);
      return;
    }

    // Set session marker immediately in localStorage to prevent race conditions across parallel mounts
    localStorage.setItem(sessionKey, "logged_in");

    const ua = navigator.userAgent || "";
    const { browser, os, device } = parseUserAgent(ua);
    const { ip, city, region, country } = await getIpAndLocation();

    // Fallback server-side recency check: query recent logins within the last 10 minutes
    // Specifically avoids false positives in temporary in-app webviews (Instagram, WhatsApp, Gmail) where localStorage was siloed
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: recentLogins, error: fetchError } = await supabase
      .from("login_history")
      .select("ip_address, os, browser, device, user_agent, city, country, created_at")
      .eq("user_id", userId)
      .gte("created_at", tenMinutesAgo)
      .order("created_at", { ascending: false });

    if (!fetchError && isSessionContinuation(recentLogins || [], { ip, os, device, browser, ua, city, country })) {
      console.log(`[logLogin] Suppressed alert - recent session continuation detected for user ${userId}`);
      return;
    }

    const locationString =
      city !== "Unknown City" && country !== "Unknown Country"
        ? `${city}, ${country}`
        : "Unknown location";

    // 1. Insert into login_history table with user_agent and location for accuracy
    const { error: historyError } = await supabase.from("login_history").insert({
      user_id: userId,
      device,
      browser,
      os,
      ip_address: ip,
      user_agent: ua,
      location: locationString,
      city,
      region,
      country,
    });

    if (historyError) {
      console.error("[logLogin] Error inserting into login_history:", historyError);
    }

    // 2. Insert into notifications table
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
