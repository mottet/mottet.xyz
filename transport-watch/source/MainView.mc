import Toybox.Application;
import Toybox.Application.Properties;
import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Math;
import Toybox.System;
import Toybox.Time;
import Toybox.Time.Gregorian;
import Toybox.Timer;
import Toybox.WatchUi;

class MainView extends WatchUi.View {
    const TICK_MS = 15000;        // redraw every 15 s
    const REFRESH_TICKS = 2;      // re-fetch every 30 s
    const ROWS = 5;

    private var _stops as Array<Dictionary> = [] as Array<Dictionary>;
    private var _state as Array<Dictionary> = [] as Array<Dictionary>;
    private var _page as Number = 0;
    private var _token as String = "";
    private var _server as String = "";
    private var _timer as Timer.Timer?;
    private var _ticks as Number = 0;
    private var _busy as Boolean = false;
    private var _busyPage as Number = 0;

    function initialize() {
        View.initialize();
        reloadConfig();
    }

    // ---------------------------------------------------------------- config

    function reloadConfig() as Void {
        _token = prop("watchToken");
        _server = prop("serverUrl");
        _stops = [] as Array<Dictionary>;
        for (var i = 1; i <= 2; i++) {
            var ref = prop("stop" + i + "Ref");
            if (ref.length() > 0) {
                _stops.add({
                    :ref => ref,
                    :line => prop("line" + i + "Ref"),
                    :name => prop("name" + i),
                    :badge => prop("badge" + i)
                });
            }
        }
        _state = [] as Array<Dictionary>;
        for (var j = 0; j < _stops.size(); j++) {
            _state.add({ :deps => null, :error => null, :updated => null });
        }
        if (_page >= _stops.size()) { _page = 0; }
        refresh();
    }

    private function prop(key as String) as String {
        var v = null;
        try { v = Properties.getValue(key); } catch (e) { v = null; }
        return (v instanceof String) ? (v as String) : "";
    }

    // ----------------------------------------------------------- lifecycle

    function onShow() as Void {
        if (_timer == null) {
            _timer = new Timer.Timer();
            (_timer as Timer.Timer).start(method(:onTick), TICK_MS, true);
        }
        refresh();
    }

    function onHide() as Void {
        stopTimer();
    }

    function stopTimer() as Void {
        if (_timer != null) {
            (_timer as Timer.Timer).stop();
            _timer = null;
        }
    }

    function onTick() as Void {
        _ticks++;
        if (_ticks >= REFRESH_TICKS) {
            refresh();
        } else {
            WatchUi.requestUpdate();
        }
    }

    function changePage(delta as Number) as Void {
        if (_stops.size() < 2) { return; }
        _page = (_page + delta + _stops.size()) % _stops.size();
        WatchUi.requestUpdate();
        refresh();
    }

    // ---------------------------------------------------------- networking

    function refresh() as Void {
        _ticks = 0;
        if (_stops.size() == 0) { WatchUi.requestUpdate(); return; }
        if (_token.length() == 0 || _server.length() == 0) {
            var demo = demoData();
            if (demo != null) {
                var ds = _state[_page] as Dictionary;
                ds[:deps] = Transit.parse(demo);
                ds[:updated] = Time.now().value();
            }
            WatchUi.requestUpdate();
            return;
        }
        if (_busy) { return; }
        _busy = true;
        _busyPage = _page;
        var s = _stops[_page];
        Transit.request(_server, _token, s[:ref] as String, s[:line] as String, method(:onResponse));
        WatchUi.requestUpdate();
    }

    function onResponse(code as Number, data as Dictionary or String or Null) as Void {
        _busy = false;
        if (_busyPage >= _state.size()) { return; }
        var st = _state[_busyPage] as Dictionary;
        if (code == 200 && data instanceof Dictionary) {
            st[:deps] = Transit.parse(data);
            st[:error] = null;
            st[:updated] = Time.now().value();
        } else {
            st[:error] = Transit.errorText(code);
        }
        if (_busyPage != _page) {
            refresh();   // user switched page while we were loading
        }
        WatchUi.requestUpdate();
    }

    // ------------------------------------------------------------- drawing

