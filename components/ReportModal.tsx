"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { X, CheckCircle2, AlertTriangle } from "lucide-react";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  targetType: "post" | "comment" | "user";
  targetId: string;
  currentUserId?: string | null;
};

const REPORT_REASONS = [
  "It's spam",
  "Nudity or sexual activity",
  "Hate speech or symbols",
  "Violence or dangerous organizations",
  "Bullying or harassment",
  "False information",
  "Scam or fraud",
  "I just don't like it",
  "Something else",
];

export default function ReportModal({
  isOpen,
  onClose,
  targetType,
  targetId,
  currentUserId,
}: Props) {
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [detailsText, setDetailsText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleClose = () => {
    setSelectedReason(null);
    setDetailsText("");
    setSubmitting(false);
    setSubmitted(false);
    setError(null);
    onClose();
  };

  const handleSubmit = async () => {
    if (!selectedReason) return;

    let userId = currentUserId;
    if (!userId) {
      const { data: { session } } = await supabase.auth.getSession();
      userId = session?.user?.id || null;
    }

    if (!userId) {
      setError("You must be logged in to submit a report.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      let finalReason = selectedReason;
      if (selectedReason === "Something else" && detailsText.trim()) {
        finalReason = `Something else: ${detailsText.trim()}`;
      }

      const { error: insertError } = await supabase.from("reports").insert({
        reporter_id: userId,
        target_type: targetType,
        target_id: targetId,
        reason: finalReason,
        status: "pending",
      });

      if (insertError) throw insertError;

      setSubmitted(true);
    } catch (err: any) {
      console.error("[ReportModal] Error submitting report:", err);
      setError(err.message || "Failed to submit report. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const isSubmitDisabled =
    !selectedReason ||
    submitting ||
    (selectedReason === "Something else" && !detailsText.trim());

  const getTargetTypeName = () => {
    if (targetType === "post") return "Post";
    if (targetType === "comment") return "Comment";
    if (targetType === "user") return "Account";
    return "Item";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-surface border border-border w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-background/50">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-accent" />
            <h2 className="font-heading font-bold text-lg text-heading">
              Report {getTargetTypeName()}
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="p-1 text-muted hover:text-heading transition-colors rounded-full hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        {submitted ? (
          <div className="p-8 text-center flex flex-col items-center justify-center gap-3 space-y-2">
            <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200 mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h3 className="font-heading font-bold text-lg text-heading">
              Thanks for reporting
            </h3>
            <p className="text-xs text-body max-w-xs leading-relaxed font-sans mx-auto">
              We'll review this and take action if needed. Thank you for helping keep Techmon safe.
            </p>
            <button
              onClick={handleClose}
              className="mt-4 px-6 py-2 bg-accent text-white font-mono text-xs uppercase tracking-wider font-semibold border border-accent hover:bg-accent/90 transition-colors"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              <div>
                <h3 className="text-sm font-heading font-semibold text-heading mb-1">
                  Why are you reporting this {getTargetTypeName().toLowerCase()}?
                </h3>
                <p className="text-xs text-muted font-sans">
                  Your report is anonymous, except if you're reporting an intellectual property infringement.
                </p>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 text-xs text-red-700 font-sans">
                  {error}
                </div>
              )}

              {/* Reasons Radio / Option List */}
              <div className="divide-y divide-border border border-border bg-background">
                {REPORT_REASONS.map((reason) => {
                  const isSelected = selectedReason === reason;
                  return (
                    <button
                      key={reason}
                      onClick={() => setSelectedReason(reason)}
                      className={`w-full text-left p-3.5 flex items-center justify-between text-xs font-sans transition-colors ${
                        isSelected
                          ? "bg-accent/10 text-accent font-semibold"
                          : "text-heading hover:bg-gray-50/80"
                      }`}
                    >
                      <span>{reason}</span>
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                          isSelected
                            ? "border-accent bg-accent text-white"
                            : "border-gray-300"
                        }`}
                      >
                        {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Text Input if "Something else" is selected */}
              {selectedReason === "Something else" && (
                <div className="space-y-1.5 pt-1 animate-in fade-in duration-150">
                  <label className="text-xs font-mono uppercase text-muted font-bold">
                    Additional Details:
                  </label>
                  <textarea
                    rows={3}
                    value={detailsText}
                    onChange={(e) => setDetailsText(e.target.value)}
                    placeholder="Please specify why you are reporting this content..."
                    className="w-full p-3 bg-background border border-border focus:border-accent text-xs font-sans text-heading focus:outline-none resize-none"
                  />
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-border bg-background/50 flex items-center justify-end gap-3">
              <button
                onClick={handleClose}
                className="px-4 py-2 bg-surface border border-border text-heading hover:border-heading font-mono text-xs uppercase tracking-wider transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitDisabled}
                className="px-6 py-2 bg-accent text-white font-mono text-xs uppercase tracking-wider font-semibold border border-accent hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? "Submitting..." : "Submit Report"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
