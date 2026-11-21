import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Math;
import Toybox.WatchUi;

// The site's night colours (maia/maia.css, dark theme).
(:glance)
module Pal {
    const PAPER = 0x0F1512;
    const LINE = 0x34433A;
    const INK = 0xECE5D3;
    const INK2 = 0xC3BBA6;
    const INK3 = 0x8F897A;
    const MOSS = 0x86A673;
    const LEAF = 0x5F7A4C;
    const BARK = 0xC49C69;
    const BLUSH = 0xE39A8C;
    const SUN = 0xD4BF5E;
    const DANGER = 0xD27A64;
    const LEFT = 0x2F7A38;
    const RIGHT = 0x5E8EE2;
    const BOTH = 0xBF8628;

    // The colours the feed strips use for each side.
    function side(s) as Number {
        if ("left".equals(s)) {
            return LEFT;
        }
        if ("right".equals(s)) {
            return RIGHT;
        }
        return BOTH;
    }
}

// Drawing helpers for the screens (the widget's and the watch face's).
module Art {
    const SLEEP_S = 150 * 60; // the tit sleeps this long after a feed, as long as the phones wait to remind

    function runningOf(s as Dictionary?) as Dictionary? {
        var r = s != null ? s["running"] : null;
        return r instanceof Dictionary ? r : null;
    }

    function lastOf(s as Dictionary?) as Dictionary? {
        var l = s != null ? s["last"] : null;
        return l instanceof Dictionary ? l : null;
    }

    // Asleep for two and a half hours after a feed, then awake again.
    function asleep(s as Dictionary?) as Boolean {
        var done = lastOf(s);
        return runningOf(s) == null && done != null && Fmt.now() - (done["end"] as Number) < SLEEP_S;
    }

    // The tit's picture: happy while a heart rises, awake while she feeds,
    // resting while paused, asleep after a feed.
    function mood(s as Dictionary?, happy as Boolean) as ResourceId {
        if (happy) {
            return Rez.Drawables.TitHappy;
        }
        var run = runningOf(s);
        if (run != null) {
            return (run["paused"] as Boolean) ? Rez.Drawables.TitRest : Rez.Drawables.TitAwake;
        }
        return asleep(s) ? Rez.Drawables.TitSleep : Rez.Drawables.TitAwake;
    }

    // The ring round the edge for a summary: leaves during a feed, the arc between.
    function edge(dc as Dc, s as Dictionary?) as Void {
        var run = runningOf(s), done = lastOf(s);
        if (run != null) {
            leafRing(dc, run, Fmt.active(run, s["fetchedAt"] as Number));
        } else if (done != null) {
            sinceArc(dc, Fmt.now() - (done["end"] as Number));
        }
    }

    // The tit pictures' feet are at (62, 113) in their 120 px square, and the
    // branch's perch at (208, 119) in its 416 x 150 picture.
    const TIT_FEET_X = 62;
    const TIT_FEET_Y = 113;
    const PERCH_X = 208;
    const PERCH_Y = 119;

    // A leaf of length `len` centred on (x, y) and lying along `deg` (screen
    // degrees, clockwise from 3 o'clock), as a polygon.
    function leaf(dc as Dc, x as Float, y as Float, deg as Float, len as Float) as Void {
        var a = Math.toRadians(deg);
        var tx = Math.cos(a), ty = Math.sin(a);
        var nx = -ty, ny = tx;
        var half = len / 2.0, wide = len * 0.26;
        var steps = [-1.0, -0.6, -0.2, 0.2, 0.6, 1.0];
        var pts = [];
        for (var i = 0; i < steps.size(); i++) {
            var s = steps[i] as Float;
            var bulge = wide * (1.0 - s * s);
            pts.add([x + tx * s * half + nx * bulge, y + ty * s * half + ny * bulge]);
        }
        for (var i = steps.size() - 2; i > 0; i--) {
            var s = steps[i] as Float;
            var bulge = wide * (1.0 - s * s) * 0.55;
            pts.add([x + tx * s * half - nx * bulge, y + ty * s * half - ny * bulge]);
        }
        dc.fillPolygon(pts);
    }

