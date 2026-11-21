import Toybox.Lang;
import Toybox.WatchUi;

class MainDelegate extends WatchUi.BehaviorDelegate {
    private var _view as MainView;

    function initialize(view as MainView) {
        BehaviorDelegate.initialize();
        _view = view;
    }

    // Swipe up / down: switch stop
    function onNextPage() as Boolean {
        _view.changePage(1);
        return true;
    }

    function onPreviousPage() as Boolean {
        _view.changePage(-1);
        return true;
    }

    // Tap or top button: refresh now
    function onSelect() as Boolean {
        _view.refresh();
        return true;
    }
}
