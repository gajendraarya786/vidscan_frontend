"use client";

import { useState, useRef, useEffect } from "react";

interface CameraRecorderModalProps {
  onClose: () => void;
  onRecordComplete: (file: File) => void;
}

export default function CameraRecorderModal({ onClose, onRecordComplete }: CameraRecorderModalProps) {
  const videoPreviewRef = useRef<HTMLVideoElement>(null);

  const [recState, setRecState] = useState<"idle" | "requesting" | "recording" | "stopped">("requesting");
  const [recSecs, setRecSecs] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");

  const streamRef = useRef<MediaStream | null>(null);
  const mrRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const openCamera = async () => {
    setRecState("requesting");
    setErrorMsg("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false,
      });
      streamRef.current = stream;
      
      setTimeout(() => {
        if (videoPreviewRef.current) {
          videoPreviewRef.current.srcObject = stream;
          videoPreviewRef.current.muted = true;
          videoPreviewRef.current.play().catch((err) => {
            console.error("Video play failed:", err);
          });
        }
      }, 100);

      setRecState("idle");
    } catch (err) {
      console.error("Failed to open high-res camera, trying fallback:", err);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false,
        });
        streamRef.current = stream;
        
        setTimeout(() => {
          if (videoPreviewRef.current) {
            videoPreviewRef.current.srcObject = stream;
            videoPreviewRef.current.muted = true;
            videoPreviewRef.current.play().catch((e) => {
              console.error("Video play failed:", e);
            });
          }
        }, 100);

        setRecState("idle");
      } catch {
        setErrorMsg("Camera access denied or unavailable. Please check permissions.");
        setRecState("idle");
      }
    }
  };

  useEffect(() => {
    openCamera();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const startRec = () => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    const mime = ["video/webm;codecs=vp9", "video/webm", "video/mp4"].find(
      (m) => MediaRecorder.isTypeSupported(m)
    ) ?? "video/webm";
    const mr = new MediaRecorder(streamRef.current, { mimeType: mime });
    mrRef.current = mr;
    mr.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    mr.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mime });
      const ext = mime.includes("mp4") ? "mp4" : "webm";
      const file = new File([blob], `recording.${ext}`, { type: mime });
      
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (videoPreviewRef.current) videoPreviewRef.current.srcObject = null;

      onRecordComplete(file);
    };
    mr.start(250);
    setRecState("recording");
    setRecSecs(0);
    timerRef.current = setInterval(() => setRecSecs((s) => s + 1), 1000);
  };

  const stopRec = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    mrRef.current?.stop();
    setRecState("stopped");
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 md:backdrop-blur-sm p-0 md:p-4 animate-in fade-in duration-200">
      <div className="relative w-full h-full md:h-auto md:max-w-lg md:rounded-3xl bg-black md:bg-slate-900 md:border md:border-slate-800 text-white shadow-2xl overflow-hidden flex flex-col justify-between">
        
        {/* Modal Header */}
        <div className="absolute md:relative top-0 left-0 right-0 z-10 flex items-center justify-between px-6 py-4 bg-gradient-to-b from-black/80 to-transparent md:bg-slate-900 md:border-b md:border-slate-800/80">
          <span className="font-bold text-sm tracking-tight flex items-center gap-1.5 text-pink-400">
            📷 Live Document Capture
          </span>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Video Preview viewport */}
        <div className="relative flex-1 md:flex-none w-full h-full md:h-auto md:aspect-video bg-black flex items-center justify-center overflow-hidden">
          <video
            ref={videoPreviewRef}
            playsInline
            className="w-full h-full object-cover"
          />
          
          {recState === "requesting" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950 z-20">
              <div className="w-8 h-8 rounded-full border-4 border-pink-500 border-t-transparent animate-spin" />
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Requesting Camera Access…</p>
            </div>
          )}

          {recState === "recording" && (
            <div className="absolute top-20 md:top-4 left-4 flex items-center gap-1.5 rounded-full bg-red-600 px-3.5 py-1.5 text-[11px] font-bold text-white shadow-lg animate-pulse z-20">
              <span className="h-1.5 w-1.5 rounded-full bg-white" />
              REC {`${String(Math.floor(recSecs / 60)).padStart(2, "0")}:${String(recSecs % 60).padStart(2, "0")}`}
            </div>
          )}
        </div>

        {/* Error Message */}
        {errorMsg && (
          <div className="absolute md:relative bottom-28 md:bottom-auto left-4 right-4 md:left-auto md:right-auto z-20 bg-red-950/90 md:bg-red-950/80 border border-red-900/50 rounded-xl px-4 py-3 text-xs text-red-300 font-medium flex gap-2 shadow-2xl">
            <span>⚠️</span>
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Control Buttons */}
        <div className="absolute md:relative bottom-0 left-0 right-0 z-10 p-8 md:p-6 bg-gradient-to-t from-black/90 via-black/55 to-transparent md:bg-slate-900 md:from-transparent md:to-transparent flex justify-center items-center gap-4">
          {recState === "idle" && (
            <button
              onClick={startRec}
              className="w-20 h-20 md:w-auto md:h-auto rounded-full md:rounded-2xl bg-red-600 hover:bg-red-500 text-white flex flex-col md:flex-row items-center justify-center gap-2 px-0 md:px-8 py-0 md:py-3.5 text-xs md:text-sm font-extrabold shadow-lg shadow-red-600/20 active:scale-95 transition-all border-4 border-white/20 md:border-0"
            >
              <span className="h-3 w-3 md:h-2.5 md:w-2.5 rounded-full bg-white" />
              <span className="md:inline hidden">Start Recording</span>
            </button>
          )}

          {recState === "recording" && (
            <button
              onClick={stopRec}
              className="w-20 h-20 md:w-auto md:h-auto rounded-full md:rounded-2xl border-4 border-red-500/80 md:border-2 bg-red-950/80 md:bg-red-950/20 hover:bg-red-900/20 text-red-200 flex flex-col md:flex-row items-center justify-center gap-2 px-0 md:px-8 py-0 md:py-3 text-xs md:text-sm font-extrabold active:scale-95 transition-all"
            >
              <span className="h-3 w-3 md:h-2.5 md:w-2.5 rounded-sm bg-red-500" />
              <span className="md:inline hidden">Stop & Process</span>
            </button>
          )}

          {recState === "stopped" && (
            <div className="flex items-center gap-3 bg-slate-900/85 backdrop-blur-md px-4 py-2.5 rounded-full border border-slate-800">
              <div className="w-4 h-4 rounded-full border-2 border-pink-500 border-t-transparent animate-spin" />
              <p className="text-[10px] text-slate-355 font-bold uppercase tracking-wider">Preparing Video Notes…</p>
            </div>
          )}
        </div>
        
      </div>
    </div>
  );
}
