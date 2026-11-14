package com.luna.music;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;
import android.os.Bundle;
import android.graphics.Color;
import android.util.Base64;
import android.util.Log;

import com.getcapacitor.BridgeActivity;
import com.google.android.material.color.DynamicColors;

import androidx.activity.OnBackPressedCallback;
import androidx.core.content.ContextCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import androidx.core.splashscreen.SplashScreen;

import org.json.JSONException;
import org.json.JSONObject;

import java.nio.charset.StandardCharsets;

public class MainActivity extends BridgeActivity {
    private static final String USB_SYNC_ACTION = "com.luna.music.USB_SYNC_PROGRESS";
    private static final String TAG = "LunaMainActivity";
    private BroadcastReceiver usbSyncProgressReceiver;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        SplashScreen.installSplashScreen(this);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            DynamicColors.applyToActivityIfAvailable(this);
        }
        registerPlugin(AndroidMusicLibraryPlugin.class);
        super.onCreate(savedInstanceState);
        registerUsbSyncProgressReceiver();
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (getBridge() == null || getBridge().getWebView() == null) {
                    moveTaskToBack(true);
                    return;
                }
                getBridge().getWebView().evaluateJavascript(
                    "window.dispatchEvent(new Event('luna-android-back'))",
                    null
                );
            }
        });
        applyImmersiveMode();
    }

    @Override
    public void onDestroy() {
        if (usbSyncProgressReceiver != null) {
            unregisterReceiver(usbSyncProgressReceiver);
            usbSyncProgressReceiver = null;
        }
        super.onDestroy();
    }

    private void registerUsbSyncProgressReceiver() {
        usbSyncProgressReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                if (!USB_SYNC_ACTION.equals(intent.getAction())) return;
                String encodedPayload = intent.getStringExtra("luna_payload");
                if (encodedPayload == null || encodedPayload.length() > 8192) {
                    Log.w(TAG, "Ignoring invalid USB sync progress payload.");
                    return;
                }

                try {
                    byte[] decodedPayload = Base64.decode(encodedPayload, Base64.NO_WRAP);
                    JSONObject payload = new JSONObject(
                        new String(decodedPayload, StandardCharsets.UTF_8)
                    );
                    String phase = payload.optString("phase", "");
                    int current = payload.optInt("current", -1);
                    int total = payload.optInt("total", -1);
                    String trackName = payload.optString("trackName", "");
                    String fileName = payload.optString("fileName", "");
                    if (
                        !isValidSyncPhase(phase) ||
                        current < 0 ||
                        total < 0 ||
                        total > 2000 ||
                        current > total ||
                        trackName.length() > 512 ||
                        fileName.length() > 512
                    ) {
                        Log.w(TAG, "Ignoring malformed USB sync progress payload.");
                        return;
                    }

                    JSONObject detail = new JSONObject();
                    detail.put("phase", phase);
                    detail.put("current", current);
                    detail.put("total", total);
                    detail.put("trackName", trackName);
                    detail.put("fileName", fileName);
                    dispatchUsbSyncProgress(detail);
                } catch (IllegalArgumentException | JSONException exception) {
                    Log.w(TAG, "Unable to decode USB sync progress payload.", exception);
                }
            }
        };

        IntentFilter filter = new IntentFilter(USB_SYNC_ACTION);
        ContextCompat.registerReceiver(
            this,
            usbSyncProgressReceiver,
            filter,
            ContextCompat.RECEIVER_EXPORTED
        );
    }

    private boolean isValidSyncPhase(String phase) {
        return "started".equals(phase) ||
            "preparing".equals(phase) ||
            "copying".equals(phase) ||
            "manifest".equals(phase) ||
            "completed".equals(phase) ||
            "failed".equals(phase);
    }

    private void dispatchUsbSyncProgress(JSONObject detail) {
        runOnUiThread(() -> {
            if (getBridge() == null || getBridge().getWebView() == null) return;
            String quotedDetail = JSONObject.quote(detail.toString());
            getBridge().getWebView().evaluateJavascript(
                "window.dispatchEvent(new CustomEvent('luna-usb-sync-progress',{detail:JSON.parse(" +
                    quotedDetail +
                    ")}))",
                null
            );
        });
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) applyImmersiveMode();
    }

    private void applyImmersiveMode() {
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        getWindow().setStatusBarColor(Color.TRANSPARENT);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            getWindow().setStatusBarContrastEnforced(false);
        }
        WindowInsetsControllerCompat controller =
            WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        controller.setSystemBarsBehavior(
            WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        );
        controller.show(WindowInsetsCompat.Type.statusBars());
        controller.hide(WindowInsetsCompat.Type.navigationBars());
    }
}
