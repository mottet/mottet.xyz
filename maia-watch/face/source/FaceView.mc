import Toybox.Graphics;
import Toybox.Lang;
import Toybox.System;
import Toybox.Time;
import Toybox.Time.Gregorian;
import Toybox.WatchUi;

// The face: the blue tit on its branch (asleep, feeding, resting, as in the
// widget), the time, the date, the feed, and a small battery and phone at the
// bottom, inside the same ring round the edge: leaves during a feed, the arc
// for the time since the last one between.
//
// When the watch sleeps with the always-on display, the AMOLED screen must not
// burn in: only the time and the feed in grey, a tenth of the pixels at most,
// shifted a little every minute.
class FaceView extends WatchUi.WatchFace {
    hidden var asleepMode as Boolean = false;
    hidden var bitmaps as Dictionary = {};

    function initialize() {
        WatchFace.initialize();
    }

    function onEnterSleep() as Void {
        asleepMode = true;
        WatchUi.requestUpdate();
    }

    function onExitSleep() as Void {
        asleepMode = false;
        WatchUi.requestUpdate();
    }

    hidden function bitmap(id) as WatchUi.BitmapResource {
        var b = bitmaps[id];
        if (b == null) {
            b = WatchUi.loadResource(id);
            bitmaps.put(id, b);
        }
        return b as WatchUi.BitmapResource;
    }

    function onUpdate(dc as Dc) as Void {
        var settings = System.getDeviceSettings();
        var burnIn = settings has :requiresBurnInProtection && settings.requiresBurnInProtection;
        if (dc has :setAntiAlias) {
            dc.setAntiAlias(true);
        }
        if (asleepMode && burnIn) {
            drawLowPower(dc);
        } else {
            drawFull(dc);
        }
    }

    // ---- the words ------------------------------------------------------------

    function timeText() as String {
        var t = System.getClockTime();
        var hour = t.hour;
        if (!System.getDeviceSettings().is24Hour) {
            hour = hour % 12 == 0 ? 12 : hour % 12;
        }
        return hour.format(System.getDeviceSettings().is24Hour ? "%02d" : "%d") + ":" + t.min.format("%02d");
    }

    function dateText() as String {
        var i = Gregorian.info(Time.now(), Time.FORMAT_MEDIUM);
        return i.day_of_week + " " + i.day + " " + i.month;
    }

    // The feed in a few words, and its colour.
    function feedLine(s as Dictionary?) as Array {
        var run = Art.runningOf(s), done = Art.lastOf(s);
        if (run != null) {
            var minutes = Fmt.span(Fmt.active(run, s["fetchedAt"] as Number));
            if (run["paused"] as Boolean) {
                return ["Resting · " + Fmt.letter(run["side"]) + " · " + minutes, Pal.INK3];
            }
            return ["Feeding · " + Fmt.letter(run["side"]) + " · " + minutes, Pal.side(run["side"])];
        }
        if (done != null) {
            var since = Fmt.now() - (done["end"] as Number);
            return ["Fed " + Fmt.ago(done["end"] as Number) + " · " + Fmt.letter(done["side"]), since >= Art.SLEEP_S ? Pal.BLUSH : Pal.INK2];
        }
        return [s == null ? "Maïa: waiting for the phone" : "No feed yet", Pal.INK3];
    }

    // ---- awake ----------------------------------------------------------------

    function drawFull(dc as Dc) as Void {
        var w = dc.getWidth(), h = dc.getHeight(), cx = w / 2;
        var center = Graphics.TEXT_JUSTIFY_CENTER | Graphics.TEXT_JUSTIFY_VCENTER;
        var s = Cache.load();
        dc.setColor(Pal.INK, Pal.PAPER);
        dc.clear();

        Art.edge(dc, s);

        // The branch and the tit, a little higher than in the widget to leave the time room.
        var top = 0;
        dc.drawBitmap(cx - Art.PERCH_X, top, bitmap(Rez.Drawables.Branch));
        var titX = cx - Art.TIT_FEET_X, titY = top + Art.PERCH_Y - Art.TIT_FEET_Y;
        dc.drawBitmap(titX, titY, bitmap(Art.mood(s, false)));
        if (Art.asleep(s)) {
            dc.setColor(Pal.INK3, Graphics.COLOR_TRANSPARENT);
            dc.drawText(titX + 104, titY + 34, Graphics.FONT_XTINY, "z", center);
            dc.drawText(titX + 118, titY + 16, Graphics.FONT_TINY, "z", center);
        }

        dc.setColor(Pal.INK, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, h * 46 / 100, Graphics.FONT_NUMBER_HOT, timeText(), center);
        dc.setColor(Pal.INK2, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, h * 62 / 100, Graphics.FONT_TINY, dateText(), center);

        var feed = feedLine(s);
        dc.setColor(feed[1] as Number, Graphics.COLOR_TRANSPARENT);
        var font = dc.getTextWidthInPixels(feed[0] as String, Graphics.FONT_TINY) > w * 72 / 100 ? Graphics.FONT_XTINY : Graphics.FONT_TINY;
        dc.drawText(cx, h * 72 / 100, font, feed[0] as String, center);

        drawStatus(dc, cx, h * 83 / 100);
    }

