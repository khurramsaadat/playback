// NOTE: Filename must be lowercase (app.tsx) to avoid TypeScript casing issues on Windows/Linux
import React, { useRef, useState } from "react";
import { createFFmpeg, fetchFile } from '@ffmpeg/ffmpeg';

// Maximum file size in bytes (500MB)
const MAX_FILE_SIZE = 500 * 1024 * 1024;

export default function App() {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [a, setA] = useState<number>(0);
  const [b, setB] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [outputFormat, setOutputFormat] = useState<'mp4'>('mp4');
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Handle file upload with size validation
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      if (f.size > MAX_FILE_SIZE) {
        setMessage(`File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB`);
        return;
      }
      setFile(f);
      const url = URL.createObjectURL(f);
      setVideoUrl(url);
      setA(0);
      setB(0);
      setMessage(null);
      setProgress(0);
    }
  };

  // Set A point
  const setPointA = () => {
    if (videoRef.current) setA(videoRef.current.currentTime);
  };

  // Set B point
  const setPointB = () => {
    if (videoRef.current) setB(videoRef.current.currentTime);
  };

  // Cut and download using ffmpeg.wasm
  const handleCutAndDownload = async () => {
    if (!file || a >= b) {
      setMessage("Invalid A/B points or no file.");
      return;
    }
    setProcessing(true);
    setProgress(0);
    setMessage("Processing...");
    try {
      const ffmpeg = createFFmpeg({ 
        log: true,
        progress: ({ ratio }: { ratio: number }) => {
          setProgress(Math.round(ratio * 100));
        }
      });
      
      await ffmpeg.load();
      ffmpeg.FS("writeFile", "input.mp4", await fetchFile(file));
      
      // Use the selected output format
      const outputFilename = `output.${outputFormat}`;
      await ffmpeg.run(
        "-ss", `${a}`,
        "-to", `${b}`,
        "-i", "input.mp4",
        "-c", "copy",
        outputFilename
      );
      
      const data = ffmpeg.FS("readFile", outputFilename);
      const blob = new Blob([new Uint8Array(data.buffer)], { type: `video/${outputFormat}` });
      const url = URL.createObjectURL(blob);
      const aEl = document.createElement("a");
      aEl.href = url;
      aEl.download = `${file.name.replace(/\.[^/.]+$/, "")}-${Math.floor(a)}-${Math.floor(b)}.${outputFormat}`;
      document.body.appendChild(aEl);
      aEl.click();
      document.body.removeChild(aEl);
      setMessage("Download ready!");
      setProgress(100);
    } catch (err: any) {
      console.error("FFmpeg error:", err);
      setMessage("Error: " + (err?.message || "Unknown error"));
      setProgress(0);
    }
    setProcessing(false);
  };

  return (
    <div style={{ maxWidth: 500, margin: "2rem auto", fontFamily: "sans-serif" }}>
      <h1>Video Cutter Micro-App</h1>
      <div style={{ marginBottom: 16 }}>
        <input 
          type="file" 
          accept="video/mp4,video/webm" 
          onChange={handleFileChange} 
          style={{ marginBottom: 8 }}
        />
        <div style={{ fontSize: 12, color: "#666" }}>
          Maximum file size: {MAX_FILE_SIZE / (1024 * 1024)}MB
        </div>
      </div>
      {videoUrl && (
        <div>
          <video
            ref={videoRef}
            src={videoUrl}
            controls
            style={{ width: "100%", marginTop: 16 }}
            onLoadedMetadata={e => setDuration(e.currentTarget.duration)}
          />
          <div style={{ marginTop: 8 }}>
            <button onClick={setPointA}>Set A (Start): {a.toFixed(2)}s</button>
            <button onClick={setPointB} style={{ marginLeft: 8 }}>Set B (End): {b.toFixed(2)}s</button>
            <span style={{ marginLeft: 16 }}>Duration: {duration.toFixed(2)}s</span>
          </div>
          <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
            <select 
              value={outputFormat} 
              onChange={(e) => setOutputFormat(e.target.value as 'mp4')}
              style={{
                padding: "0.5rem",
                borderRadius: 4,
                border: "1px solid #ccc"
              }}
            >
              <option value="mp4">MP4</option>
            </select>
            <button
              onClick={handleCutAndDownload}
              disabled={processing || a >= b}
              style={{
                background: a < b ? "#22c55e" : "#ccc",
                color: "#fff",
                border: "none",
                borderRadius: 4,
                padding: "0.5rem 1rem",
                fontWeight: 600,
                cursor: a < b && !processing ? "pointer" : "not-allowed",
                opacity: a < b ? 1 : 0.6,
              }}
            >
              {processing ? `Processing ${progress}%` : "Cut & Download"}
            </button>
          </div>
          {processing && (
            <div style={{ marginTop: 16 }}>
              <div style={{ 
                width: "100%", 
                height: 4, 
                backgroundColor: "#eee",
                borderRadius: 2,
                overflow: "hidden"
              }}>
                <div style={{
                  width: `${progress}%`,
                  height: "100%",
                  backgroundColor: "#22c55e",
                  transition: "width 0.3s ease"
                }} />
              </div>
            </div>
          )}
        </div>
      )}
      {message && (
        <div style={{ 
          marginTop: 16, 
          padding: 12,
          borderRadius: 4,
          backgroundColor: message.includes("Error") ? "#fee2e2" : "#dcfce7",
          color: message.includes("Error") ? "#991b1b" : "#166534"
        }}>
          {message}
        </div>
      )}
    </div>
  );
}
