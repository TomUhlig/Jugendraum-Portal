/** Bildformat am Dateianfang erkennen (Uploads werden nur als JPEG oder WebP angenommen). */
export const isJpeg = (b: Uint8Array) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
export const isWebp = (b: Uint8Array) => b.length > 12 && String.fromCharCode(...b.subarray(0, 4)) === 'RIFF' && String.fromCharCode(...b.subarray(8, 12)) === 'WEBP';
export const imageType = (b: Uint8Array): 'image/webp' | 'image/jpeg' | null => (isWebp(b) ? 'image/webp' : isJpeg(b) ? 'image/jpeg' : null);
