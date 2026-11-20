import Toybox.Graphics;
import Toybox.Lang;
import Toybox.WatchUi;

// The last five finished feeds, newest first: when it began, minutes at the
// breast and the sides. Swipe down or press back to return.
class MaiaRecentView extends WatchUi.View {
    hidden var main as MaiaView;

    function initialize(m as MaiaView) {
        View.initialize();
        main = m;
    }

    function onUpdate(dc as Dc) as Void {
        var w = dc.getWidth(), h = dc.getHeight(), cx = w / 2;
        var center = Graphics.TEXT_JUSTIFY_CENTER | Graphics.TEXT_JUSTIFY_VCENTER;
        dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_BLACK);
        dc.clear();
        dc.setColor(Graphics.COLOR_LT_GRAY, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, h * 14 / 100, Graphics.FONT_XTINY, "LAST 5 FEEDS", center);

        var s = main.summary;
        var recent = s != null ? s["recent"] : null;
        if (!(recent instanceof Array) || recent.size() == 0) {
            dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, h / 2, Graphics.FONT_SMALL, "No feed yet", center);
            return;
        }
        // Five rows between 27% and 83% of the height, a thin line between them.
        var top = h * 27 / 100, step = h * 14 / 100;
        for (var i = 0; i < recent.size() && i < 5; i++) {
            var f = recent[i] as Dictionary;
            var y = top + i * step;
            if (i > 0) {
                dc.setColor(0x333333, Graphics.COLOR_TRANSPARENT);
                dc.drawLine(w * 18 / 100, y - step / 2, w * 82 / 100, y - step / 2);
            }
            dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, y, Graphics.FONT_TINY, Fmt.dayTime(f["start"] as Number) + "  " + Fmt.span(f["active"] as Number) + "  " + Fmt.sides(f), center);
        }
    }
}

class MaiaRecentDelegate extends WatchUi.BehaviorDelegate {
    function initialize() {
        BehaviorDelegate.initialize();
    }

    function onPreviousPage() as Boolean {
        WatchUi.popView(WatchUi.SLIDE_DOWN);
        return true;
    }
}
