package com.luna.music;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.media.MediaMetadata;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;

import androidx.core.app.NotificationManagerCompat;

public class NowPlayingService extends Service {
    public static final String ACTION_UPDATE = "com.luna.music.action.UPDATE";
    public static final String ACTION_CONTROL = "com.luna.music.action.CONTROL";
    public static final String EXTRA_ENABLED = "enabled";
    public static final String EXTRA_LOCK_SCREEN = "lockScreen";
    public static final String EXTRA_TITLE = "title";
    public static final String EXTRA_ARTIST = "artist";
    public static final String EXTRA_ALBUM = "album";
    public static final String EXTRA_PLAYING = "playing";
    public static final String EXTRA_POSITION = "position";
    public static final String EXTRA_DURATION = "duration";
    public static final String EXTRA_CONTROL = "control";

    private static final int NOTIFICATION_ID = 1001;
    private static final String CHANNEL_ID = "luna_media_playback";
    private MediaSession mediaSession;
    private String title = "Luna Music";
    private String artist = "";
    private String album = "";
    private boolean playing;
    private boolean lockScreenControls = true;
    private long position;
    private long duration;
    private PowerManager.WakeLock playbackWakeLock;

    @Override
    public void onCreate() {
        super.onCreate();
        mediaSession = new MediaSession(this, "Luna Music");
        mediaSession.setCallback(new MediaSession.Callback() {
            @Override
            public void onPlay() {
                sendControl("play", -1);
            }

            @Override
            public void onPause() {
                sendControl("pause", -1);
            }

            @Override
            public void onSkipToNext() {
                sendControl("next", -1);
            }

            @Override
            public void onSkipToPrevious() {
                sendControl("previous", -1);
            }

            @Override
            public void onSeekTo(long newPosition) {
                sendControl("seek", newPosition);
            }
        });
        mediaSession.setFlags(
            MediaSession.FLAG_HANDLES_MEDIA_BUTTONS |
                MediaSession.FLAG_HANDLES_TRANSPORT_CONTROLS
        );
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_CONTROL.equals(intent.getAction())) {
            String control = intent.getStringExtra(EXTRA_CONTROL);
            sendControl(control == null ? "" : control, -1);
            return START_NOT_STICKY;
        }
        if (intent == null || !ACTION_UPDATE.equals(intent.getAction())) {
            stopSelf(startId);
            return START_NOT_STICKY;
        }

        if (!intent.getBooleanExtra(EXTRA_ENABLED, false)) {
            stopPlaybackService();
            return START_NOT_STICKY;
        }

        title = intent.getStringExtra(EXTRA_TITLE) == null
            ? "Luna Music" : intent.getStringExtra(EXTRA_TITLE);
        artist = intent.getStringExtra(EXTRA_ARTIST) == null
            ? "" : intent.getStringExtra(EXTRA_ARTIST);
        album = intent.getStringExtra(EXTRA_ALBUM) == null
            ? "" : intent.getStringExtra(EXTRA_ALBUM);
        playing = intent.getBooleanExtra(EXTRA_PLAYING, false);
        lockScreenControls = intent.getBooleanExtra(EXTRA_LOCK_SCREEN, true);
        position = Math.max(0, intent.getLongExtra(EXTRA_POSITION, 0));
        duration = Math.max(0, intent.getLongExtra(EXTRA_DURATION, 0));

