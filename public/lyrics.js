const chardet = require('chardet');
const iconv = require('iconv-lite');
const {
  combineLyricsValues,
  parseLyricsText,
  parseSyncedLyrics,
} = require('../src/utils/lyricsParser');

const decodeTextBuffer = (buffer, fallback = 'utf8') => {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) return '';

  let encoding = fallback;
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    encoding = 'utf16le';
    buffer = buffer.subarray(2);
  } else if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    encoding = 'utf16be';
    buffer = buffer.subarray(2);
  } else if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    encoding = 'utf8';
    buffer = buffer.subarray(3);
  } else {
    const detected = chardet.detect(buffer);
    if (typeof detected === 'string' && iconv.encodingExists(detected)) {
      encoding = detected;
    } else if (buffer.toString('utf8').includes('\uFFFD')) {
      encoding = 'windows-1252';
    }
  }

  try {
    return iconv.decode(buffer, encoding).replace(/^\uFEFF/, '').replace(/\u0000/g, '').trim();
  } catch (error) {
    return iconv.decode(buffer, 'utf8').replace(/^\uFEFF/, '').replace(/\u0000/g, '').trim();
  }
};

const normalizeTextValue = (value) => {
  if (value == null) return '';
  if (typeof value === 'string') return value.replace(/\u0000/g, '').replace(/^\uFEFF/, '').trim();
  if (Buffer.isBuffer(value)) return decodeTextBuffer(value);
  if (Array.isArray(value)) {
    return value.map(normalizeTextValue).filter(Boolean).join('\n');
  }
  if (typeof value === 'object') {
    if (typeof value.text === 'string') return normalizeTextValue(value.text);
    if (typeof value.value === 'string') return normalizeTextValue(value.value);
    if (typeof value.data === 'string' || Buffer.isBuffer(value.data)) return normalizeTextValue(value.data);
    if (typeof value.description === 'string' && !/lyrics/i.test(value.description)) {
      return normalizeTextValue(value.description);
    }
  }
  return '';
};

const isImageBuffer = (buffer) => (
  buffer.length >= 3
  && (
    (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff)
    || (buffer[0] === 0x89 && buffer.toString('ascii', 1, 4) === 'PNG')
    || (buffer.toString('ascii', 0, 3) === 'GIF')
    || (buffer.toString('ascii', 0, 2) === 'BM')
    || (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP')
  )
);

const isImageMetadata = (value) => {
  if (!value || typeof value !== 'object' || Buffer.isBuffer(value)) return false;
  const format = value.format ?? value.mime ?? value.mimeType ?? value.type;
  return typeof format === 'string' && (
    format.toLowerCase().startsWith('image/')
    || ['picture', 'image', 'coverart', 'cover art'].includes(format.toLowerCase())
  );
};

const extractLyricTextValues = (value) => {
  if (value == null) return [];
  if (Buffer.isBuffer(value)) {
    if (isImageBuffer(value)) return [];
    const text = normalizeTextValue(value);
    return text && !isImageMimeType(text) ? [text] : [];
  }
  if (typeof value === 'string') {
    const text = normalizeTextValue(value);
    return text && !isImageMimeType(text) ? [text] : [];
  }
  if (Array.isArray(value)) return value.flatMap(extractLyricTextValues);
  if (typeof value === 'object') {
    if (isImageMetadata(value)) return [];
    if (value.text !== undefined) return extractLyricTextValues(value.text);
    if (value.value !== undefined) return extractLyricTextValues(value.value);
  }
  return [];
};

const isImageMimeType = (text) => /^image\/(?:jpeg|jpg|png|gif|webp|bmp|tiff?|avif|heic)$/i.test(text.trim());

const extractEmbeddedLyrics = (metadata) => {
  const lyricValues = [
    ...extractLyricTextValues(metadata?.common?.lyrics),
    ...Object.entries(metadata?.native ?? {})
      .flatMap(([format, tags]) => /id3v2/i.test(format) && Array.isArray(tags) ? tags : [])
      .filter((tag) => ['USLT', 'ULT', 'SYLT'].includes(tag.id))
      .flatMap((tag) => extractLyricTextValues(tag.value)),
  ];

  return combineLyricsValues(lyricValues);
};

module.exports = {
  decodeTextBuffer,
  normalizeTextValue,
  combineLyricsValues,
  parseLyricsText,
  parseSyncedLyrics,
  extractEmbeddedLyrics,
};
