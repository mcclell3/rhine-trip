(function () {
  "use strict";

  var header = document.querySelector(".site-header");
  var dayLinks = Array.prototype.slice.call(document.querySelectorAll(".day-nav a"));
  var days = Array.prototype.slice.call(document.querySelectorAll(".day[id]"));
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function onScroll() {
    if (!header) return;
    header.classList.toggle("is-scrolled", window.scrollY > 24);
  }
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  if ("IntersectionObserver" in window && days.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var id = entry.target.id;
        dayLinks.forEach(function (link) {
          var match = link.getAttribute("href") === "#" + id;
          if (match) link.setAttribute("aria-current", "true");
          else link.removeAttribute("aria-current");
        });
      });
    }, { rootMargin: "-45% 0px -45% 0px", threshold: 0 });
    days.forEach(function (day) { io.observe(day); });
  }

  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener("click", function (e) {
      var id = anchor.getAttribute("href").slice(1);
      var target = document.getElementById(id);
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
      history.replaceState(null, "", "#" + id);
    });
  });

  function mapsUrl(lat, lng, z) {
    return "https://www.google.com/maps/@" + lat + "," + lng + "," + (z || 16) + "z";
  }

  function placeMaps(name, lat, lng) {
    name = String(name || "").trim();
    return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(name);
  }

  function gmapEmbed(query, z) {
    z = z || 16;
    return "https://www.google.com/maps?q=" + encodeURIComponent(query) + "&z=" + z + "&hl=en&output=embed";
  }

  function gmapSearch(query) {
    return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(query);
  }

  function placeQuery(key) {
    var p = PLACES[key];
    if (!p) return "";
    return p.query || p.name;
  }

  function queryOf(item, path) {
    if (item && item.place) return placeQuery(item.place) || item.label || "";
    if (path && path.to && PLACES[path.to]) return placeQuery(path.to);
    if (path && path.from && PLACES[path.from]) return placeQuery(path.from);
    if (item && item.label) return item.label;
    if (path && path.label) return path.label;
    return "";
  }

  function bindFrame(iframe, linkEl) {
    return function (query, z) {
      if (!iframe || !query) return;
      iframe.src = gmapEmbed(query, z || 16);
      if (linkEl) {
        linkEl.href = gmapSearch(query);
        linkEl.setAttribute("aria-label", "Open " + query + " in Google Maps");
      }
    };
  }

  function isCoarsePointer() {
    return window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
  }

  function googleTileLayer(hybrid) {
    return L.tileLayer("https://{s}.google.com/vt/lyrs=" + (hybrid ? "y" : "m") + "&hl=en&x={x}&y={y}&z={z}", {
      attribution: "Map data &copy; Google",
      maxZoom: 21,
      subdomains: ["mt0", "mt1", "mt2", "mt3"]
    });
  }

  function addSatToggle(map) {
    var ctrl = L.control({ position: "topright" });
    ctrl.onAdd = function () {
      var wrap = L.DomUtil.create("div", "map-sat-toggle");
      var btn = L.DomUtil.create("button", "", wrap);
      btn.type = "button";
      btn.textContent = "Satellite";
      btn.setAttribute("aria-pressed", "false");
      btn.setAttribute("aria-label", "Switch to satellite view");
      L.DomEvent.disableClickPropagation(wrap);
      L.DomEvent.disableScrollPropagation(wrap);
      L.DomEvent.on(btn, "click", function (ev) {
        L.DomEvent.stop(ev);
        var on = btn.getAttribute("aria-pressed") !== "true";
        btn.setAttribute("aria-pressed", on ? "true" : "false");
        btn.textContent = on ? "Map" : "Satellite";
        btn.setAttribute("aria-label", on ? "Switch to map view" : "Switch to satellite view");
        map.getContainer().classList.toggle("is-hybrid", on);
        if (on) {
          if (map.hasLayer(map._roadLayer)) map.removeLayer(map._roadLayer);
          if (!map.hasLayer(map._hybridLayer)) map._hybridLayer.addTo(map);
          map._hybridLayer.bringToBack();
        } else {
          if (map.hasLayer(map._hybridLayer)) map.removeLayer(map._hybridLayer);
          if (!map.hasLayer(map._roadLayer)) map._roadLayer.addTo(map);
          map._roadLayer.bringToBack();
        }
      });
      return wrap;
    };
    ctrl.addTo(map);
  }

  function setupMapGestures(map) {
    var coarse = isCoarsePointer();
    var el = map.getContainer();
    if (!coarse) {
      map.dragging.enable();
      map.scrollWheelZoom.disable();
      return;
    }
    map.dragging.disable();
    map.scrollWheelZoom.disable();
    map.touchZoom.enable();
    el.style.touchAction = "pan-y";
    function setTwoFinger(on) {
      el.classList.toggle("is-map-panning", on);
      el.style.touchAction = on ? "none" : "pan-y";
      if (on) map.dragging.enable();
      else map.dragging.disable();
    }
    el.addEventListener("touchstart", function (e) {
      setTwoFinger(e.touches.length >= 2);
    }, { passive: true });
    el.addEventListener("touchend", function (e) {
      setTwoFinger(e.touches.length >= 2);
    }, { passive: true });
    el.addEventListener("touchcancel", function () {
      setTwoFinger(false);
    }, { passive: true });
  }

  function addCityTiles(map) {
    map._roadLayer = googleTileLayer(false);
    map._hybridLayer = googleTileLayer(true);
    map._roadLayer.addTo(map);
    addSatToggle(map);
    setupMapGestures(map);
  }

  var PLACES = {
    amsHotel: {
      lat: 52.3740616, lng: 4.8906010, name: "Hotel Die Port van Cleve", role: "Stay", icon: "bed",
      gmaps: mapsUrl(52.3740616, 4.8906010, 18)
    },
    centraal: {
      lat: 52.3791, lng: 4.9003, name: "Amsterdam Centraal train station", role: "Station", icon: "train",
      gmaps: mapsUrl(52.3791, 4.9003, 17)
    },
    canals: {
      lat: 52.3667, lng: 4.8897, name: "Amsterdam canal ring", role: "Sight", icon: "house",
      gmaps: mapsUrl(52.3667, 4.8897, 16)
    },
    anneFrank: {
      lat: 52.3752, lng: 4.8840, name: "Anne Frank House", role: "Sight", icon: "house",
      gmaps: mapsUrl(52.3752, 4.8840, 18)
    },
    winkel: {
      lat: 52.3748, lng: 4.8836, name: "Café Winkel 43", role: "Cafe", icon: "coffee",
      gmaps: mapsUrl(52.3748, 4.8836, 18)
    },
    scheepvaart: {
      lat: 52.3717, lng: 4.9148, name: "Het Scheepvaartmuseum (maritime museum)", role: "Sight", icon: "ship",
      gmaps: mapsUrl(52.3717, 4.9148, 18)
    },
    ord: {
      lat: 41.9742, lng: -87.9073, name: "Chicago O’Hare Airport, Terminal 5", role: "Airport", icon: "plane",
      gmaps: mapsUrl(41.9742, -87.9073, 14)
    },
    schiphol: {
      lat: 52.3105, lng: 4.7683, name: "Schiphol Airport", role: "Airport", icon: "plane",
      gmaps: mapsUrl(52.3105, 4.7683, 15)
    },
    salonBoat: {
      lat: 52.3752, lng: 4.8840, name: "Flagship jetty · Anne Frank House", role: "Cruise", icon: "boat",
      gmaps: mapsUrl(52.3752, 4.8840, 18)
    },
    praetorium: {
      lat: 50.9378, lng: 6.9595, name: "Praetorium (Roman palace ruins)", role: "Sight", icon: "roman",
      gmaps: mapsUrl(50.9378, 6.9595, 18)
    },
    katz: {
      lat: 50.1547, lng: 7.7219, name: "Burg Katz castle", role: "Sight", icon: "castle",
      gmaps: mapsUrl(50.1547, 7.7219, 17)
    },
    maus: {
      lat: 50.1722, lng: 7.7289, name: "Burg Maus castle", role: "Sight", icon: "castle",
      gmaps: mapsUrl(50.1722, 7.7289, 17)
    },
    schonburg: {
      lat: 50.1039, lng: 7.7656, name: "Schönburg castle", role: "Sight", icon: "castle",
      gmaps: mapsUrl(50.1039, 7.7656, 17)
    },
    stgoar: {
      lat: 50.1506, lng: 7.7158, name: "St. Goar waterfront", role: "Sight", icon: "town",
      gmaps: mapsUrl(50.1506, 7.7158, 17)
    },
    bacharach: {
      lat: 50.0592, lng: 7.7694, name: "Bacharach", role: "Sight", icon: "town",
      gmaps: mapsUrl(50.0592, 7.7694, 16)
    },
    riverwalk: {
      lat: 50.0015, lng: 8.2750, name: "Mainz riverwalk", role: "Sight", icon: "riverwalk",
      gmaps: mapsUrl(50.0015, 8.2750, 17)
    },
    hiltonFra: {
      lat: 50.0531, lng: 8.5732, name: "Hilton Frankfurt Airport hotel", role: "Stay", icon: "bed",
      gmaps: mapsUrl(50.0531, 8.5732, 17)
    },
    cathedral: {
      lat: 50.9413, lng: 6.9583, name: "Cologne Cathedral", role: "Sight", icon: "cathedral",
      gmaps: mapsUrl(50.9413, 6.9583, 18)
    },
    excelsior: {
      lat: 50.9413, lng: 6.9564, name: "Excelsior Hotel Ernst", role: "Stay", icon: "bed",
      gmaps: mapsUrl(50.9413, 6.9564, 18)
    },
    elde: {
      lat: 50.9394, lng: 6.9506, name: "EL-DE Haus (Cologne)", role: "Sight", icon: "museum",
      gmaps: mapsUrl(50.9394, 6.9506, 18)
    },
    fruh: {
      lat: 50.9410, lng: 6.9575, name: "Brauhaus FRÜH am Dom", role: "Cafe", icon: "dinner",
      gmaps: mapsUrl(50.9410, 6.9575, 18)
    },
    koelnHbf: {
      lat: 50.9430, lng: 6.9587, name: "Cologne train station", role: "Station", icon: "train",
      gmaps: mapsUrl(50.9430, 6.9587, 17)
    },
    avisCologne: {
      lat: 50.9231722, lng: 6.9965690, name: "Avis Cologne Poll (Max-Glomsda-Straße 4)", role: "Rental", icon: "car",
      gmaps: mapsUrl(50.9231722, 6.9965690, 18)
    },
    bellevue: {
      lat: 50.232717, lng: 7.590105, name: "Restaurant Le Jardin (Bellevue terrace)", role: "Cafe", icon: "lunch",
      gmaps: mapsUrl(50.232717, 7.590105, 18)
    },
    pier: {
      lat: 50.23310, lng: 7.58988, name: "Boppard boat pier (KD Anleger)", role: "Cruise", icon: "boat",
      gmaps: mapsUrl(50.23310, 7.58988, 18)
    },
    boppardPromenade: {
      lat: 50.23135, lng: 7.58895, name: "Kurfürstliche Burg Boppard", role: "Sight", icon: "castle",
      gmaps: mapsUrl(50.23135, 7.58895, 17)
    },
    rheinfels: {
      lat: 50.1547, lng: 7.7133, name: "Burg Rheinfels castle", role: "Sight", icon: "castle",
      gmaps: mapsUrl(50.1547, 7.7133, 17)
    },
    loreley: {
      lat: 50.1394, lng: 7.7289, name: "Loreley rock", role: "Sight", icon: "rock",
      gmaps: mapsUrl(50.1394, 7.7289, 16)
    },
    pfalz: {
      lat: 50.0836, lng: 7.7658, name: "Burg Pfalzgrafenstein castle", role: "Sight", icon: "castle",
      gmaps: mapsUrl(50.0836, 7.7658, 17)
    },
    hyatt: {
      lat: 49.9989, lng: 8.2767, name: "Hyatt Regency Mainz", role: "Stay", icon: "bed",
      gmaps: mapsUrl(49.9989, 8.2767, 18)
    },
    rudesheim: {
      lat: 49.9764, lng: 7.9232, name: "Rüdesheim am Rhein", role: "Sight", icon: "town",
      gmaps: mapsUrl(49.9764, 7.9232, 16)
    },
    rudesheimJetty: {
      lat: 49.977497, lng: 7.923256, name: "KD Anleger Rüdesheim", role: "Cruise", icon: "boat",
      gmaps: mapsUrl(49.977497, 7.923256, 18)
    },
    mainzDom: {
      lat: 49.9989, lng: 8.2744, name: "Mainz Cathedral", role: "Sight", icon: "cathedral",
      gmaps: mapsUrl(49.9989, 8.2744, 18)
    },
    gutenberg: {
      lat: 50.00367, lng: 8.27095, name: "Gutenberg Museum", role: "Sight", icon: "museum",
      gmaps: mapsUrl(50.00367, 8.27095, 18)
    },
    captein: {
      lat: 52.3736, lng: 4.9029, name: "Café Captein & Co", role: "Cafe", icon: "lunch",
      gmaps: mapsUrl(52.3736, 4.9029, 18)
    },
    guzzo: {
      lat: 52.37089, lng: 4.91636, name: "Bar Guzzo", role: "Cafe", icon: "lunch",
      gmaps: mapsUrl(52.37089, 4.91636, 18)
    },
    riese: {
      lat: 50.93636, lng: 6.95040, name: "Café Riese", role: "Cafe", icon: "coffee",
      gmaps: mapsUrl(50.93636, 6.95040, 18)
    },
    domCafe: {
      lat: 49.99919, lng: 8.27388, name: "Dom-Café Mainz", role: "Cafe", icon: "coffee",
      gmaps: mapsUrl(49.99919, 8.27388, 18)
    },
    woods: {
      lat: 50.00010, lng: 8.27625, name: "WOODS café Mainz", role: "Cafe", icon: "coffee",
      gmaps: mapsUrl(50.00010, 8.27625, 18)
    },
    hoppenworth: {
      lat: 50.11092, lng: 8.68371, name: "Café Hoppenworth & Ploch", role: "Cafe", icon: "coffee",
      gmaps: mapsUrl(50.11092, 8.68371, 18)
    },
    isis: {
      lat: 50.00135, lng: 8.26788, name: "Sanctuary of Isis (Römerpassage)", role: "Sight", icon: "roman",
      gmaps: mapsUrl(50.00135, 8.26788, 18)
    },
    eltville: {
      lat: 50.0256, lng: 8.1192, name: "Eltville am Rhein", role: "Sight", icon: "town",
      gmaps: mapsUrl(50.0256, 8.1192, 17)
    },
    eberbach: {
      lat: 50.0425, lng: 8.0472, name: "Kloster Eberbach (abbey)", role: "Sight", icon: "abbey",
      gmaps: mapsUrl(50.0425, 8.0472, 17)
    },
    romerberg: {
      lat: 50.1106, lng: 8.6822, name: "Römerberg (Frankfurt old town square)", role: "Sight", icon: "town",
      gmaps: mapsUrl(50.1106, 8.6822, 18)
    },
    roemer: {
      lat: 50.11045, lng: 8.68155, name: "The Römer (Frankfurt city hall)", role: "Sight", icon: "house",
      gmaps: mapsUrl(50.11045, 8.68155, 18)
    },
    ostzeile: {
      lat: 50.11042, lng: 8.68278, name: "Ostzeile (half-timbered row)", role: "Sight", icon: "house",
      gmaps: mapsUrl(50.11042, 8.68278, 18)
    },
    kaiserdomFra: {
      lat: 50.11064, lng: 8.68528, name: "Kaiserdom St. Bartholomäus", role: "Sight", icon: "cathedral",
      gmaps: mapsUrl(50.11064, 8.68528, 18)
    },
    neueAltstadt: {
      lat: 50.11055, lng: 8.68355, name: "Neue Altstadt", role: "Sight", icon: "town",
      gmaps: mapsUrl(50.11055, 8.68355, 18)
    },
    justice: {
      lat: 50.11055, lng: 8.68215, name: "Fountain of Justice", role: "Sight", icon: "town",
      gmaps: mapsUrl(50.11055, 8.68215, 18)
    },
    fra: {
      lat: 50.0490, lng: 8.5718, name: "Frankfurt Airport, Terminal 1", role: "Airport", icon: "plane",
      gmaps: mapsUrl(50.0490, 8.5718, 16)
    },
    paulaner: {
      lat: 50.1100, lng: 8.6824, name: "Motel One Frankfurt-Römer", role: "Stay", icon: "bed",
      gmaps: mapsUrl(50.1100, 8.6824, 18)
    },
    kleinmarkt: {
      lat: 50.1134, lng: 8.6836, name: "Kleinmarkthalle", role: "Cafe", icon: "lunch",
      gmaps: mapsUrl(50.1134, 8.6836, 18)
    },
    mainTower: {
      lat: 50.1124, lng: 8.6722, name: "MAIN TOWER", role: "Sight", icon: "town",
      gmaps: mapsUrl(50.1124, 8.6722, 18)
    },
    wagner: {
      lat: 50.1019, lng: 8.6810, name: "Apfelwein Wagner", role: "Cafe", icon: "dinner",
      gmaps: mapsUrl(50.1019, 8.6810, 18)
    },
    waag: {
      lat: 52.372693, lng: 4.900385, name: "In de Waag", role: "Cafe", icon: "lunch",
      gmaps: mapsUrl(52.372693, 4.900385, 18)
    },
    belhamel: {
      lat: 52.379447, lng: 4.892137, name: "De Belhamel", role: "Cafe", icon: "dinner",
      gmaps: mapsUrl(52.379447, 4.892137, 18)
    },
    vaBistro: {
      lat: 52.371061, lng: 4.882436, name: "V&A Bar Bistro", role: "Cafe", icon: "dinner",
      gmaps: mapsUrl(52.371061, 4.882436, 18)
    },
    parlotte: {
      lat: 52.378256, lng: 4.881758, name: "Café Parlotte", role: "Cafe", icon: "dinner",
      gmaps: mapsUrl(52.378256, 4.881758, 18)
    },
    moeders: {
      lat: 52.371843, lng: 4.874978, name: "Moeders", role: "Cafe", icon: "dinner",
      gmaps: mapsUrl(52.371843, 4.874978, 18)
    },
    toscanini: {
      lat: 52.380166, lng: 4.885282, name: "Toscanini", role: "Cafe", icon: "dinner",
      gmaps: mapsUrl(52.380166, 4.885282, 18)
    },
    reiger: {
      lat: 52.375729, lng: 4.882526, name: "Café de Reiger", role: "Cafe", icon: "dinner",
      gmaps: mapsUrl(52.375729, 4.882526, 18)
    },
    funkhaus: {
      lat: 50.940387, lng: 6.955909, name: "Funkhaus", role: "Cafe", icon: "lunch",
      gmaps: mapsUrl(50.940387, 6.955909, 18)
    },
    malzmuehle: {
      lat: 50.934607, lng: 6.960530, name: "Brauerei zur Malzmühle", role: "Cafe", icon: "dinner",
      gmaps: mapsUrl(50.934607, 6.960530, 18)
    },
    peters: {
      lat: 50.939300, lng: 6.960402, name: "Peters Brauhaus", role: "Cafe", icon: "dinner",
      gmaps: mapsUrl(50.939300, 6.960402, 18)
    },
    heiliggeist: {
      lat: 50.000322, lng: 8.275774, name: "Heiliggeist", role: "Cafe", icon: "dinner",
      gmaps: mapsUrl(50.000322, 8.275774, 18)
    },
    eisgrub: {
      lat: 49.995226, lng: 8.273363, name: "Eisgrub-Bräu", role: "Cafe", icon: "dinner",
      gmaps: mapsUrl(49.995226, 8.273363, 18)
    },
    holztor: {
      lat: 49.997655, lng: 8.280130, name: "Am Holztor", role: "Cafe", icon: "dinner",
      gmaps: mapsUrl(49.997655, 8.280130, 18)
    },
    willems: {
      lat: 49.996482, lng: 8.273523, name: "Altstadtcafé Willems", role: "Cafe", icon: "lunch",
      gmaps: mapsUrl(49.996482, 8.273523, 18)
    },
    goldmarie: {
      lat: 50.013342, lng: 8.261655, name: "Goldmarie", role: "Cafe", icon: "dinner",
      gmaps: mapsUrl(50.013342, 8.261655, 18)
    },
    loesch: {
      lat: 49.995352, lng: 8.276397, name: "Weinhaus Lösch", role: "Cafe", icon: "dinner",
      gmaps: mapsUrl(49.995352, 8.276397, 18)
    },
    atschel: {
      lat: 50.104842, lng: 8.688934, name: "Apfelweinwirtschaft Atschel", role: "Cafe", icon: "dinner",
      gmaps: mapsUrl(50.104842, 8.688934, 18)
    },
    huehnermarkt: {
      lat: 50.110995, lng: 8.684005, name: "Wirtshaus am Hühnermarkt", role: "Cafe", icon: "dinner",
      gmaps: mapsUrl(50.110995, 8.684005, 18)
    },
    altdeutsche: {
      lat: 49.978615, lng: 7.926612, name: "Altdeutsche Weinstube", role: "Stay", icon: "bed",
      gmaps: mapsUrl(49.978615, 7.926612, 18)
    },
    ferryBingen: {
      lat: 49.970543, lng: 7.913121, name: "Bingen–Kempten car ferry", role: "Rental", icon: "car",
      gmaps: mapsUrl(49.970543, 7.913121, 17)
    },
    ferryRudesheim: {
      lat: 49.976199, lng: 7.911718, name: "Rüdesheim car ferry", role: "Rental", icon: "car",
      gmaps: mapsUrl(49.976199, 7.911718, 17)
    },
    krancher: {
      lat: 49.987660, lng: 7.931088, name: "Gasthof Krancher", role: "Cafe", icon: "dinner",
      gmaps: mapsUrl(49.987660, 7.931088, 18)
    },
    zehnthof: {
      lat: 49.987345, lng: 7.930248, name: "Eibinger Zehnthof", role: "Cafe", icon: "dinner",
      gmaps: mapsUrl(49.987345, 7.930248, 18)
    },
    magdalenenhof: {
      lat: 49.989379, lng: 7.938228, name: "Weingut Magdalenenhof", role: "Cafe", icon: "dinner",
      gmaps: mapsUrl(49.989379, 7.938228, 18)
    },
    stadtFrankfurtRh: {
      lat: 49.979733, lng: 7.922504, name: "Restaurant Stadt Frankfurt", role: "Cafe", icon: "dinner",
      gmaps: mapsUrl(49.979733, 7.922504, 18)
    },
    villaWeil: {
      lat: 49.977856, lng: 7.921606, name: "Villa Weil", role: "Cafe", icon: "dinner",
      gmaps: mapsUrl(49.977856, 7.921606, 18)
    },
    ratsstube: {
      lat: 49.979320, lng: 7.922597, name: "Ratsstube", role: "Cafe", icon: "dinner",
      gmaps: mapsUrl(49.979320, 7.922597, 18)
    }
  };

  var PLACE_QUERY = {
    "amsHotel": "Hotel Die Port van Cleve Nieuwezijds Voorburgwal 176 Amsterdam",
    "centraal": "Amsterdam Centraal station",
    "canals": "Grachtengordel Amsterdam",
    "anneFrank": "Anne Frank House Amsterdam",
    "winkel": "Café Winkel 43 Amsterdam",
    "scheepvaart": "Het Scheepvaartmuseum Amsterdam",
    "ord": "O'Hare International Airport Terminal 5",
    "schiphol": "Amsterdam Airport Schiphol",
    "salonBoat": "Flagship Amsterdam Anne Frank House Prinsengracht 267",
    "praetorium": "Praetorium Köln",
    "katz": "Burg Katz St. Goarshausen",
    "maus": "Burg Maus Wellmich",
    "schonburg": "Schönburg Oberwesel",
    "stgoar": "Sankt Goar",
    "bacharach": "Bacharach am Rhein",
    "riverwalk": "Rheinuferpromenade Mainz",
    "hiltonFra": "Hilton Frankfurt Airport",
    "cathedral": "Cologne Cathedral",
    "excelsior": "Excelsior Hotel Ernst Cologne",
    "elde": "EL-DE-Haus NS-Dokumentationszentrum Köln",
    "fruh": "Brauhaus FRÜH am Dom",
    "koelnHbf": "Köln Hauptbahnhof, Trankgasse 11",
    "avisCologne": "Avis Autovermietung Köln Poll Max-Glomsda-Straße 4",
    "bellevue": "Restaurant Le Jardin Bellevue Rheinhotel Boppard",
    "pier": "KD Anleger Boppard",
    "rheinfels": "Burg Rheinfels St. Goar",
    "loreley": "Loreley rock Sankt Goarshausen",
    "pfalz": "Burg Pfalzgrafenstein Kaub",
    "hyatt": "Hyatt Regency Mainz",
    "rudesheim": "Rüdesheim am Rhein",
    "rudesheimJetty": "KD Anleger Rüdesheim",
    "mainzDom": "Mainz Cathedral",
    "gutenberg": "Gutenberg-Museum Mainz Reichklarastraße",
    "captein": "Café Captein & Co Amsterdam",
    "guzzo": "Bar Guzzo Amsterdam",
    "riese": "Café Riese Köln Schildergasse",
    "domCafe": "Dom-Café Mainz",
    "woods": "WOODS Café Mainz",
    "hoppenworth": "Hoppenworth & Ploch Café Altstadt Frankfurt",
    "isis": "Isis- und Mater Magna-Heiligtum Mainz",
    "eltville": "Kurfürstliche Burg Eltville",
    "eberbach": "Kloster Eberbach",
    "romerberg": "Römerberg Frankfurt",
    "roemer": "Frankfurter Römer",
    "ostzeile": "Ostzeile Frankfurt am Main",
    "kaiserdomFra": "Kaiserdom St. Bartholomäus Frankfurt",
    "neueAltstadt": "Neue Altstadt Frankfurt",
    "justice": "Gerechtigkeitsbrunnen Römerberg Frankfurt",
    "fra": "Frankfurt Airport Terminal 1",
    "boppardPromenade": "Kurfürstliche Burg Boppard",
    "paulaner": "Motel One Frankfurt-Römer Berliner Straße 55",
    "kleinmarkt": "Kleinmarkthalle Frankfurt",
    "mainTower": "MAIN TOWER Frankfurt",
    "wagner": "Apfelwein Wagner Schweizer Straße Frankfurt",
    "waag": "In de Waag Nieuwmarkt 4 Amsterdam",
    "belhamel": "De Belhamel Brouwersgracht 60 Amsterdam",
    "vaBistro": "V&A Bar Bistro Prinsengracht 274 Amsterdam",
    "parlotte": "Café Parlotte Westerstraat 182 Amsterdam",
    "moeders": "Moeders Rozengracht 251 Amsterdam",
    "toscanini": "Toscanini Lindengracht 75 Amsterdam",
    "reiger": "Café de Reiger Nieuwe Leliestraat 34 Amsterdam",
    "funkhaus": "Funkhaus Wallrafplatz 5 Köln",
    "malzmuehle": "Brauerei zur Malzmühle Heumarkt 6 Köln",
    "peters": "Peters Brauhaus Mühlengasse 1 Köln",
    "heiliggeist": "Heiliggeist Rentengasse 2 Mainz",
    "eisgrub": "Eisgrub-Bräu Weißliliengasse 1a Mainz",
    "holztor": "Am Holztor Holzstraße 40 Mainz",
    "willems": "Altstadtcafé Willems Schönbornstraße 9a Mainz",
    "goldmarie": "Goldmarie Clarissa-Kupferberg-Platz 9 Mainz Zollhafen",
    "loesch": "Weinhaus Lösch Jakobsbergstraße 9 Mainz",
    "atschel": "Apfelweinwirtschaft Atschel Wallstraße 7 Frankfurt",
    "huehnermarkt": "Wirtshaus am Hühnermarkt Markt 18 Frankfurt",
    "altdeutsche": "Altdeutsche Weinstube Grabenstraße 4 Rüdesheim am Rhein",
    "ferryBingen": "Autofähre Bingen-Kempten Hafenstraße Bingen",
    "ferryRudesheim": "Autofähre Rüdesheim B 42",
    "krancher": "Gasthof Krancher Eibinger Oberstraße 4 Rüdesheim",
    "zehnthof": "Eibinger Zehnthof Eibinger Oberstraße 15 Rüdesheim",
    "magdalenenhof": "Weingut Magdalenenhof Marienthaler Straße 90 Rüdesheim",
    "stadtFrankfurtRh": "Restaurant Stadt Frankfurt Marktstraße 30 Rüdesheim",
    "villaWeil": "Villa Weil Rheinstraße 15 Rüdesheim",
    "ratsstube": "Ratsstube Marktstraße 26 Rüdesheim"
};
  Object.keys(PLACES).forEach(function (key) {
    var place = PLACES[key];
    var q = PLACE_QUERY[key] || place.name;
    place.query = q;
    place.gmaps = placeMaps(q, place.lat, place.lng);
  });

  var OVERNIGHT_KEYS = ["ord", "schiphol", "amsHotel", "excelsior", "altdeutsche", "paulaner", "fra"];

  var STOPS = {
    route: {
      label: "Full route",
      places: ["ord", "schiphol", "amsHotel", "excelsior", "altdeutsche", "romerberg", "fra"],
      paths: "route",
      maxZoom: 6,
      query: "Rhine Valley Germany",
      zoom: 6,
      gmaps: mapsUrl(48.5, -40, 3)
    },
    amsterdamFri: {
      label: "Amsterdam 9 Oct",
      places: ["schiphol", "amsHotel", "waag", "salonBoat", "vaBistro", "belhamel", "parlotte"],
      paths: "amsterdamFri",
      maxZoom: 13,
      query: "Grachtengordel Amsterdam",
      zoom: 13,
      gmaps: mapsUrl(52.35, 4.85, 13)
    },
    amsterdamSat: {
      label: "Amsterdam 10 Oct",
      places: ["amsHotel", "scheepvaart", "guzzo", "anneFrank", "reiger", "moeders", "toscanini", "winkel"],
      paths: "amsterdamSat",
      maxZoom: 14,
      query: "Grachtengordel Amsterdam",
      zoom: 14,
      gmaps: mapsUrl(52.37, 4.89, 14)
    },
    cologne: {
      label: "Cologne 11 Oct",
      places: ["centraal", "koelnHbf", "excelsior", "funkhaus", "cathedral", "praetorium", "fruh", "peters", "malzmuehle"],
      paths: "cologne",
      maxZoom: 17,
      query: "Cologne Cathedral",
      zoom: 16,
      gmaps: mapsUrl(50.9418, 6.9600, 17)
    },
    boppard: {
      label: "Drive 12 Oct",
      places: ["riese", "avisCologne", "boppardPromenade", "rheinfels", "pfalz", "ferryBingen", "ferryRudesheim", "altdeutsche", "bellevue", "krancher", "stadtFrankfurtRh", "villaWeil"],
      paths: "boppard",
      maxZoom: 9,
      query: "Rhine Gorge Germany",
      zoom: 9,
      gmaps: mapsUrl(50.47, 7.62, 8)
    },
    gorge: {
      label: "Boat 13 Oct",
      places: ["altdeutsche", "rudesheim", "rudesheimJetty", "loreley", "katz", "maus", "stgoar", "rheinfels", "ratsstube", "krancher", "stadtFrankfurtRh"],
      paths: "gorge",
      maxZoom: 12,
      query: "Loreley Sankt Goarshausen",
      zoom: 12,
      gmaps: mapsUrl(50.07, 7.85, 11)
    },
    mainz: {
      label: "Mainz 14 Oct",
      places: ["altdeutsche", "gutenberg", "domCafe", "mainzDom", "isis", "willems", "zehnthof", "magdalenenhof", "stadtFrankfurtRh"],
      paths: "mainz",
      maxZoom: 16,
      query: "Mainz Cathedral",
      zoom: 16,
      gmaps: mapsUrl(50.001, 8.273, 15)
    },
    eberbach: {
      label: "Abbey 15 Oct",
      places: ["altdeutsche", "eltville", "eberbach", "magdalenenhof", "zehnthof", "krancher"],
      paths: "eberbach",
      query: "Kloster Eberbach",
      zoom: 14,
      maxZoom: 14,
      gmaps: mapsUrl(50.0425, 8.0472, 16)
    },
    fra: {
      label: "Frankfurt 16 Oct",
      places: ["altdeutsche", "paulaner", "roemer", "ostzeile", "kaiserdomFra", "neueAltstadt", "justice", "kleinmarkt", "hoppenworth", "mainTower", "huehnermarkt", "atschel", "wagner"],
      paths: "fra",
      maxZoom: 16,
      query: "Römerberg Frankfurt",
      zoom: 16,
      gmaps: mapsUrl(50.1106, 8.6822, 16)
    },
    depart: {
      label: "Home 17 Oct",
      places: ["paulaner", "fra"],
      paths: "depart",
      maxZoom: 12,
      query: "Frankfurt Airport Terminal 1",
      zoom: 12,
      gmaps: mapsUrl(50.08, 8.63, 11)
    }
  };

  function latlngs(keys) {
    return keys.map(function (key) {
      var p = PLACES[key];
      return [p.lat, p.lng];
    });
  }

  function roleLabel(role) {
    if (role === "Stay") return "Hotel";
    if (role === "Sight") return "Sight";
    if (role === "Airport") return "Airport";
    if (role === "Station") return "Train station";
    if (role === "Cruise") return "Boat";
    if (role === "Rental") return "Rental";
    if (role === "Cafe") return "Café";
    return role;
  }

  function popupHtml(place) {
    return (
      '<div class="map-popup">' +
        "<strong>" + place.name + "</strong>" +
        '<span class="map-popup-role">' + roleLabel(place.role) + "</span>" +
        '<a href="' + place.gmaps + '" target="_blank" rel="noopener">Open in Google Maps</a>' +
      "</div>"
    );
  }

  var ICONS = {
    bed: '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path fill="currentColor" d="M7 13c1.66 0 3-1.34 3-3S8.66 7 7 7s-3 1.34-3 3 1.34 3 3 3zm12-6h-8v7H3V5H1v15h2v-3h18v3h2v-9c0-2.21-1.79-4-4-4z"/></svg>',
    train: '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path fill="currentColor" d="M12 2c-4 0-8 .5-8 4v9.5C4 17.43 5.57 19 7.5 19L6 20.5v.5h2l1.5-1.5h5L16 21h2v-.5L16.5 19c1.93 0 3.5-1.57 3.5-3.5V6c0-3.5-3.58-4-8-4zM7.5 17c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm3.5-7H6V6h5v4zm5.5 7c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-7h-5V6h5v4z"/></svg>',
    plane: '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path fill="currentColor" d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/></svg>',
    boat: '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path fill="currentColor" d="M20 21c-1.39 0-2.78-.47-4-1.32-2.44 1.71-5.56 1.71-8 0C6.78 20.53 5.39 21 4 21H2v2h2c1.38 0 2.74-.35 4-.99 2.52 1.29 5.48 1.29 8 0 1.26.65 2.62.99 4 .99h2v-2h-2zM3.95 19H4c1.6 0 3.02-.88 4-2 .98 1.12 2.4 2 4 2s3.02-.88 4-2c.98 1.12 2.4 2 4 2h.05l1.89-6.68c.08-.26.11-.52.11-.78 0-1.06-.42-2.08-1.17-2.83l-1.89-5.54C19.41 3.5 18.48 3 17.43 3H6.57C5.52 3 4.59 3.5 4.06 4.17L2.17 9.71c-.75.75-1.17 1.77-1.17 2.83 0 .26.03.52.11.78L3.95 19zM6 6h12l1.4 4H4.6L6 6z"/></svg>',
    car: '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path fill="currentColor" d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/></svg>',
    museum: '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path fill="currentColor" d="M22 11V9L12 2 2 9v2h2v9H2v2h20v-2h-2v-9h2zm-6 9h-3v-6h-2v6H8V10.47l4-2.82 4 2.82V20z"/></svg>',
    castle: '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path fill="currentColor" d="M21 9v2h-2V3h-2v2h-2V3h-2v2h-2V3H9v2H7V3H5v8H3V9H1v12h9v-3c0-1.1.9-2 2-2s2 .9 2 2v3h9V9h-2zm-10 3H9V9h2v3zm4 0h-2V9h2v3z"/></svg>',
    cathedral: '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path fill="currentColor" d="M18 12.22V9l-5-2.5V5h-2v1.5L6 9v3.22L2 14v8h8v-4c0-1.1.9-2 2-2s2 .9 2 2v4h8v-8l-4-1.78zM20 20h-4v-2.89c0-1.73-1.4-3.11-3.14-3.11h-1.72C9.4 14 8 15.38 8 17.11V20H4v-5.11l4-1.78V10.5l4-2 4 2v2.61l4 1.78V20z"/></svg>',
    abbey: '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path fill="currentColor" d="M18 12.22V9l-5-2.5V5h-2v1.5L6 9v3.22L2 14v8h8v-4c0-1.1.9-2 2-2s2 .9 2 2v4h8v-8l-4-1.78zM20 20h-4v-2.89c0-1.73-1.4-3.11-3.14-3.11h-1.72C9.4 14 8 15.38 8 17.11V20H4v-5.11l4-1.78V10.5l4-2 4 2v2.61l4 1.78V20z"/></svg>',
    coffee: '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path fill="currentColor" d="M20 3H4v10c0 2.21 1.79 4 4 4h6c2.21 0 4-1.79 4-4v-3h2c1.11 0 2-.89 2-2V5c0-1.11-.89-2-2-2zm0 5h-2V5h2v3zM4 19h16v2H4z"/></svg>',
    lunch: '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path fill="currentColor" d="M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm5-3v8h2.5v8H21V2c-2.76 0-5 2.24-5 4z"/></svg>',
    dinner: '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path fill="currentColor" d="M6 3v6c0 2.97 2.16 5.43 5 5.91V19H8v2h8v-2h-3v-4.09c2.84-.48 5-2.94 5-5.91V3H6zm10 5H8V5h8v3z"/></svg>',
    brewery: '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path fill="currentColor" d="M21 5V3H3v2l8 9v5H6v2h12v-2h-5v-5l8-9zM7.43 7L5.66 5h12.69l-1.78 2H7.43z"/></svg>',
    roman: '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path fill="currentColor" d="M4 10v7h3v-7H4zm6 0v7h3v-7h-3zM2 22h19v-3H2v3zm14-12v7h3v-7h-3zm-4.5-9L2 6v2h19V6l-9.5-5z"/></svg>',
    rock: '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path fill="currentColor" d="M14 6l-3.75 5 2.85 3.8-1.6 1.2C9.81 13.75 7 10 7 10l-6 8h22L14 6z"/></svg>',
    house: '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path fill="currentColor" d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>',
    town: '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path fill="currentColor" d="M15 11V5l-3-3-3 3v2H3v14h18V11h-6zm-8 8H5v-2h2v2zm0-4H5v-2h2v2zm0-4H5V9h2v2zm6 8h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V9h2v2zm0-4h-2V5h2v2zm6 12h-2v-2h2v2zm0-4h-2v-2h2v2z"/></svg>',
    riverwalk: '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path fill="currentColor" d="M17 16.99c-1.35 0-2.2.42-2.95.8-.65.33-1.22.6-2.05.6-.83 0-1.4-.27-2.05-.6-.75-.38-1.6-.8-2.95-.8s-2.2.42-2.95.8c-.65.33-1.18.6-2.05.6v1.99c1.35 0 2.2-.42 2.95-.8.65-.33 1.22-.6 2.05-.6s1.4.27 2.05.6c.75.38 1.6.8 2.95.8s2.2-.42 2.95-.8c.65-.33 1.22-.6 2.05-.6s1.4.27 2.05.6c.75.38 1.61.8 2.95.8v-1.99c-.87 0-1.4-.27-2.05-.6-.75-.38-1.6-.8-2.95-.8zM17 12.52c-1.35 0-2.2.43-2.95.8-.65.32-1.22.6-2.05.6-.83 0-1.4-.28-2.05-.6-.75-.38-1.6-.8-2.95-.8s-2.2.43-2.95.8c-.65.32-1.18.6-2.05.6v2c1.35 0 2.2-.43 2.95-.8.65-.32 1.22-.6 2.05-.6s1.4.28 2.05.6c.75.38 1.6.8 2.95.8s2.2-.43 2.95-.8c.65-.32 1.22-.6 2.05-.6s1.4.28 2.05.6c.75.38 1.61.8 2.95.8v-2c-.87 0-1.4-.28-2.05-.6-.75-.37-1.6-.8-2.95-.8zM19 6.82c-.87 0-1.4.28-2.05.6-.75.38-1.6.8-2.95.8s-2.2-.43-2.95-.8c-.65-.33-1.22-.6-2.05-.6s-1.4.27-2.05.6c-.75.38-1.6.8-2.95.8s-2.2-.43-2.95-.8C2.4 7.1 1.87 6.82 1 6.82v2c1.35 0 2.2-.43 2.95-.8.65-.33 1.22-.6 2.05-.6s1.4.27 2.05.6c.75.38 1.6.8 2.95.8s2.2-.43 2.95-.8c.65-.33 1.22-.6 2.05-.6s1.4.27 2.05.6c.75.38 1.6.8 2.95.8s2.2-.43 2.95-.8c.65-.32 1.18-.6 2.05-.6v-2z"/></svg>',
    ship: '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path fill="currentColor" d="M20 21c-1.39 0-2.78-.47-4-1.32-2.44 1.71-5.56 1.71-8 0C6.78 20.53 5.39 21 4 21H2v2h2c1.38 0 2.74-.35 4-.99 2.52 1.29 5.48 1.29 8 0 1.26.65 2.62.99 4 .99h2v-2h-2zM3.95 19H4c1.6 0 3.02-.88 4-2 .98 1.12 2.4 2 4 2s3.02-.88 4-2c.98 1.12 2.4 2 4 2h.05l1.89-6.68c.08-.26.11-.52.11-.78 0-1.06-.42-2.08-1.17-2.83l-1.89-5.54C19.41 3.5 18.48 3 17.43 3H6.57C5.52 3 4.59 3.5 4.06 4.17L2.17 9.71c-.75.75-1.17 1.77-1.17 2.83 0 .26.03.52.11.78L3.95 19zM6 6h12l1.4 4H4.6L6 6z"/></svg>'
  };

  ICONS.walk = '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path fill="currentColor" d="M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM9.8 8.9L7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3c1.3 1.5 3.3 2.5 5.5 2.5v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8-.7"/></svg>';
  ICONS.Stay = ICONS.bed;
  ICONS.Sight = ICONS.museum;
  ICONS.Station = ICONS.train;
  ICONS.Airport = ICONS.plane;
  ICONS.Cruise = ICONS.boat;
  ICONS.Rental = ICONS.car;
  ICONS.Cafe = ICONS.coffee;
  ICONS.Lunch = ICONS.lunch;
  ICONS.Dinner = ICONS.dinner;

  function pinKind(place) {
    var role = place && place.role;
    if (role === "Stay") return "hotel";
    if (role === "Sight") return "sight";
    if (role === "Airport") return "airport";
    if (role === "Station") return "station";
    if (role === "Cruise") return "cruise";
    if (role === "Rental") return "rental";
    if (role === "Cafe") return "cafe";
    if (role === "Lunch") return "lunch";
    if (role === "Dinner") return "dinner";
    return "station";
  }

  function pinIcon(place, active, color) {
    var kind = pinKind(place);
    var svg = ICONS[place.icon] || ICONS[place.role] || ICONS.Sight;
    var size = active ? 36 : 30;
    var faceStyle = color
      ? ' style="background:' + color + ';color:#f4eee4"'
      : "";
    return L.divIcon({
      className: "aurelia-pin is-" + kind + (active ? " is-active" : ""),
      html: '<span class="aurelia-pin-face"' + faceStyle + ">" + svg + "</span>",
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      popupAnchor: [0, -size / 2]
    });
  }

  function mapOptions() {
    var coarse = isCoarsePointer();
    return {
      scrollWheelZoom: false,
      dragging: !coarse,
      tap: true,
      touchZoom: true,
      bounceAtZoomLimits: true,
      attributionControl: true
    };
  }

  var PATH_STYLE = {
    train: { color: "#6e1d2a", dash: "9 8", weight: 3.2 },
    car: { color: "#6e1d2a", dash: null, weight: 3.2 },
    taxi: { color: "#6e1d2a", dash: null, weight: 3.2 },
    foot: { color: "#5c534c", dash: "1 8", weight: 2.6 },
    boat: { color: "#b0894f", dash: "9 7", weight: 3.2 },
    plane: { color: "#6e1d2a", dash: "14 10", weight: 2.8 }
  };

  var SEGMENT_COLORS = ["#6e1d2a", "#1e5f8a", "#2f6b4f", "#b0894f", "#8b3d1f", "#4a3d7a", "#3d6e73", "#6b4e31"];

  function colorForIndex(i) {
    return SEGMENT_COLORS[i % SEGMENT_COLORS.length];
  }

  function destColorsFor(ids) {
    var destColor = {};
    var destFoot = {};
    var paths = window.TRIP_PATHS || {};
    (ids || []).forEach(function (id, i) {
      var path = paths[id];
      if (!path || !path.to) return;
      var color = colorForIndex(i);
      if (path.mode === "foot") {
        destColor[path.to] = color;
        destFoot[path.to] = true;
      } else if (!destFoot[path.to]) {
        destColor[path.to] = color;
      }
    });
    return destColor;
  }

  function addPathLine(map, pts, mode, weight, color) {
    var st = PATH_STYLE[mode] || PATH_STYLE.car;
    var w = weight || st.weight;
    var c = color || st.color;
    var halo = L.polyline(pts, {
      color: c,
      weight: w + 3,
      opacity: 0.28,
      lineJoin: "round",
      lineCap: "round",
      dashArray: st.dash || null,
      interactive: false
    }).addTo(map);
    var line = L.polyline(pts, {
      color: c,
      weight: w,
      opacity: 0.95,
      lineJoin: "round",
      lineCap: "round",
      dashArray: st.dash || null,
      interactive: false
    }).addTo(map);
    return [halo, line];
  }

  function pathIdsFor(groupName) {
    var groups = window.TRIP_PATH_GROUPS || {};
    return groups[groupName] || [];
  }

  function approxMeters(a, b) {
    var dLat = (a[0] - b[0]) * 111320;
    var dLng = (a[1] - b[1]) * 111320 * Math.cos((a[0] + b[0]) * Math.PI / 360);
    return Math.sqrt(dLat * dLat + dLng * dLng);
  }

  function snapIfClose(pt, place) {
    if (!place) return pt;
    var dest = [place.lat, place.lng];
    return approxMeters(pt, dest) < 250 ? dest : pt;
  }

  function snappedPts(path) {
    var pts = path.pts.slice();
    if (!pts.length) return pts;
    if (path.from && PLACES[path.from]) {
      pts[0] = snapIfClose(pts[0], PLACES[path.from]);
    }
    if (path.to && PLACES[path.to]) {
      pts[pts.length - 1] = snapIfClose(pts[pts.length - 1], PLACES[path.to]);
    }
    return pts;
  }

  function pathIdsOnMap(ids, placeKeys) {
    var set = {};
    (placeKeys || []).forEach(function (k) { set[k] = true; });
    var paths = window.TRIP_PATHS || {};
    return ids.filter(function (id) {
      var p = paths[id];
      if (!p) return false;
      if (!p.from || !p.to) return true;
      if (p.from === p.to) return !!set[p.from];
      return set[p.from] || set[p.to];
    });
  }

  function flattenPathLayers(byId) {
    var layers = [];
    Object.keys(byId || {}).forEach(function (id) {
      layers = layers.concat(byId[id]);
    });
    return layers;
  }

  function drawPathIds(map, ids, weight) {
    var byId = {};
    var paths = window.TRIP_PATHS || {};
    ids.forEach(function (id, i) {
      var path = paths[id];
      if (!path || !path.pts || path.pts.length < 2) return;
      byId[id] = addPathLine(map, snappedPts(path), path.mode, weight, colorForIndex(i));
    });
    return byId;
  }

  function modeWord(mode) {
    return ({ foot: "Walk", taxi: "Taxi", car: "Car", train: "Train", boat: "Boat", plane: "Flight" })[mode] || mode;
  }

  function modeIconSvg(mode) {
    var aliases = {
      Walk: "walk", Taxi: "car", Car: "car", Train: "train", Boat: "boat",
      Flight: "plane", Coffee: "coffee", Lunch: "lunch", Dinner: "dinner",
      At: "museum", Rest: "bed", Stay: "bed",
      foot: "walk", taxi: "car", plane: "plane",
      Sight: "museum", Cafe: "coffee", Station: "train", Airport: "plane",
      Cruise: "boat", Rental: "car"
    };
    var iconKey = aliases[mode] || mode;
    if (ICONS[iconKey]) return ICONS[iconKey];
    return ICONS.museum;
  }

  function durationOnly(item, path) {
    var raw = "";
    if (item && item.kind === "travel") {
      raw = item.detail || (path && path.time) || "";
    } else if (item) {
      raw = item.stay || "";
    } else if (path) {
      raw = path.time || "";
    }
    raw = String(raw);
    var cut = raw.indexOf(" · ");
    return cut >= 0 ? raw.slice(0, cut) : raw;
  }

  function routeText(path) {
    var label = path.label || "";
    var cut = label.indexOf(" · ");
    return cut >= 0 ? label.slice(cut + 3) : label;
  }

  function maxZoomForPath(path) {
    if (path.mode === "foot") return 18;
    if (path.mode === "boat") return 16;
    if (path.mode === "train") return 9;
    if (path.mode === "plane") return 3;
    if (path.mode === "taxi") return 14;
    return 14;
  }

  function pathBounds(path) {
    var pts = path.pts && path.pts.length ? snappedPts(path) : [];
    var bounds = pts.length ? L.latLngBounds(pts) : null;
    ["from", "to"].forEach(function (end) {
      var place = path[end] && PLACES[path[end]];
      if (!place) return;
      var ll = L.latLng(place.lat, place.lng);
      bounds = bounds ? bounds.extend(ll) : L.latLngBounds(ll, ll);
    });
    return bounds;
  }

  function focusPath(map, path) {
    if (!map || !path) return;
    var bounds = pathBounds(path);
    if (!bounds || !bounds.isValid()) return;
    var pad = path.mode === "plane" ? 18 : 36;
    var fit = {
      padding: [pad, pad],
      maxZoom: maxZoomForPath(path),
      animate: !reduceMotion,
      duration: 0.7
    };
    if (reduceMotion) map.fitBounds(bounds, fit);
    else map.flyToBounds(bounds, fit);
  }

  function eachMarker(markers, fn) {
    if (!markers) return;
    if (Array.isArray(markers)) {
      markers.forEach(function (marker) {
        if (marker) fn(marker, marker._placeKey);
      });
      return;
    }
    Object.keys(markers).forEach(function (key) {
      fn(markers[key], key);
    });
  }

  function ensurePlaceMarker(map, ctx, key) {
    var place = PLACES[key];
    if (!map || !place || !ctx) return;
    var found = false;
    eachMarker(ctx.markers, function (marker, k) {
      if (k === key) found = true;
    });
    if (found) return;
    var marker = L.marker([place.lat, place.lng], {
      icon: pinIcon(place, true),
      title: place.name + " · " + roleLabel(place.role),
      riseOnHover: true
    });
    marker._placeKey = key;
    marker.bindPopup(popupHtml(place));
    marker.addTo(map);
    if (Array.isArray(ctx.markers)) {
      ctx.markers.push(marker);
    } else if (ctx.markers) {
      ctx.markers[key] = marker;
    } else {
      ctx.markers = {};
      ctx.markers[key] = marker;
    }
    if (ctx.placeKeys && ctx.placeKeys.indexOf(key) < 0) ctx.placeKeys.push(key);
  }

  function resetFocusOpacities(ctx) {
    var layersById = (ctx && ctx.pathLayersById) || {};
    Object.keys(layersById).forEach(function (id) {
      var pair = layersById[id];
      if (pair && pair[0]) pair[0].setStyle({ opacity: 0.28 });
      if (pair && pair[1]) pair[1].setStyle({ opacity: 0.95 });
    });
    var placeKeys = ctx && ctx.placeKeys;
    eachMarker(ctx && ctx.markers, function (marker, key) {
      var on = !placeKeys || placeKeys.indexOf(key) >= 0;
      marker.setOpacity(on ? 1 : 0.55);
      marker.setZIndexOffset(on ? 400 : 0);
    });
  }

  function styleFocusedPair(pair, selected, mode) {
    if (!pair) return;
    var st = PATH_STYLE[mode] || PATH_STYLE.car;
    var halo = pair[0];
    var line = pair[1];
    if (halo) {
      halo.setStyle({
        opacity: selected ? 0.4 : 0.03,
        weight: selected ? st.weight + 6 : st.weight + 2
      });
      if (selected && halo.bringToFront) halo.bringToFront();
    }
    if (line) {
      line.setStyle({
        opacity: selected ? 1 : 0.07,
        weight: selected ? st.weight + 1.8 : st.weight
      });
      if (selected && line.bringToFront) line.bringToFront();
    }
  }

  function applyFocusOpacities(ctx, selectedId) {
    var layersById = (ctx && ctx.pathLayersById) || {};
    var paths = window.TRIP_PATHS || {};
    var path = paths[selectedId];
    var ends = {};
    if (path) {
      if (path.from) ends[path.from] = true;
      if (path.to) ends[path.to] = true;
    }
    Object.keys(layersById).forEach(function (id) {
      var selected = id === selectedId;
      var mode = paths[id] && paths[id].mode;
      styleFocusedPair(layersById[id], selected, mode);
    });
    eachMarker(ctx && ctx.markers, function (marker, key) {
      var full = !!ends[key];
      marker.setOpacity(full ? 1 : 0.18);
      marker.setZIndexOffset(full ? 1200 : 0);
    });
  }

  function focusPlace(map, placeKey) {
    var p = PLACES[placeKey];
    if (!map || !p) return;
    var opts = { animate: !reduceMotion, duration: 0.7 };
    if (reduceMotion) map.setView([p.lat, p.lng], 17);
    else map.flyTo([p.lat, p.lng], 17, opts);
  }

  function applyPlaceFocus(ctx, placeKey) {
    var layersById = (ctx && ctx.pathLayersById) || {};
    var paths = window.TRIP_PATHS || {};
    Object.keys(layersById).forEach(function (id) {
      var mode = paths[id] && paths[id].mode;
      styleFocusedPair(layersById[id], false, mode);
    });
    eachMarker(ctx && ctx.markers, function (marker, key) {
      var full = key === placeKey;
      marker.setOpacity(full ? 1 : 0.18);
      marker.setZIndexOffset(full ? 1200 : 0);
    });
  }

  function itemMode(item, path) {
    if (item.kind === "travel") return item.mode || modeWord(path && path.mode);
    if (item.kind === "rest") return "Rest";
    if (item.mode) return item.mode;
    var place = item.place && PLACES[item.place];
    if (place && place.icon) return place.icon;
    var l = (item.label || "").toLowerCase();
    if (l.indexOf("coffee") >= 0) return "Coffee";
    if (l.indexOf("lunch") >= 0) return "Lunch";
    if (l.indexOf("dinner") >= 0) return "Dinner";
    if (place && place.role === "Stay") return "Rest";
    return "At";
  }


  function galleryForTimes(el) {
    if (!el) return null;
    var mini = el.closest(".mini-map");
    var day = (mini && mini.closest(".day")) || (el.closest && el.closest(".day"));
    return day ? day.querySelector(".day-gallery") : null;
  }

  function galleryPlaceOfItem(item, path) {
    if (item && item.place) return item.place;
    if (path && path.to) return path.to;
    return "";
  }

  function roleMode(place) {
    if (place && place.icon) return place.icon;
    var r = (place && place.role) || "";
    if (r === "Stay") return "Rest";
    if (r === "Cafe") return "Coffee";
    if (r === "Airport") return "Flight";
    if (r === "Station") return "Train";
    if (r === "Cruise") return "Boat";
    if (r === "Rental") return "Car";
    return "At";
  }

  function collectScheduleKeys(schedule) {
    var paths = window.TRIP_PATHS || {};
    var keys = [];
    var seen = {};
    function add(k) {
      if (!k || seen[k] || !PLACES[k]) return;
      seen[k] = true;
      keys.push(k);
    }
    (schedule || []).forEach(function (item) {
      var path = item.pathId ? paths[item.pathId] : null;
      add(item.place);
      if (path) {
        add(path.to);
        add(path.from);
      }
    });
    return keys;
  }

  var GALLERY_ALIAS = {
    salonBoat: "canals",
    rudesheimJetty: "loreley",
    woods: "riverwalk"
  };

  function libraryTile(key) {
    return document.querySelector('.day-gallery li[data-place="' + key + '"]');
  }

  function ensureGalleryTiles(gallery, schedule) {
    if (!gallery || !schedule) return;
    collectScheduleKeys(schedule).forEach(function (key) {
      if (gallery.querySelector('li[data-place="' + key + '"]')) return;
      var src = libraryTile(key) || libraryTile(GALLERY_ALIAS[key]);
      if (!src) return;
      var clone = src.cloneNode(true);
      clone.classList.remove("is-gallery-focus", "is-gallery-dim");
      clone.setAttribute("data-place", key);
      var place = PLACES[key] || {};
      var q = (place.query || place.name || key);
      clone.setAttribute("data-maps-query", q);
      var cap = clone.querySelector("figcaption");
      if (cap && place.name) cap.textContent = place.name;
      var a = clone.querySelector("a.gallery-maps");
      if (a && place.gmaps) a.setAttribute("href", place.gmaps);
      gallery.appendChild(clone);
    });
  }


  function pinCopyHeights() {
    var wide = window.matchMedia("(min-width: 1100px)").matches;
    document.querySelectorAll(".day-grid").forEach(function (grid) {
      var copy = grid.querySelector(".day-copy");
      var map = grid.querySelector(".mini-map");
      if (!copy) return;
      copy.style.maxHeight = "";
      copy.classList.remove("is-capped");
      if (!wide || !map) return;
      var mapH = map.offsetHeight;
      if (mapH < 80) return;
      if (copy.scrollHeight > mapH + 12) {
        copy.style.maxHeight = mapH + "px";
        copy.classList.add("is-capped");
      }
    });
  }

  function decorateGallery(gallery, schedule) {
    if (!gallery || !schedule) return;
    ensureGalleryTiles(gallery, schedule);
    var paths = window.TRIP_PATHS || {};
    var byPlace = {};
    schedule.forEach(function (item, i) {
      var path = item.pathId ? paths[item.pathId] : null;
      var keys = [];
      if (item.place) keys.push(item.place);
      if (path && path.to) keys.push(path.to);
      if (item.kind === "travel" && path && path.from) keys.push(path.from);
      var isStop = item.kind !== "travel";
      keys.forEach(function (key) {
        var prev = byPlace[key];
        if (!prev || (isStop && prev.kind === "travel")) {
          byPlace[key] = {
            i: i,
            color: colorForIndex(i),
            mode: itemMode(item, path),
            styleMode: (path && path.mode) || (isStop ? "foot" : "car"),
            kind: item.kind || "stay"
          };
        }
      });
    });
    gallery.querySelectorAll("li[data-place]").forEach(function (li, idx) {
      var key = li.getAttribute("data-place");
      var meta = byPlace[key];
      if (!meta) {
        var place = PLACES[key] || {};
        meta = {
          color: colorForIndex(idx + 3),
          mode: roleMode(place),
          styleMode: "foot",
          kind: "stay"
        };
      }
      var fig = li.querySelector("figure");
      if (!fig) return;
      var chip = fig.querySelector(".gallery-chip");
      if (chip) chip.remove();
      chip = document.createElement("span");
      chip.className = "gallery-chip";
      chip.setAttribute("aria-hidden", "true");
      chip.style.color = meta.color;
      var bar = document.createElement("span");
      bar.className = "chip-bar";
      var st = PATH_STYLE[meta.styleMode] || PATH_STYLE.car;
      bar.style.borderTopStyle = st.dash ? "dashed" : "solid";
      bar.style.background = meta.color;
      var icon = document.createElement("span");
      icon.className = "chip-icon";
      icon.innerHTML = modeIconSvg(meta.mode);
      chip.appendChild(bar);
      chip.appendChild(icon);
      fig.insertBefore(chip, fig.firstChild);
      li.classList.add("is-row-linked");
      li.style.setProperty("--row-color", meta.color);
    });
  }

  function focusGallery(gallery, keys) {
    if (!gallery) return;
    var want = {};
    (keys || []).forEach(function (k) { if (k) want[k] = true; });
    var has = false;
    var first = null;
    gallery.querySelectorAll("li[data-place]").forEach(function (li) {
      var on = !!want[li.getAttribute("data-place")];
      li.classList.toggle("is-gallery-focus", on);
      li.classList.toggle("is-gallery-dim", !on);
      if (on) {
        has = true;
        if (!first) first = li;
      }
    });
    gallery.classList.toggle("is-focused", has);
    if (first && first.scrollIntoView) {
      first.scrollIntoView({
        behavior: reduceMotion ? "auto" : "smooth",
        inline: "center",
        block: "nearest"
      });
    }
  }

  function fillLegList(el, ids, map, ctx) {
    if (!el) return;
    ctx = ctx || {};
    var paths = window.TRIP_PATHS || {};
    var schedule = ctx.group && window.TRIP_SCHEDULE && window.TRIP_SCHEDULE[ctx.group];
    el.innerHTML = "";
    el.removeAttribute("role");
    resetFocusOpacities(ctx);
    var dayBody = null;

    function rowHost() {
      return dayBody || el;
    }

    var stepStatus = null;

    function markActive(row) {
      var rows = el.querySelectorAll(".leg-row");
      var idx = -1;
      rows.forEach(function (r, i) {
        r.classList.toggle("is-active", r === row);
        if (r === row) idx = i;
      });
      el.classList.toggle("is-focused", idx >= 0);
      var beats = ctx.day ? ctx.day.querySelectorAll(".day-beats > li") : [];
      beats.forEach(function (b, i) {
        b.classList.toggle("is-active", i === idx);
      });
      if (stepStatus) {
        stepStatus.textContent = idx < 0 ? "Next step" : (idx + 1) + " / " + rows.length;
      }
    }

    function addStepper() {
      var rows = el.querySelectorAll(".leg-row");
      if (!rows.length) return;
      var bar = document.createElement("div");
      bar.className = "leg-step";
      bar.innerHTML =
        '<button type="button" class="leg-step-back">Back</button>' +
        '<span class="leg-step-status">Next step</span>' +
        '<button type="button" class="leg-step-next">Next</button>';
      var back = bar.querySelector(".leg-step-back");
      var next = bar.querySelector(".leg-step-next");
      stepStatus = bar.querySelector(".leg-step-status");
      function currentIndex() {
        var i = -1;
        rows.forEach(function (r, n) {
          if (r.classList.contains("is-active")) i = n;
        });
        return i;
      }
      function go(delta) {
        var i = currentIndex();
        if (i < 0) i = delta > 0 ? 0 : rows.length - 1;
        else i += delta;
        if (i < 0) i = rows.length - 1;
        if (i >= rows.length) i = 0;
        rows[i].click();
        if (rows[i].scrollIntoView) {
          rows[i].scrollIntoView({ block: "nearest", behavior: reduceMotion ? "auto" : "smooth" });
        }
      }
      back.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        go(-1);
      });
      next.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        go(1);
      });
      el.insertBefore(bar, el.firstChild);
    }

    var gallery = ctx.gallery || galleryForTimes(el);

    function bindRow(row, fn) {
      row.addEventListener("click", fn);
      row.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          fn();
        }
      });
    }

    function addDayRow(label) {
      var block = document.createElement("div");
      block.className = "leg-day-block";
      var head = document.createElement("div");
      head.className = "leg-day-head";
      head.textContent = label;
      var body = document.createElement("div");
      body.className = "leg-times-body";
      body.setAttribute("role", "table");
      block.appendChild(head);
      block.appendChild(body);
      el.appendChild(block);
      dayBody = body;
    }

    function addRow(i, clock, mode, route, dist, styleMode, activate, aria) {
      var color = colorForIndex(i);
      var st = PATH_STYLE[styleMode] || PATH_STYLE.car;
      var row = document.createElement("div");
      row.className = "leg-row";
      row.style.setProperty("--row-color", color);
      row.setAttribute("role", "button");
      row.setAttribute("tabindex", "0");
      row.setAttribute("aria-label", aria);
      row.innerHTML =
        '<span class="leg-key" aria-hidden="true"></span>' +
        '<span class="leg-time"></span>' +
        '<span class="leg-mode"></span>' +
        '<span class="leg-route"></span>' +
        '<span class="leg-dist"></span>';
      var key = row.querySelector(".leg-key");
      key.style.color = color;
      key.style.borderTopStyle = st.dash ? "dashed" : "solid";
      var time = row.querySelector(".leg-time");
      time.style.color = color;
      time.textContent = clock;
      var modeEl = row.querySelector(".leg-mode");
      modeEl.innerHTML = modeIconSvg(mode);
      modeEl.setAttribute("title", mode);
      modeEl.setAttribute("aria-label", mode);
      row.querySelector(".leg-route").textContent = route;
      row.querySelector(".leg-dist").textContent = dist || "";
      bindRow(row, function () {
        markActive(row);
        activate();
      });
      rowHost().appendChild(row);
    }

    if (schedule && schedule.length) {
      schedule.forEach(function (item, i) {
        if (item.dayLabel) addDayRow(item.dayLabel);
        var path = item.pathId ? paths[item.pathId] : null;
        var mode = itemMode(item, path);
        var dist = durationOnly(item, path);
        addRow(i, item.clock, mode, item.label, dist, path && path.mode, function () {
          if (ctx.onUserFrame) ctx.onUserFrame();
          if (ctx.setQuery) {
            ctx.setQuery(queryOf(item, path), item.kind === "travel" ? 14 : 17);
            return;
          }
          var gKeys = [];
          if (item.kind === "travel" && path) {
            if (path.from) ensurePlaceMarker(map, ctx, path.from);
            if (path.to) ensurePlaceMarker(map, ctx, path.to);
            focusPath(map, path);
            applyFocusOpacities(ctx, item.pathId);
            if (path.to) gKeys.push(path.to);
            if (path.from) gKeys.push(path.from);
          } else if (item.place) {
            ensurePlaceMarker(map, ctx, item.place);
            focusPlace(map, item.place);
            applyPlaceFocus(ctx, item.place);
            gKeys.push(item.place);
          }
          focusGallery(gallery, gKeys);
        }, "Show " + (item.label || item.clock) + " on the map");
      });
      decorateGallery(gallery, schedule);
      addStepper();
      pinCopyHeights();
      if (ctx.day) {
        var beatItems = ctx.day.querySelectorAll(".day-beats > li");
        var rowItems = el.querySelectorAll(".leg-row");
        beatItems.forEach(function (beat, i) {
          var row = rowItems[i];
          if (!row) return;
          beat.setAttribute("role", "button");
          beat.setAttribute("tabindex", "0");
          bindRow(beat, function () {
            row.click();
          });
        });
      }
      return;
    }

    ids.forEach(function (id, i) {
      var path = paths[id];
      if (!path) return;
      addRow(i, path.time, modeWord(path.mode), routeText(path), durationOnly(null, path), path.mode, function () {
        if (ctx.onUserFrame) ctx.onUserFrame();
        if (ctx.setQuery) {
          ctx.setQuery(queryOf(null, path), 14);
          return;
        }
        if (path.from) ensurePlaceMarker(map, ctx, path.from);
        if (path.to) ensurePlaceMarker(map, ctx, path.to);
        focusPath(map, path);
        applyFocusOpacities(ctx, id);
      }, "Show " + (path.label || id) + " on the map");
    });
    addStepper();
  }

  function paintMap(map, ctx, placeKeys, pathIds, maxZoom) {
    flattenPathLayers(ctx.pathLayersById).forEach(function (layer) {
      map.removeLayer(layer);
    });
    eachMarker(ctx.markers, function (marker) {
      map.removeLayer(marker);
    });
    ctx.pathLayersById = drawPathIds(map, pathIds || []);
    ctx.markers = {};
    ctx.placeKeys = (placeKeys || []).slice();
    var destColor = destColorsFor(pathIds || []);
    (placeKeys || []).forEach(function (key) {
      var place = PLACES[key];
      if (!place) return;
      var marker = L.marker([place.lat, place.lng], {
        icon: pinIcon(place, true, destColor[key]),
        title: place.name + " · " + roleLabel(place.role),
        riseOnHover: true
      });
      marker._placeKey = key;
      marker.bindPopup(popupHtml(place));
      marker.addTo(map);
      ctx.markers[key] = marker;
    });
    var layers = flattenPathLayers(ctx.pathLayersById);
    eachMarker(ctx.markers, function (marker) { layers.push(marker); });
    if (!layers.length) return;
    var bounds = L.featureGroup(layers).getBounds();
    if (!bounds.isValid()) return;
    map.fitBounds(bounds.pad(0.12), { maxZoom: maxZoom || 16, animate: false });
  }

  var allMaps = [];
  function invalidateAll() {
    allMaps.forEach(function (m) { m.invalidateSize(); });
  }

  var overviewEl = document.getElementById("overview-map");
  var overviewCaption = document.getElementById("overview-caption");
  var stopButtons = Array.prototype.slice.call(document.querySelectorAll(".stop-list button"));
  var refitOverview = function () {};

  if (typeof L !== "undefined" && overviewEl) {
    var overviewMap = L.map(overviewEl, mapOptions());
    addCityTiles(overviewMap);
    allMaps.push(overviewMap);
    var overviewCtx = { markers: {}, pathLayersById: {}, placeKeys: [] };

    function selectStop(btn) {
      var id = btn.getAttribute("data-stop");
      var stop = STOPS[id];
      if (!stop) return;
      stopButtons.forEach(function (b) {
        b.setAttribute("aria-selected", b === btn ? "true" : "false");
      });
      var nameEl = btn.querySelector(".stop-name");
      if (overviewCaption) overviewCaption.textContent = nameEl ? nameEl.textContent : (stop.label || id);
      var shownIds = pathIdsFor(stop.paths || id);
      if (id !== "route") shownIds = pathIdsOnMap(shownIds, stop.places);
      paintMap(overviewMap, overviewCtx, stop.places || [], shownIds, stop.maxZoom || 14);
      fillLegList(document.getElementById("overview-legs"), shownIds, overviewMap, {
        group: stop.paths || id,
        markers: overviewCtx.markers,
        pathLayersById: overviewCtx.pathLayersById,
        placeKeys: overviewCtx.placeKeys
      });
    }

    stopButtons.forEach(function (btn) {
      btn.addEventListener("click", function () { selectStop(btn); });
    });
    refitOverview = function () {
      var selected = stopButtons.filter(function (b) {
        return b.getAttribute("aria-selected") === "true";
      })[0] || stopButtons[0];
      if (selected) selectStop(selected);
    };
    refitOverview();
  }

  if (typeof L !== "undefined") {
    document.querySelectorAll(".leaflet-map[data-places]").forEach(function (el) {
      var keys = el.getAttribute("data-places").split(",").map(function (s) {
        return s.trim();
      }).filter(function (k) { return PLACES[k]; });
      var pathGroup = el.getAttribute("data-paths");
      var maxZoom = parseInt(el.getAttribute("data-max-zoom") || "16", 10);
      var dayPathIds = pathIdsOnMap(pathIdsFor(pathGroup), keys);
      var map = L.map(el, mapOptions());
      addCityTiles(map);
      allMaps.push(map);
      var ctx = { markers: {}, pathLayersById: {}, placeKeys: [] };
      paintMap(map, ctx, keys, dayPathIds, maxZoom);
      if (dayPathIds.length) {
        var times = document.createElement("div");
        times.className = "leg-times";
        times.setAttribute("aria-label", "Times for this map");
        var dayRoot = el.closest(".day");
        fillLegList(times, dayPathIds, map, {
          group: pathGroup,
          markers: ctx.markers,
          pathLayersById: ctx.pathLayersById,
          placeKeys: ctx.placeKeys,
          gallery: dayRoot ? dayRoot.querySelector(".day-gallery") : null,
          day: dayRoot || null
        });
        if (el.parentNode) el.parentNode.appendChild(times);
      }
    });
  }

  window.addEventListener("resize", invalidateAll);
  window.addEventListener("load", function () {
    invalidateAll();
    if (refitOverview) refitOverview();
    setTimeout(function () {
      invalidateAll();
    }, 250);
  });


  var GALLERY_QUERY = {
    "amsterdam-dusk": "Grachtengordel Amsterdam",
    "cologne-night-bridge": "Cologne Cathedral",
    "rhine-boppard-loop": "Boppard am Rhein",
    "loreley-cruise": "Loreley Sankt Goarshausen",
    "mainz-cathedral": "Mainz Cathedral",
    "kloster-eberbach": "Kloster Eberbach",
    romerberg: "Römerberg Frankfurt",
    "frankfurt-roemer": "Frankfurter Römer",
    "frankfurt-ostzeile": "Ostzeile Frankfurt am Main",
    "frankfurt-kaiserdom": "Kaiserdom St. Bartholomäus Frankfurt",
    "frankfurt-neue-altstadt": "Neue Altstadt Frankfurt",
    "frankfurt-justice-fountain": "Gerechtigkeitsbrunnen Römerberg Frankfurt",
    "frankfurt-airport": "Frankfurt Airport Terminal 1",
    "eltville-castle": "Kurfürstliche Burg Eltville",
    "kloster-eberbach-church": "Kloster Eberbach",
    "kloster-eberbach-cloister": "Kloster Eberbach",
    "kloster-eberbach-dormitory": "Kloster Eberbach",
    "kloster-eberbach-barrels": "Kloster Eberbach",
    "rheingau-vines": "Rheingau",
    "cafe-captein": "Café Captein & Co Amsterdam",
    "bar-guzzo": "Bar Guzzo Amsterdam",
    "cafe-riese": "Café Riese Köln Schildergasse",
    "dom-cafe-mainz": "Dom-Café Mainz",
    "hoppenworth-ploch": "Hoppenworth & Ploch Café Altstadt Frankfurt",
    "paulaner-am-dom": "Motel One Frankfurt-Römer Berliner Straße 55",
    kleinmarkthalle: "Kleinmarkthalle Frankfurt",
    "main-tower": "MAIN TOWER Frankfurt",
    "fruh-am-dom": "Brauhaus FRÜH am Dom",
    "in-de-waag": "In de Waag Nieuwmarkt 4 Amsterdam",
    "de-belhamel": "De Belhamel Brouwersgracht 60 Amsterdam",
    "va-bar-bistro": "V&A Bar Bistro Prinsengracht 274 Amsterdam",
    "cafe-parlotte": "Café Parlotte Westerstraat 182 Amsterdam",
    moeders: "Moeders Rozengracht 251 Amsterdam",
    toscanini: "Toscanini Lindengracht 75 Amsterdam",
    "cafe-de-reiger": "Café de Reiger Nieuwe Leliestraat 34 Amsterdam",
    funkhaus: "Funkhaus Wallrafplatz 5 Köln",
    malzmuehle: "Brauerei zur Malzmühle Heumarkt 6 Köln",
    "peters-brauhaus": "Peters Brauhaus Mühlengasse 1 Köln",
    heiliggeist: "Heiliggeist Rentengasse 2 Mainz",
    "eisgrub-brau": "Eisgrub-Bräu Weißliliengasse 1a Mainz",
    "altdeutsche-weinstube": "Altdeutsche Weinstube Grabenstraße 4 Rüdesheim am Rhein",
    "bingen-rudesheim-ferry": "Autofähre Bingen-Kempten Hafenstraße Bingen",
    "villa-weil": "Villa Weil Rheinstraße 15 Rüdesheim",
    "rudesheim-marktstrasse": "Ratsstube Marktstraße 26 Rüdesheim",
    "am-holztor": "Am Holztor Holzstraße 40 Mainz",
    "altstadtcafe-willems": "Altstadtcafé Willems Schönbornstraße 9a Mainz",
    goldmarie: "Goldmarie Clarissa-Kupferberg-Platz 9 Mainz Zollhafen",
    "weinhaus-loesch": "Weinhaus Lösch Jakobsbergstraße 9 Mainz",
    atschel: "Apfelweinwirtschaft Atschel Wallstraße 7 Frankfurt",
    "wirtshaus-huehnermarkt": "Wirtshaus am Hühnermarkt Markt 18 Frankfurt",
    "apfelwein-wagner": "Apfelwein Wagner Schweizer Straße Frankfurt",
    "boppard-promenade": "Kurfürstliche Burg Boppard",
    "amsterdam-canals": "Grachtengordel Amsterdam",
    "amsterdam-dusk": "Grachtengordel Amsterdam"
  };

  var GALLERY_PLACE = {
    schiphol: "schiphol", "anne-frank-house": "anneFrank", "cafe-winkel-43": "winkel",
    scheepvaartmuseum: "scheepvaart", "amsterdam-canals": "canals", "amsterdam-canal-houses": "amsHotel", "amsterdam-dusk": "canals",
    "hotel-excelsior": "excelsior", "cologne-cathedral": "cathedral", praetorium: "praetorium",
    "fruh-am-dom": "fruh", "el-de-haus": "elde", "cologne-night-bridge": "cathedral",
    "boppard-promenade": "boppardPromenade", "hotel-bellevue": "bellevue", "rhine-boppard": "boppardPromenade",
    loreley: "loreley", "burg-katz": "katz", "burg-rheinfels": "rheinfels",
    "burg-pfalzgrafenstein": "pfalz", "hotel-hyatt-mainz": "hyatt",
    "altdeutsche-weinstube": "altdeutsche", "bingen-rudesheim-ferry": "ferryBingen",
    "villa-weil": "villaWeil", "rudesheim-marktstrasse": "ratsstube",
    "gutenberg-museum": "gutenberg", "sanctuary-isis": "isis", "mainz-riverwalk": "riverwalk",
    "mainz-cathedral": "mainzDom", "kloster-eberbach": "eberbach",
    "kloster-eberbach-dormitory": "eberbach", "rheingau-vines": "eberbach",
    "kloster-eberbach-church": "eberbach", "kloster-eberbach-barrels": "eberbach",
    "kloster-eberbach-cloister": "eberbach", "eltville-castle": "eltville", eltville: "eltville",
    romerberg: "romerberg", "frankfurt-cathedral": "kaiserdomFra", "frankfurt-kaiserdom": "kaiserdomFra",
    "neue-altstadt": "neueAltstadt", "frankfurt-neue-altstadt": "neueAltstadt",
    "frankfurt-ostzeile": "ostzeile", "frankfurt-justice-fountain": "justice",
    "frankfurt-roemer": "roemer", "frankfurt-airport": "fra",
    "hotel-hyatt": "hyatt",
    "cafe-captein": "captein", "bar-guzzo": "guzzo", "cafe-riese": "riese",
    "dom-cafe-mainz": "domCafe", "hoppenworth-ploch": "hoppenworth",
    "paulaner-am-dom": "paulaner", kleinmarkthalle: "kleinmarkt",
    "main-tower": "mainTower",
    "in-de-waag": "waag", "de-belhamel": "belhamel", "va-bar-bistro": "vaBistro",
    "cafe-parlotte": "parlotte", moeders: "moeders", toscanini: "toscanini",
    "cafe-de-reiger": "reiger", funkhaus: "funkhaus", malzmuehle: "malzmuehle",
    "peters-brauhaus": "peters", heiliggeist: "heiliggeist", "eisgrub-brau": "eisgrub",
    "am-holztor": "holztor", "altstadtcafe-willems": "willems", goldmarie: "goldmarie",
    "weinhaus-loesch": "loesch", atschel: "atschel", "wirtshaus-huehnermarkt": "huehnermarkt",
    "apfelwein-wagner": "wagner"
  };

  function imgStem(root) {
    var img = root.querySelector("img");
    var src = img && (img.getAttribute("src") || "");
    return src.replace(/^.*\//, "").replace(/\.(jpg|jpeg|png|webp)$/i, "");
  }

  function mapsHrefFor(root, place) {
    var stem = imgStem(root);
    var q = root.getAttribute("data-maps-query") || GALLERY_QUERY[stem] || (place && (place.query || place.name));
    if (!place && q) {
      var keys = Object.keys(PLACES);
      for (var i = 0; i < keys.length; i++) {
        var p = PLACES[keys[i]];
        if ((p.query || PLACE_QUERY[keys[i]] || p.name) === q) { place = p; break; }
      }
    }
    if (q) return { href: placeMaps(q, place && place.lat, place && place.lng), label: q };
    if (place && place.gmaps) return { href: place.gmaps, label: place.name };
    return null;
  }

  function wrapMaps(fig, href, label) {
    if (!fig || fig.closest("a.gallery-maps")) return;
    var a = document.createElement("a");
    a.className = "gallery-maps";
    a.href = href;
    a.target = "_blank";
    a.rel = "noopener";
    a.setAttribute("aria-label", "Open " + label + " in Google Maps");
    fig.parentNode.insertBefore(a, fig);
    a.appendChild(fig);
  }

  function bindGalleryMaps() {
    document.querySelectorAll(".day-gallery li").forEach(function (li) {
      var key = li.getAttribute("data-place");
      if (!key) key = GALLERY_PLACE[imgStem(li)];
      var place = key && PLACES[key];
      var spec = mapsHrefFor(li, place);
      if (!spec) return;
      var existing = li.querySelector("a.gallery-maps");
      if (existing) {
        existing.href = spec.href;
        existing.setAttribute("aria-label", "Open " + spec.label + " in Google Maps");
        return;
      }
      wrapMaps(li.querySelector("figure"), spec.href, spec.label);
    });
    document.querySelectorAll("figure.day-photo").forEach(function (fig) {
      var stem = imgStem(fig);
      var key = GALLERY_PLACE[stem];
      var place = key && PLACES[key];
      var spec = mapsHrefFor(fig, place);
      if (!spec) return;
      var parent = fig.parentNode;
      if (parent && parent.classList && parent.classList.contains("gallery-maps")) {
        parent.href = spec.href;
        parent.setAttribute("aria-label", "Open " + spec.label + " in Google Maps");
        return;
      }
      wrapMaps(fig, spec.href, spec.label);
    });
  }
  bindGalleryMaps();

  window.addEventListener("load", function () {
    if (refitOverview) refitOverview();
    pinCopyHeights();
  });
  window.addEventListener("resize", function () {
    pinCopyHeights();
  });
})();
