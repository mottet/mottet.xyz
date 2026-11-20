import Toybox.Attention;
import Toybox.Communications;
import Toybox.Graphics;
import Toybox.Lang;
import Toybox.System;
import Toybox.Timer;
import Toybox.WatchUi;

// The full screen. Idle: the last feed, then Left / Right with the suggested
// side lit. Running: a live clock, then Switch / Stop (Resume / Stop while
// paused). The upper part or the action button opens a menu with everything,
// pause and refresh included.
class MaiaView extends WatchUi.View {
    const GREEN = 0x3FA34D;
    const BARK = 0xB5523B;
    const GREY = 0x333333;
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
            if (lastAction != null && Attention has :vibrate) {
                Attention.vibrate([new Attention.VibeProfile(60, 150)]);
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

    // ---- what the screen shows ------------------------------------------

    function running() as Dictionary? {
        var r = summary != null ? summary["running"] : null;
        return r instanceof Dictionary ? r : null;
    }

    function last() as Dictionary? {
        var l = summary != null ? summary["last"] : null;
        return l instanceof Dictionary ? l : null;
    }

    // The two big buttons at the bottom: [id, label, colour], or one for Stop
    // alone on a feed on both sides.
    function buttons() as Array {
        var run = running();
        if (run == null) {
            var next = summary != null ? summary["next"] : null;
            return [
                ["start-left", "LEFT", "left".equals(next) ? GREEN : GREY],
                ["start-right", "RIGHT", "right".equals(next) ? GREEN : GREY]
            ];
        }
        if (run["paused"] as Boolean) {
            return [["resume", "RESUME", GREEN], ["stop", "STOP", BARK]];
        }
        if ("both".equals(run["side"])) {
            return [["stop", "STOP", BARK]];
        }
        return [["switch", "SWITCH", GREY], ["stop", "STOP", BARK]];
    }

    // The actions for the menu.
    function actions() as Array {
        var run = running();
        if (run == null) {
            return [["start-left", "Start left"], ["start-right", "Start right"], ["refresh", "Refresh"]];
        }
        var out = [];
        if (!"both".equals(run["side"])) {
            out.add(["switch", "Switch side"]);
        }
        out.add((run["paused"] as Boolean) ? ["resume", "Resume"] : ["pause", "Pause"]);
        out.add(["stop", "Stop"]);
        out.add(["refresh", "Refresh"]);
        return out;
    }

    function buttonTop(dc as Dc) as Number {
        return dc.getHeight() * 64 / 100;
    }

    // Which button a tap at (x, y) lands on, or null.
    function buttonAt(x as Number, y as Number) as String? {
        var w = System.getDeviceSettings().screenWidth, h = System.getDeviceSettings().screenHeight;
        if (y < h * 64 / 100) {
            return null;
        }
        var b = buttons();
        var hit = (b.size() == 1 || x < w / 2 ? b[0] : b[1]) as Array;
        return hit[0] as String;
    }

    function onUpdate(dc as Dc) as Void {
        var w = dc.getWidth(), h = dc.getHeight(), cx = w / 2;
        dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_BLACK);
        dc.clear();
        var center = Graphics.TEXT_JUSTIFY_CENTER | Graphics.TEXT_JUSTIFY_VCENTER;
        var fetchedAt = summary != null ? summary["fetchedAt"] as Number : 0;
        var run = running(), done = last();

        if (summary == null) {
            dc.drawText(cx, h * 38 / 100, Graphics.FONT_SMALL, busy ? "Loading..." : "No data yet", center);
        } else if (run != null) {
            var paused = run["paused"] as Boolean;
            dc.setColor(Graphics.COLOR_LT_GRAY, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, h * 16 / 100, Graphics.FONT_XTINY, (paused ? "PAUSED · " : "FEEDING · ") + Fmt.name(run["side"]).toUpper(), center);
            dc.setColor(paused ? Graphics.COLOR_LT_GRAY : Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, h * 34 / 100, Graphics.FONT_NUMBER_MEDIUM, Fmt.clock(Fmt.active(run, fetchedAt)), center);
            dc.setColor(Graphics.COLOR_LT_GRAY, Graphics.COLOR_TRANSPARENT);
            var detail = "since " + Fmt.time(run["start"] as Number);
            if ((run["switches"] as Number) > 0) {
                detail += " · " + Fmt.sides(run);
            }
            dc.drawText(cx, h * 49 / 100, Graphics.FONT_XTINY, detail, center);
        } else if (done != null) {
            dc.setColor(Graphics.COLOR_LT_GRAY, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, h * 16 / 100, Graphics.FONT_XTINY, "LAST FEED", center);
            dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, h * 31 / 100, Graphics.FONT_MEDIUM, Fmt.ago(done["end"] as Number), center);
            dc.setColor(Graphics.COLOR_LT_GRAY, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, h * 42 / 100, Graphics.FONT_XTINY, Fmt.time(done["start"] as Number) + "-" + Fmt.time(done["end"] as Number) + " · " + Fmt.sides(done), center);
            dc.drawText(cx, h * 50 / 100, Graphics.FONT_XTINY, Fmt.span(done["active"] as Number) + " at the breast", center);
        } else {
            dc.drawText(cx, h * 38 / 100, Graphics.FONT_SMALL, "No feed yet", center);
        }

        // A line for what is going on: sending, or what went wrong.
        if (busy || message != null) {
            dc.setColor(message != null ? 0xFFAA55 : Graphics.COLOR_LT_GRAY, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, h * 58 / 100, Graphics.FONT_XTINY, message != null ? message : "Sending...", center);
        }

        // The buttons, cut by the round edge at the bottom.
        var top = buttonTop(dc), gap = 6;
        var b = buttons();
        for (var i = 0; i < b.size(); i++) {
            var x0 = b.size() == 1 ? 0 : (i == 0 ? 0 : cx + gap / 2);
            var x1 = b.size() == 1 ? w : (i == 0 ? cx - gap / 2 : w);
            var button = b[i] as Array;
            dc.setColor(busy ? GREY : (button[2] as Number), Graphics.COLOR_TRANSPARENT);
            dc.fillRectangle(x0, top, x1 - x0, h - top);
            dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
            var lx = b.size() == 1 ? cx : (i == 0 ? cx - w / 5 : cx + w / 5);
            dc.drawText(lx, top + (h - top) * 2 / 5, Graphics.FONT_SMALL, button[1] as String, center);
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
