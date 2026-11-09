#!/bin/sh
# Fetch the third-party candidates of the Flux visualisation benchmark into
# flux/bench/vendor/ (gitignored): d3 (for d3-sankey) and Apache ECharts,
# pinned versions from jsDelivr. The site itself uses none of them.
set -eu
cd "$(dirname "$0")/../flux/bench"
mkdir -p vendor
get() { [ -f "vendor/$2" ] || curl -fsSL "$1" -o "vendor/$2"; }
get https://cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js d3.min.js
get https://cdn.jsdelivr.net/npm/d3-sankey@0.12.3/dist/d3-sankey.min.js d3-sankey.min.js
get https://cdn.jsdelivr.net/npm/echarts@5.5.1/dist/echarts.min.js echarts.min.js
ls -la vendor
