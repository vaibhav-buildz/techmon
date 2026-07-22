"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  X,
  Camera,
  Upload,
  RotateCcw,
  Send,
  AlertCircle,
  Type,
  Pencil,
  Trash2,
  Undo,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Move,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onStoryCreated: () => void;
};

type CaptureTab = "camera" | "upload";
type ToolMode = "none" | "draw";
type FontStyle = "classic" | "bold" | "modern" | "typewriter";

type TextOverlay = {
  id: string;
  text: string;
  color: string;
  fontStyle: FontStyle;
  x: number; // percentage (0..100)
  y: number; // percentage (0..100)
};

const COLOR_SWATCHES = [
  "#FFFFFF",
  "#000000",
  "#EF4444",
  "#F59E0B",
  "#10B981",
  "#3B82F6",
  "#EC4899",
  "#8B5CF6",
];

const FONT_STYLES: { id: FontStyle; label: string; class: string }[] = [
  { id: "classic", label: "Classic", class: "font-sans font-medium" },
  { id: "bold", label: "Bold", class: "font-heading font-black uppercase tracking-wider" },
  { id: "modern", label: "Modern", class: "font-sans font-extrabold tracking-tight" },
  { id: "typewriter", label: "Typewriter", class: "font-mono font-semibold" },
];

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
  const [mediaType, setMediaType] = useState<"image" | "video">("image");
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [streamLoading, setStreamLoading] = useState(false);

  // Editor Tools State
  const [activeTool, setActiveTool] = useState<ToolMode>("none");
  const [selectedColor, setSelectedColor] = useState<string>("#FFFFFF");
  const [selectedFontStyle, setSelectedFontStyle] = useState<FontStyle>("classic");
  const [penWidth, setPenWidth] = useState<number>(6);

  // Base Image Pan & Zoom State
  const [imageScale, setImageScale] = useState<number>(1);
  const [imagePan, setImagePan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Overlays State
  const [textOverlays, setTextOverlays] = useState<TextOverlay[]>([]);
  const [activeTextId, setActiveTextId] = useState<string | null>(null);

  // Dragging State for Text
  const [dragItem, setDragItem] = useState<{
    id: string;
    startX: number;
    startY: number;
    initialX: number;
    initialY: number;
  } | null>(null);

  // Base Image Panning Ref
  const isImagePanningRef = useRef(false);
  const imagePanStartRef = useRef<{
    startX: number;
    startY: number;
    initialPanX: number;
    initialPanY: number;
  }>({ startX: 0, startY: 0, initialPanX: 0, initialPanY: 0 });
  const touchDistanceRef = useRef<number | null>(null);
  const touchInitialScaleRef = useRef<number>(1);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isDrawingRef = useRef(false);

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

  // Start/stop streams based on active tab and open state
  useEffect(() => {
    if (!isOpen || capturedBlob) return;

    if (activeTab === "camera") {
      startCamera();
    } else {
      stopStream();
    }
  }, [activeTab, isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Attach stream to video element AFTER React renders it
  useEffect(() => {
    if (!stream) return;

    const video = videoRef.current;
    if (!video) return;

    video.srcObject = stream;
    video.play().catch((err) => {
      console.warn("[CameraCaptureModal] video.play() rejected:", err);
    });
  }, [stream]);

  // Cleanup editor state on close/reset
  const resetEditorState = useCallback(() => {
    setTextOverlays([]);
    setActiveTextId(null);
    setActiveTool("none");
    setSelectedColor("#FFFFFF");
    setSelectedFontStyle("classic");
    setPenWidth(6);
    setImageScale(1);
    setImagePan({ x: 0, y: 0 });

    if (drawCanvasRef.current) {
      const ctx = drawCanvasRef.current.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, drawCanvasRef.current.width, drawCanvasRef.current.height);
      }
    }
  }, []);

  // Cleanup on close
  useEffect(() => {
    if (!isOpen) {
      stopStream();
      setCapturedBlob(null);
      if (capturedPreview) {
        URL.revokeObjectURL(capturedPreview);
      }
      setCapturedPreview(null);
      setMediaType("image");
      setError(null);
      setUploading(false);
      setActiveTab("camera");
      resetEditorState();
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

  // Sync drawing canvas dimensions when preview container is mounted
  useEffect(() => {
    if (capturedPreview && drawCanvasRef.current && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      drawCanvasRef.current.width = rect.width;
      drawCanvasRef.current.height = rect.height;
    }
  }, [capturedPreview]);

  // Capture the current camera frame
  const handleCapture = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !stream) return;

    if (video.videoWidth === 0 || video.videoHeight === 0) {
      setError("Video not ready yet. Please wait a moment and try again.");
      setTimeout(() => setError(null), 3000);
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Mirror the canvas draw to match live video preview transform (scaleX(-1))
    ctx.save();
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.restore();

    canvas.toBlob(
      (blob) => {
        if (blob) {
          setCapturedBlob(blob);
          setCapturedPreview(URL.createObjectURL(blob));
          setMediaType("image");
          stopStream();
        }
      },
      "image/jpeg",
      0.92
    );
  }, [stream, stopStream]);

  // Handle file selection in Upload tab
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      const isVideo = selectedFile.type.startsWith("video/");

      setCapturedBlob(selectedFile);
      setCapturedPreview(URL.createObjectURL(selectedFile));
      setMediaType(isVideo ? "video" : "image");
      stopStream();
    }
  };

  // Retake / Clear selection — go back to live view or upload picker
  const handleRetake = useCallback(() => {
    setCapturedBlob(null);
    if (capturedPreview) {
      URL.revokeObjectURL(capturedPreview);
    }
    setCapturedPreview(null);
    setMediaType("image");
    setError(null);
    resetEditorState();

    if (activeTab === "camera") {
      startCamera();
    }
  }, [activeTab, capturedPreview, startCamera, resetEditorState]);

  // --- BASE MEDIA PAN & ZOOM HANDLERS ---
  const handleWheel = (e: React.WheelEvent) => {
    if (activeTool === "draw") return;
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    setImageScale((prev) => {
      const next = Math.max(1, Math.min(3.5, prev * zoomFactor));
      if (next === 1) {
        setImagePan({ x: 0, y: 0 });
      }
      return next;
    });
  };

  const handleMediaPointerDown = (e: React.PointerEvent) => {
    if (activeTool === "draw" || dragItem) return;
    isImagePanningRef.current = true;
    imagePanStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialPanX: imagePan.x,
      initialPanY: imagePan.y,
    };
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (activeTool === "draw" || dragItem) return;
    if (e.touches.length === 2) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      touchDistanceRef.current = dist;
      touchInitialScaleRef.current = imageScale;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (activeTool === "draw" || dragItem) return;
    if (e.touches.length === 2 && touchDistanceRef.current !== null) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      const ratio = dist / touchDistanceRef.current;
      const nextScale = Math.max(1, Math.min(3.5, touchInitialScaleRef.current * ratio));
      setImageScale(nextScale);
      if (nextScale === 1) {
        setImagePan({ x: 0, y: 0 });
      }
    }
  };

  const handleTouchEnd = () => {
    touchDistanceRef.current = null;
  };

  // --- DRAWING CANVAS HANDLERS ---
  const handleDrawStart = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activeTool !== "draw") return;
    isDrawingRef.current = true;
    const canvas = drawCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.strokeStyle = selectedColor;
    ctx.lineWidth = penWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const handleDrawMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || activeTool !== "draw") return;
    const canvas = drawCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const handleDrawEnd = () => {
    isDrawingRef.current = false;
  };

  const clearDrawing = () => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  // --- TEXT OVERLAY HANDLERS ---
  const addTextOverlay = () => {
    const newText: TextOverlay = {
      id: Date.now().toString(),
      text: "",
      color: selectedColor,
      fontStyle: selectedFontStyle,
      x: 50,
      y: 50,
    };
    setTextOverlays((prev) => [...prev, newText]);
    setActiveTextId(newText.id);
  };

  const updateTextOverlay = (id: string, updates: Partial<TextOverlay>) => {
    setTextOverlays((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
    );
  };

  const removeTextOverlay = (id: string) => {
    setTextOverlays((prev) => prev.filter((t) => t.id !== id));
    if (activeTextId === id) setActiveTextId(null);
  };

  // --- DRAGGING OVERLAYS & PANNING ---
  const startDrag = (id: string, e: React.PointerEvent) => {
    e.stopPropagation();
    setActiveTextId(id);
    const item = textOverlays.find((t) => t.id === id);
    if (!item) return;

    setSelectedColor(item.color);
    setSelectedFontStyle(item.fontStyle || "classic");

    setDragItem({
      id,
      startX: e.clientX,
      startY: e.clientY,
      initialX: item.x,
      initialY: item.y,
    });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    // 1. Text Overlay Dragging
    if (dragItem && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const deltaXPercent = ((e.clientX - dragItem.startX) / rect.width) * 100;
      const deltaYPercent = ((e.clientY - dragItem.startY) / rect.height) * 100;

      const newX = Math.max(5, Math.min(95, dragItem.initialX + deltaXPercent));
      const newY = Math.max(5, Math.min(95, dragItem.initialY + deltaYPercent));

      updateTextOverlay(dragItem.id, { x: newX, y: newY });
      return;
    }

    // 2. Base Image Panning
    if (isImagePanningRef.current) {
      const dx = e.clientX - imagePanStartRef.current.startX;
      const dy = e.clientY - imagePanStartRef.current.startY;
      setImagePan({
        x: imagePanStartRef.current.initialPanX + dx,
        y: imagePanStartRef.current.initialPanY + dy,
      });
    }
  };

  const onPointerUp = () => {
    setDragItem(null);
    isImagePanningRef.current = false;
  };

  // --- COMPOSITE & SHARE STORY ---
  const handleShare = useCallback(async () => {
    if (!capturedBlob || !capturedPreview) return;

    setUploading(true);
    setError(null);

    try {
      let finalBlob: Blob = capturedBlob;

      // If mediaType === "image", composite drawing, text, and base image pan/zoom onto final image canvas
      if (mediaType === "image") {
        const compositeCanvas = document.createElement("canvas");
        const ctx = compositeCanvas.getContext("2d");

        if (ctx && containerRef.current) {
          const img = new Image();
          img.src = capturedPreview;

          await new Promise((resolve) => {
            img.onload = resolve;
          });

          // Set high resolution canvas dimensions (1080 x 1920 9:16 ratio)
          const targetW = 1080;
          const targetH = 1920;
          compositeCanvas.width = targetW;
          compositeCanvas.height = targetH;

          // Fill black background for clean letterboxing
          ctx.fillStyle = "#000000";
          ctx.fillRect(0, 0, targetW, targetH);

          // Calculate base aspect ratio render size
          const imgAspect = img.width / img.height;
          const targetAspect = targetW / targetH;
          let renderW = targetW;
          let renderH = targetH;

          if (imgAspect > targetAspect) {
            renderH = targetW / imgAspect;
          } else {
            renderW = targetH * imgAspect;
          }

          // Scale pan offsets from screen container dimensions to 1080x1920 canvas resolution
          const containerRect = containerRef.current.getBoundingClientRect();
          const scaleX = targetW / containerRect.width;
          const scaleY = targetH / containerRect.height;

          const canvasPanX = imagePan.x * scaleX;
          const canvasPanY = imagePan.y * scaleY;

          // 1. Draw base image with exact pan & zoom transform
          ctx.save();
          ctx.translate(targetW / 2 + canvasPanX, targetH / 2 + canvasPanY);
          ctx.scale(imageScale, imageScale);
          ctx.drawImage(img, -renderW / 2, -renderH / 2, renderW, renderH);
          ctx.restore();

          // 2. Draw freehand drawing layer
          if (drawCanvasRef.current) {
            ctx.drawImage(drawCanvasRef.current, 0, 0, targetW, targetH);
          }

          // 3. Draw text overlays with exact font styling
          textOverlays.forEach((t) => {
            if (!t.text.trim()) return;
            const px = (t.x / 100) * targetW;
            const py = (t.y / 100) * targetH;

            ctx.save();
            ctx.fillStyle = t.color;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";

            // Font style canvas mapping
            switch (t.fontStyle) {
              case "bold":
                ctx.font = "900 56px system-ui, sans-serif";
                break;
              case "modern":
                ctx.font = "900 52px system-ui, sans-serif";
                break;
              case "typewriter":
                ctx.font = "600 46px monospace";
                break;
              case "classic":
              default:
                ctx.font = "500 52px system-ui, sans-serif";
                break;
            }

            // Subtle text shadow for legibility
            ctx.shadowColor = "rgba(0,0,0,0.6)";
            ctx.shadowBlur = 8;
            ctx.fillText(t.text, px, py);
            ctx.restore();
          });

          // Export final composite blob
          const blob = await new Promise<Blob | null>((resolve) => {
            compositeCanvas.toBlob(resolve, "image/jpeg", 0.95);
          });

          if (blob) {
            finalBlob = blob;
          }
        }
      }

      const fileExt = mediaType === "video" ? "mp4" : "jpg";
      const contentType =
        finalBlob.type || (mediaType === "video" ? "video/mp4" : "image/jpeg");
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${userId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("stories")
        .upload(filePath, finalBlob, { contentType });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from("stories")
        .getPublicUrl(filePath);

      const mediaUrl = publicUrlData.publicUrl;
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      const { error: insertError } = await supabase.from("stories").insert({
        user_id: userId,
        media_url: mediaUrl,
        media_type: mediaType,
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
  }, [
    capturedBlob,
    capturedPreview,
    mediaType,
    textOverlays,
    imageScale,
    imagePan,
    userId,
    onStoryCreated,
    onClose,
  ]);

  // Handle close — stop stream
  const handleClose = useCallback(() => {
    stopStream();
    onClose();
  }, [stopStream, onClose]);

  if (!isOpen) return null;

  const activeText = textOverlays.find((t) => t.id === activeTextId);

  return (
    <div className="fixed inset-0 z-[70] bg-black flex items-center justify-center">
      {/* Hidden canvas for frame capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {capturedPreview ? (
        /* ================= INSTAGRAM-STYLE STORY EDITOR ================= */
        <div
          ref={containerRef}
          onWheel={handleWheel}
          onPointerDown={handleMediaPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onClick={() => {
            setActiveTextId(null);
          }}
          className="relative w-full h-full max-w-[480px] max-h-[100dvh] mx-auto flex flex-col justify-center items-center bg-black overflow-hidden sm:rounded-2xl select-none touch-none"
        >
          {/* Base Image/Video with Pan & Zoom CSS transform */}
          {mediaType === "video" ? (
            <video
              src={capturedPreview}
              autoPlay
              loop
              playsInline
              style={{
                transform: `translate(${imagePan.x}px, ${imagePan.y}px) scale(${imageScale})`,
                transition: isImagePanningRef.current ? "none" : "transform 0.1s ease-out",
              }}
              className="w-full h-full object-contain bg-black pointer-events-none"
            />
          ) : (
            <img
              src={capturedPreview}
              alt="Story Preview"
              style={{
                transform: `translate(${imagePan.x}px, ${imagePan.y}px) scale(${imageScale})`,
                transition: isImagePanningRef.current ? "none" : "transform 0.1s ease-out",
              }}
              className="w-full h-full object-contain bg-black pointer-events-none"
            />
          )}

          {/* Freehand Drawing Canvas Layer */}
          <canvas
            ref={drawCanvasRef}
            onPointerDown={handleDrawStart}
            onPointerMove={handleDrawMove}
            onPointerUp={handleDrawEnd}
            className={`absolute inset-0 z-10 ${
              activeTool === "draw" ? "cursor-crosshair pointer-events-auto" : "pointer-events-none"
            }`}
          />

          {/* Render Text Overlays */}
          {textOverlays.map((t) => {
            const isSelected = activeTextId === t.id;
            const fontClass = FONT_STYLES.find((f) => f.id === t.fontStyle)?.class || "font-sans font-medium";

            return (
              <div
                key={t.id}
                style={{
                  left: `${t.x}%`,
                  top: `${t.y}%`,
                  transform: "translate(-50%, -50%)",
                  color: t.color,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveTextId(t.id);
                  setSelectedColor(t.color);
                  setSelectedFontStyle(t.fontStyle || "classic");
                }}
                className={`absolute z-20 pointer-events-auto px-3 py-1.5 rounded-xl transition-all ${
                  isSelected ? "ring-2 ring-white/60 bg-black/50 backdrop-blur-sm" : "cursor-pointer hover:bg-black/20"
                }`}
              >
                {isSelected ? (
                  <input
                    type="text"
                    value={t.text}
                    autoFocus
                    onChange={(e) => updateTextOverlay(t.id, { text: e.target.value })}
                    onPointerDown={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    style={{ color: t.color }}
                    className={`bg-transparent text-center text-xl md:text-2xl focus:outline-none placeholder-white/50 min-w-[140px] max-w-[280px] ${fontClass}`}
                    placeholder="Type text..."
                  />
                ) : (
                  <span className={`text-xl md:text-2xl drop-shadow-md whitespace-nowrap ${fontClass}`}>
                    {t.text || "Type text..."}
                  </span>
                )}

                {/* Drag Move Handle & Delete Button for selected text */}
                {isSelected && (
                  <>
                    <div
                      onPointerDown={(e) => startDrag(t.id, e)}
                      className="absolute -top-3.5 left-1/2 -translate-x-1/2 cursor-grab active:cursor-grabbing bg-black/80 backdrop-blur-md text-white px-2.5 py-0.5 rounded-full text-[11px] flex items-center gap-1 border border-white/20 shadow-lg select-none hover:bg-black"
                      title="Drag to reposition"
                    >
                      <Move className="w-3 h-3" />
                      <span className="font-medium">Drag</span>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeTextOverlay(t.id);
                      }}
                      className="absolute -top-3 -right-3 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white shadow-md hover:bg-red-600"
                      title="Delete text"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            );
          })}

          {/* Error overlay if any */}
          {error && (
            <div className="absolute top-16 inset-x-4 z-30 px-4 py-3 bg-red-500/80 backdrop-blur-md rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-white shrink-0 mt-0.5" />
              <p className="text-sm text-white font-medium">{error}</p>
            </div>
          )}

          {/* Top Header Bar (Close + Toolbar + Retake) */}
          <div
            className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between p-4 bg-gradient-to-b from-black/70 via-black/30 to-transparent"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Exit Button */}
            <button
              onClick={handleClose}
              disabled={uploading}
              className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md text-white hover:bg-black/60 flex items-center justify-center transition-all border border-white/10 shadow-lg active:scale-95"
              aria-label="Exit"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Central Editor Toolbar (Text & Draw only) */}
            <div className="flex items-center gap-2 bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
              {/* Text Tool */}
              <button
                onClick={addTextOverlay}
                className="p-2 rounded-full text-white/80 hover:text-white hover:bg-white/20 transition-colors"
                title="Add Text"
              >
                <Type className="w-5 h-5" />
              </button>

              {/* Draw Tool */}
              <button
                onClick={() => setActiveTool(activeTool === "draw" ? "none" : "draw")}
                className={`p-2 rounded-full transition-colors ${
                  activeTool === "draw"
                    ? "bg-white text-gray-900 font-bold"
                    : "text-white/80 hover:text-white hover:bg-white/20"
                }`}
                title="Draw"
              >
                <Pencil className="w-5 h-5" />
              </button>
            </div>

            {/* Retake Button */}
            <button
              onClick={handleRetake}
              disabled={uploading}
              className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md text-white hover:bg-black/60 flex items-center justify-center transition-all border border-white/10 shadow-lg active:scale-95"
              aria-label="Retake"
              title={activeTab === "camera" ? "Retake photo" : "Choose another file"}
            >
              <RotateCcw className="w-5 h-5" />
            </button>
          </div>

          {/* Color, Font Style & Pen Width Toolbar */}
          {(activeTool === "draw" || activeTextId !== null) && (
            <div
              className="absolute top-16 z-30 flex flex-col items-center gap-2.5 bg-black/75 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/10 shadow-xl max-w-[90%]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Font Style Tabs (shown when editing Text) */}
              {activeTextId !== null && (
                <div className="flex items-center gap-1.5 bg-white/10 p-1 rounded-xl">
                  {FONT_STYLES.map((style) => (
                    <button
                      key={style.id}
                      onClick={() => {
                        setSelectedFontStyle(style.id);
                        if (activeTextId) {
                          updateTextOverlay(activeTextId, { fontStyle: style.id });
                        }
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                        (activeText?.fontStyle || selectedFontStyle) === style.id
                          ? "bg-white text-gray-900 shadow-sm"
                          : "text-white/70 hover:text-white hover:bg-white/10"
                      }`}
                    >
                      {style.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Color Swatches & Pen controls */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  {COLOR_SWATCHES.map((color) => (
                    <button
                      key={color}
                      onClick={() => {
                        setSelectedColor(color);
                        if (activeTextId) {
                          updateTextOverlay(activeTextId, { color });
                        }
                      }}
                      className={`w-6 h-6 rounded-full border border-white/40 transition-transform ${
                        selectedColor === color ? "scale-125 ring-2 ring-white" : ""
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>

                {/* Pen options if drawing */}
                {activeTool === "draw" && (
                  <div className="flex items-center gap-2 pl-2 border-l border-white/20">
                    {[4, 8, 16].map((w) => (
                      <button
                        key={w}
                        onClick={() => setPenWidth(w)}
                        className={`rounded-full bg-white transition-all ${
                          penWidth === w ? "ring-2 ring-accent scale-110" : "opacity-60"
                        }`}
                        style={{ width: `${w + 4}px`, height: `${w + 4}px` }}
                      />
                    ))}
                    <button
                      onClick={clearDrawing}
                      className="p-1.5 text-white/70 hover:text-red-400 transition-colors ml-1"
                      title="Clear drawing"
                    >
                      <Undo className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Floating Zoom Controls & Reset Pill (bottom-left) */}
          {(imageScale > 1 || imagePan.x !== 0 || imagePan.y !== 0) && (
            <div
              className="absolute bottom-6 left-6 z-30 flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/15 text-white text-xs font-semibold shadow-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() =>
                  setImageScale((prev) => {
                    const next = Math.max(1, prev - 0.25);
                    if (next === 1) setImagePan({ x: 0, y: 0 });
                    return next;
                  })
                }
                className="hover:text-white/80 transition-colors"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>

              <span>{imageScale.toFixed(1)}x</span>

              <button
                onClick={() =>
                  setImageScale((prev) => Math.min(3.5, prev + 0.25))
                }
                className="hover:text-white/80 transition-colors"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => {
                  setImageScale(1);
                  setImagePan({ x: 0, y: 0 });
                }}
                className="ml-1 text-[11px] text-accent hover:underline flex items-center gap-1 font-medium"
                title="Reset Pan & Zoom"
              >
                <Maximize2 className="w-3 h-3" /> Reset
              </button>
            </div>
          )}

          {/* Bottom Right Floating Share Button */}
          <div className="absolute bottom-6 right-6 z-30">
            <button
              onClick={handleShare}
              disabled={uploading}
              className="w-14 h-14 rounded-full bg-accent text-white shadow-2xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
              aria-label="Share to Story"
              title="Share to Story"
            >
              {uploading ? (
                <div className="w-6 h-6 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                <Send className="w-6 h-6 ml-0.5 text-white" />
              )}
            </button>
          </div>
        </div>
      ) : (
        /* ================= CAMERA / UPLOAD CAPTURE MODE ================= */
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

          {/* Tabs */}
          <div className="px-4 pb-3 shrink-0">
            <div className="flex items-center gap-1 bg-white/10 p-1 rounded-xl">
              {[
                { id: "camera" as CaptureTab, label: "Camera", icon: Camera },
                { id: "upload" as CaptureTab, label: "Upload", icon: Upload },
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

          {/* Error display */}
          {error && (
            <div className="mx-4 mb-3 px-4 py-3 bg-red-500/20 border border-red-500/30 rounded-xl flex items-start gap-3 shrink-0">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-red-300 leading-relaxed">{error}</p>
            </div>
          )}

          {/* Main content area */}
          <div className="flex-1 flex items-center justify-center px-4 overflow-hidden">
            {activeTab === "upload" ? (
              /* Upload file picker area */
              <div
                onClick={() => fileInputRef.current?.click()}
                className="w-full aspect-[9/16] max-h-full rounded-2xl border-2 border-dashed border-white/20 hover:border-white/40 bg-white/5 flex flex-col items-center justify-center p-6 cursor-pointer transition-colors"
              >
                <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mb-4">
                  <Upload className="w-8 h-8 text-white/70" />
                </div>
                <p className="text-white font-medium text-base text-center">
                  Select Photo or Video
                </p>
                <p className="text-white/40 text-xs mt-1 text-center">
                  Click to browse your device files
                </p>
              </div>
            ) : (
              /* Live camera preview */
              <div className="w-full aspect-[9/16] max-h-full rounded-2xl overflow-hidden bg-gray-900 relative flex items-center justify-center">
                {streamLoading && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
                    <div className="w-10 h-10 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                    <p className="text-white/50 text-sm font-medium mt-4">
                      Starting camera...
                    </p>
                  </div>
                )}
                {!streamLoading && !stream && !error && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
                    <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center">
                      <Camera className="w-8 h-8 text-white/40" />
                    </div>
                    <p className="text-white/40 text-sm mt-4">
                      Allow camera access to get started
                    </p>
                  </div>
                )}
                {/* Video element for live camera stream */}
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{ display: stream ? "block" : "none", width: "100%", height: "100%" }}
                  className="object-contain scale-x-[-1]"
                />
              </div>
            )}
          </div>

          {/* Bottom actions */}
          <div className="px-4 py-6 shrink-0">
            {activeTab === "camera" ? (
              /* Capture button for live camera */
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
            ) : (
              /* Browse button for Upload tab */
              <div className="flex justify-center">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-6 py-3.5 bg-white text-gray-900 font-semibold rounded-xl text-sm hover:bg-white/90 transition-colors shadow-lg"
                >
                  <Upload className="w-4 h-4" />
                  Browse Device Files
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
