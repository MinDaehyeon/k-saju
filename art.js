// sajuArt — Saju-seeded generative talisman art (SVG). Deterministic per chart, unique per person.
// window.sajuArt({counts:[wood,fire,earth,metal,water], dmElem:0..4, seed, size}) -> SVG string
(function () {
  var OBANG = ["#2f6b54", "#c0392b", "#bf9430", "#7c776b", "#222a36"];
  var INK = "#17140f";
  var VELLUM = "#bbb4a2";
  var PAPER = "#cbc6b8";
  var TAU = Math.PI * 2;

  function hash(str) {
    var h = 2166136261;
    str = String(str);
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function rng(seed) {
    var a = (seed >>> 0) || 1;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function n(v) { return (Math.round(v * 10) / 10).toFixed(1); }
  function pol(cx, cy, r, a) { return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }; }
  function xy(p) { return n(p.x) + " " + n(p.y); }
  function arc(cx, cy, r, a0, a1) {
    var p0 = pol(cx, cy, r, a0), p1 = pol(cx, cy, r, a1), large = a1 - a0 > Math.PI ? 1 : 0;
    return "M" + xy(p0) + " A " + n(r) + " " + n(r) + " 0 " + large + " 1 " + xy(p1);
  }
  function poly(points, close) {
    if (!points.length) return "";
    var d = "M" + xy(points[0]);
    for (var i = 1; i < points.length; i++) d += " L" + xy(points[i]);
    return close ? d + " Z" : d;
  }
  function line(p1, p2, color, width, opacity) {
    return '<line x1="' + n(p1.x) + '" y1="' + n(p1.y) + '" x2="' + n(p2.x) + '" y2="' + n(p2.y) +
      '" stroke="' + color + '" stroke-width="' + width + '" stroke-opacity="' + opacity + '" stroke-linecap="round"/>';
  }
  function circle(p, r, fill, stroke, width, opacity) {
    return '<circle cx="' + n(p.x) + '" cy="' + n(p.y) + '" r="' + n(r) + '"' +
      (fill ? ' fill="' + fill + '"' : ' fill="none"') +
      (stroke ? ' stroke="' + stroke + '" stroke-width="' + width + '"' : "") +
      ' opacity="' + opacity + '"/>';
  }

  window.sajuArtSeed = function (parts) {
    return hash((parts || []).map(function (x) { return String(x); }).join("|"));
  };

  window.sajuArt = function (o) {
    o = o || {};
    var size = Math.max(120, Number(o.size) || 260);
    var C = 130, i;
    var counts = Array.isArray(o.counts) && o.counts.length === 5 ? o.counts.slice() : [1, 1, 1, 1, 1];
    for (i = 0; i < 5; i++) counts[i] = Math.max(0, Number(counts[i]) || 0);
    var total = counts.reduce(function (a, b) { return a + b; }, 0);
    if (!total) { counts = [1, 1, 1, 1, 1]; total = 5; }
    var maxCount = Math.max.apply(null, counts.concat([1]));
    var dm = o.dmElem == null ? 2 : Math.max(0, Math.min(4, Number(o.dmElem) | 0));
    var seedNum = o.seed == null ? hash(counts.join(",") + "|" + dm)
      : (typeof o.seed === "number" ? (o.seed >>> 0) : hash(String(o.seed)));
    var R = rng(seedNum);

    var phase = -Math.PI / 2 + dm * TAU / 5 + (R() - 0.5) * 0.08;
    var outerR = 111, anchors = [], inner = [], satellites = [];

    for (i = 0; i < 5; i++) {
      var a = phase + i * TAU / 5;
      var share = counts[i] / maxCount;
      var rr = 52 + share * 31 + (R() - 0.5) * 4;
      anchors.push({ elem: i, p: pol(C, C, rr, a + (R() - 0.5) * 0.045), share: share });
      inner.push(pol(C, C, 27 + (i === dm ? 5 : 0), a + TAU / 10));
      if (counts[i] === 0) {
        satellites.push({ elem: i, missing: true, p: pol(C, C, 72, a) });
      } else {
        var m = Math.min(4, 1 + Math.floor(counts[i]));
        for (var j = 0; j < m; j++) {
          var side = j % 2 ? -1 : 1;
          var off = side * (0.09 + j * 0.038) + (R() - 0.5) * 0.018;
          var sr = 42 + j * 9 + share * 13 + (R() - 0.5) * 2;
          satellites.push({ elem: i, p: pol(C, C, sr, a + off), link: j < 2 });
        }
      }
    }

    var s = '<svg viewBox="0 0 260 260" width="' + size + '" height="' + size +
      '" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="display:block;overflow:visible">';
    s += '<g fill="none" stroke="' + VELLUM + '" stroke-linecap="round">';
    [38, 62, 86, 102].forEach(function (r, idx) {
      s += '<circle cx="130" cy="130" r="' + r + '" stroke-width="1" opacity="' + (0.52 - idx * 0.07).toFixed(2) + '"/>';
    });
    s += '</g>';
    s += '<circle cx="130" cy="130" r="' + outerR + '" fill="none" stroke="' + VELLUM + '" stroke-width="8" opacity=".22"/>';

    var ang = -Math.PI / 2;
    for (i = 0; i < 5; i++) {
      var span = counts[i] / total * TAU;
      if (span > 0.01) {
        var gap = Math.min(0.035, span * 0.18);
        if (span > gap * 2) {
          s += '<path d="' + arc(C, C, outerR, ang + gap, ang + span - gap) +
            '" fill="none" stroke="' + OBANG[i] + '" stroke-width="8.5" stroke-linecap="round"/>';
        }
      }
      ang += span;
    }

    for (var t = 0; t < 40; t++) {
      var major = t % 8 === 0;
      var ta = phase + t * TAU / 40;
      s += line(pol(C, C, major ? 96 : 100, ta), pol(C, C, 105, ta), major ? INK : VELLUM, major ? 1 : 0.8, major ? 0.22 : 0.34);
    }

    s += '<g fill="none" stroke="' + INK + '" stroke-linecap="round" stroke-linejoin="round">';
    s += '<path d="' + poly(anchors.map(function (a) { return a.p; }), true) + '" stroke-width="1.05" opacity=".24"/>';
    s += '<path d="' + poly(inner, true) + '" stroke-width=".9" opacity=".18"/>';
    anchors.forEach(function (a, idx) {
      var start = pol(C, C, 31, phase + idx * TAU / 5);
      s += line(start, a.p, INK, 0.9, (0.11 + a.share * 0.08).toFixed(2));
    });
    var startChord = seedNum % 5;
    for (i = 0; i < 2; i++) {
      var from = (startChord + i * 2) % 5, to = (from + 2) % 5;
      if (counts[from] && counts[to]) s += line(anchors[from].p, anchors[to].p, INK, 0.75, 0.15);
    }
    s += '</g>';

    satellites.forEach(function (st) {
      if (st.missing) {
        s += circle(st.p, 2.2, null, VELLUM, 1, 0.72);
      } else {
        if (st.link) s += line(st.p, anchors[st.elem].p, INK, 0.65, 0.13);
        s += circle(st.p, 1.45 + counts[st.elem] * 0.12, st.elem === dm ? OBANG[dm] : INK, null, 0, st.elem === dm ? 0.9 : 0.74);
      }
    });
    anchors.forEach(function (a) {
      s += circle(a.p, 2.5 + a.share * 1.8, OBANG[a.elem], null, 0, 0.96);
      s += circle(a.p, 5.2 + a.share * 1.5, null, OBANG[a.elem], 0.9, 0.34);
    });

    s += '<circle cx="130" cy="130" r="20" fill="none" stroke="' + VELLUM + '" stroke-width="1" opacity=".62"/>';
    s += '<g transform="translate(130 130) rotate(' + n((dm * 72 + seedNum % 11) % 90 - 45) + ')">';
    s += '<rect x="-13" y="-13" width="26" height="26" rx="3.5" fill="' + OBANG[dm] + '"/>';
    s += '<path d="M-7 -6.5H7M-7 0H7M-7 6.5H7M-6.5 -7V7M6.5 -7V7" fill="none" stroke="' + PAPER + '" stroke-width="1.7" stroke-linecap="round" opacity=".92"/>';
    s += '<circle cx="0" cy="0" r="2.2" fill="' + INK + '" opacity=".72"/>';
    s += '</g>';
    s += '</svg>';
    return s;
  };
})();
