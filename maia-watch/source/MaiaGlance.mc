import Toybox.Graphics;
import Toybox.Lang;
import Toybox.WatchUi;

// In the glance list: "Maïa" over "1h 42m ago · R 18 min".
(:glance)
class MaiaGlance extends WatchUi.GlanceView {
    function initialize() {
        GlanceView.initialize();
    }

    function onUpdate(dc as Dc) as Void {
        var s = Cache.load();
        var h = dc.getHeight();
        dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
        dc.drawText(0, h / 4, Graphics.FONT_GLANCE, "Maïa", Graphics.TEXT_JUSTIFY_LEFT | Graphics.TEXT_JUSTIFY_VCENTER);
        var running = s != null && s["running"] instanceof Dictionary;
        dc.setColor(running ? 0x7FD47F : Graphics.COLOR_LT_GRAY, Graphics.COLOR_TRANSPARENT);
        dc.drawText(0, h * 3 / 4, Graphics.FONT_GLANCE, Fmt.glance(s), Graphics.TEXT_JUSTIFY_LEFT | Graphics.TEXT_JUSTIFY_VCENTER);
    }
}
