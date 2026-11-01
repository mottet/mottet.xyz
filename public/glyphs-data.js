'use strict';

// Glyphs: the elements, how they stand to one another, the spells with their
// glyph shapes, and the reactions written by hand. Pure data; the rules in
// glyphs-spells.js build everything else from it. Edit it in the forge
// (/glyphs-editor.html), which writes this file back, or by hand: the value
// must stay JSON. A pair of attacks with no written reaction gets one derived
// from the relations.
(function (root, data) {
  if (typeof module === 'object' && module.exports) module.exports = data;
  else root.GlyphsData = data;
})(typeof self !== 'undefined' ? self : this, {
  "version": 1,
  "round": {
    "seconds": 10,
    "maxPower": 3,
    "maxRing": 3,
    "hits": 2,
    "powerLevels": [
      {
        "within": 0.5,
        "power": 3
      },
      {
        "within": 0.9,
        "power": 2
      }
    ],
    "compoundCost": 1
  },
  "elements": [
    {
      "id": "fire",
      "name": "flame",
      "color": "#d8632a",
      "death": {
        "name": "burnt to ash",
        "line": "The fire takes the last of them; ash drifts where a caster stood."
      }
    },
    {
      "id": "metal",
      "name": "iron",
      "color": "#8a97a8",
      "death": {
        "name": "cut down",
        "line": "The iron finds the gap and the caster falls where they stood, cut down."
      }
    },
    {
      "id": "earth",
      "name": "stone",
      "color": "#8d8470",
      "death": {
        "name": "turned to stone",
        "line": "The stone climbs to the throat and the caster stands forever."
      }
    },
    {
      "id": "air",
      "name": "wind",
      "color": "#8ea66d",
      "death": {
        "name": "scattered",
        "line": "The wind unpicks them and carries them away as leaves."
      }
    },
    {
      "id": "water",
      "name": "water",
      "color": "#4f8aa3",
      "death": {
        "name": "drowned",
        "line": "The water closes over them and does not give them back."
      }
    }
  ],
  "relations": [
    {
      "kind": "beats",
      "from": "fire",
      "to": "metal"
    },
    {
      "kind": "beats",
      "from": "metal",
      "to": "earth"
    },
    {
      "kind": "beats",
      "from": "earth",
      "to": "air"
    },
    {
      "kind": "beats",
      "from": "air",
      "to": "water"
    },
    {
      "kind": "beats",
      "from": "water",
      "to": "fire"
    },
    {
      "kind": "beats",
      "from": "earth",
      "to": "fire"
    },
    {
      "kind": "beats",
      "from": "water",
      "to": "metal"
    },
    {
      "kind": "quench",
      "from": "earth",
      "to": "water"
    },
    {
      "kind": "pass",
      "from": "fire",
      "to": "air"
    },
    {
      "kind": "pass",
      "from": "metal",
      "to": "air"
    }
  ],
  "spells": [
    {
      "id": "flame",
      "name": "Flame",
      "elements": [
        "fire"
      ],
      "kind": "attack",
      "glyph": "a triangle, apex up",
      "flavour": "The old sign for fire: a point rising from a broad base.",
      "shapes": [
        {
          "kind": "triangle"
        }
      ]
    },
    {
      "id": "wave",
      "name": "Wave",
      "elements": [
        "water"
      ],
      "kind": "attack",
      "glyph": "a wave of two crests, drawn across",
      "flavour": "Water moves in crests; two are enough to call it.",
      "shapes": [
        {
          "kind": "wave",
          "crests": 2
        },
        {
          "kind": "wave",
          "crests": 3
        },
        {
          "kind": "wave",
          "crests": 1.5
        }
      ]
    },
    {
      "id": "stone",
      "name": "Stone",
      "elements": [
        "earth"
      ],
      "kind": "attack",
      "glyph": "a square",
      "flavour": "Earth is a block with four corners and no give.",
      "shapes": [
        {
          "kind": "square"
        }
      ]
    },
    {
      "id": "wind",
      "name": "Wind",
      "elements": [
        "air"
      ],
      "kind": "attack",
      "glyph": "a spiral of two turns",
      "flavour": "Air is a gust that winds outward from stillness.",
      "shapes": [
        {
          "kind": "spiral",
          "turns": 2,
          "sign": 1
        },
        {
          "kind": "spiral",
          "turns": 2,
          "sign": -1
        },
        {
          "kind": "spiral",
          "turns": 2.5,
          "sign": 1
        },
        {
          "kind": "spiral",
          "turns": 2.5,
          "sign": -1
        }
      ]
    },
    {
      "id": "iron",
      "name": "Iron",
      "elements": [
        "metal"
      ],
      "kind": "attack",
      "glyph": "a cross: two strokes, one laid across the other",
      "flavour": "The smith's sign: a bar laid across a bar. Iron is edge and weight, and it answers to fire and to rust.",
      "shapes": [
        {
          "kind": "cross"
        }
      ]
    },
    {
      "id": "ward",
      "name": "Ward",
      "elements": [],
      "kind": "barrier",
      "glyph": "a circle",
      "flavour": "A bare ring on the floor. It stands against every element alike, and thickens whatever ring already stands.",
      "shapes": [
        {
          "kind": "circle"
        }
      ]
    },
    {
      "id": "mirror",
      "name": "Mirror",
      "elements": [],
      "kind": "defence",
      "reflects": [
        "fire",
        "air"
      ],
      "glyph": "one upright stroke",
      "flavour": "A still, upright pane for one round. What flies comes back off it; what is heavy soaks or shatters it.",
      "shapes": [
        {
          "kind": "upright"
        }
      ]
    },
    {
      "id": "bolt",
      "name": "Bolt",
      "elements": [
        "fire",
        "air"
      ],
      "kind": "attack",
      "glyph": "a lightning stroke, two sharp turns",
      "flavour": "Fire riding the air. It strikes as flame and as wind at once.",
      "shapes": [
        {
          "kind": "bolt"
        }
      ]
    },
    {
      "id": "frost",
      "name": "Frost",
      "elements": [
        "water",
        "air"
      ],
      "kind": "attack",
      "glyph": "a snow crystal: three strokes crossing at one point",
      "flavour": "Water carried on the wind until it hardens. Six arms, like the crystal.",
      "shapes": [
        {
          "kind": "crystal",
          "tilt": 60
        },
        {
          "kind": "crystal",
          "tilt": 45
        }
      ]
    },
    {
      "id": "vine",
      "name": "Vine",
      "elements": [
        "earth",
        "water"
      ],
      "kind": "attack",
      "glyph": "an S, a tendril climbing",
      "flavour": "Earth drinking water and growing. It binds as stone and as flood.",
      "shapes": [
        {
          "kind": "tendril",
          "sign": 1
        },
        {
          "kind": "tendril",
          "sign": -1
        }
      ]
    },
    {
      "id": "magma",
      "name": "Magma",
      "elements": [
        "fire",
        "earth"
      ],
      "kind": "attack",
      "glyph": "a triangle, apex down",
      "flavour": "Fire turned to the ground until the ground runs. Flame and stone together.",
      "shapes": [
        {
          "kind": "cup"
        }
      ]
    }
  ],
  "reactions": {
    "flame flame": {
      "name": "inferno",
      "x": {
        "fire": 1
      },
      "y": {
        "fire": 1
      },
      "line": "Two flames meet and the air itself burns. Each flame goes on to the other caster."
    },
    "flame wave": {
      "name": "steam",
      "x": {
        "water": 1
      },
      "y": {},
      "line": "Fire and water meet in a hiss of steam, and the wave rolls on through it to the fire caster."
    },
    "flame stone": {
      "name": "smothered",
      "x": {
        "earth": 1
      },
      "y": {},
      "line": "The stone smothers the flame and goes on to the one who lit it."
    },
    "flame wind": {
      "name": "fanned",
      "x": {
        "air": 1
      },
      "y": {
        "fire": 1
      },
      "line": "The wind fans the flame and the flame rides the wind. Each goes on to the other caster."
    },
    "flame mirror": {
      "name": "reflected",
      "x": {
        "fire": 1
      },
      "y": {},
      "line": "The mirror turns the flame back to its caster."
    },
    "flame iron": {
      "name": "melts",
      "x": {},
      "y": {
        "fire": 1
      },
      "line": "The flame runs the iron to a glowing pool that goes on to the iron caster."
    },
    "wave wave": {
      "name": "flood",
      "x": {
        "water": 1
      },
      "y": {
        "water": 1
      },
      "line": "Two waves meet and the floor floods. Each wave goes on to the other caster."
    },
    "wave stone": {
      "name": "mud",
      "x": {},
      "y": {},
      "line": "The stone drinks the wave and the wave softens the stone to mud. Nothing lands."
    },
    "wave wind": {
      "name": "spray",
      "x": {
        "air": 1
      },
      "y": {},
      "line": "The wind tears the wave to spray and goes on to the water caster."
    },
    "wave mirror": {
      "name": "flows through",
      "x": {},
      "y": {
        "water": 1
      },
      "line": "Water finds its way round the mirror and reaches its caster."
    },
    "wave iron": {
      "name": "rust",
      "x": {},
      "y": {
        "water": 1
      },
      "line": "The wave eats the iron to rust and rolls on to the iron caster."
    },
    "stone stone": {
      "name": "quake",
      "x": {
        "earth": 1
      },
      "y": {
        "earth": 1
      },
      "line": "Two stones strike and the ground cracks under both casters."
    },
    "stone wind": {
      "name": "breaks",
      "x": {},
      "y": {
        "earth": 1
      },
      "line": "The wind breaks on the stone, and the stone goes on to the wind caster."
    },
    "stone mirror": {
      "name": "shatters",
      "x": {},
      "y": {
        "earth": 1
      },
      "line": "The stone shatters the mirror and strikes its caster."
    },
    "stone iron": {
      "name": "split",
      "x": {
        "metal": 1
      },
      "y": {},
      "line": "The iron splits the stone and goes on to the stone caster."
    },
    "wind wind": {
      "name": "gale",
      "x": {
        "air": 1
      },
      "y": {
        "air": 1
      },
      "line": "Two gusts become a gale that tears at both casters."
    },
    "wind mirror": {
      "name": "reflected",
      "x": {
        "air": 1
      },
      "y": {},
      "line": "The mirror turns the wind back to its caster."
    },
    "wind iron": {
      "name": "slips",
      "x": {
        "metal": 1
      },
      "y": {
        "air": 1
      },
      "line": "The wind slips round the iron and the iron cuts nothing of the wind. Each goes on to the other caster."
    },
    "iron iron": {
      "name": "sparks",
      "x": {
        "metal": 1
      },
      "y": {
        "metal": 1
      },
      "line": "Two blades ring together and the sparks fly. Each goes on to the other caster."
    },
    "iron mirror": {
      "name": "shatters",
      "x": {},
      "y": {
        "metal": 1
      },
      "line": "The iron shatters the mirror and strikes its caster."
    },
    "mirror mirror": {
      "name": "stillness",
      "x": {},
      "y": {},
      "line": "Two guards and no blow. Nothing moves."
    }
  }
});
