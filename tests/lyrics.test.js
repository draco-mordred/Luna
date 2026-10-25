const assert = require('node:assert/strict');
const test = require('node:test');
const iconv = require('iconv-lite');
const {
  decodeTextBuffer,
  extractEmbeddedLyrics,
  parseSyncedLyrics,
} = require('../public/lyrics');

test('decodes UTF-8 lyrics in non-Latin scripts', () => {
  const lyrics = 'こんにちは世界\nمرحبا بالعالم\nПривет, мир';
  assert.equal(decodeTextBuffer(Buffer.from(lyrics, 'utf8')), lyrics);
});

test('decodes UTF-16LE and UTF-16BE files with byte-order marks', () => {
  const lyrics = '日本語の歌詞 — Привет';
  const utf16le = Buffer.concat([Buffer.from([0xff, 0xfe]), iconv.encode(lyrics, 'utf16le')]);
  const utf16be = Buffer.concat([Buffer.from([0xfe, 0xff]), iconv.encode(lyrics, 'utf16-be')]);

  assert.equal(decodeTextBuffer(utf16le), lyrics);
  assert.equal(decodeTextBuffer(utf16be), lyrics);
});

test('detects legacy Cyrillic encoding', () => {
  const lyrics = 'Это пример текста песни на русском языке.';
  const encoded = iconv.encode(lyrics, 'windows-1251');
  assert.equal(decodeTextBuffer(encoded), lyrics);
});

test('parses multilingual LRC with multiple timestamps per line', () => {
  const lines = parseSyncedLyrics('[00:01.25][00:02,50]你好 — مرحبا\n[00:03.000]안녕하세요');
  assert.deepEqual(lines, [
    { time: 1.25, text: '你好 — مرحبا' },
    { time: 2.5, text: '你好 — مرحبا' },
    { time: 3, text: '안녕하세요' },
  ]);
});

test('parses multiline SRT and WebVTT cue text', () => {
  const lines = parseSyncedLyrics([
    'WEBVTT',
    '',
    '1',
    '00:00:01,250 --> 00:00:02,000',
    'こんにちは',
    'مرحبا',
    '',
    '00:00:03.500 --> 00:00:04.000',
    '안녕하세요',
  ].join('\n'));

  assert.deepEqual(lines, [
    { time: 1.25, text: 'こんにちは\nمرحبا' },
    { time: 3.5, text: '안녕하세요' },
  ]);
});

test('extracts lyrics only from embedded lyric fields, not other metadata', () => {
  const result = extractEmbeddedLyrics({
    common: {
      lyrics: [{ text: '嵌入された歌詞\nEmbedded lyrics' }],
      comment: [{ text: 'This is a comment, not lyrics.' }],
      description: 'Album description is not lyrics.',
    },
    native: {
      'ID3v2.4': [
        { id: 'TIT2', value: ['Track title'] },
        { id: 'COMM', value: [{ text: 'Another comment.' }] },
      ],
    },
  });

  assert.deepEqual(result, {
    lyrics: '嵌入された歌詞\nEmbedded lyrics',
    syncedLyrics: undefined,
  });
});

test('tracks are only marked as synced when an embedded lyric field contains timestamps', () => {
  const plain = extractEmbeddedLyrics({
    common: { lyrics: [{ text: 'Only plain embedded lyrics.' }] },
  });
  assert.equal(plain.lyrics, 'Only plain embedded lyrics.');
  assert.equal(plain.syncedLyrics, undefined);

  const synced = extractEmbeddedLyrics({
    common: { lyrics: [{ text: '[00:01.00]مرحبا\n[00:02.00]こんにちは' }] },
  });
  assert.deepEqual(synced.syncedLyrics, [
    { time: 1, text: 'مرحبا' },
    { time: 2, text: 'こんにちは' },
  ]);
});

test('deduplicates large repeated synchronized lyric cue sets', () => {
  const repeatedCues = Array.from({ length: 3000 }, () => '[00:01.00]Repeated lyric').join('\n');
  const result = extractEmbeddedLyrics({ common: { lyrics: [repeatedCues] } });

  assert.deepEqual(result.syncedLyrics, [{ time: 1, text: 'Repeated lyric' }]);
});

test('returns no lyrics when embedded lyric fields are absent', () => {
  const result = extractEmbeddedLyrics({
    common: {
      title: 'A song title',
      artist: 'An artist',
      comment: [{ text: 'A comment that must not appear as lyrics.' }],
      description: 'An album description.',
    },
    native: {
      'ID3v2.4': [{ id: 'TIT2', value: ['Another title'] }],
    },
  });

  assert.deepEqual(result, { lyrics: undefined, syncedLyrics: undefined });
});

test('never treats attached picture frames or image payloads as lyrics', () => {
  const imageData = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ...Buffer.from('[00:01.00]cover text', 'utf8'),
  ]);
  const result = extractEmbeddedLyrics({
    common: {
      lyrics: [
        { text: 'Actual embedded lyric.' },
        { format: 'image/png', data: imageData, description: '[00:01.00]cover description' },
      ],
      picture: [{ format: 'image/jpeg', data: imageData, description: 'Artwork metadata' }],
    },
    native: {
      'ID3v2.4': [
        { id: 'APIC', value: [{ format: 'image/png', data: imageData, description: '[00:02.00]cover frame' }] },
        { id: 'USLT', value: [{ text: 'Actual embedded lyric.' }] },
      ],
    },
  });

  assert.deepEqual(result, {
    lyrics: 'Actual embedded lyric.',
    syncedLyrics: undefined,
  });
});

test('rejects image bytes even when stored in an embedded lyrics field', () => {
  const encodedImageText = Buffer.from([
    0xff, 0xd8, 0xff,
    ...Buffer.from('[00:03.00]not a real lyric frame', 'utf8'),
  ]);
  const result = extractEmbeddedLyrics({ common: { lyrics: [encodedImageText] } });
  assert.deepEqual(result, { lyrics: undefined, syncedLyrics: undefined });
});

test('does not display image MIME labels or image-frame descriptions as lyrics', () => {
  const result = extractEmbeddedLyrics({
    common: {
      lyrics: ['image/jpeg', { text: 'image/png' }],
    },
    native: {
      'ID3v2.4': [
        { id: 'USLT', value: [{ description: 'image/jpeg', text: 'image/jpeg' }] },
        { id: 'APIC', value: [{ format: 'image/jpeg', description: 'Artwork description' }] },
      ],
    },
  });

  assert.deepEqual(result, { lyrics: undefined, syncedLyrics: undefined });
});
