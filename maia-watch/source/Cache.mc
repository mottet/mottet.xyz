import Toybox.Application;
import Toybox.Lang;
import Toybox.Time;

// The last summary the watch got, and when, so the glance and the screen can
// show something (and count the minutes on) without the phone.
(:glance)
module Cache {
    function save(summary as Dictionary) as Void {
        var keep = {
            "fetchedAt" => Time.now().value()
        };
        // Storage takes no nulls inside a dictionary: an absent key is "none".
        var keys = ["next", "running", "last"];
        for (var i = 0; i < keys.size(); i++) {
            var v = summary[keys[i]];
            if (v != null) {
                keep.put(keys[i], v);
            }
        }
        Application.Storage.setValue("summary", keep);
    }

    function load() as Dictionary? {
        var s = Application.Storage.getValue("summary");
        return s instanceof Dictionary ? s : null;
    }
}
