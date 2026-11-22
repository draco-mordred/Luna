export type ArtworkColorSampler = (
  x: number,
  y: number,
  width: number,
  height: number
) => string | null;

export type ArtworkPalette = {
  darkest: [string, string, string];
  brightest: [string, string, string];
};

export type ArtworkImageSampler = {
  palette: ArtworkPalette;
  sampleRegion: ArtworkColorSampler;
};

type ArtworkRgb = [number, number, number];

const getRelativeLuminance = (red: number, green: number, blue: number): number => {
  const channels = [red, green, blue].map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
};

const getContrastRatio = (first: number, second: number): number =>
  (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);

const formatRgb = ([red, green, blue]: ArtworkRgb): string => `rgb(${red}, ${green}, ${blue})`;

const mixRgb = (
  [red, green, blue]: ArtworkRgb,
  [targetRed, targetGreen, targetBlue]: ArtworkRgb,
  amount: number
): ArtworkRgb => [
  Math.round(red + (targetRed - red) * amount),
  Math.round(green + (targetGreen - green) * amount),
  Math.round(blue + (targetBlue - blue) * amount),
];

const getRgbChannels = (color: string): ArtworkRgb | null => {
  const channels = color
    .match(/[\d.]+/g)
    ?.slice(0, 3)
    .map(Number);
  if (!channels || channels.length !== 3 || channels.some((channel) => !Number.isFinite(channel))) {
    return null;
  }
  return [channels[0], channels[1], channels[2]];
};

export const createArtworkPaletteFromPixels = (
  pixels: Uint8ClampedArray
): ArtworkPalette | null => {
  const buckets = new Map<string, { red: number; green: number; blue: number; count: number }>();

  for (let index = 0; index < pixels.length; index += 4) {
    if (pixels[index + 3] < 80) continue;

    const red = pixels[index];
    const green = pixels[index + 1];
    const blue = pixels[index + 2];
    const key = `${Math.min(255, Math.round(red / 32) * 32)},${Math.min(255, Math.round(green / 32) * 32)},${Math.min(255, Math.round(blue / 32) * 32)}`;
    const bucket = buckets.get(key) ?? { red: 0, green: 0, blue: 0, count: 0 };
    bucket.red += red;
    bucket.green += green;
    bucket.blue += blue;
    bucket.count += 1;
    buckets.set(key, bucket);
  }

  const colors = Array.from(buckets.values())
    .sort((first, second) => second.count - first.count)
    .slice(0, 24)
    .map(({ red, green, blue, count }): ArtworkRgb => [
      Math.round(red / count),
      Math.round(green / count),
      Math.round(blue / count),
    ]);
  if (!colors.length) return null;

  const uniqueColors = new Map(colors.map((color) => [formatRgb(color), color]));
  if (uniqueColors.size < 6) {
    const base = colors[0];
    const shades = [
      mixRgb(base, [0, 0, 0], 1),
      mixRgb(base, [0, 0, 0], 0.75),
      mixRgb(base, [0, 0, 0], 0.5),
      mixRgb(base, [0, 0, 0], 0.25),
      mixRgb(base, [255, 255, 255], 0.125),
      mixRgb(base, [255, 255, 255], 0.25),
      mixRgb(base, [255, 255, 255], 0.5),
      mixRgb(base, [255, 255, 255], 0.75),
      mixRgb(base, [255, 255, 255], 1),
    ];
    shades.forEach((color) => uniqueColors.set(formatRgb(color), color));
  }

  const sortByLuminance = () =>
    Array.from(uniqueColors.values()).sort(
      (first, second) => getRelativeLuminance(...first) - getRelativeLuminance(...second)
    );
  const dominantColor = colors[0];
  let sortedColors = sortByLuminance();
  for (const amount of [0.15, 0.3, 0.45, 0.6, 0.75, 1]) {
    const darkestLuminance = getRelativeLuminance(...sortedColors[0]);
    const brightestLuminance = getRelativeLuminance(...sortedColors[sortedColors.length - 1]);
    if (getContrastRatio(darkestLuminance, brightestLuminance) >= 4.5) break;

    const darkerShade = mixRgb(dominantColor, [0, 0, 0], amount);
    const brighterShade = mixRgb(dominantColor, [255, 255, 255], amount);
    uniqueColors.set(formatRgb(darkerShade), darkerShade);
    uniqueColors.set(formatRgb(brighterShade), brighterShade);
    sortedColors = sortByLuminance();
  }
  const darkest: ArtworkPalette['darkest'] = [
    formatRgb(sortedColors[0]),
    formatRgb(sortedColors[1]),
    formatRgb(sortedColors[2]),
  ];
  const brightest: ArtworkPalette['brightest'] = [
    formatRgb(sortedColors[sortedColors.length - 3]),
    formatRgb(sortedColors[sortedColors.length - 2]),
    formatRgb(sortedColors[sortedColors.length - 1]),
  ];

  return {
    darkest,
    brightest,
  };
};

