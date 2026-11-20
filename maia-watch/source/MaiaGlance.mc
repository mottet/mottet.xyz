import Toybox.Graphics;
import Toybox.Lang;
import Toybox.System;
import Toybox.Time;
import Toybox.Timer;
import Toybox.WatchUi;

// In the glance list: "Maïa" over "1h 42m ago · R 18 min". It asks the site
// itself each time it comes on screen (when its copy is more than half a
// minute old) and once a minute while it stays there, so a feed started on a
// phone shows up without waiting for the five-minute background job.
(:glance)
class MaiaGlance extends WatchUi.GlanceView {
    const STALE_S = 30;
    hidden var timer as Timer.Timer? = null;
    hidden var asking as Boolean = false;

    function initialize() {
        GlanceView.initialize();
    }

    function onShow() as Void {
        var s = Cache.load();
        if (s == null || Time.now().value() - (s["fetchedAt"] as Number) >= STALE_S) {
            ask();
        }
        timer = new Timer.Timer();
        timer.start(method(:onTick), 60000, true);
    }

    function onHide() as Void {
        if (timer != null) {
            timer.stop();
            timer = null;
        }
    }

    function onTick() as Void {
        ask();
        WatchUi.requestUpdate();
    }

    function ask() as Void {
        if (asking || !System.getDeviceSettings().phoneConnected) {
            return;
        }
        asking = true;
        Api.fetch(method(:onReply));
    }

    function onReply(code as Number, data as Dictionary or String or Null) as Void {
        asking = false;
        if (code == 200 && data instanceof Dictionary) {
            Cache.save(data);
            WatchUi.requestUpdate();
        }
    }

    function onUpdate(dc as Dc) as Void {
        var s = Cache.load();
        var h = dc.getHeight();
        dc.setColor(Pal.INK, Graphics.COLOR_TRANSPARENT);
        dc.drawText(0, h / 4, Graphics.FONT_GLANCE, "Maïa", Graphics.TEXT_JUSTIFY_LEFT | Graphics.TEXT_JUSTIFY_VCENTER);
        var running = s != null && s["running"] instanceof Dictionary;
        dc.setColor(running ? Pal.MOSS : Pal.INK2, Graphics.COLOR_TRANSPARENT);
        dc.drawText(0, h * 3 / 4, Graphics.FONT_GLANCE, Fmt.glance(s), Graphics.TEXT_JUSTIFY_LEFT | Graphics.TEXT_JUSTIFY_VCENTER);
    }
}
