package com.luna.music;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(AndroidMusicLibraryPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