        updateMediaSession();
        updatePlaybackWakeLock();
        Notification notification = buildNotification();
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(NOTIFICATION_ID, notification, android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
            } else {
                startForeground(NOTIFICATION_ID, notification);
            }
        } catch (SecurityException error) {
            android.util.Log.e("Luna", "Could not start media playback foreground service.", error);
            stopPlaybackService();
        }
        return START_NOT_STICKY;
    }

    private void updateMediaSession() {
        mediaSession.setMetadata(new MediaMetadata.Builder()
            .putString(MediaMetadata.METADATA_KEY_TITLE, title)
            .putString(MediaMetadata.METADATA_KEY_ARTIST, artist)
            .putString(MediaMetadata.METADATA_KEY_ALBUM, album)
            .putLong(MediaMetadata.METADATA_KEY_DURATION, duration)
            .build());

        long actions = PlaybackState.ACTION_PLAY |
            PlaybackState.ACTION_PAUSE |
            PlaybackState.ACTION_PLAY_PAUSE |
            PlaybackState.ACTION_SKIP_TO_PREVIOUS |
            PlaybackState.ACTION_SKIP_TO_NEXT |
            PlaybackState.ACTION_SEEK_TO;
        mediaSession.setPlaybackState(new PlaybackState.Builder()
            .setActions(actions)
            .setState(
                playing ? PlaybackState.STATE_PLAYING : PlaybackState.STATE_PAUSED,
                position,
                playing ? 1f : 0f
            )
            .build());
        mediaSession.setActive(lockScreenControls);
    }

    private void updatePlaybackWakeLock() {
        PowerManager powerManager = (PowerManager) getSystemService(POWER_SERVICE);
        if (playing) {
            if (playbackWakeLock == null) {
                playbackWakeLock = powerManager.newWakeLock(
                    PowerManager.PARTIAL_WAKE_LOCK,
                    "Luna:MediaPlayback"
                );
                playbackWakeLock.setReferenceCounted(false);
            }
            if (!playbackWakeLock.isHeld()) playbackWakeLock.acquire(4 * 60 * 60 * 1000L);
            return;
        }
        releasePlaybackWakeLock();
    }

    private void releasePlaybackWakeLock() {
        if (playbackWakeLock != null && playbackWakeLock.isHeld()) {
            playbackWakeLock.release();
        }
        playbackWakeLock = null;
    }

    private Notification buildNotification() {
        Intent launchIntent = getPackageManager().getLaunchIntentForPackage(getPackageName());
        PendingIntent contentIntent = launchIntent == null
            ? null
            : PendingIntent.getActivity(
                this,
                0,
                launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT |
                    (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
            );
        Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? new Notification.Builder(this, CHANNEL_ID)
            : new Notification.Builder(this);
        builder
            .setSmallIcon(R.drawable.ic_stat_luna)
            .setContentTitle(title)
            .setContentText(artist)
            .setContentIntent(contentIntent)
            .setCategory(Notification.CATEGORY_TRANSPORT)
            .setVisibility(lockScreenControls
                ? Notification.VISIBILITY_PUBLIC
                : Notification.VISIBILITY_PRIVATE)
            .setOnlyAlertOnce(true)
            .setOngoing(playing)
            .setShowWhen(false)
            .addAction(action(android.R.drawable.ic_media_previous, "Previous", "previous"))
            .addAction(
                action(
                    playing ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play,
                    playing ? "Pause" : "Play",
                    playing ? "pause" : "play"
                )
            )
            .addAction(action(android.R.drawable.ic_media_next, "Next", "next"));
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            builder.setSubText(album + " · " + getString(R.string.app_name));
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            builder.setStyle(new Notification.MediaStyle()
                .setMediaSession(mediaSession.getSessionToken())
                .setShowActionsInCompactView(0, 1, 2));
        }
        return builder.build();
    }

    private Notification.Action action(int icon, String label, String control) {
        Intent intent = new Intent(this, NowPlayingService.class);
        intent.setAction(ACTION_CONTROL);
        intent.putExtra(EXTRA_CONTROL, control);
        PendingIntent pendingIntent = PendingIntent.getService(
            this,
            control.hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT |
                (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
        );
        return new Notification.Action.Builder(icon, label, pendingIntent).build();
    }

    private void sendControl(String control, long seekPosition) {
        Intent intent = new Intent(ACTION_CONTROL);
        intent.setPackage(getPackageName());
        intent.putExtra(EXTRA_CONTROL, control);
        if (seekPosition >= 0) intent.putExtra(EXTRA_POSITION, seekPosition);
        sendBroadcast(intent);
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = getSystemService(NotificationManager.class);
        manager.createNotificationChannel(new NotificationChannel(
            CHANNEL_ID,
            "Playback",
            NotificationManager.IMPORTANCE_LOW
        ));
    }

    private void stopPlaybackService() {
        releasePlaybackWakeLock();
        if (mediaSession != null) {
            mediaSession.setActive(false);
            mediaSession.release();
            mediaSession = null;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE);
        } else {
            stopForeground(true);
        }
        NotificationManagerCompat.from(this).cancel(NOTIFICATION_ID);
        stopSelf();
    }

    @Override
    public void onDestroy() {
        releasePlaybackWakeLock();
        if (mediaSession != null) {
            mediaSession.setActive(false);
            mediaSession.release();
            mediaSession = null;
        }
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
