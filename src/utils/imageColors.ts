export const getDominantImageColor = (imageUrl: string, fallback: string): Promise<string> =>
  new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = 'Anonymous';
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const sampleSize = 32;
        canvas.width = sampleSize;
        canvas.height = sampleSize;
        const context = canvas.getContext('2d');

        if (!context) {
          resolve(fallback);
          return;
        }

        context.drawImage(image, 0, 0, sampleSize, sampleSize);
        const { data } = context.getImageData(0, 0, sampleSize, sampleSize);
        const buckets = new Map<string, { r: number; g: number; b: number; count: number }>();

        for (let index = 0; index < data.length; index += 4) {
          if (data[index + 3] < 80) continue;

          const red = data[index];
          const green = data[index + 1];
          const blue = data[index + 2];
          const key = `${Math.round(red / 32) * 32},${Math.round(green / 32) * 32},${Math.round(blue / 32) * 32}`;
          const bucket = buckets.get(key) ?? { r: 0, g: 0, b: 0, count: 0 };
          bucket.r += red;
          bucket.g += green;
          bucket.b += blue;
          bucket.count += 1;
          buckets.set(key, bucket);
        }

        let dominant = { r: 0, g: 0, b: 0, count: 0 };
        for (const bucket of buckets.values()) {
          if (bucket.count > dominant.count) dominant = bucket;
        }

        if (!dominant.count) {
          resolve(fallback);
          return;
        }

        resolve(
          `${Math.round(dominant.r / dominant.count)}, ${Math.round(dominant.g / dominant.count)}, ${Math.round(dominant.b / dominant.count)}`
        );
      } catch (error) {
        console.warn('Could not read the dominant color from artwork:', error);
        resolve(fallback);
      }
    };
    image.onerror = () => resolve(fallback);
    image.src = imageUrl;
  });

export const getContrastingTextColor = (rgb: string): string => {
  const channels = rgb.split(',').map((channel) => Number(channel.trim()));
  if (channels.length !== 3 || channels.some((channel) => !Number.isFinite(channel))) return '#fff';

  const [red, green, blue] = channels.map((channel) => {
    const normalized = Math.min(255, Math.max(0, channel)) / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  return luminance > 0.179 ? '#0b0b0b' : '#fff';
};
