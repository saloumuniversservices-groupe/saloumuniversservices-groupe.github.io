/* Vue 360° des produits : lecture et affichage (site et logiciel), fabrication depuis une vidéo (logiciel).
   Stockage : spins/{produit} (infos) et spins/{produit}/c/{tour}-{paquet} (6 images par document). */
(function () {
  'use strict';
  var N = 36, PER = 6, SIDE = 480;

  function load(db, pid) {
    return db.collection('spins').doc(pid).collection('c').get().then(function (q) {
      var rows = [];
      q.forEach(function (d) { var x = d.data(); (rows[x.r] = rows[x.r] || [])[x.k] = x.f; });
      return rows.filter(Boolean).map(function (r) { return [].concat.apply([], r.filter(Boolean)); }).filter(function (r) { return r.length; });
    });
  }

  /* Affiche une vue 360° dans « el ». Glisser à gauche ou à droite : tour ; en haut ou en bas : autre hauteur. */
  function viewer(el, rows, opt) {
    opt = opt || {};
    if (!rows || !rows.length) return null;
    var row = 0, i = 0, busy = false, auto = !opt.still, x0 = 0, y0 = 0, acc = 0, accY = 0, timer = null;
    el.innerHTML = '<div class="spin360" style="position:relative;touch-action:none;user-select:none;-webkit-user-select:none;cursor:grab;border-radius:12px;overflow:hidden;background:#fff;aspect-ratio:1/1;max-width:520px;margin:0 auto">' +
      '<img alt="' + (opt.alt || 'Vue 360°') + '" draggable="false" style="width:100%;height:100%;object-fit:contain;display:block;pointer-events:none">' +
      '<span style="position:absolute;left:10px;top:10px;background:rgba(200,16,30,.92);color:#fff;font:600 12px system-ui,sans-serif;padding:4px 9px;border-radius:999px">360°</span>' +
      '<span class="spin-hint" style="position:absolute;left:50%;bottom:10px;transform:translateX(-50%);background:rgba(20,20,20,.72);color:#fff;font:500 12px system-ui,sans-serif;padding:5px 11px;border-radius:999px;white-space:nowrap;transition:opacity .4s">↔ ' + (opt.hint || 'Glissez pour faire tourner') + (rows.length > 1 ? ' · ↕ dessus' : '') + '</span></div>';
    var box = el.firstChild, img = box.querySelector('img'), hint = box.querySelector('.spin-hint');
    var pre = rows.map(function (r) { return r.map(function (src) { var im = new Image(); im.src = src; return im; }); });
    var show = function () { var r = rows[row]; img.src = r[((i % r.length) + r.length) % r.length]; };
    show();
    var stopAuto = function () { auto = false; if (timer) { clearInterval(timer); timer = null; } hint.style.opacity = '0'; };
    if (auto) timer = setInterval(function () { if (!document.body.contains(box)) { clearInterval(timer); return; } i++; show(); }, 90);
    box.addEventListener('pointerdown', function (e) { stopAuto(); busy = true; x0 = e.clientX; y0 = e.clientY; acc = 0; accY = 0; try { box.setPointerCapture(e.pointerId); } catch (er) {} box.style.cursor = 'grabbing'; });
    box.addEventListener('pointermove', function (e) {
      if (!busy) return;
      var step = Math.max(4, box.clientWidth / rows[row].length / 1.2);
      acc += e.clientX - x0; accY += e.clientY - y0; x0 = e.clientX; y0 = e.clientY;
      while (acc > step) { i--; acc -= step; } while (acc < -step) { i++; acc += step; }
      if (rows.length > 1 && Math.abs(accY) > 40) { row = Math.max(0, Math.min(rows.length - 1, row + (accY < 0 ? 1 : -1))); accY = 0; }
      show();
    });
    var up = function () { busy = false; box.style.cursor = 'grab'; };
    box.addEventListener('pointerup', up); box.addEventListener('pointercancel', up);
    return { stop: stopAuto, frames: pre };
  }

  /* Découpe une vidéo en N images carrées, allégées (fait sur l'appareil). */
  function framesFromVideo(file, onProgress) {
    return new Promise(function (ok, ko) {
      var v = document.createElement('video'), url = URL.createObjectURL(file), out = [];
      v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = url;
      var c = document.createElement('canvas'), g = c.getContext('2d'); c.width = SIDE; c.height = SIDE;
      var fail = function (m) { URL.revokeObjectURL(url); ko(new Error(m)); };
      var seek = function (t) { return new Promise(function (res) { var h = function () { v.removeEventListener('seeked', h); res(); }; v.addEventListener('seeked', h); v.currentTime = t; }); };
      v.onerror = function () { fail('Vidéo illisible sur cet appareil'); };
      v.onloadedmetadata = function () {
        var go = function (dur) {
          if (!(dur > 0.8)) return fail('Vidéo trop courte : filmez au moins 5 secondes');
          var k = 0, a = dur * 0.03, b = dur * 0.97;
          var next = function () {
            if (k >= N) { URL.revokeObjectURL(url); return ok(out); }
            seek(a + (b - a) * k / N).then(function () {
              var w = v.videoWidth, h = v.videoHeight, s = Math.min(w, h);
              g.fillStyle = '#fff'; g.fillRect(0, 0, SIDE, SIDE);
              g.drawImage(v, (w - s) / 2, (h - s) / 2, s, s, 0, 0, SIDE, SIDE);
              out.push(c.toDataURL('image/jpeg', 0.62)); k++;
              if (onProgress) onProgress(k, N);
              next();
            });
          };
          next();
        };
        if (isFinite(v.duration)) go(v.duration);
        else { v.currentTime = 1e7; v.ontimeupdate = function () { v.ontimeupdate = null; var d = v.duration; v.currentTime = 0; go(isFinite(d) ? d : v.currentTime); }; }
      };
    });
  }

  /* Enregistre les tours d'images ; remplace l'ancienne vue 360° du produit. */
  function save(db, pid, rows, by) {
    var ref = db.collection('spins').doc(pid);
    return ref.collection('c').get().then(function (q) {
      var b = db.batch(); q.forEach(function (d) { b.delete(d.ref); }); return b.commit();
    }).then(function () {
      var jobs = [];
      rows.forEach(function (r, ri) { for (var k = 0; k * PER < r.length; k++) jobs.push({ r: ri, k: k, f: r.slice(k * PER, k * PER + PER) }); });
      var chain = Promise.resolve();
      for (var j = 0; j < jobs.length; j += 3) (function (part) { chain = chain.then(function () { var b = db.batch(); part.forEach(function (x) { b.set(ref.collection('c').doc(x.r + '-' + x.k), x); }); return b.commit(); }); })(jobs.slice(j, j + 3));
      return chain;
    }).then(function () {
      var info = { n: rows[0].length, rows: rows.length, v: Date.now(), by: by || '' };
      return ref.set(info).then(function () { return info; });
    });
  }
  function remove(db, pid) {
    var ref = db.collection('spins').doc(pid);
    return ref.collection('c').get().then(function (q) { var b = db.batch(); q.forEach(function (d) { b.delete(d.ref); }); b.delete(ref); return b.commit(); });
  }
  window.SPIN = { load: load, viewer: viewer, framesFromVideo: framesFromVideo, save: save, remove: remove, N: N };
})();
