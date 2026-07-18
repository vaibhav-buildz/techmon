"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { X, Camera, Monitor, RotateCcw, Share2, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onStoryCreated: () => void;
};

type CaptureTab = "camera" | "screen";

export default function CameraCaptureModal({
  isOpen,
  onClose,
  userId,
  onStoryCreated,
}: Props) {
  const [activeTab, setActiveTab] = useState<CaptureTab>("camera");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [streamLoading, setStreamLoading] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Stop any active stream
  const stopStream = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, [stream]);

  // Start camera stream
  const startCamera = useCallback(async () => {
    stopStream();
    setError(null);
    setStreamLoading(true);

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err: any) {
      console.error("Camera error:", err);
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setError("Camera access denied. Please allow camera access in your browser settings.");
      } else if (err.name === "NotFoundError") {
        setError("No camera found. Please connect a camera and try again.");
      } else {
        setError("Could not access camera. Please try again.");
      }
    } finally {
      setStreamLoading(false);
    }
  }, [stopStream]);

  // Start screen share stream
  const startScreenShare = useCallback(async () => {
    stopStream();
    setError(null);
    setStreamLoading(true);

    try {
      const mediaStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
      });

      // Listen for user ending share via browser UI
      mediaStream.getVideoTracks()[0].addEventListener("ended", () => {
        setStream(null);
        if (videoRef.current) {
          videoRef.current.srcObject = null;
        }
      });

      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err: any) {
      console.error("Screen share error:", err);
      if (err.name === "NotAllowedError" || err.name === "AbortError") {
        setError("Screen share was cancelled or denied. Please try again.");
      } else {
        setError("Could not start screen share. Please try again.");
      }
    } finally {
      setStreamLoading(false);
    }
  }, [stopStream]);

  // Start the appropriate stream when tab changes (only if no capture yet)
  useEffect(() => {
    if (!isOpen || capturedBlob) return;

    if (activeTab === "camera") {
      startCamera();
    } else {
      startScreenShare();
    }

    // Cleanup on unmount or tab change
    return () => {
      // We don't stop stream here because the new effect will handle it
    };
  }, [activeTab, isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on close
  useEffect(() => {
    if (!isOpen) {
      stopStream();
      setCapturedBlob(null);
      if (capturedPreview) {
        URL.revokeObjectURL(capturedPreview);
      }
      setCapturedPreview(null);
      setError(null);
      setUploading(false);
      setActiveTab("camera");
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Capture the current frame
  const handleCapture = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !stream) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (blob) {
          setCapturedBlob(blob);
          setCapturedPreview(URL.createObjectURL(blob));
          stopStream();
        }
      },
      "image/jpeg",
      0.92
    );
  }, [stream, stopStream]);

  // Retake — go back to live view
  const handleRetake = useCallback(() => {
    setCapturedBlob(null);
    if (capturedPreview) {
      URL.revokeObjectURL(capturedPreview);
    }
    setCapturedPreview(null);
    setError(null);

    if (activeTab === "camera") {
      startCamera();
    } else {
      startScreenShare();
    }
  }, [activeTab, capturedPreview, startCamera, startScreenShare]);

  // Upload and share to story
  const handleShare = useCallback(async () => {
    if (!capturedBlob) return;

    setUploading(true);
    setError(null);

    try {
      const fileName = `${Date.now()}.jpg`;
      const filePath = `${userId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("stories")
        .upload(filePath, capturedBlob, { contentType: "image/jpeg" });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from("stories")
        .getPublicUrl(filePath);

      const mediaUrl = publicUrlData.publicUrl;

      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      const { error: insertError } = await supabase.from("stories").insert({
        user_id: userId,
        media_url: mediaUrl,
        media_type: "image",
        expires_at: expiresAt,
      });

      if (insertError) throw insertError;

      onStoryCreated();
      onClose();
    } catch (err: any) {
      console.error("Error sharing story:", err);
      setError(err.message || "Failed to share story. Please try again.");
    } finally {
      setUploading(false);
    }
  }, [capturedBlob, userId, onStoryCreated, onClose]);

  // Handle close — stop stream
  const handleClose = useCallback(() => {
    stopStream();
    onClose();
  }, [stopStream, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] bg-black/95 flex items-center justify-center">
      {/* Hidden canvas for frame capture */}
      <canvas ref={canvasRef} className="hidden" />

      <div className="relative w-full h-full max-w-[480px] max-h-[100dvh] mx-auto flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3 shrink-0">
          <h2 className="text-white font-heading font-semibold text-lg">
            Create Story
          </h2>
          <button
            onClick={handleClose}
            className="p-2 text-white/70 hover:text-white transition-colors rounded-full hover:bg-white/10"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs — only visible during live preview (not after capture) */}
        {!capturedBlob && (
          <div className="px-4 pb-3 shrink-0">
            <div className="flex items-center gap-1 bg-white/10 p-1 rounded-xl">
              {[
                { id: "camera" as CaptureTab, label: "Camera", icon: Camera },
                { id: "screen" as CaptureTab, label: "Screen", icon: Monitor },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      if (activeTab !== tab.id) {
                        setActiveTab(tab.id);
                        setError(null);
                      }
                    }}
                    disabled={streamLoading}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-white/60 hover:text-white/80"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Error display */}
        {error && (
          <div className="mx-4 mb-3 px-4 py-3 bg-red-500/20 border border-red-500/30 rounded-xl flex items-start gap-3 shrink-0">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-300 leading-relaxed">{error}</p>
          </div>
        )}

        {/* Main content area */}
        <div className="flex-1 flex items-center justify-center px-4 overflow-hidden">
          {capturedPreview ? (
            /* Captured image preview */
            <div className="w-full aspect-[9/16] max-h-full rounded-2xl overflow-hidden bg-gray-900 relative">
              <img
                src={capturedPreview}
                alt="Captured"
                className="w-full h-full object-contain"
              />
            </div>
          ) : (
            /* Live video preview */
            <div className="w-full aspect-[9/16] max-h-full rounded-2xl overflow-hidden bg-gray-900 relative flex items-center justify-center">
              {streamLoading ? (
                <div className="flex flex-col items-center gap-4">
                  <div className="w-10 h-10 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                  <p className="text-white/50 text-sm font-medium">
                    {activeTab === "camera" ? "Starting camera..." : "Starting screen share..."}
                  </p>
                </div>
              ) : !stream && !error ? (
                <div className="flex flex-col items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center">
                    {activeTab === "camera" ? (
                      <Camera className="w-8 h-8 text-white/40" />
                    ) : (
                      <Monitor className="w-8 h-8 text-white/40" />
                    )}
                  </div>
                  <p className="text-white/40 text-sm">
                    {activeTab === "camera"
                      ? "Allow camera access to get started"
                      : "Select a screen to share"}
                  </p>
                </div>
              ) : (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-contain ${
                    activeTab === "camera" ? "scale-x-[-1]" : ""
                  }`}
                />
              )}
            </div>
          )}
        </div>

        {/* Bottom actions */}
        <div className="px-4 py-6 shrink-0">
          {capturedPreview ? (
            /* Post-capture actions */
            <div className="flex items-center gap-4">
              <button
                onClick={handleRetake}
                disabled={uploading}
                className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-white/10 text-white font-medium rounded-xl text-sm hover:bg-white/15 transition-colors disabled:opacity-50"
              >
                <RotateCcw className="w-4 h-4" />
                Retake
              </button>
              <button
                onClick={handleShare}
                disabled={uploading}
                className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-accent text-white font-medium rounded-xl text-sm hover:bg-accent/90 transition-colors disabled:opacity-50"
              >
                {uploading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Sharing...
                  </>
                ) : (
                  <>
                    <Share2 className="w-4 h-4" />
                    Share to Story
                  </>
                )}
              </button>
            </div>
          ) : (
            /* Capture button */
            <div className="flex justify-center">
              <button
                onClick={handleCapture}
                disabled={!stream || streamLoading}
                className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed group"
                aria-label="Capture"
              >
                <div className="w-16 h-16 rounded-full bg-white group-hover:bg-white/90 transition-colors" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
