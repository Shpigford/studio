/** Convert canvas to PNG blob. */
export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

/** Copy canvas as PNG image to clipboard. Returns true on success. */
export async function copyImageToClipboard(
  canvas: HTMLCanvasElement
): Promise<boolean> {
  try {
    const blob = await canvasToBlob(canvas);
    if (!blob) return false;
    await navigator.clipboard.write([
      new ClipboardItem({ "image/png": blob }),
    ]);
    return true;
  } catch {
    return false;
  }
}

/** Open native share sheet with canvas image. Returns true on success. */
export async function nativeShare(
  canvas: HTMLCanvasElement,
  toolName: string
): Promise<boolean> {
  try {
    const blob = await canvasToBlob(canvas);
    if (!blob) return false;
    const file = new File([blob], `${toolName}.png`, { type: "image/png" });
    await navigator.share({ files: [file] });
    return true;
  } catch {
    return false;
  }
}

let _canShare: boolean | null = null;

/** Check if the browser supports native file sharing. */
export function canNativeShare(): boolean {
  if (_canShare !== null) return _canShare;
  try {
    const file = new File([], "test.png", { type: "image/png" });
    _canShare =
      !!navigator.share && !!navigator.canShare?.({ files: [file] });
  } catch {
    _canShare = false;
  }
  return _canShare;
}
