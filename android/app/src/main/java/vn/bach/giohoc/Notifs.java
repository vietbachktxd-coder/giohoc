package vn.bach.giohoc;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

final class Notifs {
    static final String CH = "giohoc";

    static void channel(Context c) {
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel ch = new NotificationChannel(CH, "Giờ học", NotificationManager.IMPORTANCE_HIGH);
            ch.setDescription("Nhắc giờ học, điểm danh, học phí, cập nhật ứng dụng");
            ch.enableVibration(true);
            c.getSystemService(NotificationManager.class).createNotificationChannel(ch);
        }
    }

    static PendingIntent openApp(Context c, String extra, int req) {
        Intent i = new Intent(c, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        if (extra != null) i.putExtra(extra, true);
        return PendingIntent.getActivity(c, req, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    @SuppressWarnings("deprecation")
    static void show(Context c, int id, String title, String body, PendingIntent pi) {
        channel(c);
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(c, CH) : new Notification.Builder(c);
        b.setSmallIcon(R.drawable.ic_notif)
                .setColor(0xFF0F766E)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new Notification.BigTextStyle().bigText(body))
                .setAutoCancel(true)
                .setContentIntent(pi != null ? pi : openApp(c, "notifs", id));
        if (Build.VERSION.SDK_INT < 26) b.setPriority(Notification.PRIORITY_HIGH).setDefaults(Notification.DEFAULT_ALL);
        try { c.getSystemService(NotificationManager.class).notify(id, b.build()); } catch (Exception ignored) { }
    }
}
