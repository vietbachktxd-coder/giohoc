package vn.bach.giohoc;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

final class Http {
    /** Mở kết nối, tự đi theo chuyển hướng (Apps Script trả 302 sang googleusercontent). */
    static HttpURLConnection open(String url, String postBody) throws Exception {
        String u = url; String body = postBody;
        for (int hop = 0; hop < 6; hop++) {
            HttpURLConnection c = (HttpURLConnection) new URL(u).openConnection();
            c.setConnectTimeout(20000);
            c.setReadTimeout(60000);
            c.setUseCaches(false);
            c.setInstanceFollowRedirects(false);
            if (body != null) {
                c.setRequestMethod("POST");
                c.setDoOutput(true);
                c.setRequestProperty("Content-Type", "text/plain;charset=utf-8");
                try (OutputStream os = c.getOutputStream()) { os.write(body.getBytes(StandardCharsets.UTF_8)); }
            }
            int code = c.getResponseCode();
            if (code >= 300 && code < 400 && c.getHeaderField("Location") != null) {
                u = new URL(new URL(u), c.getHeaderField("Location")).toString();
                if (code != 307 && code != 308) body = null;
                c.disconnect();
                continue;
            }
            if (code >= 400) throw new Exception("HTTP " + code);
            return c;
        }
        throw new Exception("Quá nhiều chuyển hướng");
    }

    static String text(String url, String postBody) throws Exception {
        HttpURLConnection c = open(url, postBody);
        try (InputStream in = c.getInputStream()) {
            ByteArrayOutputStream bo = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) > 0) bo.write(buf, 0, n);
            return bo.toString("UTF-8");
        } finally { c.disconnect(); }
    }
}
