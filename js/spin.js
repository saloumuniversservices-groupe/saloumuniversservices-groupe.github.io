/* Vue 360° des produits : lecture et affichage (site et logiciel), fabrication depuis une vidéo (logiciel).
   Stockage : spins/{produit} (infos) et spins/{produit}/c/{tour}-{paquet} (6 images par document). */
(function () {
  'use strict';
  var N = 36, PER = 6, SIDE = 480;
  /* Stockage Cloudflare R2 : images en haute qualité, servies par medias.saloumuniversservices-groupe.com. */
  var UP = 'https://saloum-envoi.mbow72816.workers.dev/o/', PUB = 'https://medias.saloumuniversservices-groupe.com/';
  var SD = 640, HD = 1280;

  function load(db, pid, hd) {
    return db.collection('spins').doc(pid).get().then(function (d) {
      var x = d.exists ? d.data() : null;
      if (x && x.base) {
        var rows = []; for (var r = 0; r < (x.rows || 1); r++) { var row = []; for (var i = 0; i < x.n; i++) row.push(x.base + (hd && x.hd ? 'h' : 's') + '/' + r + '-' + i + '.jpg'); rows.push(row); }
        rows.hd = x.hd ? rows.map(function (row) { return row.map(function (u) { return u.replace('/s/', '/h/'); }); }) : null;
        return rows;
      }
      return loadChunks(db, pid);
    });
  }
  function loadChunks(db, pid) {
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
      if (!busy || (typeof zoom !== 'undefined' && zoom)) return;
      var step = Math.max(4, box.clientWidth / rows[row].length / 1.2);
      acc += e.clientX - x0; accY += e.clientY - y0; x0 = e.clientX; y0 = e.clientY;
      while (acc > step) { i--; acc -= step; } while (acc < -step) { i++; acc += step; }
      if (rows.length > 1 && Math.abs(accY) > 40) { row = Math.max(0, Math.min(rows.length - 1, row + (accY < 0 ? 1 : -1))); accY = 0; }
      show();
    });
    var up = function () { busy = false; box.style.cursor = 'grab'; };
    box.addEventListener('pointerup', up); box.addEventListener('pointercancel', up);
    // Double-toucher : zoom x2 en haute qualité (si elle existe), glisser pour se déplacer ; double-toucher encore pour revenir.
    var zoom = false, lastTap = 0, base = rows, pan = { x: 0, y: 0 };
    var setZoom = function (on, ev) {
      zoom = on; stopAuto();
      if (on && rows.hd) { rows = rows.hd; show(); }
      if (!on) { rows = base; show(); pan = { x: 0, y: 0 }; }
      img.style.transition = 'transform .2s'; img.style.transform = on ? 'scale(2) translate(' + pan.x + 'px,' + pan.y + 'px)' : '';
    };
    box.addEventListener('pointerdown', function (e) { var t = Date.now(); if (t - lastTap < 300) { setZoom(!zoom, e); lastTap = 0; } else lastTap = t; });
    box.addEventListener('pointermove', function (e) { if (!zoom || !busy) return; pan.x += e.movementX / 2; pan.y += e.movementY / 2; var m = box.clientWidth / 4; pan.x = Math.max(-m, Math.min(m, pan.x)); pan.y = Math.max(-m, Math.min(m, pan.y)); img.style.transition = 'none'; img.style.transform = 'scale(2) translate(' + pan.x + 'px,' + pan.y + 'px)'; }, true);
    return { stop: stopAuto, frames: pre, isZoom: function () { return zoom; } };
  }

  /* Découpe une vidéo en N images carrées, allégées (fait sur l'appareil). */
  function framesFromVideo(file, onProgress, hq) {
    return new Promise(function (ok, ko) {
      var v = document.createElement('video'), url = URL.createObjectURL(file), out = [], big = [], small = [];
      var c2 = document.createElement('canvas'), g2 = c2.getContext('2d'), c3 = document.createElement('canvas'), g3 = c3.getContext('2d');
      c2.width = c2.height = HD; c3.width = c3.height = SD;
      var blob = function (cv, q) { return new Promise(function (res) { cv.toBlob(res, 'image/jpeg', q); }); };
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
            if (k >= N) { URL.revokeObjectURL(url); if (hq) { out.big = big; out.small = small; } return ok(out); }
            seek(a + (b - a) * k / N).then(function () {
              var w = v.videoWidth, h = v.videoHeight, s = Math.min(w, h);
              g.fillStyle = '#fff'; g.fillRect(0, 0, SIDE, SIDE);
              g.drawImage(v, (w - s) / 2, (h - s) / 2, s, s, 0, 0, SIDE, SIDE);
              out.push(c.toDataURL('image/jpeg', 0.62));
              var fin = function () { k++; if (onProgress) onProgress(k, N); next(); };
              if (!hq) return fin();
              var s2 = Math.min(w, h);
              g2.fillStyle = '#fff'; g2.fillRect(0, 0, HD, HD); g2.drawImage(v, (w - s2) / 2, (h - s2) / 2, s2, s2, 0, 0, HD, HD);
              g3.fillStyle = '#fff'; g3.fillRect(0, 0, SD, SD); g3.drawImage(v, (w - s2) / 2, (h - s2) / 2, s2, s2, 0, 0, SD, SD);
              Promise.all([blob(c2, 0.85), blob(c3, 0.78)]).then(function (b) { big.push(b[0]); small.push(b[1]); fin(); });
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
  /* Haute qualité : envoie les images vers R2 par le relais sécurisé, puis note l'adresse dans Firestore. */
  function saveHQ(db, pid, rows, by, onProgress) {
    var user = firebase.auth().currentUser; if (!user) return Promise.reject(new Error('Connectez-vous'));
    var ref = db.collection('spins').doc(pid), v = Date.now().toString(36), base = PUB + 'spins/' + pid + '/' + v + '/';
    return Promise.all([user.getIdToken(), ref.get()]).then(function (res) {
      var tok = res[0], old = res[1].exists ? res[1].data() : null, jobs = [];
      rows.forEach(function (r, ri) { r.big.forEach(function (b, i) { jobs.push(['h/' + ri + '-' + i + '.jpg', b]); }); r.small.forEach(function (b, i) { jobs.push(['s/' + ri + '-' + i + '.jpg', b]); }); });
      var done = 0, put = function (j) {
        return fetch(UP + 'spins/' + pid + '/' + v + '/' + j[0], { method: 'PUT', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'image/jpeg' }, body: j[1] })
          .then(function (r) { if (!r.ok) return r.json().catch(function () { return {}; }).then(function (e) { throw new Error('Envoi refusé (' + (e.error || r.status) + ')'); }); done++; if (onProgress) onProgress(done, jobs.length); });
      };
      var i = 0, lanes = [];
      for (var l = 0; l < 6; l++) lanes.push((function run() { if (i >= jobs.length) return Promise.resolve(); var j = jobs[i++]; return put(j).then(run); })());
      return Promise.all(lanes).then(function () {
        var info = { n: rows[0].big.length, rows: rows.length, v: Date.now(), base: base, hd: true, by: by || '' };
        return ref.set(info).then(function () {
          // Nettoyage : ancienne version sur R2, anciennes images dans la base.
          if (old && old.base) fetch(UP + old.base.replace(PUB, ''), { method: 'DELETE', headers: { Authorization: 'Bearer ' + tok } }).catch(function () {});
          ref.collection('c').get().then(function (q) { if (!q.size) return; var b = db.batch(); q.forEach(function (d) { b.delete(d.ref); }); return b.commit(); }).catch(function () {});
          return info;
        });
      });
    });
  }
  function remove(db, pid) {
    var user = firebase.auth && firebase.auth().currentUser;
    db.collection('spins').doc(pid).get().then(function (d) { var x = d.exists ? d.data() : null; if (x && x.base && user) user.getIdToken().then(function (tok) { fetch(UP + x.base.replace(PUB, ''), { method: 'DELETE', headers: { Authorization: 'Bearer ' + tok } }).catch(function () {}); }); }).catch(function () {});
    var ref = db.collection('spins').doc(pid);
    return ref.collection('c').get().then(function (q) { var b = db.batch(); q.forEach(function (d) { b.delete(d.ref); }); b.delete(ref); return b.commit(); });
  }
  window.SPIN = { load: load, viewer: viewer, framesFromVideo: framesFromVideo, save: save, saveHQ: saveHQ, remove: remove, N: N };
})();
