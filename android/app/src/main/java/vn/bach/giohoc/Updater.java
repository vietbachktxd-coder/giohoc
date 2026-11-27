package vn.bach.giohoc;

import android.app.AlertDialog;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInstaller;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.widget.Toast;

import org.json.JSONObject;

import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;

/** Tự kiểm tra & cài bản APK mới từ trang GitHub Pages (app-version.json). */
final class Updater {
    static volatile boolean busy = false;

    static JSONObject fetch() throws Exception {
        return new JSONObject(Http.text(BuildConfig.WEB_URL + "app-version.json?t=" + System.currentTimeMillis(), null));
    }

    static boolean newer(JSONObject j) { return j.optInt("versionCode", 0) > BuildConfig.VERSION_CODE; }

    static String apkUrl(JSONObject j) {
        String a = j.optString("apk", "download/GioHoc.apk");
        return a.startsWith("http") ? a : BuildConfig.WEB_URL + a;
    }

    /** Kiểm tra khi mở ứng dụng (manual = người dùng bấm "Kiểm tra cập nhật"). */
    static void check(MainActivity a, boolean manual) {
        new Thread(() -> {
            try {
                JSONObject j = fetch();
                if (!newer(j)) {
                    if (manual) toast(a, "Bạn đang dùng bản mới nhất " + BuildConfig.VERSION_NAME);
                    return;
                }
                a.runOnUiThread(() -> {
                    if (canSilent(a) && !manual) { start(a, j); return; }
                    boolean force = j.optBoolean("force", false);
                    AlertDialog.Builder b = new AlertDialog.Builder(a)
                            .setTitle("Có phiên bản mới " + j.optString("versionName"))
                            .setMessage(j.optString("notes", "Cập nhật để dùng các tính năng mới nhất."))
                            .setCancelable(!force)
                            .setPositiveButton("Cập nhật ngay", (d, w) -> start(a, j));
                    if (!force) b.setNegativeButton("Để sau", null);
                    b.show();
                });
            } catch (Exception e) {
                if (manual) toast(a, "Không kiểm tra được bản cập nhật (mất mạng?)");
            }
        }).start();
    }

    /** Tự cài không cần bấm chỉ khi chính app là "nguồn cài đặt" của nó (Android 12+).
     *  App cài lần đầu từ trình duyệt / Tệp thì lần cập nhật đầu tiên phải bấm xác nhận 1 lần. */
    static boolean selfInstaller(Context c) {
        try {
            if (Build.VERSION.SDK_INT >= 30) {
                String who = c.getPackageManager().getInstallSourceInfo(c.getPackageName()).getInstallingPackageName();
                return c.getPackageName().equals(who);
            }
        } catch (Exception ignored) { }
        return false;
    }

    static boolean canSilent(Context c) {
        return Build.VERSION.SDK_INT >= 31 && c.getPackageManager().canRequestPackageInstalls() && selfInstaller(c);
    }

    static void start(MainActivity a, JSONObject j) {
        if (Build.VERSION.SDK_INT >= 26 && !a.getPackageManager().canRequestPackageInstalls()) {
            a.pendingUpdate = j;
            Toast.makeText(a, "Bật \"Cho phép từ nguồn này\" cho Giờ học rồi quay lại", Toast.LENGTH_LONG).show();
            try {
                a.startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + a.getPackageName())));
            } catch (Exception e) {
                a.startActivity(new Intent(Settings.ACTION_SECURITY_SETTINGS));
            }
            return;
        }
        Toast.makeText(a, "Đang tải bản cập nhật " + j.optString("versionName") + "…", Toast.LENGTH_LONG).show();
        a.bridge.js("window.__nativeUpdating&&window.__nativeUpdating(" + JSONObject.quote(j.optString("versionName")) + ")");
        new Thread(() -> {
            try { install(a.getApplicationContext(), apkUrl(j)); }
            catch (Exception e) { toast(a, "Lỗi tải bản cập nhật: " + e.getMessage()); }
        }).start();
    }

    /** Tải APK và đưa vào trình cài đặt hệ thống. Android 12+ cài đè tự động không cần bấm. */
    static void install(Context ctx, String url) throws Exception { Prefs.get(ctx).edit().putBoolean("needConfirm", false).apply(); install(ctx, url, false); }

    static void install(Context ctx, String url, boolean confirm) throws Exception {
        if (busy) return;
        busy = true;
        try {
            PackageInstaller pi = ctx.getPackageManager().getPackageInstaller();
            PackageInstaller.SessionParams sp = new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL);
            sp.setAppPackageName(ctx.getPackageName());
            if (Build.VERSION.SDK_INT >= 31) sp.setRequireUserAction(!confirm && canSilent(ctx) ? PackageInstaller.SessionParams.USER_ACTION_NOT_REQUIRED : PackageInstaller.SessionParams.USER_ACTION_REQUIRED);
            Prefs.get(ctx).edit().putString("updUrl", url).apply();
            int id = pi.createSession(sp);
            PackageInstaller.Session s = pi.openSession(id);
            try {
                HttpURLConnection c = Http.open(url, null);
                long len = c.getContentLengthLong();
                try (InputStream in = c.getInputStream(); OutputStream out = s.openWrite("app.apk", 0, len > 0 ? len : -1)) {
                    byte[] buf = new byte[65536];
                    int n;
                    while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
                    s.fsync(out);
                } finally { c.disconnect(); }
                Intent i = new Intent(ctx, InstallReceiver.class);
                int fl = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0);
                PendingIntent p = PendingIntent.getBroadcast(ctx, id, i, fl);
                s.commit(p.getIntentSender());
            } catch (Exception e) {
                s.abandon();
                throw e;
            } finally { s.close(); }
        } finally { busy = false; }
    }

    /** Gọi từ tác vụ nền: có bản mới thì tự cài (Android 12+) hoặc hiện thông báo. */
    static void background(Context c) {
        try {
            long last = Prefs.get(c).getLong("updChk", 0);
            if (System.currentTimeMillis() - last < 3 * 3600 * 1000L) return;
            Prefs.get(c).edit().putLong("updChk", System.currentTimeMillis()).apply();
            JSONObject j = fetch();
            if (!newer(j)) return;
            if (canSilent(c)) install(c, apkUrl(j));
            else Notifs.show(c, 9001, "Có bản cập nhật " + j.optString("versionName"), "Chạm để cập nhật ứng dụng Giờ học", Notifs.openApp(c, "update", 9001));
        } catch (Exception ignored) { }
    }

    static void toast(MainActivity a, String m) { a.runOnUiThread(() -> Toast.makeText(a, m, Toast.LENGTH_LONG).show()); }
}
