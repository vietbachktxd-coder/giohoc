package vn.bach.giohoc;

import android.app.job.JobInfo;
import android.app.job.JobParameters;
import android.app.job.JobScheduler;
import android.app.job.JobService;
import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.HashSet;
import java.util.Set;

/** Tác vụ nền ~30 phút/lần: lấy thông báo mới từ máy chủ và kiểm tra bản cập nhật. */
public class PollJob extends JobService {
    static final int ID = 4201;

    static void schedule(Context c) {
        JobScheduler js = c.getSystemService(JobScheduler.class);
        if (js == null || js.getPendingJob(ID) != null) return;
        JobInfo ji = new JobInfo.Builder(ID, new ComponentName(c, PollJob.class))
                .setPeriodic(30 * 60 * 1000L)
                .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
                .setPersisted(true)
                .build();
        js.schedule(ji);
    }

    static void cancel(Context c) {
        JobScheduler js = c.getSystemService(JobScheduler.class);
        if (js != null) js.cancel(ID);
    }

    @Override
    public boolean onStartJob(JobParameters params) {
        new Thread(() -> {
            try { poll(getApplicationContext()); } catch (Exception ignored) { }
            Updater.background(getApplicationContext());
            jobFinished(params, false);
        }).start();
        return true;
    }

    @Override
    public boolean onStopJob(JobParameters params) { return true; }

    static void poll(Context c) throws Exception {
        SharedPreferences p = Prefs.get(c);
        String api = p.getString("api", ""), token = p.getString("token", ""), since = p.getString("since", "");
        if (api.isEmpty() || token.isEmpty()) return;
        JSONObject req = new JSONObject().put("action", "notifs").put("token", token).put("since", since);
        JSONObject r = new JSONObject(Http.text(api, req.toString()));
        if (!r.optBoolean("ok")) return;
        Set<String> seen = new HashSet<>(p.getStringSet("seen", new HashSet<>()));
        JSONArray list = r.optJSONArray("list");
        boolean first = since.isEmpty();
        if (list != null) for (int i = list.length() - 1; i >= 0; i--) {
            JSONObject n = list.getJSONObject(i);
            String id = n.optString("id");
            if (seen.contains(id)) continue;
            seen.add(id);
            if (!first) Notifs.show(c, 5000 + (id.hashCode() & 0xfff), n.optString("title"), n.optString("body"), null);
        }
        if (seen.size() > 300) seen.clear();
        p.edit().putString("since", r.optString("now", since)).putStringSet("seen", seen).apply();
    }
}
