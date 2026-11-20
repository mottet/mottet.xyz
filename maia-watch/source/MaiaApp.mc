import Toybox.Application;
import Toybox.Background;
import Toybox.Lang;
import Toybox.Time;
import Toybox.WatchUi;

// Maïa's feeds on the watch. The glance shows the last summary the watch
// kept; a background job asks the site for a fresh one every five minutes,
// and the full screen asks again while it is open. Every request goes
// through Garmin Connect on the phone, so the phone must be near.
(:background :glance)
class MaiaApp extends Application.AppBase {
    function initialize() {
        AppBase.initialize();
    }

    function getInitialView() {
        refreshInBackground();
        var view = new MaiaView();
        return [view, new MaiaDelegate(view)];
    }

    (:glance)
    function getGlanceView() {
        return [new MaiaGlance()];
    }

    function getServiceDelegate() {
        return [new MaiaService()];
    }

    // A summary from the background job (null when the phone or site did not answer).
    function onBackgroundData(data) {
        if (data instanceof Dictionary) {
            Cache.save(data);
        }
        WatchUi.requestUpdate();
    }

    // Registered the first time the screen opens; Connect IQ keeps it after.
    function refreshInBackground() as Void {
        // Five minutes is the shortest gap Connect IQ allows.
        if (Background.getTemporalEventRegisteredTime() == null) {
            Background.registerForTemporalEvent(new Time.Duration(5 * 60));
        }
    }
}
