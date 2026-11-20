import Toybox.Background;
import Toybox.Lang;
import Toybox.System;

// The background job: fetch the summary and hand it to the app, which keeps
// it for the glance.
(:background)
class MaiaService extends System.ServiceDelegate {
    function initialize() {
        ServiceDelegate.initialize();
    }

    function onTemporalEvent() as Void {
        Api.fetch(method(:onReply));
    }

    function onReply(code as Number, data as Dictionary or String or Null) as Void {
        Background.exit(code == 200 && data instanceof Dictionary ? data : null);
    }
}
