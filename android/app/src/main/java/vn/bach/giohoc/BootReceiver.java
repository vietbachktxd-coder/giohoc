package vn.bach.giohoc;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent i) {
        Reminders.schedule(c);
        if (!Prefs.get(c).getString("token", "").isEmpty()) PollJob.schedule(c);
        if (Intent.ACTION_MY_PACKAGE_REPLACED.equals(i.getAction())) {
            Notifs.show(c, 9004, "Đã cập nhật Giờ học", "Phiên bản " + BuildConfig.VERSION_NAME + " đã được cài đặt. Chạm để mở.", Notifs.openApp(c, null, 9004));
        }
    }
}