export const getArtworkPaletteButtonColors = (
  palette: ArtworkPalette,
  isDarkTheme: boolean
): { background: string; foreground: string; iconColor: string } => {
  const background = isDarkTheme ? palette.darkest[0] : palette.brightest[2];
  const backgroundChannels = getRgbChannels(background) ?? [255, 255, 255];
  const backgroundLuminance = getRelativeLuminance(...backgroundChannels);
  const foregroundCandidates = isDarkTheme ? palette.brightest : palette.darkest;
  const fallbackIconBase: ArtworkRgb = isDarkTheme ? [0, 0, 0] : [255, 255, 255];
  const iconBase =
    getRgbChannels(isDarkTheme ? palette.darkest[0] : palette.brightest[2]) ?? fallbackIconBase;
  const iconColor = formatRgb(mixRgb(iconBase, isDarkTheme ? [255, 255, 255] : [0, 0, 0], 0.75));
  const foreground = foregroundCandidates.reduce((best, candidate) => {
    const channels = getRgbChannels(candidate);
    if (!channels) return best;
    const candidateContrast = getContrastRatio(
      backgroundLuminance,
      getRelativeLuminance(...channels)
    );
    const bestChannels = getRgbChannels(best);
    const bestContrast = bestChannels
      ? getContrastRatio(backgroundLuminance, getRelativeLuminance(...bestChannels))
      : -1;
    return candidateContrast > bestContrast ? candidate : best;
  }, foregroundCandidates[0]);

  return { background, foreground, iconColor };
};

const artworkImageSamplerCache = new Map<string, Promise<ArtworkImageSampler | null>>();
const maximumCachedArtworkSamplers = 32;

export const createArtworkImageSampler = (
  imageUrl: string
): Promise<ArtworkImageSampler | null> => {
  const cachedSampler = artworkImageSamplerCache.get(imageUrl);
  if (cachedSampler) {
    artworkImageSamplerCache.delete(imageUrl);
    artworkImageSamplerCache.set(imageUrl, cachedSampler);
    return cachedSampler;
  }

  const samplerPromise = new Promise<ArtworkImageSampler | null>((resolve) => {
    const image = new Image();
    image.crossOrigin = 'Anonymous';
    image.onload = () => {
      try {
        if (!image.naturalWidth || !image.naturalHeight) {
          resolve(null);
          return;
        }

        const maximumSampleSize = 128;
        const scale = Math.min(
          1,
          maximumSampleSize / Math.max(image.naturalWidth, image.naturalHeight)
        );
        const width = Math.max(1, Math.round(image.naturalWidth * scale));
        const height = Math.max(1, Math.round(image.naturalHeight * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        if (!context) {
          resolve(null);
          return;
        }

        context.drawImage(image, 0, 0, width, height);
        const pixels = context.getImageData(0, 0, width, height).data;
        const palette = createArtworkPaletteFromPixels(pixels);
        if (!palette) {
          resolve(null);
          return;
        }

        const sampleRegion: ArtworkColorSampler = (x, y, regionWidth, regionHeight) => {
          const left = Math.max(0, Math.min(1, x));
          const top = Math.max(0, Math.min(1, y));
          const right = Math.max(left, Math.min(1, x + regionWidth));
          const bottom = Math.max(top, Math.min(1, y + regionHeight));
          if (right <= left || bottom <= top) return null;

          let lightTextContrast = Number.POSITIVE_INFINITY;
          let darkTextContrast = Number.POSITIVE_INFINITY;
          let sampleCount = 0;
          for (let row = 0; row < 3; row += 1) {
            for (let column = 0; column < 5; column += 1) {
              const sampleX = Math.min(
                width - 1,
                Math.floor((left + ((column + 0.5) / 5) * (right - left)) * width)
              );
              const sampleY = Math.min(
                height - 1,
                Math.floor((top + ((row + 0.5) / 3) * (bottom - top)) * height)
              );
              const pixelIndex = (sampleY * width + sampleX) * 4;
              if (pixels[pixelIndex + 3] < 80) continue;

              const luminance = getRelativeLuminance(
                pixels[pixelIndex],
                pixels[pixelIndex + 1],
                pixels[pixelIndex + 2]
              );
              lightTextContrast = Math.min(lightTextContrast, getContrastRatio(1, luminance));
              darkTextContrast = Math.min(
                darkTextContrast,
                getContrastRatio(getRelativeLuminance(11, 11, 11), luminance)
              );
              sampleCount += 1;
            }
          }

          if (!sampleCount) return null;
          return lightTextContrast >= darkTextContrast ? '#fff' : '#0b0b0b';
        };
        resolve({ palette, sampleRegion });
      } catch (error) {
        console.warn('Could not sample a local color from artwork:', error);
        resolve(null);
      }
    };
    image.onerror = () => resolve(null);
    image.src = imageUrl;
  });

  artworkImageSamplerCache.set(imageUrl, samplerPromise);
  if (artworkImageSamplerCache.size > maximumCachedArtworkSamplers) {
    const oldestImageUrl = artworkImageSamplerCache.keys().next().value;
    if (oldestImageUrl) artworkImageSamplerCache.delete(oldestImageUrl);
  }
  void samplerPromise.then((sampler) => {
    if (!sampler && artworkImageSamplerCache.get(imageUrl) === samplerPromise) {
      artworkImageSamplerCache.delete(imageUrl);
    }
  });
  return samplerPromise;
};

export const createArtworkColorSampler = async (
  imageUrl: string
): Promise<ArtworkColorSampler | null> =>
  (await createArtworkImageSampler(imageUrl))?.sampleRegion ?? null;

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
