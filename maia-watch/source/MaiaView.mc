import Toybox.Attention;
import Toybox.Communications;
import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Math;
import Toybox.System;
import Toybox.Timer;
import Toybox.WatchUi;

// The full screen: the site's blue tit on a branch, asleep between feeds,
// awake and bobbing while she feeds, resting while paused. Idle: the last
// feed, a quiet arc round the edge for the time since, then Left / Right with
// the suggested side filled. Running: a live clock, a ring of leaves that
// grows a leaf a minute in the side's colour, then Switch / Stop (Resume /
// Stop while paused). The upper part or the action button opens a menu with
// everything, pause and refresh included.
class MaiaView extends WatchUi.View {
    const REFETCH_TICKS = 30; // ask the site again every half minute while open

    var summary as Dictionary? = null;
    var busy as Boolean = false;
    var message as String? = null;
    var lastAction as String? = null;
    hidden var timer as Timer.Timer? = null;
    hidden var ticks as Number = 0;

    function initialize() {
        View.initialize();
        summary = Cache.load();
    }

    function onShow() as Void {
        refresh();
        timer = new Timer.Timer();
        timer.start(method(:onTick), 1000, true);
    }

    function onHide() as Void {
        if (timer != null) {
            timer.stop();
            timer = null;
        }
        if (heartTimer != null) {
            heartTimer.stop();
            heartAt = 0;
        }
    }

    function onTick() as Void {
        ticks++;
        if (ticks % REFETCH_TICKS == 0 && !busy) {
            refresh();
        }
        WatchUi.requestUpdate();
    }

    // ---- talking to the site --------------------------------------------

    function refresh() as Void {
        if (busy) {
            return;
        }
        if (!System.getDeviceSettings().phoneConnected) {
            message = "Phone not connected";
            WatchUi.requestUpdate();
            return;
        }
        busy = true;
        lastAction = null;
        Api.fetch(method(:onReply));
        WatchUi.requestUpdate();
    }

    function act(action as String) as Void {
        if (action.equals("refresh")) {
            refresh();
            return;
        }
        if (action.equals("recent")) {
            showRecent();
            return;
        }
        if (busy) {
            return;
        }
        if (!System.getDeviceSettings().phoneConnected) {
            message = "Phone not connected";
            WatchUi.requestUpdate();
            return;
        }
        var run = running();
        busy = true;
        lastAction = action;
        message = null;
        Api.send(action, run != null ? run["id"] as String : null, method(:onReply));
        WatchUi.requestUpdate();
    }

    function onReply(code as Number, data as Dictionary or String or Null) as Void {
        busy = false;
        if (data instanceof Dictionary && data["now"] != null) {
            Cache.save(data);
            summary = Cache.load();
        }
        if (code == 200) {
            message = null;
            if (lastAction != null) {
                if (Attention has :vibrate) {
                    Attention.vibrate([new Attention.VibeProfile(60, 150)]);
                }
                if (!lastAction.equals("pause")) {
                    startHeart();
                }
            }
        } else if (data instanceof Dictionary && data["message"] instanceof String) {
            message = code == 401 ? "Wrong watch token" : data["message"] as String;
        } else if (code == 401) {
            message = "Wrong watch token";
        } else if (code == Communications.BLE_CONNECTION_UNAVAILABLE) {
            message = "Phone not connected";
        } else if (code == Communications.SECURE_CONNECTION_REQUIRED) {
            message = "Site must use HTTPS";
        } else if (code == Communications.NETWORK_REQUEST_TIMED_OUT) {
            message = "No answer, try again";
        } else {
            message = "Error " + code;
        }
        lastAction = null;
        WatchUi.requestUpdate();
    }

    function showRecent() as Void {
        var list = new MaiaRecentView(self);
        WatchUi.pushView(list, new MaiaRecentDelegate(), WatchUi.SLIDE_UP);
    }

    // ---- what the screen shows ------------------------------------------

    function running() as Dictionary? {
        var r = summary != null ? summary["running"] : null;
        return r instanceof Dictionary ? r : null;
    }

    function last() as Dictionary? {
        var l = summary != null ? summary["last"] : null;
        return l instanceof Dictionary ? l : null;
    }

    // The two buttons at the bottom: [id, label, colour, filled, ink], or one
    // for Stop alone on a feed on both sides.
    function buttons() as Array {
        var run = running();
        if (run == null) {
            var next = summary != null ? summary["next"] : null;
            return [
                ["start-left", "Left", Pal.LEFT, "left".equals(next), Pal.INK],
                ["start-right", "Right", Pal.RIGHT, "right".equals(next), Pal.INK]
            ];
        }
        if (run["paused"] as Boolean) {
            return [["resume", "Resume", Pal.MOSS, true, Pal.PAPER], ["stop", "Stop", Pal.BARK, true, Pal.PAPER]];
        }
        if ("both".equals(run["side"])) {
            return [["stop", "Stop", Pal.BARK, true, Pal.PAPER]];
        }
        // Switch is outlined in the colour of the side it goes to.
        var to = "left".equals(run["side"]) ? "right" : "left";
        return [["switch", "Switch", Pal.side(to), false, Pal.INK], ["stop", "Stop", Pal.BARK, true, Pal.PAPER]];
    }

