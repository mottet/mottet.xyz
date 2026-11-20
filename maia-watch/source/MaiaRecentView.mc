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

    hidden var sprig as WatchUi.BitmapResource? = null;

    function onUpdate(dc as Dc) as Void {
        var w = dc.getWidth(), h = dc.getHeight(), cx = w / 2;
        var center = Graphics.TEXT_JUSTIFY_CENTER | Graphics.TEXT_JUSTIFY_VCENTER;
        var left = Graphics.TEXT_JUSTIFY_LEFT | Graphics.TEXT_JUSTIFY_VCENTER;
        if (dc has :setAntiAlias) {
            dc.setAntiAlias(true);
        }
        dc.setColor(Pal.INK, Pal.PAPER);
        dc.clear();
        dc.setColor(Pal.INK3, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, h * 12 / 100, Graphics.FONT_XTINY, "LAST 5 FEEDS", center);
        if (sprig == null) {
            sprig = WatchUi.loadResource(Rez.Drawables.Sprig) as WatchUi.BitmapResource;
        }
        dc.drawBitmap(cx - 80, h * 16 / 100, sprig);

        var s = main.summary;
        var recent = s != null ? s["recent"] : null;
        if (!(recent instanceof Array) || recent.size() == 0) {
            dc.setColor(Pal.INK2, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, h / 2, Graphics.FONT_SMALL, "No feed yet", center);
            return;
        }
        // Five rows between 31% and 83% of the height: the start in cream,
        // the minutes in grey, the sides in the colour of the side she ended on.
        var top = h * 31 / 100, step = h * 13 / 100;
        for (var i = 0; i < recent.size() && i < 5; i++) {
            var f = recent[i] as Dictionary;
            var y = top + i * step;
            if (i > 0) {
                dc.setColor(Pal.LINE, Graphics.COLOR_TRANSPARENT);
                dc.drawLine(w * 22 / 100, y - step / 2, w * 78 / 100, y - step / 2);
            }
            var parts = [
                [Fmt.dayTime(f["start"] as Number), Pal.INK],
                ["   " + Fmt.span(f["active"] as Number) + "   ", Pal.INK3],
                [Fmt.sides(f), Pal.side(f["side"])]
            ];
            var total = 0;
            for (var k = 0; k < parts.size(); k++) {
                total += dc.getTextWidthInPixels((parts[k] as Array)[0] as String, Graphics.FONT_TINY);
            }
            var x = cx - total / 2;
            for (var k = 0; k < parts.size(); k++) {
                var part = parts[k] as Array;
                dc.setColor(part[1] as Number, Graphics.COLOR_TRANSPARENT);
                dc.drawText(x, y, Graphics.FONT_TINY, part[0] as String, left);
                x += dc.getTextWidthInPixels(part[0] as String, Graphics.FONT_TINY);
            }
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
