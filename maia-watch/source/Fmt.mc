import Toybox.Lang;
import Toybox.Time;
import Toybox.Time.Gregorian;

// Words and numbers for the glance and the screen, worded like the phone.
(:glance)
module Fmt {
    function now() as Number {
        return Time.now().value();
    }

    // 18 min, 1h 42m, 2d 3h
    function span(s as Number) as String {
        if (s < 0) {
            s = 0;
        }
        var m = s / 60;
        if (m < 60) {
            return m + " min";
        }
        var h = m / 60;
        if (h < 24) {
            return h + "h " + (m % 60).format("%02d") + "m";
        }
        return (h / 24) + "d " + (h % 24) + "h";
    }

    // just now, 18 min ago, 1h 42m ago
    function ago(s as Number) as String {
        var d = now() - s;
        return d < 60 ? "just now" : span(d) + " ago";
    }

    // A running clock: 4:07 or 1:04:07
    function clock(s as Number) as String {
        if (s < 0) {
            s = 0;
        }
        var h = s / 3600, m = (s / 60) % 60, sec = s % 60;
        if (h > 0) {
            return h + ":" + m.format("%02d") + ":" + sec.format("%02d");
        }
        return m + ":" + sec.format("%02d");
    }

    // 14:05, the watch's own time zone
    function time(s as Number) as String {
        var i = Gregorian.info(new Time.Moment(s), Time.FORMAT_SHORT);
        return i.hour.format("%02d") + ":" + i.min.format("%02d");
    }

    function letter(side) as String {
        if ("left".equals(side)) {
            return "L";
        }
        if ("right".equals(side)) {
            return "R";
        }
        return "L+R";
    }

    function name(side) as String {
        if ("left".equals(side)) {
            return "Left";
        }
        if ("right".equals(side)) {
            return "Right";
        }
        return "Both";
    }

    // left → right, from the first side and the number of switches
    function sides(feed as Dictionary) as String {
        var side = feed["first"];
        var out = letter(side);
        var n = feed["switches"] as Number;
        for (var i = 0; i < n; i++) {
            side = "left".equals(side) ? "right" : "left";
            out += ">" + letter(side);
        }
        return out;
    }

    // Seconds at the breast so far: the site's count plus the time since it
    // was fetched, unless she is resting.
    function active(run as Dictionary, fetchedAt as Number) as Number {
        var a = run["active"] as Number;
        if (!(run["paused"] as Boolean)) {
            a += now() - fetchedAt;
        }
        return a;
    }

    // The glance's one line.
    function glance(s as Dictionary?) as String {
        if (s == null) {
            return "Open to load";
        }
        var run = s["running"];
        if (run instanceof Dictionary) {
            return ((run["paused"] as Boolean) ? "Paused " : "Feeding ") + letter(run["side"]) + " · " + span(active(run, s["fetchedAt"] as Number));
        }
        var last = s["last"];
        if (last instanceof Dictionary) {
            return ago(last["end"] as Number) + " · " + letter(last["side"]) + " " + span(last["active"] as Number);
        }
        return "No feed yet";
    }
}
