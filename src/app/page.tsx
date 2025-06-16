"use client";
import { useRef, useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { ComponentType } from "react";
import type { WaveSurferComponentProps } from "../components/WaveSurferComponent";
import { Slider } from "@/components/ui/slider";

const WaveSurferComponent = dynamic(() =>
  import("../components/WaveSurferComponent") as Promise<{ default: ComponentType<WaveSurferComponentProps> }>
, { ssr: false });

export default function Home() {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [abMarkers, setAbMarkers] = useState<{ a: number; b: number }>({ a: 0, b: 0 });
  const [duration, setDuration] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [centerOnAB, setCenterOnAB] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [isCutting, setIsCutting] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [cutProgress, setCutProgress] = useState<number>(0);

  // Store looping handler refs to allow cleanup
  const loopingHandlerRef = useRef<(() => void) | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setVideoUrl(url);
      setAudioUrl(url); // For now, use the same URL for both video and audio
      setFileName(file.name);
    }
  };

  // Track play/pause state
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const { a, b } = abMarkers;
    // Only loop if both markers are set and valid
    if (a < b) {
      // Remove any previous looping listeners
      if (loopingHandlerRef.current) {
        loopingHandlerRef.current();
        loopingHandlerRef.current = null;
      }
      // Always jump to A and play
      video.currentTime = a;
      video.play();
      const onTimeUpdate = () => {
        if (video.currentTime >= b) {
          video.currentTime = a;
          video.play();
        }
      };
      const onPause = () => {
        video.removeEventListener('timeupdate', onTimeUpdate);
        video.removeEventListener('pause', onPause);
      };
      video.addEventListener('timeupdate', onTimeUpdate);
      video.addEventListener('pause', onPause);
      loopingHandlerRef.current = () => {
        video.removeEventListener('timeupdate', onTimeUpdate);
        video.removeEventListener('pause', onPause);
      };
    } else {
      // If markers are not valid, remove looping listeners
      if (loopingHandlerRef.current) {
        loopingHandlerRef.current();
        loopingHandlerRef.current = null;
      }
    }
    // Cleanup on unmount or abMarkers change
    return () => {
      if (loopingHandlerRef.current) {
        loopingHandlerRef.current();
        loopingHandlerRef.current = null;
      }
    };
  }, [abMarkers, videoRef, duration]);

  // Ensure isPlaying state always matches the actual video state
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
    };
  }, [videoRef, audioUrl]);

  // Helper to get the green color from CSS variable
  function getPrimaryColor() {
    if (typeof window !== 'undefined') {
      return getComputedStyle(document.documentElement).getPropertyValue('--primary') || '#22c55e';
    }
    return '#22c55e';
  }

  // Helper to show toast
  const showToast = (type: 'success' | 'error' | 'info', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  // Convert seconds to human readable time format (e.g., 1h05m30s, 10m30s, 30s)
  function formatTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.floor(seconds % 60);

    let timeString = '';
    if (hours > 0) {
      timeString += `${hours}h`;
      timeString += minutes.toString().padStart(2, '0') + 'm';
      timeString += remainingSeconds.toString().padStart(2, '0') + 's';
    } else if (minutes > 0) {
      timeString += `${minutes}m`;
      timeString += remainingSeconds.toString().padStart(2, '0') + 's';
    } else {
      timeString += `${remainingSeconds}s`;
    }
    return timeString;
  }

  // Helper to cut and download video
  const handleCutAndDownload = () => {
    if (!videoRef.current || !fileName || abMarkers.a >= abMarkers.b) return;
    const inputElem = document.getElementById('file-upload') as HTMLInputElement | null;
    const file = inputElem?.files?.[0];
    if (!file) {
      showToast('error', 'No file found');
      return;
    }
    const iframe = document.getElementById('video-cutter-iframe') as HTMLIFrameElement | null;
    if (!iframe) {
      showToast('error', 'Video cutter micro-app not found');
      return;
    }

    // Add these logs:
    console.log('Sending file:', file, typeof file, file instanceof Blob, file instanceof File);
    console.log('Sending start:', abMarkers.a, typeof abMarkers.a);
    console.log('Sending end:', abMarkers.b, typeof abMarkers.b);

    const start = abMarkers.a;
    const end = abMarkers.b;

    // Generate filename with formatted time
    const originalName = fileName.replace(/\.[^/.]+$/, ''); // Remove extension
    const newFilename = `${originalName}-${formatTime(start)}-${formatTime(end)}.mp4`;

    // Send to micro-app
    setIsCutting(true);
    showToast('info', 'Processing... your download will start soon');
    iframe.contentWindow?.postMessage(
      {
        file,
        start,
        end,
        filename: newFilename
      },
      '*'
    );
  };

  // Add useEffect to listen for messages from the micro-app
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      // For local testing, accept all origins. For production, check event.origin.
      if (event.data.status === 'success') {
        showToast('success', 'Video cut and download ready!');
        setIsCutting(false);
        setCutProgress(100);
      } else if (event.data.status === 'error') {
        showToast('error', 'Video cutting failed: ' + event.data.message);
        setIsCutting(false);
        setCutProgress(0);
      } else if (event.data.status === 'progress') {
        setCutProgress(event.data.progress);
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  return (
    <>
      <iframe
        id="video-cutter-iframe"
        src="/video-cutter/index.html"
        style={{ 
          width: "100%", 
          height: 0, 
          border: 'none',
          visibility: 'hidden',
          position: 'absolute' 
        }}
        title="Video Cutter Micro-App"
      />
      <div className="min-h-screen flex flex-col items-center justify-start bg-background p-0 sm:p-2">
        <Card className="w-full max-w-md sm:max-w-2xl p-2 sm:p-4 flex flex-col gap-4 shadow-lg mt-0">
          <h1 className="text-2xl font-bold text-primary mb-2 text-center">Playback & Learn</h1>
          {/* Choose File Button and File Name in one row */}
          <div className="w-full flex flex-row items-center gap-2 mb-2">
            <label htmlFor="file-upload" className="flex-shrink-0">
              <Button asChild size="sm" className="w-auto px-3 py-1.5 text-sm">
                <span>Choose File</span>
              </Button>
              <input
                id="file-upload"
                type="file"
                accept="video/*,audio/*"
                onChange={handleFileChange}
                className="hidden"
                disabled={isPlaying}
              />
            </label>
            <div className="text-xs text-muted-foreground truncate w-full">
              {fileName || ''}
            </div>
          </div>
          {/* Video Section */}
          <div className="w-full flex items-center justify-center bg-muted rounded-lg aspect-video overflow-hidden max-h-48 sm:max-h-56">
            {videoUrl ? (
              <video
                ref={videoRef}
                src={videoUrl}
                controls
                className="w-full h-full object-contain bg-black"
                onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
              />
            ) : (
              <div className="flex flex-col items-center justify-center w-full h-full text-muted-foreground">
                <span className="text-lg">No video loaded</span>
                <span className="text-xs">Upload a video or audio file</span>
              </div>
            )}
          </div>
          {/* Waveform Section */}
          <div className="w-full min-h-32 flex flex-col items-center justify-center gap-2">
            {/* Zoom Slider Removed */}
            {audioUrl ? (
              <WaveSurferComponent
                audioUrl={audioUrl}
                abMarkers={abMarkers}
                setAbMarkers={(markers: { a: number; b: number }) => setAbMarkers(markers)}
                videoRef={videoRef}
                onDuration={(d: number) => setDuration(d)}
                centerOnAB={centerOnAB}
                onCenterHandled={() => setCenterOnAB(false)}
                zoom={zoom}
              />
            ) : (
              <div className="w-full h-32 flex items-center justify-center bg-muted rounded text-muted-foreground">
                <span className="text-sm">No Audio loaded</span>
              </div>
            )}
            {/* Main Controls */}
            <div className="flex flex-row gap-2 w-full justify-center sm:mt-0 mt-2">
              <Button size="sm" variant="destructive" onClick={() => setAbMarkers({ a: 0, b: duration })} disabled={!audioUrl || isPlaying} aria-label="Clear A/B Markers">
                Clear A/B
              </Button>
              {/* Cut & Download Button */}
              <button
                type="button"
                style={{
                  background: abMarkers.a < abMarkers.b && audioUrl ? getPrimaryColor() : '#d1d5db',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 4,
                  padding: '0.5rem 1rem',
                  fontWeight: 600,
                  marginLeft: 8,
                  position: 'relative',
                  cursor: abMarkers.a < abMarkers.b && audioUrl && !isCutting ? 'pointer' : 'not-allowed',
                  opacity: abMarkers.a < abMarkers.b && audioUrl ? 1 : 0.6,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
                disabled={!(abMarkers.a < abMarkers.b && audioUrl) || isCutting || isPlaying}
                onClick={handleCutAndDownload}
                aria-label="Cut & Download"
              >
                {isCutting ? `Processing ${cutProgress}%` : "Cut & Download"}
                {isCutting && (
                  <span style={{ marginLeft: 8, display: 'inline-block' }}>
                    <span className="cut-spinner" style={{
                      width: 16, height: 16, border: `2px solid #fff`, borderTop: `2px solid ${getPrimaryColor()}`,
                      borderRadius: '50%', display: 'inline-block', animation: 'spin 1s linear infinite',
                    }} />
                  </span>
                )}
              </button>
            </div>
            {isCutting && (
              <div style={{ 
                width: "100%",
                height: 2,
                backgroundColor: "#e5e7eb",
                borderRadius: 1,
                marginTop: 8,
                overflow: "hidden"
              }}>
                <div style={{
                  width: `${cutProgress}%`,
                  height: "100%",
                  backgroundColor: getPrimaryColor(),
                  transition: "width 0.3s ease"
                }} />
              </div>
            )}
            {/* Zoom slider and reset button below waveform (always visible) */}
            <div className="w-full flex flex-row items-center gap-2 mt-2">
              <span className="text-xs text-gray-500">Zoom</span>
              <Slider
                min={1}
                max={5}
                step={0.1}
                value={[zoom]}
                onValueChange={([val]) => setZoom(val)}
                className="w-32"
              />
              <Button size="sm" variant="outline" onClick={() => setZoom(1)} className="ml-2">Reset Zoom</Button>
            </div>
          </div>
          {/* Controls Section Removed: Repeat */}
        </Card>
        {toast && (
          <div
            style={{
              position: 'fixed',
              bottom: 32,
              left: '50%',
              transform: 'translateX(-50%)',
              background: getPrimaryColor(),
              color: '#fff',
              padding: '1rem 2rem',
              borderRadius: 8,
              boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
              fontWeight: 600,
              zIndex: 9999,
              minWidth: 200,
              textAlign: 'center',
              opacity: 0.98,
            }}
            role="alert"
          >
            {toast.message}
          </div>
        )}
      </div>
    </>
  );
}