    // A small battery with its percentage, and the phone, side by side.
    function drawStatus(dc as Dc, cx as Number, y as Number) as Void {
        var stats = System.getSystemStats();
        var pct = stats.battery;
        var colour = pct <= 10 ? Pal.DANGER : pct <= 20 ? Pal.SUN : Pal.MOSS;
        var label = pct.format("%d") + "%";
        var tw = dc.getTextWidthInPixels(label, Graphics.FONT_XTINY);
        var bw = 26, bh = 13, gap = 6, phoneGap = 22, pw = 11, ph = 19;
        var total = bw + 3 + gap + tw + phoneGap + pw;
        var x = cx - total / 2;

        // battery: an outline with a nub, filled to the level
        dc.setColor(Pal.INK3, Graphics.COLOR_TRANSPARENT);
        dc.setPenWidth(2);
        dc.drawRoundedRectangle(x, y - bh / 2, bw, bh, 3);
        dc.fillRectangle(x + bw, y - 3, 3, 6);
        dc.setPenWidth(1);
        dc.setColor(colour, Graphics.COLOR_TRANSPARENT);
        var fill = ((bw - 6) * pct / 100).toNumber();
        if (fill > 0) {
            dc.fillRectangle(x + 3, y - bh / 2 + 3, fill, bh - 6);
        }
        dc.setColor(Pal.INK2, Graphics.COLOR_TRANSPARENT);
        dc.drawText(x + bw + 3 + gap, y, Graphics.FONT_XTINY, label, Graphics.TEXT_JUSTIFY_LEFT | Graphics.TEXT_JUSTIFY_VCENTER);

        // phone: moss when Garmin Connect is reachable, grey and struck through when not
        var px = x + bw + 3 + gap + tw + phoneGap, py = y - ph / 2;
        var connected = System.getDeviceSettings().phoneConnected;
        dc.setColor(connected ? Pal.MOSS : Pal.INK3, Graphics.COLOR_TRANSPARENT);
        dc.setPenWidth(2);
        dc.drawRoundedRectangle(px, py, pw, ph, 3);
        dc.setPenWidth(1);
        dc.fillRectangle(px + pw / 2 - 2, py + ph - 5, 4, 2);
        if (!connected) {
            dc.setColor(Pal.DANGER, Graphics.COLOR_TRANSPARENT);
            dc.setPenWidth(2);
            dc.drawLine(px - 4, py + ph + 2, px + pw + 4, py - 2);
            dc.setPenWidth(1);
        }
    }

    // ---- always-on, asleep ----------------------------------------------------

    function drawLowPower(dc as Dc) as Void {
        var w = dc.getWidth(), h = dc.getHeight(), cx = w / 2;
        var center = Graphics.TEXT_JUSTIFY_CENTER | Graphics.TEXT_JUSTIFY_VCENTER;
        dc.setColor(Graphics.COLOR_BLACK, Graphics.COLOR_BLACK);
        dc.clear();
        // drift over a 5 x 5 grid of 6 px steps, one step a minute
        var m = System.getClockTime().min;
        var dx = (m % 5 - 2) * 6, dy = ((m / 5) % 5 - 2) * 6;
        dc.setColor(Pal.INK3, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx + dx, h * 45 / 100 + dy, Graphics.FONT_NUMBER_MEDIUM, timeText(), center);
        var feed = feedLine(Cache.load());
        dc.setColor(0x5D5A4C, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx + dx, h * 60 / 100 + dy, Graphics.FONT_XTINY, feed[0] as String, center);
    }
}
