// Client-side photo handling: any image file the user picks is square-cropped
// and downscaled to a small data-URL (JPEG) so it fits comfortably in
// localStorage (device profile) and the Supabase profiles table (cloud).
const MAX_INPUT_BYTES = 8 * 1024 * 1024; // 8MB

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
          resolve(canvas.toDataURL('image/jpeg', 0.85));
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
