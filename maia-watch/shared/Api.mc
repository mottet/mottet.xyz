import Toybox.Application;
import Toybox.Communications;
import Toybox.Lang;

// The site's watch endpoint: GET /api/watch for the summary, POST it an
// action (start-left, start-right, switch, pause, resume, stop). Both answer
// with the summary, times in Unix seconds:
//   { ok, now, next: "left"|"right"|null,
//     running: { id, side, first, switches, start, active, paused, sideSince } | null,
//     last: { id, side, first, switches, start, end, active } | null }
(:background :glance)
module Api {
    const DEFAULT_URL = "https://maia.mottet.xyz";

    function url() as String {
        var base = Application.Properties.getValue("serverUrl");
        if (!(base instanceof String) || base.length() == 0) {
            base = DEFAULT_URL;
        }
        if (base.substring(base.length() - 1, base.length()).equals("/")) {
            base = base.substring(0, base.length() - 1);
        }
        return base + "/api/watch";
    }

    function token() as String {
        var t = Application.Properties.getValue("watchToken");
        return t instanceof String ? t : "";
    }

    function fetch(callback as Method) as Void {
        Communications.makeWebRequest(url(), null, {
            :method => Communications.HTTP_REQUEST_METHOD_GET,
            :headers => { "Authorization" => "Bearer " + token() },
            :responseType => Communications.HTTP_RESPONSE_CONTENT_TYPE_JSON
        }, callback);
    }

    // `feed` is the running feed the screen showed, so the site can refuse a
    // switch or stop meant for a feed that has changed since on a phone.
    function send(action as String, feed as String?, callback as Method) as Void {
        var body = { "action" => action };
        if (feed != null) {
            body.put("feed", feed);
        }
        Communications.makeWebRequest(url(), body, {
            :method => Communications.HTTP_REQUEST_METHOD_POST,
            :headers => {
                "Authorization" => "Bearer " + token(),
                "Content-Type" => Communications.REQUEST_CONTENT_TYPE_JSON
            },
            :responseType => Communications.HTTP_RESPONSE_CONTENT_TYPE_JSON
        }, callback);
    }
}
