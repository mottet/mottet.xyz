import Toybox.Lang;
import Toybox.Time;

// Debug builds only: sample departures when no watch token is set, so the
// layout can be checked in the simulator.
(:debug)
function demoData() as Dictionary? {
    var dests = ["Boissy-Saint-Léger", "Saint-Germain-en-Laye", "Boissy-Saint-Léger", "Cergy-le-Haut", "Poissy", "Boissy-Saint-Léger"];
    var mins = [0, 3, 9, 12, 19, 24];
    var now = Time.now().value();
    var deps = [];
    for (var i = 0; i < dests.size(); i++) {
        var d = { "t" => now + mins[i] * 60 + 20, "d" => dests[i] };
        if (i == 0) { d["a"] = 1; }
        if (i == 4) { d["c"] = 1; }
        deps.add(d);
    }
    return { "ok" => true, "deps" => deps };
}

(:release)
function demoData() as Dictionary? {
    return null;
}
