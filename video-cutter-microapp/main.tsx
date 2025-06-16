// Remove static import
// import { createFFmpeg, fetchFile } from '@ffmpeg/ffmpeg';

import React from "react";
import { createRoot } from "react-dom/client";
import App from "./app";
import { createFFmpeg, fetchFile } from '@ffmpeg/ffmpeg';

// Check if the environment supports SharedArrayBuffer
const isSharedArrayBufferSupported = typeof SharedArrayBuffer !== 'undefined';
const isCrossOriginIsolated = globalThis.crossOriginIsolated;

let ffmpeg: any = null;

// Maximum file size in bytes (500MB) - keep in sync with app.tsx
const MAX_FILE_SIZE = 500 * 1024 * 1024;

window.addEventListener('message', async (event) => {
  console.log('Received message:', event.data);
  const { file, start, end, filename } = event.data || {};
  console.log('file:', file, 'type:', typeof file, 'instanceof Blob:', file instanceof Blob, 'instanceof File:', file instanceof File);
  console.log('start:', start, 'type:', typeof start);
  console.log('end:', end, 'type:', typeof end);
  console.log('filename:', filename, 'type:', typeof filename);
  
  if (!file || typeof start !== 'number' || typeof end !== 'number' || !filename) {
    console.log('Invalid message data');
    window.parent.postMessage({ status: 'error', message: 'Invalid input data' }, '*');
    return;
  }

  if (file.size > MAX_FILE_SIZE) {
    console.log('File too large');
    window.parent.postMessage({ 
      status: 'error', 
      message: `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB` 
    }, '*');
    return;
  }

  // Check for SharedArrayBuffer support
  if (!isSharedArrayBufferSupported || !isCrossOriginIsolated) {
    console.error('SharedArrayBuffer is not supported. Cross-Origin Isolation may not be enabled.');
    window.parent.postMessage({ 
      status: 'error', 
      message: 'Your browser environment does not support the required features. Please ensure Cross-Origin Isolation is enabled.'
    }, '*');
    return;
  }

  try {
    if (!ffmpeg) {
      ffmpeg = createFFmpeg({ 
        log: true,
        corePath: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js',
        progress: ({ ratio }: { ratio: number }) => {
          window.parent.postMessage({ 
            status: 'progress', 
            progress: Math.round(ratio * 100) 
          }, '*');
        }
      });
      await ffmpeg.load();
      console.log('ffmpeg loaded');
    }

    window.parent.postMessage({ status: 'progress', progress: 0 }, '*');
    
    // Convert File to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    ffmpeg.FS('writeFile', 'input.mp4', new Uint8Array(arrayBuffer));
    console.log('File written');

    // Extract keyframe information
    await ffmpeg.run(
      '-i', 'input.mp4',
      '-vf', 'select=eq(pict_type\\,I)',
      '-vsync', '2',
      '-loglevel', 'debug',
      '-f', 'null',
      '-'
    );

    // Single pass with precise seeking and optimized settings
    await ffmpeg.run(
      '-accurate_seek',
      '-ss', start.toString(),
      '-i', 'input.mp4',
      '-t', (end - start).toString(),
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-tune', 'zerolatency',
      '-profile:v', 'high',
      '-level', '4.1',
      '-maxrate', '5000k',
      '-bufsize', '10000k',
      '-pix_fmt', 'yuv420p',
      '-flags', '+global_header',
      '-movflags', '+faststart+frag_keyframe+empty_moov+default_base_moof',
      '-g', '1',
      '-keyint_min', '1',
      '-force_key_frames', 'expr:gte(t,0)',
      '-vsync', '1',
      '-async', '1',
      '-af', 'aresample=async=1:min_hard_comp=0.100000',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-ac', '2',
      '-ar', '48000',
      '-y',
      'output.mp4'
    );
    
    console.log('FFmpeg command executed');
    
    const data = ffmpeg.FS('readFile', 'output.mp4');
    const blob = new Blob([data.buffer], { type: 'video/mp4' });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Cleanup
    ffmpeg.FS('unlink', 'input.mp4');
    ffmpeg.FS('unlink', 'output.mp4');
    
    window.parent.postMessage({ status: 'success', progress: 100 }, '*');
  } catch (err) {
    console.error('Micro-app error:', err);
    window.parent.postMessage({ 
      status: 'error', 
      message: err instanceof Error ? err.message : 'Unknown error',
      progress: 0 
    }, '*');
  }
});

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
