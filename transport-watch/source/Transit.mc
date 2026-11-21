import Toybox.Communications;
import Toybox.Lang;

// The next passages come from mottet.xyz (../transport-server.js), which asks
// Île-de-France Mobilités' PRIM API and keeps only the next departures:
// PRIM's own answer for an RER station is too big for a watch.
//   GET <serverUrl>/api/transport/next?ref=STIF:StopArea:SP:43234:&line=STIF:Line::C01742:
//   Authorization: Bearer <watchToken>
//   -> { "ok": true, "deps": [{ "t": 1795262323, "d": "Boissy-Saint-Léger", "c": 1, "a": 1 }] }
module Transit {
    const MAX_DEPARTURES = 8;

    function request(serverUrl as String, token as String, ref as String, line as String,
                     callback as Method(responseCode as Number, data as Dictionary or String or Null) as Void) as Void {
        var params = { "ref" => ref };
        if (line.length() > 0) {
            params["line"] = line;
        }
        var options = {
            :method => Communications.HTTP_REQUEST_METHOD_GET,
            :headers => { "Authorization" => "Bearer " + token },
            :responseType => Communications.HTTP_RESPONSE_CONTENT_TYPE_JSON
        };
        Communications.makeWebRequest(serverUrl + "/api/transport/next", params, options, callback);
    }

    // The server's answer -> [{ :t => Unix seconds, :dest => String, :cancelled => Boolean, :atStop => Boolean }]
    function parse(data as Dictionary) as Array<Dictionary> {
        var out = [] as Array<Dictionary>;
        var deps = data["deps"];
        if (!(deps instanceof Array)) {
            return out;
        }
        for (var i = 0; i < deps.size() && out.size() < MAX_DEPARTURES; i++) {
            var d = deps[i];
            if (!(d instanceof Dictionary)) { continue; }
            var t = d["t"];
            if (!(t instanceof Number)) { continue; }
            var dest = d["d"];
            out.add({
                :t => t,
                :dest => shorten(dest instanceof String ? dest : "?"),
                :cancelled => d["c"] == 1,
                :atStop => d["a"] == 1
            });
        }
        return out;
    }

    function replaceAll(s as String, from as String, to as String) as String {
        var res = "";
        var idx = s.find(from);
        while (idx != null) {
            res += s.substring(0, idx) + to;
            s = s.substring(idx + from.length(), s.length());
            idx = s.find(from);
        }
        return res + s;
    }

    // Make long destination names fit on the watch
    function shorten(s as String) as String {
        s = replaceAll(s, "Saint-", "St-");
        s = replaceAll(s, "Sainte-", "Ste-");
        s = replaceAll(s, "Saint ", "St ");
        if (s.find("Gare de ") == 0) { s = s.substring(8, s.length()); }
        return s;
    }

    // Human-readable error for a failed request
    function errorText(code as Number) as String {
        if (code == 401) { return "Jeton refusé"; }
        if (code == 503) { return "Serveur non configuré"; }
        if (code == 502) { return "PRIM indisponible"; }
        if (code == 429) { return "Trop de requêtes"; }
        if (code == 400) { return "Arrêt invalide"; }
        if (code == -104) { return "Téléphone non connecté"; }
        if (code == -402 || code == -403) { return "Réponse trop lourde"; }
        if (code == -300) { return "Délai dépassé"; }
        if (code == -400) { return "Réponse invalide"; }
        if (code == -2 || code == -101) { return "Bluetooth occupé"; }
        return "Erreur " + code.toString();
    }
}
