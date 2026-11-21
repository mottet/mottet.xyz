import Toybox.Application;
import Toybox.Lang;
import Toybox.WatchUi;

class NextTransitApp extends Application.AppBase {
    private var _view as MainView?;

    function initialize() {
        AppBase.initialize();
    }

    function onStart(state as Dictionary?) as Void {}

    function onStop(state as Dictionary?) as Void {
        if (_view != null) {
            (_view as MainView).stopTimer();
        }
    }

    function getInitialView() as [WatchUi.Views] or [WatchUi.Views, WatchUi.InputDelegates] {
        var view = new MainView();
        _view = view;
        return [view, new MainDelegate(view)];
    }

    // Called when the user edits settings in the Garmin Connect phone app
    function onSettingsChanged() as Void {
        if (_view != null) {
            (_view as MainView).reloadConfig();
        }
    }
}
