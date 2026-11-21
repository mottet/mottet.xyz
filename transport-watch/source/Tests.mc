import Toybox.Lang;
import Toybox.Test;

(:test)
function testParse(logger as Logger) as Boolean {
    var deps = Transit.parse({ "ok" => true, "deps" => [
        { "t" => 1795262323, "d" => "Boissy-Saint-Léger", "a" => 1 },
        { "t" => 1795262435, "d" => "Gare de Saint-Germain-en-Laye", "c" => 1 },
        { "d" => "no time" },
        "junk"
    ] });
    Test.assertEqual(deps.size(), 2);
    Test.assertEqual(deps[0][:t], 1795262323);
    Test.assertEqual(deps[0][:dest], "Boissy-St-Léger");
    Test.assertEqual(deps[0][:atStop], true);
    Test.assertEqual(deps[0][:cancelled], false);
    Test.assertEqual(deps[1][:dest], "St-Germain-en-Laye");
    Test.assertEqual(deps[1][:cancelled], true);
    return true;
}

(:test)
function testParseEmpty(logger as Logger) as Boolean {
    Test.assertEqual(Transit.parse({}).size(), 0);
    Test.assertEqual(Transit.parse({ "ok" => false, "message" => "wrong" }).size(), 0);
    return true;
}
