'use client';

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Camera, X, RotateCcw, Check, AlertCircle, CameraOff } from 'lucide-react';

interface CameraCaptureProps {
  onCapture: (file: File) => void;
  onClose: () => void;
}

type CameraState = 'idle' | 'requesting' | 'active' | 'captured' | 'denied' | 'unavailable' | 'error';

export default function CameraCapture({ onCapture, onClose }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraState, setCameraState] = useState<CameraState>('idle');
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  // Stop stream on unmount
  useEffect(() => {
    return () => {
      stopStream();
    };
  }, [stopStream]);

  // Attach stream to video element AFTER it mounts (cameraState === 'active')
  useEffect(() => {
    if (cameraState !== 'active') return;
    const video = videoRef.current;
    if (!video || !streamRef.current) return;

    video.srcObject = streamRef.current;

    const handleLoadedMetadata = () => {
      video.play().catch(() => {
        // play() rejection is non-fatal; autoPlay attribute handles most cases
      });
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);

    // If metadata already loaded (stream was fast), play immediately
    if (video.readyState >= 1) {
      video.play().catch(() => {});
    }

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, [cameraState]);

  const startCamera = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setCameraState('unavailable');
      return;
    }

    setCameraState('requesting');
    setErrorMessage('');

    const tryGetStream = async (facingMode?: string): Promise<MediaStream> => {
      const constraints: MediaStreamConstraints = {
        video: facingMode
          ? { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } }
          : { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      };
      return navigator.mediaDevices.getUserMedia(constraints);
    };

    try {
      let stream: MediaStream;
      try {
        // Prefer rear/environment camera on mobile
        stream = await tryGetStream('environment');
      } catch {
        // Fall back to default camera (works on desktop and front-camera-only devices)
        stream = await tryGetStream(undefined);
      }

      streamRef.current = stream;
      // Set state to 'active' — the useEffect above will attach the stream
      // to the video element once it renders
      setCameraState('active');
    } catch (err: unknown) {
      stopStream();
      const error = err as { name?: string; message?: string };
      if (error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError') {
        setCameraState('denied');
      } else if (
        error?.name === 'NotFoundError' ||
        error?.name === 'DevicesNotFoundError'
      ) {
        setCameraState('unavailable');
      } else if (error?.name === 'NotReadableError' || error?.name === 'AbortError') {
        setErrorMessage('Camera is already in use by another application.');
        setCameraState('error');
      } else {
        setErrorMessage(error?.message || 'An unexpected error occurred.');
        setCameraState('error');
      }
    }
  }, [stopStream]);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        setCapturedUrl(url);
        setCapturedBlob(blob);
        stopStream();
        setCameraState('captured');
      },
      'image/jpeg',
      0.92
    );
  }, [stopStream]);

  const retake = useCallback(() => {
    if (capturedUrl) URL.revokeObjectURL(capturedUrl);
    setCapturedUrl(null);
    setCapturedBlob(null);
    setCameraState('idle');
  }, [capturedUrl]);

  const usePhoto = useCallback(() => {
    if (!capturedBlob) return;
    const file = new File([capturedBlob], `camera-capture-${Date.now()}.jpg`, {
      type: 'image/jpeg',
    });
    onCapture(file);
    if (capturedUrl) URL.revokeObjectURL(capturedUrl);
  }, [capturedBlob, capturedUrl, onCapture]);

  const handleClose = useCallback(() => {
    stopStream();
    if (capturedUrl) URL.revokeObjectURL(capturedUrl);
    onClose();
  }, [stopStream, capturedUrl, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/80 backdrop-blur-sm p-4">
      <div className="bg-card rounded-2xl shadow-2xl border border-border w-full max-w-lg max-h-[90dvh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <Camera size={18} className="text-accent" />
            <span className="font-bold text-navy text-sm">Camera Capture</span>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
            aria-label="Close camera"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* IDLE — prompt to start */}
          {cameraState === 'idle' && (
            <div className="flex flex-col items-center gap-5 py-8">
              <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center">
                <Camera size={28} className="text-accent" />
              </div>
              <div className="text-center space-y-1">
                <p className="font-semibold text-navy text-sm">Ready to capture</p>
                <p className="text-xs text-muted-foreground">
                  Click below to request camera access and take a photo of the product label.
                </p>
              </div>
              <button onClick={startCamera} className="btn-primary px-6 py-2.5 text-sm">
                <Camera size={15} />
                Start Camera
              </button>
            </div>
          )}

          {/* REQUESTING */}
          {cameraState === 'requesting' && (
            <div className="flex flex-col items-center gap-4 py-10">
              <div className="w-10 h-10 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
              <p className="text-sm text-muted-foreground">Requesting camera access…</p>
            </div>
          )}

          {/* ACTIVE — live preview */}
          {cameraState === 'active' && (
            <>
              <div
                className="relative rounded-xl overflow-hidden bg-black"
                style={{ aspectRatio: '16/9' }}
              >
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{
                    display: 'block',
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                />
                {/* Viewfinder overlay — pointer-events-none so it never blocks the video */}
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute inset-6 border-2 border-white/30 rounded-xl" />
                  <div className="absolute top-6 left-6 w-5 h-5 border-t-2 border-l-2 border-white rounded-tl-lg" />
                  <div className="absolute top-6 right-6 w-5 h-5 border-t-2 border-r-2 border-white rounded-tr-lg" />
                  <div className="absolute bottom-6 left-6 w-5 h-5 border-b-2 border-l-2 border-white rounded-bl-lg" />
                  <div className="absolute bottom-6 right-6 w-5 h-5 border-b-2 border-r-2 border-white rounded-br-lg" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Position the product label within the frame, then capture.
              </p>
              <button
                onClick={capturePhoto}
                className="btn-primary w-full py-3 text-sm font-semibold"
              >
                <Camera size={16} />
                Capture Photo
              </button>
            </>
          )}

          {/* CAPTURED — review photo */}
          {cameraState === 'captured' && capturedUrl && (
            <>
              <div
                className="relative rounded-xl overflow-hidden bg-black"
                style={{ aspectRatio: '16/9' }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={capturedUrl}
                  alt="Captured product label photo for compliance analysis"
                  style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }}
                />
                <div className="absolute top-2 right-2 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-pass/90 text-white text-xs font-medium">
                  <Check size={11} />
                  Photo captured
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={retake}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                >
                  <RotateCcw size={14} />
                  Retake
                </button>
                <button onClick={usePhoto} className="flex-1 btn-primary py-2.5 text-sm">
                  <Check size={15} />
                  Use Photo
                </button>
              </div>
            </>
          )}

          {/* DENIED */}
          {cameraState === 'denied' && (
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="w-14 h-14 rounded-2xl bg-flag/10 flex items-center justify-center">
                <AlertCircle size={26} className="text-flag" />
              </div>
              <div className="text-center space-y-1.5">
                <p className="font-semibold text-navy text-sm">Camera access denied</p>
                <p className="text-xs text-muted-foreground leading-relaxed max-w-xs">
                  Camera permission was denied. To use this feature, allow camera access in your
                  browser settings and reload the page.
                </p>
              </div>
              <div className="w-full p-3 rounded-xl bg-amber-50 border border-amber-200">
                <p className="text-xs text-amber-800 text-center">
                  Alternatively, use the <strong>Browse files</strong> button to upload a photo
                  from your device.
                </p>
              </div>
              <button
                onClick={handleClose}
                className="px-5 py-2 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
              >
                Close
              </button>
            </div>
          )}

          {/* UNAVAILABLE */}
          {cameraState === 'unavailable' && (
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
                <CameraOff size={26} className="text-muted-foreground" />
              </div>
              <div className="text-center space-y-1.5">
                <p className="font-semibold text-navy text-sm">Camera not available</p>
                <p className="text-xs text-muted-foreground leading-relaxed max-w-xs">
                  No camera was detected on this device, or the browser does not support camera
                  access. Please use HTTPS and a supported browser (Chrome, Firefox, Safari).
                </p>
              </div>
              <div className="w-full p-3 rounded-xl bg-muted border border-border">
                <p className="text-xs text-muted-foreground text-center">
                  Use the <strong>Browse files</strong> button to upload a photo from your device.
                </p>
              </div>
              <button
                onClick={handleClose}
                className="px-5 py-2 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
              >
                Close
              </button>
            </div>
          )}

          {/* ERROR */}
          {cameraState === 'error' && (
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="w-14 h-14 rounded-2xl bg-flag/10 flex items-center justify-center">
                <AlertCircle size={26} className="text-flag" />
              </div>
              <div className="text-center space-y-1.5">
                <p className="font-semibold text-navy text-sm">Camera error</p>
                <p className="text-xs text-muted-foreground leading-relaxed max-w-xs">
                  {errorMessage || 'An unexpected camera error occurred. Please try again.'}
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleClose}
                  className="px-5 py-2 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                >
                  Close
                </button>
                <button onClick={startCamera} className="btn-primary px-5 py-2 text-sm">
                  Try Again
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Hidden canvas for capture */}
        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
}
