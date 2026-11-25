package vn.bach.giohoc;

import android.Manifest;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.net.Uri;
import android.net.wifi.WifiInfo;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.Looper;
import android.os.SystemClock;
import android.provider.MediaStore;
import android.provider.Settings;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.widget.Toast;

import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

public class Bridge {
    final MainActivity act;
    final WebView web;
    LocationManager lm;
    LocationListener ll;

    Bridge(MainActivity a, WebView w) { act = a; web = w; }

    void js(String code) { web.post(() -> web.evaluateJavascript(code, null)); }

    static String deviceId(Context c) {
        String id = Settings.Secure.getString(c.getContentResolver(), Settings.Secure.ANDROID_ID);
        return "A" + (id == null ? "0" : id.toUpperCase());
    }

    @JavascriptInterface
    public String info() {
        JSONObject o = new JSONObject();
        try {
            o.put("app", "android");
            o.put("versionName", BuildConfig.VERSION_NAME);
            o.put("versionCode", BuildConfig.VERSION_CODE);
            o.put("deviceId", deviceId(act));
            o.put("sdk", Build.VERSION.SDK_INT);
            o.put("model", Build.MANUFACTURER + " " + Build.MODEL);
        } catch (Exception ignored) { }
        return o.toString();
    }

    /* ---------- Vị trí (GPS gốc của máy, có phát hiện vị trí giả) ---------- */
    @JavascriptInterface
    public void startLocation() { act.runOnUiThread(this::startLoc); }

    @JavascriptInterface
    public void stopLocation() { act.runOnUiThread(this::stopLoc); }

    void restartLocation() { act.runOnUiThread(() -> { stopLoc(); startLoc(); }); }

