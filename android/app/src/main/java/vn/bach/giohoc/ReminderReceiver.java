package vn.bach.giohoc;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

public class ReminderReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent i) {
        String type = i.getStringExtra("type"), date = i.getStringExtra("date"), title = i.getStringExtra("title"), cid = i.getStringExtra("cid");
        SharedPreferences p = Prefs.get(c);
        String tDate = p.getString("tDate", ""), open = "," + p.getString("tLast", "") + ",";
        boolean isOpen = date != null && date.equals(tDate) && cid != null && open.contains("," + cid + ",");
        if ("IN".equals(type)) {
            Notifs.show(c, 7101, "⏰ Sắp đến giờ học " + title, "Đến nơi học nhớ bấm ▶ BẮT ĐẦU để điểm danh.", Notifs.openApp(c, null, 7101));
        } else if ("OUT".equals(type) && isOpen) {
            Notifs.show(c, 7102, "⏰ Đã hết giờ học " + title, "Nhớ bấm ■ KẾT THÚC để ghi đúng số giờ học.", Notifs.openApp(c, null, 7102));
        }
        Reminders.schedule(c);
    }
}
