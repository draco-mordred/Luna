package com.luna.music;

import android.Manifest;
import android.content.ContentUris;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.util.Locale;

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
        )
    }
)
public class AndroidMusicLibraryPlugin extends Plugin {
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
            MediaStore.Audio.Media.MIME_TYPE
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

            while (cursor.moveToNext()) {
                long durationMillis = cursor.getLong(durationColumn);
                long size = cursor.getLong(sizeColumn);
                if (durationMillis <= 0 || size <= 0) continue;

                long mediaId = cursor.getLong(idColumn);
                Uri trackUri = ContentUris.withAppendedId(collection, mediaId);
                String fileName = valueOrDefault(cursor.getString(displayNameColumn), "Unknown audio");
                String mimeType = cursor.getString(mimeColumn);
                String format = getFormat(fileName, mimeType);
                JSObject track = new JSObject();
                track.put("id", trackUri.toString());
                track.put("path", trackUri.toString());
                track.put("src", trackUri.toString());
                track.put("filename", fileName);
                track.put("name", valueOrDefault(cursor.getString(titleColumn), fileName));
                track.put("artist", valueOrDefault(cursor.getString(artistColumn), "Unknown Artist"));
                track.put("album", valueOrDefault(cursor.getString(albumColumn), "Unknown Album"));
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
