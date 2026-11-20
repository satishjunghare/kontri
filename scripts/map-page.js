/* Map page logic. Runs inside a WebView (phone) or an iframe (browser preview).
   Receives {kind:'state', ...} messages and posts {type:...} messages back. Kept in plain ES5. */
(function () {
  function send(o) {
    var s = JSON.stringify(o);
    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) window.ReactNativeWebView.postMessage(s);
    else if (window.parent && window.parent !== window) window.parent.postMessage(s, '*');
  }
  function div(cls, text) {
    var e = document.createElement('div');
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  var map = L.map('map', { zoomControl: true, attributionControl: true }).setView([21.0, 78.0], 5);
  var tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);

  var banner = document.getElementById('banner');
  var loaded = 0, failed = 0;
  tiles.on('tileload', function () { loaded++; banner.style.display = 'none'; });
  tiles.on('tileerror', function () {
    failed++;
    if (loaded === 0 && failed >= 3) { banner.style.display = 'block'; send({ type: 'tiles', ok: false }); }
  });

  var pins = L.layerGroup().addTo(map);
  var legs = L.layerGroup().addTo(map);
  var pickMarker = null, mode = 'view', lastFit = null;

  function updateLegVisibility() {
    if (map.getZoom() >= 10) { if (!map.hasLayer(legs)) map.addLayer(legs); }
    else if (map.hasLayer(legs)) map.removeLayer(legs);
  }
  map.on('zoomend', updateLegVisibility);

  function makePin(m, selected) {
    var wrap = div('pin-wrap' + (selected ? ' selected' : ''));
    var dot = div('pin', m.label);
    dot.style.background = m.color;
    wrap.appendChild(dot);
    if (m.sub) wrap.appendChild(div('pin-sub', m.sub));
    return L.divIcon({ className: 'pin-icon', html: wrap, iconSize: [70, 50], iconAnchor: [35, 16] });
  }

  function setPick(p) {
    if (pickMarker) { map.removeLayer(pickMarker); pickMarker = null; }
    if (!p) return;
    var icon = L.divIcon({ className: 'pin-icon', html: div('pick-dot'), iconSize: [26, 26], iconAnchor: [13, 13] });
    pickMarker = L.marker([p.lat, p.lng], { icon: icon, draggable: mode === 'pick', zIndexOffset: 1000 }).addTo(map);
    pickMarker.on('dragend', function () {
      var ll = pickMarker.getLatLng();
      send({ type: 'tap', lat: ll.lat, lng: ll.lng });
    });
  }

  function render(d) {
    pins.clearLayers();
    legs.clearLayers();
    mode = d.mode || 'view';
    var pts = [];
    (d.lines || []).forEach(function (l) {
      L.polyline(l.coords, { color: l.color, weight: 4, opacity: 0.75, dashArray: '2 9', lineCap: 'round' }).addTo(pins);
    });
    (d.legs || []).forEach(function (g) {
      var chip = div('leg-chip', g.text);
      chip.style.borderColor = g.color;
      var icon = L.divIcon({ className: 'pin-icon', html: chip, iconSize: [0, 0] });
      L.marker([g.lat, g.lng], { icon: icon, interactive: false, keyboard: false }).addTo(legs);
    });
    (d.markers || []).forEach(function (m) {
      var mk = L.marker([m.lat, m.lng], { icon: makePin(m, m.id === d.selectedId), zIndexOffset: m.id === d.selectedId ? 500 : 0 }).addTo(pins);
      mk.on('click', function () { send({ type: 'marker', id: m.id }); });
      pts.push([m.lat, m.lng]);
    });
    setPick(d.pick);
    if (d.fitKey !== lastFit) {
      lastFit = d.fitKey;
      var all = pts.slice();
      if (d.pick) all.push([d.pick.lat, d.pick.lng]);
      if (all.length === 1) map.setView(all[0], 14);
      else if (all.length > 1) map.fitBounds(all, { padding: [50, 50], maxZoom: 15 });
    }
    updateLegVisibility();
  }

  map.on('click', function (e) {
    if (mode !== 'pick') return;
    setPick({ lat: e.latlng.lat, lng: e.latlng.lng });
    send({ type: 'tap', lat: e.latlng.lat, lng: e.latlng.lng });
  });

  function onMessage(ev) {
    try {
      var d = JSON.parse(typeof ev.data === 'string' ? ev.data : '');
      if (d && d.kind === 'state') render(d);
    } catch (err) { /* ignore messages that are not ours */ }
  }
  window.addEventListener('message', onMessage);
  document.addEventListener('message', onMessage);
  window.addEventListener('resize', function () { map.invalidateSize(); });

  send({ type: 'ready' });
})();
