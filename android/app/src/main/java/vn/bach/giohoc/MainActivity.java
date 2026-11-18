package vn.bach.giohoc;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.webkit.GeolocationPermissions;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

public class MainActivity extends Activity {
    static final int REQ_PERMS = 11, REQ_CAMERA = 12, REQ_FILE = 21;

    WebView web;
    Bridge bridge;
    ValueCallback<Uri[]> fileCb;
    PermissionRequest pendingPerm;
    JSONObject pendingUpdate;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(0xFF0F766E);
        Notifs.channel(this);

        web = new WebView(this);
        setContentView(web);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setGeolocationEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        int zoom = Math.round(getResources().getConfiguration().fontScale * 100);
        s.setTextZoom(Math.max(85, Math.min(zoom, 110)));
        s.setUserAgentString(s.getUserAgentString() + " GioHocApp/" + BuildConfig.VERSION_NAME);

        bridge = new Bridge(this, web);
        web.addJavascriptInterface(bridge, "Native");

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                String home = Uri.parse(BuildConfig.WEB_URL).getHost();
                if (u.getHost() != null && u.getHost().equals(home)) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception ignored) { }
                return true;
            }

            @Override
            public void onReceivedError(WebView v, WebResourceRequest r, WebResourceError e) {
                if (r.isForMainFrame()) v.loadUrl("file:///android_asset/offline.html");
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest req) {
                runOnUiThread(() -> {
                    if (checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                        req.grant(req.getResources());
                    } else {
                        pendingPerm = req;
                        requestPermissions(new String[]{Manifest.permission.CAMERA}, REQ_CAMERA);
                    }
                });
            }

            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback cb) {
                cb.invoke(origin, true, false);
            }

            @Override
            public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams p) {
                if (fileCb != null) fileCb.onReceiveValue(null);
                fileCb = cb;
                try {
                    startActivityForResult(p.createIntent(), REQ_FILE);
                } catch (Exception e) {
                    fileCb = null;
                    return false;
                }
                return true;
            }
        });

        askPermissions();
        web.loadUrl(BuildConfig.WEB_URL);
        Updater.check(this, false);
        handleIntent(getIntent());
    }

    void askPermissions() {
        List<String> need = new ArrayList<>();
        String[] all = Build.VERSION.SDK_INT >= 33
                ? new String[]{Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION, Manifest.permission.POST_NOTIFICATIONS}
                : new String[]{Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION};
        for (String p : all) if (checkSelfPermission(p) != PackageManager.PERMISSION_GRANTED) need.add(p);
        if (!need.isEmpty()) requestPermissions(need.toArray(new String[0]), REQ_PERMS);
    }

    @Override
    public void onRequestPermissionsResult(int code, String[] perms, int[] res) {
        super.onRequestPermissionsResult(code, perms, res);
        if (code == REQ_CAMERA && pendingPerm != null) {
            if (res.length > 0 && res[0] == PackageManager.PERMISSION_GRANTED) pendingPerm.grant(pendingPerm.getResources());
            else pendingPerm.deny();
            pendingPerm = null;
        }
        if (code == REQ_PERMS) bridge.restartLocation();
    }

    @Override
    protected void onActivityResult(int code, int result, Intent data) {
        super.onActivityResult(code, result, data);
        if (code == REQ_FILE && fileCb != null) {
            fileCb.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result, data));
            fileCb = null;
        }
    }

    @Override
    protected void onNewIntent(Intent i) {
        super.onNewIntent(i);
        handleIntent(i);
    }

    void handleIntent(Intent i) {
        if (i != null && i.getBooleanExtra("update", false)) Updater.check(this, true);
        if (i != null && i.getBooleanExtra("notifs", false)) bridge.js("window.__nativeOpen&&window.__nativeOpen('notifs')");
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (pendingUpdate != null && (Build.VERSION.SDK_INT < 26 || getPackageManager().canRequestPackageInstalls())) {
            JSONObject j = pendingUpdate;
            pendingUpdate = null;
            Updater.start(this, j);
        }
        bridge.js("window.__nativeResume&&window.__nativeResume()");
    }

    @Override
    public void onBackPressed() {
        web.evaluateJavascript("(window.__nativeBack?window.__nativeBack():'exit')", r -> {
            if (r == null || r.contains("exit")) {
                if (web.canGoBack()) web.goBack();
                else moveTaskToBack(true);
            }
        });
    }

    @Override
    protected void onDestroy() {
        bridge.stopLoc();
        super.onDestroy();
    }

    void reload() {
        runOnUiThread(() -> web.loadUrl(BuildConfig.WEB_URL));
    }
}