    // The actions for the menu.
    function actions() as Array {
        var run = running();
        if (run == null) {
            return [["start-left", "Start left"], ["start-right", "Start right"], ["recent", "Last 5 feeds"], ["refresh", "Refresh"]];
        }
        var out = [];
        if (!"both".equals(run["side"])) {
            out.add(["switch", "Switch side"]);
        }
        out.add((run["paused"] as Boolean) ? ["resume", "Resume"] : ["pause", "Pause"]);
        out.add(["stop", "Stop"]);
        out.add(["recent", "Last 5 feeds"]);
        out.add(["refresh", "Refresh"]);
        return out;
    }

    // Which button a tap at (x, y) lands on, or null: the lower third, split down the middle.
    function buttonAt(x as Number, y as Number) as String? {
        var w = System.getDeviceSettings().screenWidth, h = System.getDeviceSettings().screenHeight;
        if (y < h * 64 / 100) {
            return null;
        }
        var b = buttons();
        var hit = (b.size() == 1 || x < w / 2 ? b[0] : b[1]) as Array;
        return hit[0] as String;
    }

    // ---- the little bird ----------------------------------------------------

    hidden var bitmaps as Dictionary = {};
    hidden var heartAt as Number = 0; // System.getTimer() when the heart began, 0 for none
    hidden var heartTimer as Timer.Timer? = null;
    const HEART_MS = 1400;

    hidden function bitmap(id) as WatchUi.BitmapResource {
        var b = bitmaps[id];
        if (b == null) {
            b = WatchUi.loadResource(id);
            bitmaps.put(id, b);
        }
        return b as WatchUi.BitmapResource;
    }

    // A heart rises from the bird when the site has taken a start, a switch or a stop.
    function startHeart() as Void {
        heartAt = System.getTimer();
        if (heartTimer == null) {
            heartTimer = new Timer.Timer();
        }
        heartTimer.start(method(:onHeartTick), 60, true);
    }

    function onHeartTick() as Void {
        if (System.getTimer() - heartAt > HEART_MS) {
            heartAt = 0;
            heartTimer.stop();
        }
        WatchUi.requestUpdate();
    }

    // Asleep between feeds (awake again once it has been two and a half
    // hours), awake and bobbing while she feeds, resting while paused, and
    // happy while the heart rises.
    hidden function mood() {
        if (heartAt != 0) {
            return Rez.Drawables.TitHappy;
        }
        var run = running();
        if (run != null) {
            return (run["paused"] as Boolean) ? Rez.Drawables.TitRest : Rez.Drawables.TitAwake;
        }
        var done = last();
        if (done != null && Fmt.now() - (done["end"] as Number) < 150 * 60) {
            return Rez.Drawables.TitSleep;
        }
        return Rez.Drawables.TitAwake;
    }

    // ---- drawing ------------------------------------------------------------