    void startLoc() {
        if (act.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            js("window.__nativeLocErr&&window.__nativeLocErr('perm')");
            return;
        }
        if (lm == null) lm = (LocationManager) act.getSystemService(Context.LOCATION_SERVICE);
        if (lm == null) return;
        boolean gps = lm.isProviderEnabled(LocationManager.GPS_PROVIDER), net = lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER);
        if (!gps && !net) js("window.__nativeLocErr&&window.__nativeLocErr('off')");
        if (ll != null) return;
        ll = new LocationListener() {
            @Override public void onLocationChanged(Location l) { push(l); }
            @Override public void onStatusChanged(String p, int s, Bundle b) { }
            @Override public void onProviderEnabled(String p) { }
            @Override public void onProviderDisabled(String p) { }
        };
        try {
            for (String p : new String[]{LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER}) {
                if (!lm.getAllProviders().contains(p)) continue;
                lm.requestLocationUpdates(p, 2000, 0, ll, Looper.getMainLooper());
                Location last = lm.getLastKnownLocation(p);
                if (last != null && age(last) < 60000) push(last);
            }
        } catch (SecurityException ignored) { }
    }

    void stopLoc() {
        if (lm != null && ll != null) lm.removeUpdates(ll);
        ll = null;
    }

    static long age(Location l) {
        return (SystemClock.elapsedRealtimeNanos() - l.getElapsedRealtimeNanos()) / 1000000L;
    }

    @SuppressWarnings("deprecation")
    void push(Location l) {
        boolean mock = Build.VERSION.SDK_INT >= 31 ? l.isMock() : l.isFromMockProvider();
        JSONObject o = new JSONObject();
        try {
            o.put("lat", l.getLatitude());
            o.put("lng", l.getLongitude());
            o.put("acc", l.hasAccuracy() ? l.getAccuracy() : 999);
            o.put("t", System.currentTimeMillis() - age(l));
            o.put("mock", mock);
            o.put("provider", l.getProvider());
        } catch (Exception ignored) { }
        js("window.__nativeLoc&&window.__nativeLoc(" + o + ")");
    }

    /* ---------- Wi-Fi đang kết nối ---------- */
    @JavascriptInterface
    @SuppressWarnings("deprecation")
    public String wifi() {
        JSONObject o = new JSONObject();
        try {
            WifiManager wm = (WifiManager) act.getApplicationContext().getSystemService(Context.WIFI_SERVICE);
            WifiInfo wi = wm == null ? null : wm.getConnectionInfo();
            String ssid = wi == null ? "" : wi.getSSID(), bssid = wi == null ? "" : wi.getBSSID();
            if (ssid == null || ssid.contains("unknown ssid")) ssid = "";
            ssid = ssid.replaceAll("^\"|\"$", "");
            if (bssid == null || bssid.equals("02:00:00:00:00:00")) bssid = "";
            o.put("ssid", ssid);
            o.put("bssid", bssid.toLowerCase());
            o.put("enabled", wm != null && wm.isWifiEnabled());
        } catch (Exception ignored) { }
        return o.toString();
    }

    /* ---------- Phiên đăng nhập, nhắc ca, thông báo nền ---------- */
    @JavascriptInterface
    public void setSession(String api, String token, String schedule) {
        Prefs.get(act).edit().putString("api", api).putString("token", token).putString("sched", schedule).apply();
        Reminders.schedule(act);
        PollJob.schedule(act);
    }

    @JavascriptInterface
    public void setToday(String date, String lastType) {
        Prefs.get(act).edit().putString("tDate", date).putString("tLast", lastType).apply();
    }

    @JavascriptInterface
    public void clearSession() {
        Prefs.get(act).edit().remove("token").remove("sched").remove("since").apply();
        Reminders.cancel(act);
        PollJob.cancel(act);
    }

    /* ---------- Lưu file (CSV...) vào thư mục Download/GioHoc ---------- */
    @JavascriptInterface
    public String saveFile(String name, String mime, String content, boolean isBase64) {
        try {
            byte[] data = isBase64 ? Base64.decode(content, Base64.DEFAULT) : content.getBytes(StandardCharsets.UTF_8);
            Uri uri;
            if (Build.VERSION.SDK_INT >= 29) {
                ContentValues cv = new ContentValues();
                cv.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
                cv.put(MediaStore.MediaColumns.MIME_TYPE, mime);
                cv.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/GioHoc");
                uri = act.getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, cv);
                if (uri == null) throw new Exception("Không tạo được file");
                try (OutputStream os = act.getContentResolver().openOutputStream(uri)) { os.write(data); }
            } else {
                File dir = new File(act.getExternalFilesDir(null), "GioHoc");
                dir.mkdirs();
                File f = new File(dir, name);
                try (FileOutputStream os = new FileOutputStream(f)) { os.write(data); }
                uri = Uri.fromFile(f);
            }
            final Uri u = uri;
            act.runOnUiThread(() -> {
                Toast.makeText(act, "Đã lưu: Download/GioHoc/" + name, Toast.LENGTH_LONG).show();
                if (Build.VERSION.SDK_INT >= 29) {
                    try {
                        Intent i = new Intent(Intent.ACTION_VIEW).setDataAndType(u, mime).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                        act.startActivity(Intent.createChooser(i, "Mở file"));
                    } catch (Exception ignored) { }
                }
            });
            return "OK";
        } catch (Exception e) {
            return "ERR:" + e.getMessage();
        }
    }

    /* ---------- Chia sẻ ảnh (phiếu học phí) qua Zalo… ---------- */
    @JavascriptInterface
    public String shareImage(String name, String base64, String text) {
        try {
            if (Build.VERSION.SDK_INT < 29) return "ERR:Máy Android quá cũ";
            byte[] data = Base64.decode(base64, Base64.DEFAULT);
            ContentValues cv = new ContentValues();
            cv.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
            cv.put(MediaStore.MediaColumns.MIME_TYPE, "image/png");
            cv.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/GioHoc");
            Uri u = act.getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, cv);
            if (u == null) return "ERR:Không tạo được ảnh";
            try (OutputStream os = act.getContentResolver().openOutputStream(u)) { os.write(data); }
            act.runOnUiThread(() -> {
                try {
                    Intent i = new Intent(Intent.ACTION_SEND).setType("image/png").putExtra(Intent.EXTRA_STREAM, u)
                        .putExtra(Intent.EXTRA_TEXT, text).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    act.startActivity(Intent.createChooser(i, "Gửi phiếu học phí"));
                } catch (Exception ignored) { }
            });
            return "OK";
        } catch (Exception e) { return "ERR:" + e.getMessage(); }
    }

    /* ---------- Khác ---------- */
    @JavascriptInterface
    public void checkUpdate(boolean manual) { Updater.check(act, manual); }

    @JavascriptInterface
    public void reload() { act.reload(); }

    @JavascriptInterface
    public void share(String text) {
        act.runOnUiThread(() -> {
            try {
                Intent i = new Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text);
                act.startActivity(Intent.createChooser(i, "Chia sẻ qua"));
            } catch (Exception ignored) { }
        });
    }

    @JavascriptInterface
    @SuppressWarnings("deprecation")
    public void vibrate() {
        try {
            android.os.Vibrator v = (android.os.Vibrator) act.getSystemService(Context.VIBRATOR_SERVICE);
            if (v == null) return;
            if (Build.VERSION.SDK_INT >= 26) v.vibrate(android.os.VibrationEffect.createOneShot(120, android.os.VibrationEffect.DEFAULT_AMPLITUDE));
            else v.vibrate(120);
        } catch (Exception ignored) { }
    }

    @JavascriptInterface
    public void openSettings(String kind) {
        act.runOnUiThread(() -> {
            try {
                Intent i;
                if ("location".equals(kind)) i = new Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS);
                else if ("wifi".equals(kind)) i = new Intent(Settings.ACTION_WIFI_SETTINGS);
                else i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + act.getPackageName()));
                act.startActivity(i);
            } catch (Exception ignored) { }
        });
    }
}
