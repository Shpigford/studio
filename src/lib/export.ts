import { Muxer, ArrayBufferTarget } from "mp4-muxer";

/** Generate a filename like `topo-2026-03-15-a3f9b2.png`. */
export function generateFilename(toolId: string, extension: string): string {
  const date = new Date().toISOString().slice(0, 10);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${toolId}-${date}-${rand}.${extension}`;
}

/** Export canvas as PNG via anchor download. */
export function exportPNG(canvas: HTMLCanvasElement, filename: string): void {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, "image/png");
}

/** Export SVG string via anchor download. */
export function exportSVG(svgString: string, filename: string): void {
  const blob = new Blob([svgString], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

interface RecorderOptions {
  width: number;
  height: number;
  fps?: number;
  bitrate?: number;
  /** Source canvas dimensions — when larger than width/height, frames are downscaled. */
  sourceWidth?: number;
  sourceHeight?: number;
}

export interface Recorder {
  start: () => void;
  addFrame: (canvas: HTMLCanvasElement | OffscreenCanvas) => void;
  stop: () => Promise<Blob>;
}

/**
 * Create an MP4 recorder using VideoEncoder + mp4-muxer.
 * Returns null if VideoEncoder is not supported.
 *
 * Includes frame-rate throttling (only encodes at target fps) and
 * backpressure (drops frames when encoder queue backs up).
 */
export function createRecorder(
  options: RecorderOptions,
): Recorder | null {
  if (typeof VideoEncoder === "undefined") return null;

  const fps = options.fps ?? 30;
  const bitrate = options.bitrate ?? 5_000_000;
  // H.264 requires even dimensions
  const w = options.width & ~1;
  const h = options.height & ~1;

  let muxer: Muxer<ArrayBufferTarget>;
  let encoder: VideoEncoder;
  let frameCount = 0;
  let lastFrameTime = 0;
  const frameInterval = 1000 / fps;

  // Downscaling support
  const needsScale =
    options.sourceWidth != null &&
    options.sourceHeight != null &&
    (options.sourceWidth !== w || options.sourceHeight !== h);
  let scaleCanvas: OffscreenCanvas | null = null;
  let scaleCtx: OffscreenCanvasRenderingContext2D | null = null;

  return {
    start() {
      muxer = new Muxer({
        target: new ArrayBufferTarget(),
        video: {
          codec: "avc",
          width: w,
          height: h,
        },
        fastStart: "in-memory",
      });

      encoder = new VideoEncoder({
        output: (chunk, meta) => {
          muxer.addVideoChunk(chunk, meta ?? undefined);
        },
        error: (e) => console.error("VideoEncoder error:", e),
      });

      encoder.configure({
        codec: "avc1.640028",
        width: w,
        height: h,
        bitrate,
        framerate: fps,
      });

      frameCount = 0;
      lastFrameTime = 0;

      if (needsScale) {
        scaleCanvas = new OffscreenCanvas(w, h);
        scaleCtx = scaleCanvas.getContext("2d");
      }
    },

    addFrame(canvas: HTMLCanvasElement | OffscreenCanvas) {
      // Throttle to target fps
      const now = performance.now();
      if (lastFrameTime && now - lastFrameTime < frameInterval) return;

      // Backpressure — drop frame if encoder is overwhelmed
      if (encoder.encodeQueueSize > 5) return;

      lastFrameTime = now;

      let source: HTMLCanvasElement | OffscreenCanvas = canvas;
      if (scaleCtx && scaleCanvas) {
        scaleCtx.drawImage(canvas, 0, 0, w, h);
        source = scaleCanvas;
      }

      const frame = new VideoFrame(source, {
        timestamp: (frameCount / fps) * 1_000_000,
        duration: Math.round(1_000_000 / fps),
      });
      encoder.encode(frame);
      frame.close();
      frameCount++;
    },

    async stop(): Promise<Blob> {
      let flushError: unknown;
      try {
        await encoder.flush();
      } catch (e) {
        flushError = e;
      } finally {
        encoder.close();
      }
      muxer.finalize();
      const buf = muxer.target.buffer;
      scaleCanvas = null;
      scaleCtx = null;
      if (flushError) throw flushError;
      return new Blob([buf], { type: "video/mp4" });
    },
  };
}
