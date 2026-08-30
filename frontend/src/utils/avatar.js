// Client-side photo handling: any image file the user picks is square-cropped
// and downscaled to a small data-URL so it fits comfortably in localStorage
// (device profile) and the Supabase profiles row (cloud).
//
// Encoded as WebP where the browser can ENCODE it, JPEG otherwise. WebP is not
// universally encodable (Safari only gained canvas WebP output in 16.4), so the
// support is probed once and the result cached — worst case this behaves
// exactly like it did before. Every browser decodes both formats, so existing
// JPEG data-URLs already in storage keep rendering untouched.
const MAX_INPUT_BYTES = 8 * 1024 * 1024; // 8MB

let webpEncode = null; // null = not probed yet

function canEncodeWebp() {
  if (webpEncode !== null) return webpEncode;
  try {
    const c = document.createElement('canvas');
    c.width = 1;
    c.height = 1;
    // A browser that cannot encode WebP silently returns a PNG data URL.
    webpEncode = c.toDataURL('image/webp').startsWith('data:image/webp');
  } catch {
    webpEncode = false;
  }
  return webpEncode;
}

export function fileToAvatar(file, size = 256) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type || !file.type.startsWith('image/')) {
      reject(new Error('not an image'));
      return;
    }
    if (file.size > MAX_INPUT_BYTES) {
      reject(new Error('image too large'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read failed'));
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d');
          // square cover-crop from the center
          const side = Math.min(img.width, img.height);
          const sx = (img.width - side) / 2;
          const sy = (img.height - side) / 2;
          ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
          const useWebp = canEncodeWebp();
          resolve(canvas.toDataURL(useWebp ? 'image/webp' : 'image/jpeg', 0.85));
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = () => reject(new Error('could not decode image'));
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
