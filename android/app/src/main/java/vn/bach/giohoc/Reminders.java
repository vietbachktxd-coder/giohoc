package vn.bach.giohoc;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Calendar;
import java.util.Locale;

/** Đặt báo thức nhắc giờ học (trước giờ học) và nhắc bấm Kết thúc (khi hết giờ), kể cả khi app đang đóng. */
final class Reminders {
    static PendingIntent pi(Context c, String type, String date, String title, String cid) {
        Intent i = new Intent(c, ReminderReceiver.class).putExtra("type", type).putExtra("date", date).putExtra("title", title).putExtra("cid", cid);
        return PendingIntent.getBroadcast(c, 7001, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static void cancel(Context c) {
        AlarmManager am = c.getSystemService(AlarmManager.class);
        if (am != null) am.cancel(pi(c, "", "", "", ""));
    }

    static int min(String hhmm) {
        String[] p = hhmm.split(":");
        return Integer.parseInt(p[0].trim()) * 60 + Integer.parseInt(p[1].trim().substring(0, 2));
    }

    static String ymd(Calendar k) {
        return String.format(Locale.US, "%04d-%02d-%02d", k.get(Calendar.YEAR), k.get(Calendar.MONTH) + 1, k.get(Calendar.DAY_OF_MONTH));
    }

    /** Tìm mốc nhắc gần nhất trong 8 ngày tới và đặt 1 báo thức; khi báo thức chạy sẽ đặt mốc kế tiếp. */
    static void schedule(Context c) {
        try {
            SharedPreferences p = Prefs.get(c);
            String js = p.getString("sched", ""), token = p.getString("token", "");
            cancel(c);
            if (js.isEmpty() || token.isEmpty()) return;
            JSONObject s = new JSONObject(js);
            if (!s.optBoolean("enabled", true)) return;
            int before = s.optInt("before", 15);
            JSONArray slots = s.optJSONArray("slots");
            if (slots == null || slots.length() == 0) return;
            long now = System.currentTimeMillis() + 30000, best = Long.MAX_VALUE;
            String bType = "", bDate = "", bTitle = "", bCid = "";
            for (int off = 0; off < 8; off++) {
                Calendar day = Calendar.getInstance();
                day.add(Calendar.DAY_OF_MONTH, off);
                day.set(Calendar.HOUR_OF_DAY, 0); day.set(Calendar.MINUTE, 0); day.set(Calendar.SECOND, 0); day.set(Calendar.MILLISECOND, 0);
                int dow = (day.get(Calendar.DAY_OF_WEEK) + 5) % 7 + 1; // 1=T2 … 7=CN
                for (int i = 0; i < slots.length(); i++) {
                    JSONObject sl = slots.getJSONObject(i);
                    if (sl.optInt("d") != dow) continue;
                    int st = min(sl.optString("t", "18:00")), len = sl.optInt("m", 90);
                    int[][] marks = {{st - before, 0}, {st + len + 5, 1}};
                    for (int[] mk : marks) {
                        long t = day.getTimeInMillis() + mk[0] * 60000L;
                        if (t > now && t < best) {
                            best = t; bType = mk[1] == 0 ? "IN" : "OUT"; bDate = ymd(day);
                            bTitle = sl.optString("title"); bCid = sl.optString("id");
                        }
                    }
                }
                if (best != Long.MAX_VALUE) break;
            }
            if (best == Long.MAX_VALUE) return;
            AlarmManager am = c.getSystemService(AlarmManager.class);
            am.setWindow(AlarmManager.RTC_WAKEUP, best, 2 * 60 * 1000L, pi(c, bType, bDate, bTitle, bCid));
        } catch (Exception ignored) { }
    }
}