    function onUpdate(dc as Dc) as Void {
        var w = dc.getWidth(), h = dc.getHeight(), cx = w / 2;
        if (dc has :setAntiAlias) {
            dc.setAntiAlias(true);
        }
        dc.setColor(Pal.INK, Pal.PAPER);
        dc.clear();
        var center = Graphics.TEXT_JUSTIFY_CENTER | Graphics.TEXT_JUSTIFY_VCENTER;
        var fetchedAt = summary != null ? summary["fetchedAt"] as Number : 0;
        var run = running(), done = last();

        // Around the edge: the leaves of this feed, or the time since the last.
        if (run != null) {
            Art.leafRing(dc, run, Fmt.active(run, fetchedAt));
        } else if (done != null) {
            Art.sinceArc(dc, Fmt.now() - (done["end"] as Number));
        }

        // The branch across the top and the tit on it.
        var top = h * 3 / 100;
        var perchX = cx, perchY = top + Art.PERCH_Y;
        dc.drawBitmap(cx - Art.PERCH_X, top, bitmap(Rez.Drawables.Branch));
        var bob = run != null && !(run["paused"] as Boolean) && heartAt == 0 && ticks % 2 == 1 ? -3 : 0;
        var titX = perchX - Art.TIT_FEET_X, titY = perchY - Art.TIT_FEET_Y + bob;
        dc.drawBitmap(titX, titY, bitmap(mood()));
        var sleeping = run == null && heartAt == 0 && done != null && Fmt.now() - (done["end"] as Number) < 150 * 60;
        if (sleeping) {
            // z, z z, z z z, then quiet, a second each
            dc.setColor(Pal.INK3, Graphics.COLOR_TRANSPARENT);
            var zs = [[titX + 100, titY + 40, Graphics.FONT_XTINY], [titX + 112, titY + 24, Graphics.FONT_TINY], [titX + 126, titY + 6, Graphics.FONT_SMALL]];
            for (var i = 0; i < ticks % 4; i++) {
                var z = zs[i] as Array;
                dc.drawText(z[0] as Number, z[1] as Number, z[2] as Graphics.FontType, "z", center);
            }
        }
        if (heartAt != 0) {
            var t = (System.getTimer() - heartAt).toFloat() / HEART_MS;
            Art.heart(dc, titX + 92.0 + 6.0 * Math.sin(t * 9.0), titY + 30.0 - 46.0 * t, 9.5 + 5.0 * t);
        }

        // The words.
        if (summary == null) {
            dc.setColor(Pal.INK2, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, h * 47 / 100, Graphics.FONT_SMALL, busy ? "Loading..." : "No data yet", center);
        } else if (run != null) {
            var paused = run["paused"] as Boolean;
            dc.setColor(paused ? Pal.INK3 : Pal.INK, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, h * 46 / 100, Graphics.FONT_NUMBER_MEDIUM, Fmt.clock(Fmt.active(run, fetchedAt)), center);
            dc.setColor(paused ? Pal.INK3 : Pal.side(run["side"]), Graphics.COLOR_TRANSPARENT);
            var detail = (paused ? "Resting · " : "") + Fmt.name(run["side"]) + " · since " + Fmt.time(run["start"] as Number);
            if ((run["switches"] as Number) > 0 && !paused) {
                detail = Fmt.name(run["side"]) + " since " + Fmt.time(run["sideSince"] as Number);
            }
            dc.drawText(cx, h * 57 / 100, Graphics.FONT_XTINY, detail, center);
        } else if (done != null) {
            dc.setColor(Pal.INK, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, h * 45 / 100, Graphics.FONT_MEDIUM, Fmt.ago(done["end"] as Number), center);
            dc.setColor(Pal.INK3, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, h * 55 / 100, Graphics.FONT_XTINY, Fmt.time(done["start"] as Number) + " · " + Fmt.span(done["active"] as Number) + " · " + Fmt.sides(done), center);
        } else {
            dc.setColor(Pal.INK2, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, h * 47 / 100, Graphics.FONT_SMALL, "No feed yet", center);
        }

        // What is going on: sending, or what went wrong.
        if (busy || message != null) {
            dc.setColor(message != null ? Pal.DANGER : Pal.INK3, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, h * 63 / 100, Graphics.FONT_XTINY, message != null ? message : "Sending...", center);
        }

        // The buttons, rounded, inside the ring.
        var b = buttons();
        var by = h * 68 / 100, bh = h * 14 / 100, gap = 10, half = w * 31 / 100;
        for (var i = 0; i < b.size(); i++) {
            var button = b[i] as Array;
            var x0 = b.size() == 1 ? cx - half / 2 - 10 : (i == 0 ? cx - half - gap / 2 : cx + gap / 2);
            var bw = b.size() == 1 ? half + 20 : half;
            Art.pill(dc, x0, by, bw, bh, busy ? Pal.LINE : button[2] as Number, button[3] as Boolean, button[1] as String, button[4] as Number);
        }
    }
}

class MaiaDelegate extends WatchUi.BehaviorDelegate {
    hidden var view as MaiaView;

    function initialize(v as MaiaView) {
        BehaviorDelegate.initialize();
        view = v;
    }

    // A touchscreen turns a tap into onSelect before onTap, and onSelect has
    // no coordinates, so onSelect declines and the tap lands here: a button
    // acts at once (or does nothing while a request is out), anywhere else
    // opens the menu.
    function onTap(event as WatchUi.ClickEvent) as Boolean {
        var xy = event.getCoordinates();
        var action = view.buttonAt(xy[0], xy[1]);
        if (action == null) {
            openMenu();
        } else if (!view.busy) {
            view.act(action);
        }
        return true;
    }

    function onSelect() as Boolean {
        return false;
    }

    // Swiping up shows the last five feeds.
    function onNextPage() as Boolean {
        view.showRecent();
        return true;
    }

    // The action button (top right) opens the menu.
    function onKey(event as WatchUi.KeyEvent) as Boolean {
        if (event.getKey() == WatchUi.KEY_ENTER) {
            openMenu();
            return true;
        }
        return false;
    }

    function onMenu() as Boolean {
        openMenu();
        return true;
    }

    hidden function openMenu() as Void {
        var menu = new WatchUi.Menu2({ :title => "Maïa" });
        var items = view.actions();
        for (var i = 0; i < items.size(); i++) {
            var item = items[i] as Array;
            menu.addItem(new WatchUi.MenuItem(item[1] as String, null, item[0] as String, {}));
        }
        WatchUi.pushView(menu, new MaiaMenuDelegate(view), WatchUi.SLIDE_UP);
    }
}

class MaiaMenuDelegate extends WatchUi.Menu2InputDelegate {
    hidden var view as MaiaView;

    function initialize(v as MaiaView) {
        Menu2InputDelegate.initialize();
        view = v;
    }

    function onSelect(item as WatchUi.MenuItem) as Void {
        WatchUi.popView(WatchUi.SLIDE_DOWN);
        view.act(item.getId() as String);
    }
}
