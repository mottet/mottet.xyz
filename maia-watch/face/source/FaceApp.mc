import Toybox.Application;
import Toybox.Background;
import Toybox.Lang;
import Toybox.Time;
import Toybox.WatchUi;

// Maïa's watch face. A watch face cannot go online itself, so a background
// job asks the site for the feed summary every five minutes (the shortest
// Connect IQ allows) through Garmin Connect on the phone; the face draws from
// the last one kept. The widget has its own copy: two apps keep two stores.
(:background)
class FaceApp extends Application.AppBase {
    function initialize() {
        AppBase.initialize();
    }

    function getInitialView() {
        if (Background.getTemporalEventRegisteredTime() == null) {
            Background.registerForTemporalEvent(new Time.Duration(5 * 60));
        }
        return [new FaceView()];
    }

    function getServiceDelegate() {
        return [new MaiaService()];
    }

    function onBackgroundData(data) {
        if (data instanceof Dictionary) {
            Cache.save(data);
        }
        WatchUi.requestUpdate();
    }
}
