package vn.bach.giohoc;

import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInstaller;
import android.os.Build;

public class InstallReceiver extends BroadcastReceiver {
    @Override
    @SuppressWarnings("deprecation")
    public void onReceive(Context c, Intent i) {
        int st = i.getIntExtra(PackageInstaller.EXTRA_STATUS, -999);
        if (st == PackageInstaller.STATUS_PENDING_USER_ACTION) {
            Intent conf = Build.VERSION.SDK_INT >= 33 ? i.getParcelableExtra(Intent.EXTRA_INTENT, Intent.class) : (Intent) i.getParcelableExtra(Intent.EXTRA_INTENT);
            if (conf == null) return;
            conf.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            try {
                c.startActivity(conf);
            } catch (Exception e) {
                PendingIntent pi = PendingIntent.getActivity(c, 9002, conf, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
                Notifs.show(c, 9002, "Cài bản cập nhật", "Chạm để hoàn tất cài đặt bản mới", pi);
            }
        } else if (st == PackageInstaller.STATUS_SUCCESS) {
            Prefs.get(c).edit().putBoolean("needConfirm", false).apply();
        } else {
            String msg = i.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE);
            /* Máy chặn tự cập nhật: thử lại ngay theo cách hỏi xác nhận 1 lần */
            String url = Prefs.get(c).getString("updUrl", "");
            if (msg != null && msg.toLowerCase().contains("self update") && !url.isEmpty() && !Prefs.get(c).getBoolean("needConfirm", false)) {
                Prefs.get(c).edit().putBoolean("needConfirm", true).apply();
                final Context ac = c.getApplicationContext();
                new Thread(() -> { try { Updater.install(ac, url, true); } catch (Exception ignored) { } }).start();
                return;
            }
            Notifs.show(c, 9003, "Cập nhật chưa thành công", msg == null ? "Vui lòng thử lại sau" : msg, null);
        }
    }
}
