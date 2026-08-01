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

/**
 * Logs a login event to login_history and notifications using device/session localStorage deduplication.
 */
export async function logLogin(userId: string, accessToken?: string) {
  if (!userId || typeof window === "undefined") return;

  try {
    const deviceId = getOrCreateDeviceId();

    let token = accessToken;
    if (!token) {
      const { data: { session } } = await supabase.auth.getSession();
      token = session?.access_token;
    }

    const tokenIdentifier = token || "active_session";
    const sessionKey = `techmon_logged_in_session_${deviceId}_${userId}`;

    // Deduplication check using localStorage
    const storedToken = localStorage.getItem(sessionKey);
    if (storedToken === tokenIdentifier) {
      return;
    }

    // Set token immediately in localStorage to prevent race conditions across parallel mounts
    localStorage.setItem(sessionKey, tokenIdentifier);

    const ua = navigator.userAgent;
    const { browser, os, device } = parseUserAgent(ua);
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
    const locationString =
      city !== "Unknown City" && country !== "Unknown Country"
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
