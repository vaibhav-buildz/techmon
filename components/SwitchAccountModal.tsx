"use client";

import { useState, useEffect } from "react";
import { X, Check, Plus, AlertCircle } from "lucide-react";
import { 
  SavedAccount, 
  getSavedAccounts, 
  switchToAccount 
} from "@/lib/accountManager";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string | null;
};

export default function SwitchAccountModal({ isOpen, onClose, currentUserId }: Props) {
  const [accounts, setAccounts] = useState<SavedAccount[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [switchingId, setSwitchingId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setAccounts(getSavedAccounts());
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSwitch = async (userId: string) => {
    if (userId === currentUserId || switchingId) return;
    setSwitchingId(userId);
    setError(null);
    try {
      const account = await switchToAccount(userId);
      // Force reload/redirect to the profile page of the switched user
      window.location.href = `/profile/${(account as any).username || account.user_id}`;
    } catch (err: any) {
      setError(err.message || "Failed to switch accounts.");
      // Refresh list as the failed account might have been removed
      setAccounts(getSavedAccounts());
    } finally {
      setSwitchingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface border border-border w-full max-w-sm rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="font-heading font-semibold text-heading text-lg">Switch Account</h3>
          <button
            onClick={onClose}
            className="p-1.5 text-body hover:text-heading hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {error && (
            <div className="px-4 py-3 bg-red-50 border border-red-100 rounded-xl flex items-start gap-2.5 text-sm text-red-600">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <p className="leading-normal">{error}</p>
            </div>
          )}

          <div className="space-y-1">
            {accounts.map((acc) => {
              const isActive = acc.user_id === currentUserId;
              const isSwitching = switchingId === acc.user_id;

              return (
                <div
                  key={acc.user_id}
                  onClick={() => handleSwitch(acc.user_id)}
                  className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${
                    isActive 
                      ? "bg-gray-50 border border-transparent cursor-default" 
                      : "hover:bg-gray-50 cursor-pointer border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Avatar */}
                    {acc.avatar_url ? (
                      <img
                        src={acc.avatar_url}
                        alt={acc.name}
                        className="w-10 h-10 rounded-full object-cover border border-border"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-background border border-border flex items-center justify-center text-sm font-semibold text-gray-400">
                        {acc.name?.charAt(0)?.toUpperCase()}
                      </div>
                    )}
                    
                    {/* Name / Email */}
                    <div className="text-left">
                      <p className="font-medium text-sm text-heading leading-tight">{acc.name}</p>
                      <p className="text-xs text-body font-mono mt-0.5">{acc.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isActive && (
                      <span className="w-6 h-6 bg-accent/10 rounded-full flex items-center justify-center text-accent">
                        <Check className="w-4 h-4" strokeWidth={3} />
                      </span>
                    )}

                    {isSwitching && (
                      <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                    )}

                  </div>
                </div>
              );
            })}

            {accounts.length === 0 && (
              <p className="text-center text-sm text-body py-4">No saved accounts found.</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 border-t border-border">
          <button
            onClick={() => {
              onClose();
              window.location.href = "/login";
            }}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-accent text-white font-medium rounded-xl text-sm hover:bg-accent/90 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" strokeWidth={2.5} />
            <span>Add Account</span>
          </button>
        </div>
      </div>
    </div>
  );
}