    // The ring of leaves around the edge during a feed: one per minute at the
    // breast, forty to the lap, each in the colour of the side she was on that
    // minute; the minute under way grows as it passes.
    function leafRing(dc as Dc, run as Dictionary, seconds as Number) as Void {
        var w = dc.getWidth(), h = dc.getHeight();
        var cx = w / 2.0, cy = h / 2.0, r = w / 2.0 - 13;
        var slots = 40;
        var minutes = seconds / 60;
        var turns = run["turns"] instanceof Array ? run["turns"] as Array : [];
        var first = run["first"];
        for (var i = 0; i < slots; i++) {
            var deg = -90.0 + i * 360.0 / slots;
            var a = Math.toRadians(deg);
            var x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
            // the newest minute on this slot, over however many laps
            var m = i;
            while (m + slots <= minutes) {
                m += slots;
            }
            if (m > minutes) {
                dc.setColor(Pal.LINE, Graphics.COLOR_TRANSPARENT);
                dc.fillCircle(x, y, 2);
                continue;
            }
            var side = first;
            for (var k = 0; k < turns.size(); k++) {
                if ((turns[k] as Number) <= m * 60) {
                    side = "left".equals(side) ? "right" : "left";
                }
            }
            dc.setColor(m >= slots ? Pal.SUN : Pal.side(side), Graphics.COLOR_TRANSPARENT);
            var size = m == minutes ? 6.0 + 10.0 * (seconds % 60) / 60.0 : 16.0;
            leaf(dc, x, y, deg + 90.0, size);
        }
    }

    // Between feeds, a quiet arc for the time since the last one, full at the
    // two and a half hours after which the phones remind; moss, then sun, then
    // blush once it is past.
    function sinceArc(dc as Dc, seconds as Number) as Void {
        var w = dc.getWidth(), h = dc.getHeight();
        var r = w / 2 - 12;
        var full = 150 * 60;
        var frac = seconds >= full ? 1.0 : seconds.toFloat() / full;
        dc.setPenWidth(4);
        dc.setColor(Pal.LINE, Graphics.COLOR_TRANSPARENT);
        dc.drawCircle(w / 2, h / 2, r);
        var colour = seconds >= full ? Pal.BLUSH : frac > 0.8 ? Pal.SUN : Pal.MOSS;
        dc.setColor(colour, Graphics.COLOR_TRANSPARENT);
        if (frac >= 0.999) {
            dc.drawCircle(w / 2, h / 2, r);
        } else if (frac > 0.005) {
            dc.drawArc(w / 2, h / 2, r, Graphics.ARC_CLOCKWISE, 90, 90 - frac * 360);
        }
        // a leaf at its tip
        var deg = -90.0 + frac * 360.0;
        var a = Math.toRadians(deg);
        leaf(dc, w / 2.0 + r * Math.cos(a), h / 2.0 + r * Math.sin(a), deg + 60.0, 15.0);
        dc.setPenWidth(1);
    }

    function heart(dc as Dc, x as Float, y as Float, r as Float) as Void {
        dc.setColor(Pal.BLUSH, Graphics.COLOR_TRANSPARENT);
        dc.fillCircle(x - r * 0.5, y, r * 0.6);
        dc.fillCircle(x + r * 0.5, y, r * 0.6);
        dc.fillPolygon([[x - r * 1.08, y + r * 0.2], [x + r * 1.08, y + r * 0.2], [x, y + r * 1.4]]);
    }

    // A rounded button: filled, or outlined in its colour.
    function pill(dc as Dc, x as Number, y as Number, w as Number, h as Number, colour as Number, filled as Boolean, label as String, ink as Number) as Void {
        dc.setColor(colour, Graphics.COLOR_TRANSPARENT);
        if (filled) {
            dc.fillRoundedRectangle(x, y, w, h, h / 2);
        } else {
            dc.setPenWidth(3);
            dc.drawRoundedRectangle(x + 1, y + 1, w - 2, h - 2, h / 2);
            dc.setPenWidth(1);
        }
        dc.setColor(filled ? ink : colour, Graphics.COLOR_TRANSPARENT);
        // a smaller letter when the word would touch the rounded ends
        var font = dc.getTextWidthInPixels(label, Graphics.FONT_SMALL) > w - h / 2 ? Graphics.FONT_TINY : Graphics.FONT_SMALL;
        dc.drawText(x + w / 2, y + h / 2, font, label, Graphics.TEXT_JUSTIFY_CENTER | Graphics.TEXT_JUSTIFY_VCENTER);
    }
}
