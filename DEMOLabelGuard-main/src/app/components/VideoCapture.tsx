'use client';

/**
 * Video recording modal for the VIDEO / 360° SCAN feature.
 *
 * Deliberately a SEPARATE component from CameraCapture.tsx rather than an
 * extension of it — CameraCapture's photo-capture flow must stay exactly
 * as stable as it is today. This component only knows how to record a
 * short clip and hand back a File; it has no knowledge of frame
 * extraction (see videoFrames.ts) or the existing photo pipeline.
 */

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Video, X, RotateCcw, Check, AlertCircle, VideoOff } from 'lucide-react';
import { MAX_VIDEO_DURATION_SECONDS, pickSupportedRecordingMimeType } from '@/lib/videoFrames';

interface VideoCaptureProps {
  onCapture: (file: File) => void;
  onClose: () => void;
}

type RecorderState =
  | 'idle'
  | 'requesting'
  | 'ready'
  | 'recording'
  | 'recorded'
  | 'denied'
  | 'unavailable'
  | 'unsupported'
  | 'error';

export default function VideoCapture({ onCapture, onClose }: VideoCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [state, setState] = useState<RecorderState>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopStream();
      stopTimer();
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (state !== 'ready' && state !== 'recording') return;
    const video = videoRef.current;
    if (!video || !streamRef.current) return;

    video.srcObject = streamRef.current;
    video.play().catch(() => {});
  }, [state]);

  const startCamera = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setState('unavailable');
      return;
    }

    if (typeof MediaRecorder === 'undefined') {
      // Honest limitation: some browsers (notably older mobile Safari)
      // don't support recording at all. We don't fake it — the caller's
      // VideoScanPanel keeps "Upload Video" available regardless.
      setState('unsupported');
      return;
    }

    setState('requesting');
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
        stream = await tryGetStream('environment');
      } catch {
        stream = await tryGetStream(undefined);
      }

      streamRef.current = stream;
      setState('ready');
    } catch (err: unknown) {
      stopStream();
      const error = err as { name?: string; message?: string };
      if (error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError') {
        setState('denied');
      } else if (error?.name === 'NotFoundError' || error?.name === 'DevicesNotFoundError') {
        setState('unavailable');
      } else if (error?.name === 'NotReadableError' || error?.name === 'AbortError') {
        setErrorMessage('Camera is already in use by another application.');
        setState('error');
      } else {
        setErrorMessage(error?.message || 'An unexpected error occurred.');
        setState('error');
      }
    }
  }, [stopStream]);

  const stopRecording = useCallback(() => {
    stopTimer();
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
  }, [stopTimer]);

  const startRecording = useCallback(() => {
    if (!streamRef.current) return;

    const mimeType = pickSupportedRecordingMimeType();
    if (!mimeType) {
      // Camera preview works but MediaRecorder can't produce a usable
      // format on this browser. Be honest rather than recording garbage.
      setState('unsupported');
      return;
    }

    chunksRef.current = [];

    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(streamRef.current, { mimeType });
    } catch {
      setState('unsupported');
      return;
    }

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      const url = URL.createObjectURL(blob);
      setRecordedBlob(blob);
      setRecordedUrl(url);
      stopStream();
      setState('recorded');
    };

    recorderRef.current = recorder;
    recorder.start();
    setElapsedSeconds(0);
    setState('recording');

    timerRef.current = setInterval(() => {
      setElapsedSeconds((prev) => {
        const next = prev + 1;
        if (next >= MAX_VIDEO_DURATION_SECONDS) {
          stopRecording();
        }
        return next;
      });
    }, 1000);
  }, [stopStream, stopRecording]);

  const retake = useCallback(() => {
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    setRecordedUrl(null);
    setRecordedBlob(null);
    setElapsedSeconds(0);
    setState('idle');
  }, [recordedUrl]);

  const useVideo = useCallback(() => {
    if (!recordedBlob) return;
    const extension = recordedBlob.type.includes('mp4') ? 'mp4' : 'webm';
    const file = new File([recordedBlob], `video-scan-${Date.now()}.${extension}`, {
      type: recordedBlob.type || 'video/webm',
    });
    onCapture(file);
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
  }, [recordedBlob, recordedUrl, onCapture]);

  const handleClose = useCallback(() => {
    stopStream();
    stopTimer();
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    onClose();
  }, [stopStream, stopTimer, recordedUrl, onClose]);

  const remainingSeconds = Math.max(0, MAX_VIDEO_DURATION_SECONDS - elapsedSeconds);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/80 backdrop-blur-sm p-4">
      <div className="bg-card rounded-2xl shadow-2xl border border-border w-full max-w-lg max-h-[90dvh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <Video size={18} className="text-accent" />
            <span className="font-bold text-navy text-sm">Record Product Video</span>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
            aria-label="Close video recorder"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          {state === 'idle' && (
            <div className="flex flex-col items-center gap-5 py-8">
              <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center">
                <Video size={28} className="text-accent" />
              </div>
              <div className="text-center space-y-1">
                <p className="font-semibold text-navy text-sm">Ready to record</p>
                <p className="text-xs text-muted-foreground max-w-xs">
                  Slowly rotate the product in front of the camera. Recording stops automatically
                  after {MAX_VIDEO_DURATION_SECONDS} seconds.
                </p>
              </div>
              <button onClick={startCamera} className="btn-primary px-6 py-2.5 text-sm">
                <Video size={15} />
                Start Camera
              </button>
            </div>
          )}

          {state === 'requesting' && (
            <div className="flex flex-col items-center gap-4 py-10">
              <div className="w-10 h-10 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
              <p className="text-sm text-muted-foreground">Requesting camera access…</p>
            </div>
          )}

          {(state === 'ready' || state === 'recording') && (
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
                  style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }}
                />
                {state === 'recording' && (
                  <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-flag/90 text-white text-xs font-medium">
                    <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                    REC {elapsedSeconds}s
                  </div>
                )}
                {state === 'recording' && (
                  <div className="absolute top-2 right-2 px-2 py-1 rounded-lg bg-navy/80 text-white text-xs font-medium">
                    {remainingSeconds}s left
                  </div>
                )}
              </div>

              <p className="text-xs text-muted-foreground text-center">
                {state === 'recording'
                  ? 'Slowly rotate the product — keep it centered in frame.'
                  : 'Position the product, then start recording.'}
              </p>

              {state === 'ready' ? (
                <button
                  onClick={startRecording}
                  className="btn-primary w-full py-3 text-sm font-semibold"
                >
                  <Video size={16} />
                  Start Recording
                </button>
              ) : (
                <button
                  onClick={stopRecording}
                  className="w-full py-3 rounded-xl bg-flag text-white text-sm font-semibold flex items-center justify-center gap-2"
                >
                  <span className="w-3 h-3 rounded-sm bg-white" />
                  Stop Recording
                </button>
              )}
            </>
          )}

          {state === 'recorded' && recordedUrl && (
            <>
              <div
                className="relative rounded-xl overflow-hidden bg-black"
                style={{ aspectRatio: '16/9' }}
              >
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <video
                  src={recordedUrl}
                  controls
                  playsInline
                  style={{ display: 'block', width: '100%', height: '100%', objectFit: 'contain' }}
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={retake}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                >
                  <RotateCcw size={14} />
                  Retake
                </button>
                <button onClick={useVideo} className="flex-1 btn-primary py-2.5 text-sm">
                  <Check size={15} />
                  Use Video
                </button>
              </div>
            </>
          )}

          {state === 'denied' && (
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
                  Alternatively, close this and use <strong>Upload Video</strong> instead.
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

          {state === 'unavailable' && (
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
                <VideoOff size={26} className="text-muted-foreground" />
              </div>
              <div className="text-center space-y-1.5">
                <p className="font-semibold text-navy text-sm">Camera not available</p>
                <p className="text-xs text-muted-foreground leading-relaxed max-w-xs">
                  No camera was detected, or the browser does not support camera access.
                </p>
              </div>
              <div className="w-full p-3 rounded-xl bg-muted border border-border">
                <p className="text-xs text-muted-foreground text-center">
                  Close this and use <strong>Upload Video</strong> instead.
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

          {state === 'unsupported' && (
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
                <VideoOff size={26} className="text-muted-foreground" />
              </div>
              <div className="text-center space-y-1.5">
                <p className="font-semibold text-navy text-sm">
                  Recording isn&apos;t supported here
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed max-w-xs">
                  Video recording isn&apos;t available in this browser. You can still upload a
                  product video instead.
                </p>
              </div>
              <button
                onClick={handleClose}
                className="px-5 py-2 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
              >
                Close &amp; Upload Instead
              </button>
            </div>
          )}

          {state === 'error' && (
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
      </div>
    </div>
  );
}