    function onUpdate(dc as Graphics.Dc) as Void {
        var w = dc.getWidth();
        var h = dc.getHeight();
        var cx = w / 2;
        dc.setColor(Graphics.COLOR_BLACK, Graphics.COLOR_BLACK);
        dc.clear();

        if (_stops.size() == 0) {
            centered(dc, h / 2, "Aucun arrêt configuré", Graphics.COLOR_WHITE, Graphics.FONT_SMALL);
            return;
        }

        var stop = _stops[_page];
        var st = _state[_page] as Dictionary;

        drawBadge(dc, cx, 48, stop[:badge] as String);
        centered(dc, 92, stop[:name] as String, Graphics.COLOR_LT_GRAY, Graphics.FONT_SMALL);

        var deps = st[:deps] as Array<Dictionary>?;
        var now = Time.now().value();

        if ((_token.length() == 0 || _server.length() == 0) && deps == null) {
            centered(dc, h / 2 - 10, "Jeton manquant", Graphics.COLOR_WHITE, Graphics.FONT_SMALL);
            centered(dc, h / 2 + 24, "voir transport-watch/README", Graphics.COLOR_LT_GRAY, Graphics.FONT_XTINY);
        } else if (deps == null) {
            var msg = st[:error] != null ? st[:error] as String : "Chargement…";
            centered(dc, h / 2, msg, st[:error] != null ? Graphics.COLOR_RED : Graphics.COLOR_WHITE, Graphics.FONT_SMALL);
        } else {
            var row = 0;
            var y0 = 132;
            var rowH = 42;
            for (var i = 0; i < deps.size() && row < ROWS; i++) {
                var d = deps[i];
                var secs = (d[:t] as Number) - now;
                if (secs < -30) { continue; }   // already gone
                drawRow(dc, w, y0 + row * rowH, rowH, d, secs);
                row++;
            }
            if (row == 0) {
                centered(dc, h / 2, "Aucun passage", Graphics.COLOR_LT_GRAY, Graphics.FONT_SMALL);
            }
        }

        // footer: last update / error / loading
        var footer = "";
        var fColor = Graphics.COLOR_DK_GRAY;
        if (_busy) {
            footer = "Actualisation…";
        } else if (st[:error] != null && deps != null) {
            footer = st[:error] as String;
            fColor = Graphics.COLOR_RED;
        } else if (st[:updated] != null) {
            var info = Gregorian.info(new Time.Moment(st[:updated] as Number), Time.FORMAT_SHORT);
            footer = "maj " + info.hour.format("%02d") + ":" + info.min.format("%02d");
        }
        centered(dc, h - 38, footer, fColor, Graphics.FONT_XTINY);

        drawPageDots(dc, w, h);
    }

    private function drawRow(dc as Graphics.Dc, w as Number, y as Number, rowH as Number, d as Dictionary, secs as Number) as Void {
        // available width on the round screen at this height
        var r = w / 2;
        var dy = (y + rowH / 2 - r).abs();
        var half = Math.sqrt(r * r - dy * dy).toNumber();
        var left = r - half + 22;
        var right = r + half - 32;
        var midY = y + rowH / 2;

        // time label
        var cancelled = d[:cancelled] as Boolean;
        var label;
        var color = Graphics.COLOR_WHITE;
        if (cancelled) {
            label = "supprimé";
            color = Graphics.COLOR_RED;
        } else if (secs < 60) {
            label = (d[:atStop] as Boolean) ? "à quai" : "proche";
            color = Graphics.COLOR_YELLOW;
        } else {
            label = (secs / 60).toString() + " min";
            if (secs < 300) { color = Graphics.COLOR_GREEN; }
        }
        var font = Graphics.FONT_SMALL;
        dc.setColor(color, Graphics.COLOR_TRANSPARENT);
        dc.drawText(right, midY, font, label, Graphics.TEXT_JUSTIFY_RIGHT | Graphics.TEXT_JUSTIFY_VCENTER);
        var labelW = dc.getTextWidthInPixels(label, font);

        // destination, truncated to the remaining width
        var maxW = right - left - labelW - 12;
        var dest = fit(dc, d[:dest] as String, Graphics.FONT_TINY, maxW);
        dc.setColor(cancelled ? Graphics.COLOR_DK_GRAY : Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
        dc.drawText(left, midY, Graphics.FONT_TINY, dest, Graphics.TEXT_JUSTIFY_LEFT | Graphics.TEXT_JUSTIFY_VCENTER);

        // separator
        dc.setColor(0x222222, Graphics.COLOR_TRANSPARENT);
        dc.drawLine(left, y + rowH - 1, right, y + rowH - 1);
    }

    private function drawBadge(dc as Graphics.Dc, cx as Number, cy as Number, text as String) as Void {
        var font = Graphics.FONT_SMALL;
        var tw = dc.getTextWidthInPixels(text, font);
        var bw = tw + 28;
        var bh = 40;
        var bg = 0x0064B0;                     // bus blue
        if (text.find("RER") != null) { bg = 0xE3051C; }   // RER A red
        dc.setColor(bg, Graphics.COLOR_TRANSPARENT);
        dc.fillRoundedRectangle(cx - bw / 2, cy - bh / 2, bw, bh, 10);
        dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, cy, font, text, Graphics.TEXT_JUSTIFY_CENTER | Graphics.TEXT_JUSTIFY_VCENTER);
    }

    private function drawPageDots(dc as Graphics.Dc, w as Number, h as Number) as Void {
        var n = _stops.size();
        if (n < 2) { return; }
        var x = w - 10;
        var y = h / 2 - (n - 1) * 9;
        for (var i = 0; i < n; i++) {
            dc.setColor(i == _page ? Graphics.COLOR_WHITE : Graphics.COLOR_DK_GRAY, Graphics.COLOR_TRANSPARENT);
            dc.fillCircle(x, y + i * 18, 5);
        }
    }

    private function centered(dc as Graphics.Dc, y as Number, text as String, color as Number, font as Graphics.FontType) as Void {
        dc.setColor(color, Graphics.COLOR_TRANSPARENT);
        dc.drawText(dc.getWidth() / 2, y, font, text, Graphics.TEXT_JUSTIFY_CENTER | Graphics.TEXT_JUSTIFY_VCENTER);
    }

    private function fit(dc as Graphics.Dc, s as String, font as Graphics.FontType, maxW as Number) as String {
        if (dc.getTextWidthInPixels(s, font) <= maxW) { return s; }
        var n = s.length();
        while (n > 1 && dc.getTextWidthInPixels(s.substring(0, n) + "…", font) > maxW) {
            n--;
        }
        return s.substring(0, n) + "…";
    }
}
