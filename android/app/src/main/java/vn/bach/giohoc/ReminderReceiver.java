package vn.bach.giohoc;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

public class ReminderReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent i) {
        String type = i.getStringExtra("type"), date = i.getStringExtra("date"), title = i.getStringExtra("title"), cid = i.getStringExtra("cid"), at = i.getStringExtra("at");
        int mins = i.getIntExtra("mins", 0);
        String left = mins >= 60 ? (mins / 60) + " giờ" + (mins % 60 > 0 ? " " + (mins % 60) + " phút" : "") : mins + " phút";
        SharedPreferences p = Prefs.get(c);
        String tDate = p.getString("tDate", ""), open = "," + p.getString("tLast", "") + ",";
        boolean isOpen = date != null && date.equals(tDate) && cid != null && open.contains("," + cid + ",");
        if ("IN".equals(type)) {
            Notifs.show(c, 7101, "⏰ Còn " + left + ": " + title, "Giờ học lúc " + at + ". Đến nơi nhớ bấm ▶ BẮT ĐẦU để điểm danh.", Notifs.openApp(c, null, 7101));
        } else if ("OUT".equals(type) && isOpen) {
            Notifs.show(c, 7102, "⏰ Đã hết giờ học " + title, "Nhớ bấm ■ KẾT THÚC để ghi đúng số giờ học.", Notifs.openApp(c, null, 7102));
        }
        Reminders.schedule(c);
    }
}
