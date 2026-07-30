"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { X, Link as LinkIcon, Check, Send as SendIcon } from "lucide-react";

type Profile = {
  id: string;
  name: string;
  avatar_url?: string;
  headline?: string;
  username?: string;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  postId: string;
  currentUserId: string | null;
};

export default function SharePostModal({ isOpen, onClose, postId, currentUserId }: Props) {
  const [followers, setFollowers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [sentUserIds, setSentUserIds] = useState<Set<string>>(new Set());
  const [sendingUserId, setSendingUserId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && currentUserId) {
      fetchFollowers();
    }
  }, [isOpen, currentUserId]);

  const fetchFollowers = async () => {
    setLoading(true);
    try {
      // Fetch users the current user follows
      const { data: follows, error: followsError } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", currentUserId);

      if (followsError) throw followsError;

      const followingIds = follows?.map(f => f.following_id) || [];
      if (followingIds.length === 0) {
        setFollowers([]);
        return;
      }

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, name, avatar_url, headline, username")
        .in("id", followingIds);

      if (profilesError) throw profilesError;

      setFollowers(profiles || []);
    } catch (err) {
      console.error("Error fetching followers to share:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = async () => {
    const url = `${window.location.origin}/post/${postId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy link:", err);
    }
  };

  const handleSend = async (targetUserId: string) => {
    if (!currentUserId || sentUserIds.has(targetUserId)) return;
    setSendingUserId(targetUserId);

    try {
      // 1. Find existing conversation or create new one
      const { data: existingConvos } = await supabase
        .from("conversations")
        .select("id")
        .or(`and(user1_id.eq.${currentUserId},user2_id.eq.${targetUserId}),and(user1_id.eq.${targetUserId},user2_id.eq.${currentUserId})`);

      let convoId = existingConvos?.[0]?.id;
      if (!convoId) {
        const { data: newConvo, error: convoErr } = await supabase
          .from("conversations")
          .insert({ user1_id: currentUserId, user2_id: targetUserId })
          .select("id")
          .single();

        if (convoErr) throw convoErr;
        convoId = newConvo.id;
      }

      const postUrl = `${window.location.origin}/post/${postId}`;
      const { error: msgErr } = await supabase.from("messages").insert({
        conversation_id: convoId,
        sender_id: currentUserId,
        content: `Check out this post: ${postUrl}`,
        read: false,
      });

      if (msgErr) throw msgErr;

      setSentUserIds(prev => new Set(prev).add(targetUserId));
    } catch (err) {
      console.error("Error sending post via message:", err);
    } finally {
      setSendingUserId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150" onClick={onClose}>
      <div 
        className="bg-surface border border-border shadow-2xl rounded-none w-full max-w-sm overflow-hidden flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-border bg-surface shrink-0">
          <h2 className="font-heading font-bold text-lg text-heading">Share post</h2>
          <button 
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-heading hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <h3 className="text-xs font-mono font-bold text-muted uppercase tracking-wider mb-2">Send message to</h3>
          {loading ? (
            <div className="flex justify-center p-4">
              <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : followers.length === 0 ? (
            <p className="text-xs font-mono text-muted text-center py-4">You aren't following anyone yet.</p>
          ) : (
            <div className="space-y-3">
              {followers.map(user => {
                const isSent = sentUserIds.has(user.id);
                const isSending = sendingUserId === user.id;

                return (
                  <div key={user.id} className="flex items-center justify-between group">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-surface border border-border overflow-hidden shrink-0 flex items-center justify-center font-bold font-mono text-xs text-heading">
                        {user.avatar_url ? (
                          <img src={user.avatar_url} alt={user.name} className="w-full h-full object-cover" />
                        ) : (
                          user.name.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-bold text-xs text-heading truncate">{user.name}</span>
                        {user.username && (
                          <span className="text-[10px] font-mono text-muted truncate">@{user.username}</span>
                        )}
                      </div>
                    </div>
                    <button 
                      onClick={() => handleSend(user.id)}
                      disabled={isSent || isSending}
                      className={`px-3.5 py-1.5 font-mono text-xs uppercase tracking-wider transition-colors border ${
                        isSent
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200 cursor-default"
                          : "bg-accent/10 text-accent border-accent/20 hover:bg-accent hover:text-white"
                      }`}
                    >
                      {isSending ? "..." : isSent ? "Sent ✓" : "Send"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="border-t border-border p-4 bg-background shrink-0">
          <button 
            onClick={handleCopyLink}
            className="w-full flex items-center gap-3 p-3 bg-surface border border-border rounded-none hover:border-heading transition-colors text-left"
          >
            <div className={`w-9 h-9 flex items-center justify-center rounded-none border ${copied ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-background text-muted border-border'}`}>
              {copied ? <Check className="w-4 h-4" /> : <LinkIcon className="w-4 h-4" />}
            </div>
            <div className="flex-1">
              <span className="font-heading font-semibold text-xs text-heading block">Copy Direct Link</span>
              <span className="text-[11px] text-muted block font-mono">Share this post anywhere</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
