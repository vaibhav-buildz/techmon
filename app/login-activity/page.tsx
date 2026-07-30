"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Laptop, Smartphone, Shield, ArrowLeft, Clock, MapPin } from "lucide-react";

type LoginRecord = {
  id: string;
  user_id: string;
  device: string;
  browser: string;
  os: string;
  ip_address: string;
  city: string;
  region: string;
  country: string;
  created_at: string;
};

function formatTimeAgo(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

function formatExactDate(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function getDeviceIcon(device: string, os: string) {
  const lowerDevice = (device || "").toLowerCase();
  const lowerOs = (os || "").toLowerCase();

  if (lowerDevice.includes("mobile") || lowerOs.includes("ios") || lowerOs.includes("android")) {
    return <Smartphone className="w-5 h-5 text-accent" />;
  }
  return <Laptop className="w-5 h-5 text-accent" />;
}

export default function LoginActivityPage() {
  const router = useRouter();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [history, setHistory] = useState<LoginRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLoginHistory = useCallback(async (userId: string) => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("login_history")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (fetchError) throw fetchError;
      setHistory(data || []);
    } catch (err: any) {
      console.error("[LoginActivity] Fetch error:", err);
      setError(err.message);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        router.push("/login");
      } else {
        setCurrentUserId(session.user.id);
        fetchLoginHistory(session.user.id);
      }
    };

    checkAuth();
  }, [router, fetchLoginHistory]);

  if (!currentUserId) return null;

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 pt-24 pb-12">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors text-body hover:text-heading"
            title="Go back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl md:text-3xl font-heading font-bold text-heading">Login Activity</h1>
            <p className="text-sm font-sans text-muted">Active sessions, device logs, and security history</p>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-xs font-mono text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="bg-surface border border-border p-5 flex items-center justify-between animate-pulse"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-gray-200" />
                  <div className="space-y-2">
                    <div className="h-4 bg-gray-200 w-40" />
                    <div className="h-3 bg-gray-200 w-28" />
                  </div>
                </div>
                <div className="h-3 bg-gray-200 w-16" />
              </div>
            ))}
          </div>
        ) : history.length === 0 ? (
          <div className="bg-surface border border-border p-12 text-center flex flex-col items-center justify-center gap-3">
            <Shield className="w-10 h-10 text-gray-300" />
            <h3 className="font-heading font-bold text-lg text-heading">No Login History</h3>
            <p className="text-sm font-sans text-muted max-w-sm">
              Your login sessions will appear here as soon as you sign in on a device.
            </p>
          </div>
        ) : (
          <div className="bg-surface border border-border divide-y divide-border overflow-hidden">
            {history.map((record, index) => {
              const isCurrentSession = index === 0;
              const hasLocation =
                record.city &&
                record.country &&
                record.city !== "Unknown City" &&
                record.country !== "Unknown Country";

              const locationString = hasLocation
                ? `${record.city}${record.region && record.region !== "Unknown Region" ? `, ${record.region}` : ""}, ${record.country}`
                : "Unknown location";

              return (
                <div
                  key={record.id || index}
                  className={`p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
                    isCurrentSession ? "bg-accent/5" : "hover:bg-gray-50/50"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-surface border border-border flex items-center justify-center shrink-0 mt-0.5">
                      {getDeviceIcon(record.device, record.os)}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-heading font-bold text-heading text-base">
                          {record.browser || "Unknown Browser"} on {record.os || "Unknown OS"}
                        </span>

                        {isCurrentSession && (
                          <span className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Active session
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-xs text-muted font-sans flex-wrap">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-gray-400" />
                          {locationString}
                        </span>
                        {record.ip_address && record.ip_address !== "Unknown IP" && (
                          <span className="font-mono text-gray-400">• IP: {record.ip_address}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="sm:text-right shrink-0 flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 pt-2 sm:pt-0 border-border">
                    <span className="text-xs font-mono font-bold text-heading flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-gray-400 sm:hidden" />
                      {formatTimeAgo(record.created_at)}
                    </span>
                    <span className="text-[11px] text-muted font-mono" title={record.created_at}>
                      {formatExactDate(record.created_at)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
