package com.luna.music;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.ContentUris;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;
import android.util.Base64;
import android.util.TypedValue;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.ByteArrayOutputStream;
import java.io.FileNotFoundException;
import java.io.InputStream;
import java.nio.charset.Charset;
import java.util.Locale;
import java.util.ArrayList;
import java.util.List;

@CapacitorPlugin(
    name = "AndroidMusicLibrary",
    permissions = {
        @Permission(
            alias = "audio",
            strings = { Manifest.permission.READ_MEDIA_AUDIO }
        ),
        @Permission(
            alias = "legacyAudio",
            strings = { Manifest.permission.READ_EXTERNAL_STORAGE }
        ),
        @Permission(
            alias = "notifications",
            strings = { Manifest.permission.POST_NOTIFICATIONS }
        )
    }
)
public class AndroidMusicLibraryPlugin extends Plugin {
    private static final int MAX_ID3_TAG_SIZE = 8 * 1024 * 1024;
    private static final int MAX_ARTWORK_DIMENSION = 320;
    private BroadcastReceiver mediaControlReceiver;
    private boolean mediaServiceStarted;
    private boolean notificationPermissionRequestPending;

    @Override
    public void load() {
        super.load();
        mediaControlReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                JSObject event = new JSObject();
                event.put("control", intent.getStringExtra(NowPlayingService.EXTRA_CONTROL));
                if (intent.hasExtra(NowPlayingService.EXTRA_POSITION)) {
                    event.put(
                        "position",
                        intent.getLongExtra(NowPlayingService.EXTRA_POSITION, 0) / 1000.0
                    );
                }
                notifyListeners("mediaControl", event);
            }
        };
        IntentFilter filter = new IntentFilter(NowPlayingService.ACTION_CONTROL);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            getContext().registerReceiver(
                mediaControlReceiver,
                filter,
                Context.RECEIVER_NOT_EXPORTED
            );
        } else {
            getContext().registerReceiver(mediaControlReceiver, filter);
        }
    }

    @Override
    protected void handleOnDestroy() {
        if (mediaControlReceiver != null) {
            getContext().unregisterReceiver(mediaControlReceiver);
            mediaControlReceiver = null;
        }
        super.handleOnDestroy();
    }

    @PluginMethod
    public void getAppearance(PluginCall call) {
        JSObject result = new JSObject();
        int apiLevel = Build.VERSION.SDK_INT;
        result.put("apiLevel", apiLevel);
        result.put("supportsMaterialYou", apiLevel >= Build.VERSION_CODES.S);

        if (apiLevel >= Build.VERSION_CODES.S) {
            JSObject colors = new JSObject();
            int[] colorAttributes = {
                com.google.android.material.R.attr.colorPrimary,
                com.google.android.material.R.attr.colorOnPrimary,
                com.google.android.material.R.attr.colorPrimaryContainer,
                com.google.android.material.R.attr.colorOnPrimaryContainer,
                com.google.android.material.R.attr.colorSecondary,
                com.google.android.material.R.attr.colorTertiary,
                com.google.android.material.R.attr.colorSurface,
                com.google.android.material.R.attr.colorOnSurface,
                com.google.android.material.R.attr.colorSurfaceVariant,
                com.google.android.material.R.attr.colorOnSurfaceVariant,
                com.google.android.material.R.attr.colorOutline,
                com.google.android.material.R.attr.colorOutlineVariant
            };
            String[] colorRoles = {
                "primary",
                "onPrimary",
                "primaryContainer",
                "onPrimaryContainer",
                "secondary",
                "tertiary",
                "surface",
                "onSurface",
                "surfaceVariant",
                "onSurfaceVariant",
                "outline",
                "outlineVariant"
            };
            for (int index = 0; index < colorAttributes.length; index++) {
                int color = resolveThemeColor(colorAttributes[index]);
                if (color != Color.TRANSPARENT) {
                    colors.put(
                        colorRoles[index],
                        String.format(Locale.ROOT, "#%06X", 0xFFFFFF & color)
                    );
                }
            }
            result.put("colors", colors);
        }

        call.resolve(result);
    }

    @PluginMethod
    public void getDeviceInfo(PluginCall call) {
        JSObject result = new JSObject();
        result.put("manufacturer", Build.MANUFACTURER == null ? "" : Build.MANUFACTURER.trim());
        result.put("model", Build.MODEL == null ? "" : Build.MODEL.trim());
        result.put("androidVersion", Build.VERSION.RELEASE == null ? "Unknown" : Build.VERSION.RELEASE);
        result.put("apiLevel", Build.VERSION.SDK_INT);
        call.resolve(result);
    }

    @PluginMethod
    public void getAlbumArtwork(PluginCall call) {
        String albumId = call.getString("albumId");
        if (albumId == null || !albumId.matches("\\d+")) {
            call.reject("A valid Android album ID is required.");
            return;
        }

        Uri artworkUri = Uri.parse("content://media/external/audio/albumart/" + albumId);
        try (InputStream input = getContext().getContentResolver().openInputStream(artworkUri)) {
            Bitmap artwork = input == null ? null : BitmapFactory.decodeStream(input);
            if (artwork == null) {
                JSObject result = new JSObject();
                result.put("dataUrl", (String) null);
                call.resolve(result);
                return;
            }

            Bitmap thumbnail = resizeArtwork(artwork);
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            thumbnail.compress(Bitmap.CompressFormat.JPEG, 82, output);
            if (thumbnail != artwork) thumbnail.recycle();
            artwork.recycle();

            JSObject result = new JSObject();
            result.put("dataUrl", "data:image/jpeg;base64," +
                Base64.encodeToString(output.toByteArray(), Base64.NO_WRAP));
            call.resolve(result);
        } catch (FileNotFoundException missingArtwork) {
            JSObject result = new JSObject();
            result.put("dataUrl", (String) null);
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Could not read album artwork from Android media storage.", error);
        }
    }

    @PluginMethod
    public void updateNowPlaying(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            getPermissionState("notifications") != PermissionState.GRANTED) {
            if (notificationPermissionRequestPending) {
                call.reject("Android notification permission is already being requested.");
                return;
            }
            notificationPermissionRequestPending = true;
            requestPermissionForAlias("notifications", call, "updateNowPlayingAfterPermission");
            return;
        }
        updateNowPlayingService(call);
    }

    @PermissionCallback
    private void updateNowPlayingAfterPermission(PluginCall call) {
        notificationPermissionRequestPending = false;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            getPermissionState("notifications") != PermissionState.GRANTED) {
            call.reject(
                "Allow notifications for Android playback controls.",
                "PERMISSION_DENIED"
            );
            return;
        }
        updateNowPlayingService(call);
    }

    @PluginMethod
    public void clearNowPlaying(PluginCall call) {
        getContext().stopService(new Intent(getContext(), NowPlayingService.class));
        mediaServiceStarted = false;
        call.resolve();
    }

    private void updateNowPlayingService(PluginCall call) {
        boolean enabled = call.getBoolean("enabled", true);
        if (!enabled) {
            getContext().stopService(new Intent(getContext(), NowPlayingService.class));
            mediaServiceStarted = false;
            call.resolve();
            return;
        }

        String title = call.getString("title");
        String artist = call.getString("artist");
        String album = call.getString("album");
        if (title == null || artist == null || album == null) {
            call.reject("Track title, artist, and album are required.");
            return;
        }

        Intent service = new Intent(getContext(), NowPlayingService.class)
            .setAction(NowPlayingService.ACTION_UPDATE)
            .putExtra(NowPlayingService.EXTRA_ENABLED, true)
            .putExtra(NowPlayingService.EXTRA_LOCK_SCREEN, call.getBoolean("lockScreen", true))
            .putExtra(NowPlayingService.EXTRA_TITLE, title)
            .putExtra(NowPlayingService.EXTRA_ARTIST, artist)
            .putExtra(NowPlayingService.EXTRA_ALBUM, album)
            .putExtra(NowPlayingService.EXTRA_PLAYING, call.getBoolean("isPlaying", false))
            .putExtra(
                NowPlayingService.EXTRA_POSITION,
                (long) (call.getDouble("position", 0.0) * 1000)
            )
            .putExtra(
                NowPlayingService.EXTRA_DURATION,
                (long) (call.getDouble("duration", 0.0) * 1000)
            );
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !mediaServiceStarted) {
                getContext().startForegroundService(service);
            } else {
                getContext().startService(service);
            }
            mediaServiceStarted = true;
            call.resolve();
        } catch (Exception error) {
            mediaServiceStarted = false;
            call.reject("Could not start Android playback controls.", error);
        }
    }

    @PluginMethod
    public void scan(PluginCall call) {
        String permissionAlias = getAudioPermissionAlias();
        if (getPermissionState(permissionAlias) != PermissionState.GRANTED) {
            requestPermissionForAlias(permissionAlias, call, "scanAfterPermission");
            return;
        }
        scanGrantedLibrary(call);
    }

    @PermissionCallback
    private void scanAfterPermission(PluginCall call) {
        if (getPermissionState(getAudioPermissionAlias()) != PermissionState.GRANTED) {
            call.reject("Luna needs permission to read audio files on this device.", "PERMISSION_DENIED");
            return;
        }
        scanGrantedLibrary(call);
    }

    private String getAudioPermissionAlias() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU ? "audio" : "legacyAudio";
    }

    private int resolveThemeColor(int attributeId) {
        TypedValue value = new TypedValue();
        if (!getActivity().getTheme().resolveAttribute(attributeId, value, true)) {
            return Color.TRANSPARENT;
        }
        if (value.resourceId != 0) {
            return getContext().getResources().getColor(value.resourceId, getActivity().getTheme());
        }
        return value.data;
    }

    private void scanGrantedLibrary(PluginCall call) {
        Uri collection = MediaStore.Audio.Media.EXTERNAL_CONTENT_URI;
        String[] projection = {
            MediaStore.Audio.Media._ID,
            MediaStore.Audio.Media.DISPLAY_NAME,
            MediaStore.Audio.Media.TITLE,
            MediaStore.Audio.Media.ARTIST,
            MediaStore.Audio.Media.ALBUM,
            MediaStore.Audio.Media.DURATION,
            MediaStore.Audio.Media.SIZE,
            MediaStore.Audio.Media.DATE_MODIFIED,
            MediaStore.Audio.Media.TRACK,
            MediaStore.Audio.Media.YEAR,
            MediaStore.Audio.Media.MIME_TYPE,
            MediaStore.Audio.Media.ALBUM_ID
        };
        String sortOrder = MediaStore.Audio.Media.TITLE + " COLLATE NOCASE ASC";

        try (Cursor cursor = getContext().getContentResolver().query(
            collection,
            projection,
            null,
            null,
            sortOrder
        )) {
            if (cursor == null) {
                call.reject("Android could not read the device audio library.");
                return;
            }

            JSArray tracks = new JSArray();
            int idColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media._ID);
            int displayNameColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DISPLAY_NAME);
            int titleColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.TITLE);
            int artistColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ARTIST);
            int albumColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ALBUM);
            int durationColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DURATION);
            int sizeColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.SIZE);
            int modifiedColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DATE_MODIFIED);
            int trackColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.TRACK);
            int yearColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.YEAR);
            int mimeColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.MIME_TYPE);
            int albumIdColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ALBUM_ID);

            while (cursor.moveToNext()) {
                long durationMillis = cursor.getLong(durationColumn);
                long size = cursor.getLong(sizeColumn);
                if (durationMillis <= 0 || size <= 0) continue;

                long mediaId = cursor.getLong(idColumn);
                Uri trackUri = ContentUris.withAppendedId(collection, mediaId);
                String fileName = valueOrDefault(cursor.getString(displayNameColumn), "Unknown audio");
                String mimeType = cursor.getString(mimeColumn);
                String format = getFormat(fileName, mimeType);
                long albumId = cursor.getLong(albumIdColumn);
                JSObject track = new JSObject();
                track.put("id", trackUri.toString());
                track.put("path", trackUri.toString());
                track.put("src", trackUri.toString());
                track.put("filename", fileName);
                track.put("name", valueOrDefault(cursor.getString(titleColumn), fileName));
                track.put("artist", valueOrDefault(cursor.getString(artistColumn), "Unknown Artist"));
                track.put("album", valueOrDefault(cursor.getString(albumColumn), "Unknown Album"));
                if (albumId > 0) track.put("androidAlbumId", String.valueOf(albumId));
                EmbeddedLyrics embeddedLyrics =
                    "mp3".equals(format) ? extractEmbeddedLyrics(trackUri) : null;
                if (embeddedLyrics != null && !embeddedLyrics.text.trim().isEmpty()) {
                    track.put("lyrics", embeddedLyrics.text);
                    if (embeddedLyrics.syncedLines.length() > 0) {
                        track.put("syncedLyrics", embeddedLyrics.syncedLines);
                    }
                }
                track.put("duration", durationMillis / 1000.0);
                track.put("trackNumber", positiveValue(cursor.getInt(trackColumn)));
                track.put("year", positiveValue(cursor.getInt(yearColumn)));
                track.put("format", format);
                track.put("size", size);
                track.put("lastModified", cursor.getLong(modifiedColumn) * 1000L);
                tracks.put(track);
            }

            JSArray folders = new JSArray();
            folders.put("Device audio library");
            JSArray errors = new JSArray();
            JSObject result = new JSObject();
            result.put("tracks", tracks);
            result.put("folders", folders);
            result.put("errors", errors);
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Could not scan the Android audio library.", error);
        }
    }

    private Bitmap resizeArtwork(Bitmap artwork) {
        int largestDimension = Math.max(artwork.getWidth(), artwork.getHeight());
        if (largestDimension <= MAX_ARTWORK_DIMENSION) return artwork;
        float scale = (float) MAX_ARTWORK_DIMENSION / largestDimension;
        return Bitmap.createScaledBitmap(
            artwork,
            Math.max(1, Math.round(artwork.getWidth() * scale)),
            Math.max(1, Math.round(artwork.getHeight() * scale)),
            true
        );
    }

    private EmbeddedLyrics extractEmbeddedLyrics(Uri trackUri) {
        try (InputStream input = getContext().getContentResolver().openInputStream(trackUri)) {
            if (input == null) return null;
            byte[] header = readBytes(input, 10);
            if (header.length != 10 || header[0] != 'I' || header[1] != 'D' || header[2] != '3') {
                return null;
            }
            int version = header[3] & 0xFF;
            if (version < 3 || version > 4) return null;
            int tagSize = synchsafeInt(header, 6);
            if (tagSize <= 0 || tagSize > MAX_ID3_TAG_SIZE) return null;
            byte[] tag = readBytes(input, tagSize);
            int offset = 0;
            if ((header[5] & 0x40) != 0 && tag.length >= 4) {
                offset = version == 3 ? 4 + bigEndianInt(tag, 0) : synchsafeInt(tag, 0);
            }

            String lyricsText = null;
            JSArray syncedLines = new JSArray();
            while (offset + 10 <= tag.length) {
                String frameId = new String(tag, offset, 4, Charset.forName("ISO-8859-1"));
                if (frameId.trim().isEmpty()) break;
                int frameSize = version == 4
                    ? synchsafeInt(tag, offset + 4)
                    : bigEndianInt(tag, offset + 4);
                int frameStart = offset + 10;
                if (frameSize <= 0 || frameStart + frameSize > tag.length) break;
                if ("USLT".equals(frameId)) {
                    lyricsText = decodeUnsynchronizedLyrics(tag, frameStart, frameSize);
                    List<SyncedLine> lrcLines = parseLrcLyrics(lyricsText);
                    if (!lrcLines.isEmpty()) {
                        return new EmbeddedLyrics(lyricsText, toJsArray(lrcLines));
                    }
                } else if ("SYLT".equals(frameId)) {
                    List<SyncedLine> lines = decodeSynchronizedLyrics(tag, frameStart, frameSize);
                    if (!lines.isEmpty()) {
                        return new EmbeddedLyrics(
                            lyricsText == null ? joinLyrics(lines) : lyricsText,
                            toJsArray(lines)
                        );
                    }
                }
                offset = frameStart + frameSize;
            }
            if (lyricsText != null) return new EmbeddedLyrics(lyricsText, syncedLines);
        } catch (Exception error) {
            android.util.Log.w("Luna", "Could not read embedded lyrics.", error);
        }
        return null;
    }

    private static List<SyncedLine> parseLrcLyrics(String lyrics) {
        List<SyncedLine> lines = new ArrayList<>();
        if (lyrics == null) return lines;
        java.util.regex.Pattern timestamp = java.util.regex.Pattern.compile(
            "\\[(\\d{1,3}):(\\d{2})(?:[.:](\\d{1,3}))?\\]"
        );
        for (String line : lyrics.split("\\r?\\n")) {
            java.util.regex.Matcher matcher = timestamp.matcher(line);
            List<Double> times = new ArrayList<>();
            int textStart = 0;
            while (matcher.find()) {
                double fraction = 0;
                String fractionText = matcher.group(3);
                if (fractionText != null) {
                    fraction = Integer.parseInt(fractionText) /
                        Math.pow(10, fractionText.length());
                }
                times.add(Integer.parseInt(matcher.group(1)) * 60.0 +
                    Integer.parseInt(matcher.group(2)) + fraction);
                textStart = matcher.end();
            }
            String text = line.substring(textStart).trim();
            for (Double time : times) {
                if (!text.isEmpty()) lines.add(new SyncedLine(time, text));
            }
        }
        lines.sort((first, second) -> Double.compare(first.time, second.time));
        return lines;
    }

    private static List<SyncedLine> decodeSynchronizedLyrics(
        byte[] tag,
        int start,
        int length
    ) {
        List<SyncedLine> lines = new ArrayList<>();
        if (length < 8) return lines;
        int encoding = tag[start] & 0xFF;
        int timestampFormat = tag[start + 4] & 0xFF;
        if (timestampFormat != 1 && timestampFormat != 2) return lines;
        Charset charset = encoding == 1
            ? Charset.forName("UTF-16")
            : encoding == 2
                ? Charset.forName("UTF-16BE")
                : encoding == 3
                    ? Charset.forName("UTF-8")
                    : Charset.forName("ISO-8859-1");
        int terminatorLength = encoding == 1 || encoding == 2 ? 2 : 1;
        int end = start + length;
        int descriptorEnd = findTextTerminator(tag, start + 6, end, terminatorLength);
        if (descriptorEnd < 0) return lines;
        int cursor = descriptorEnd + terminatorLength;
        while (cursor + 4 <= end) {
            int textEnd = findTextTerminator(tag, cursor, end, terminatorLength);
            if (textEnd < 0 || textEnd + terminatorLength + 4 > end) break;
            String text = new String(tag, cursor, textEnd - cursor, charset).trim();
            cursor = textEnd + terminatorLength;
            long timestamp = bigEndianUnsignedInt(tag, cursor);
            cursor += 4;
            if (!text.isEmpty()) {
                double seconds = timestampFormat == 2
                    ? timestamp / 1000.0
                    : timestamp * (1000.0 / 75.0) / 1000.0;
                lines.add(new SyncedLine(seconds, text));
            }
        }
        lines.sort((first, second) -> Double.compare(first.time, second.time));
        return lines;
    }

    private static int findTextTerminator(
        byte[] bytes,
        int start,
        int end,
        int terminatorLength
    ) {
        for (int index = start; index + terminatorLength <= end; index += terminatorLength) {
            if (bytes[index] == 0 &&
                (terminatorLength == 1 || bytes[index + 1] == 0)) {
                return index;
            }
        }
        return -1;
    }

    private static long bigEndianUnsignedInt(byte[] bytes, int offset) {
        return ((long) (bytes[offset] & 0xFF) << 24)
            | ((long) (bytes[offset + 1] & 0xFF) << 16)
            | ((long) (bytes[offset + 2] & 0xFF) << 8)
            | (long) (bytes[offset + 3] & 0xFF);
    }

    private static JSArray toJsArray(List<SyncedLine> lines) throws Exception {
        JSArray result = new JSArray();
        for (SyncedLine line : lines) {
            JSObject item = new JSObject();
            item.put("time", line.time);
            item.put("text", line.text);
            result.put(item);
        }
        return result;
    }

    private static String joinLyrics(List<SyncedLine> lines) {
        StringBuilder text = new StringBuilder();
        for (SyncedLine line : lines) {
            if (text.length() > 0) text.append('\n');
            text.append(line.text);
        }
        return text.toString();
    }

    private static final class SyncedLine {
        final double time;
        final String text;

        SyncedLine(double time, String text) {
            this.time = time;
            this.text = text;
        }
    }

    private static final class EmbeddedLyrics {
        final String text;
        final JSArray syncedLines;

        EmbeddedLyrics(String text, JSArray syncedLines) {
            this.text = text;
            this.syncedLines = syncedLines;
        }
    }

    private static String decodeUnsynchronizedLyrics(byte[] tag, int start, int length) {
        if (length < 5) return null;
        int encoding = tag[start] & 0xFF;
        int terminatorLength = encoding == 1 || encoding == 2 ? 2 : 1;
        int textStart = start + 4;
        int end = start + length;
        int descriptorEnd = textStart;
        while (descriptorEnd + terminatorLength <= end) {
            if (tag[descriptorEnd] == 0 &&
                (terminatorLength == 1 || tag[descriptorEnd + 1] == 0)) {
                descriptorEnd += terminatorLength;
                break;
            }
            descriptorEnd += terminatorLength;
        }
        if (descriptorEnd >= end) return null;
        Charset charset = encoding == 1
            ? Charset.forName("UTF-16")
            : encoding == 2
                ? Charset.forName("UTF-16BE")
                : encoding == 3
                    ? Charset.forName("UTF-8")
                    : Charset.forName("ISO-8859-1");
        String lyrics = new String(tag, descriptorEnd, end - descriptorEnd, charset);
        return lyrics.replace("\u0000", "").trim();
    }

    private static byte[] readBytes(InputStream input, int requestedLength) throws Exception {
        byte[] result = new byte[requestedLength];
        int offset = 0;
        while (offset < requestedLength) {
            int count = input.read(result, offset, requestedLength - offset);
            if (count < 0) break;
            offset += count;
        }
        if (offset == requestedLength) return result;
        byte[] partial = new byte[offset];
        System.arraycopy(result, 0, partial, 0, offset);
        return partial;
    }

    private static int synchsafeInt(byte[] bytes, int offset) {
        if (offset + 4 > bytes.length) return 0;
        return ((bytes[offset] & 0x7F) << 21)
            | ((bytes[offset + 1] & 0x7F) << 14)
            | ((bytes[offset + 2] & 0x7F) << 7)
            | (bytes[offset + 3] & 0x7F);
    }

    private static int bigEndianInt(byte[] bytes, int offset) {
        if (offset + 4 > bytes.length) return 0;
        return ((bytes[offset] & 0xFF) << 24)
            | ((bytes[offset + 1] & 0xFF) << 16)
            | ((bytes[offset + 2] & 0xFF) << 8)
            | (bytes[offset + 3] & 0xFF);
    }

    private static String valueOrDefault(String value, String fallback) {
        if (value == null || value.trim().isEmpty() || value.equals("<unknown>")) return fallback;
        return value.trim();
    }

    private static int positiveValue(int value) {
        return value > 0 ? value : 0;
    }

    private static String getFormat(String fileName, String mimeType) {
        int extensionIndex = fileName.lastIndexOf('.');
        if (extensionIndex >= 0 && extensionIndex < fileName.length() - 1) {
            return fileName.substring(extensionIndex + 1).toLowerCase(Locale.ROOT);
        }
        if (mimeType != null && mimeType.startsWith("audio/")) {
            return mimeType.substring("audio/".length()).toLowerCase(Locale.ROOT);
        }
        return "audio";
    }
}
