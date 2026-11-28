(function () {
  var root = document.getElementById('shop'); if (!root) return;
  var L = root.dataset.lang === 'en' ? 'en' : 'fr', FR = L === 'fr';
  var T = function (fr, en) { return FR ? fr : en; };
  var CATS = window.SHOP_CATS, UNITS = window.SHOP_UNITS, MODELS = window.BMW_MODELS, COND = window.PART_COND;
  var S = JSON.parse(JSON.stringify(window.SHOP_DEFAULTS));
  var ONLY = (root.dataset.cats || '').split(',').filter(Boolean);
  if (ONLY.length) CATS = CATS.filter(function (c) { return ONLY.indexOf(c.id) >= 0; });
  var SHOPK = root.dataset.shop ? '_' + root.dataset.shop : '';
  var products = [], cat = CATS[0].id, cart = {}, db = null, veh = {}, onlyCompat = false, loaded = false, fam = '', shown = 48;
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var money = function (n) { return Math.round(n || 0).toLocaleString('fr-FR').replace(/ | /g, ' '); };
  var unit = function (u) { var x = UNITS[u] || UNITS.piece; return FR ? x[0] : x[1]; };
  var price = function (p) { return p.promo > 0 && p.promo < p.price ? p.promo : p.price; };
  var pname = function (p) { return FR || !p.nameEn ? p.name : p.nameEn; };
  var weighed = function (p) { return (p.cat === 'agro' || p.cat === 'legumes' || p.cat === 'tilapia') && p.unit === 'kg'; };
  var catOf = function (id) { return CATS.filter(function (c) { return c.id === id; })[0] || {}; };
  var store = { get: function (k, d) { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } }, set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
  cart = store.get('suns_cart' + SHOPK, {}); veh = store.get('suns_bmw', {}); onlyCompat = !!veh.only;
  var save = function () { store.set('suns_cart' + SHOPK, cart); };

  // ---------- Recherche tolérante (accents, espaces dans les références, petites fautes) ----------
  var norm = function (s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); };
  var compact = function (s) { return norm(s).replace(/[^a-z0-9]/g, ''); };
  function lev1(a, b) { // distance de Levenshtein ≤ 1 ?
    if (Math.abs(a.length - b.length) > 1) return false;
    var i = 0, j = 0, e = 0;
    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) { i++; j++; continue; }
      if (++e > 1) return false;
      if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
    }
    return e + (a.length - i) + (b.length - j) <= 1;
  }
  /* Recherche par véhicule : « X5 » trouve les pièces écrites G05, F15, E70… ; un code châssis trouve aussi ses modèles. */
  function score(p, q) {
    if (!q) return 1;
    var B = window.BMW;
    if (B && p.cat === 'bmw') {
      var mq = B.modelIn(q);
      if (mq) {
        var codes = B.codesOf(mq.model), inName = B.codesIn([p.name, p.ref, p.desc].join(' '));
        var hit = inName.some(function (c) { return codes.indexOf(c) >= 0; }) || (p.models || []).indexOf(mq.model) >= 0 || norm(p.name).indexOf(norm(q)) >= 0;
        if (!hit) return 0;
        return mq.rest ? score(p, mq.rest) && 2 : 2;
      }
    }
    var text = [p.name, p.nameEn, p.ref, p.desc, p.family, (p.models || []).join(' ')].join(' ');
    var qc = compact(q);
    if (qc.length >= 5 && compact(p.ref).indexOf(qc) >= 0) return 3;
    var hay = norm(text), words = hay.split(/[^a-z0-9]+/);
    var toks = norm(q).split(/\s+/).filter(Boolean), s = 2;
    for (var i = 0; i < toks.length; i++) {
      var t = toks[i];
      if (hay.indexOf(t) >= 0) continue;
      if (t.length >= 4 && words.some(function (w) { return lev1(w, t) || (w.length > 4 && lev1(w.slice(0, t.length), t)); })) { s = 1; continue; }
      return 0;
    }
    return s;
  }
  function compatible(p) {
    if (!veh.model) return null;
    if (!p.models || !p.models.length) {
      // Pas de modèle saisi : on lit les codes châssis du nom de la pièce.
      var B = window.BMW, inName = B ? B.codesIn([p.name, p.ref].join(' ')) : [];
      if (!inName.length) return 'all';
      var mine = B.codesOf(veh.model, veh.year);
      return inName.some(function (c) { return mine.indexOf(c) >= 0; });
    }
    if (p.models.indexOf(veh.model) < 0) return false;
    var y = +veh.year;
    if (y && ((p.yearFrom && y < p.yearFrom) || (p.yearTo && y > p.yearTo))) return false;
    return true;
  }

  // ---------- Rayons ----------
  if (CATS.length < 2) $('tabs').hidden = true;
  $('tabs').innerHTML = CATS.map(function (c) { return '<button role="tab" data-c="' + c.id + '">' + c.ico + ' ' + esc(FR ? c.fr : c.en) + '</button>'; }).join('');
  $('tabs').onclick = function (e) { var b = e.target.closest('button'); if (!b) return; cat = b.dataset.c; history.replaceState(null, '', '#' + cat); render(); };
  $('q').oninput = function () { shown = 48; render(); };
  $('sf').onsubmit = function (e) { e.preventDefault(); $('q').blur(); render(); };
  var h0 = location.hash.slice(1);
  if (CATS.some(function (c) { return c.id === h0; })) cat = h0;

  function drawVehicle() {
    if (cat !== 'bmw') { $('veh').innerHTML = ''; return; }
    var years = []; for (var y = new Date().getFullYear(); y >= 1990; y--) years.push(y);
    $('veh').innerHTML = '<div class="vehbox"><b>🚗 ' + T('Mon véhicule BMW', 'My BMW') + '</b>' +
      '<div class="row"><select id="vModel" aria-label="' + T('Modèle', 'Model') + '"><option value="">' + T('Modèle…', 'Model…') + '</option>' + MODELS.map(function (m) { return '<option' + (m === veh.model ? ' selected' : '') + '>' + m + '</option>'; }).join('') + '</select>' +
      '<select id="vYear" aria-label="' + T('Année', 'Year') + '"><option value="">' + T('Année…', 'Year…') + '</option>' + years.map(function (y) { return '<option' + (String(y) === String(veh.year) ? ' selected' : '') + '>' + y + '</option>'; }).join('') + '</select></div>' +
      (veh.model ? '<label class="rad small"><input type="checkbox" id="vOnly"' + (onlyCompat ? ' checked' : '') + '> ' + T('Afficher seulement les pièces compatibles', 'Show compatible parts only') + '</label>' : '<p class="small muted">' + T('Choisissez votre modèle pour voir les pièces compatibles. Vous pouvez aussi chercher par référence d\'origine (OEM).', 'Pick your model to see compatible parts. You can also search by original part number (OEM).') + '</p>') + '</div>';
    var up = function () { veh = { model: $('vModel').value, year: $('vYear').value, only: onlyCompat }; store.set('suns_bmw', veh); render(); };
    $('vModel').onchange = up; $('vYear').onchange = up;
    if ($('vOnly')) $('vOnly').onchange = function () { onlyCompat = this.checked; veh.only = onlyCompat; store.set('suns_bmw', veh); render(); };
  }

  // ---------- Données ----------
  function boot() {
    if (!window.SHOP_FIREBASE || !window.firebase) {
      $('list').innerHTML = '<div class="card"><h3>' + T('Boutique bientôt ouverte', 'Shop opening soon') + '</h3><p>' + T('En attendant, commandez par WhatsApp ou par téléphone.', 'Meanwhile, order by WhatsApp or phone.') + '</p>' + waButtons() + '</div>';
      render(); return;
    }
    firebase.initializeApp(window.SHOP_FIREBASE);
    db = firebase.firestore();
    db.collection('settings').doc('shop').onSnapshot(function (d) {
      if (d.exists) { var v = d.data(); for (var k in v) S[k] = v[k]; }
      $('shopNotice').innerHTML = S.notice ? '<div class="note">' + esc(S.notice) + '</div>' : '';
      render();
    }, function () {});
    db.collection('products').where('visible', '==', true).onSnapshot(function (qs) {
      loaded = true;
      products = qs.docs.map(function (d) { var p = d.data(); p.id = d.id; return p; });
      products.sort(function (a, b) { return (b.inStock !== false) - (a.inStock !== false) || String(a.name).localeCompare(String(b.name)); });
      for (var id in cart) if (!products.some(function (p) { return p.id === id; })) delete cart[id];
      save(); render(); openFromHash();
    }, function () { $('list').innerHTML = '<p class="muted">' + T('Impossible de charger les produits. Vérifiez la connexion.', 'Could not load products. Check your connection.') + '</p>'; });
  }
  function waButtons() {
    return '<div class="cta">' + CATS.map(function (c) { var n = S.wa[c.id]; return n ? '<a class="btn small" href="https://wa.me/' + n + '">' + c.ico + ' ' + esc(FR ? c.fr : c.en) + '</a>' : ''; }).join('') + (S.wa.repair ? '<a class="btn small" href="https://wa.me/' + S.wa.repair + '">🔧 ' + T('Réparation BMW', 'BMW repair') + '</a>' : '') + '</div>';
  }

  // ---------- Liste ----------
  function render() {
    [].forEach.call($('tabs').children, function (b) { var on = b.dataset.c === cat; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    var dv = cat === 'transport';
    $('devis').hidden = !dv; $('sf').hidden = dv; $('list').hidden = dv; $('qinfo').textContent = '';
    drawVehicle();
    if (dv) { renderDevis(); updateCart(); return; }
    if (!db) { updateCart(); return; }
    if (!loaded) return;
    var q = $('q').value.trim();
    // Rayons (familles) de la boutique, rangés par ordre alphabétique
    var fl = $('fam');
    if (!fl) { fl = document.createElement('div'); fl.id = 'fam'; fl.className = 'chips'; $('qinfo').parentNode.insertBefore(fl, $('qinfo')); fl.onclick = function (e) { var b = e.target.closest('[data-f]'); if (!b) return; fam = b.dataset.f; shown = 48; render(); }; }
    var fc = {}; products.forEach(function (p) { if (p.cat === cat && p.family) fc[p.family] = (fc[p.family] || 0) + 1; });
    var fk = Object.keys(fc).sort(function (x, y) { return x.localeCompare(y, 'fr'); });
    if (fam && !fc[fam]) fam = '';
    fl.hidden = fk.length < 2;
    fl.innerHTML = '<button type="button" data-f=""' + (fam ? '' : ' class="on"') + '>' + T('Tous les rayons', 'All sections') + '</button>' + fk.map(function (k) { return '<button type="button" data-f="' + esc(k) + '"' + (fam === k ? ' class="on"' : '') + '>' + esc(k) + ' <span class="small">' + fc[k] + '</span></button>'; }).join('');
    var l = products.filter(function (p) { return p.cat === cat && (!fam || p.family === fam); }).map(function (p) { return { p: p, s: score(p, q), c: cat === 'bmw' ? compatible(p) : null }; })
      .filter(function (x) { return x.s > 0 && !(onlyCompat && veh.model && x.c === false); });
    l.sort(function (a, b) { return (b.s - a.s) || ((b.c === true) - (a.c === true)) || ((b.c === 'all') - (a.c === 'all')); });
    if (q) { var mq0 = cat === 'bmw' && window.BMW && window.BMW.modelIn(q); $('qinfo').textContent = l.length + ' ' + T('résultat(s) pour', 'result(s) for') + ' « ' + q + ' »' + (mq0 && window.BMW.label(mq0.model) ? ' · BMW ' + mq0.model + ' = ' + window.BMW.label(mq0.model) : ''); }
    if (!q && !fam && l.length > shown) $('qinfo').textContent = l.length + ' ' + T('produits', 'products');
    $('list').innerHTML = l.length ? l.slice(0, shown).map(function (x) { return card(x.p, x.c); }).join('') + (l.length > shown ? '<div style="grid-column:1/-1;text-align:center"><button type="button" class="btn ghost dark" id="more">' + T('Voir plus de produits', 'See more products') + ' (' + (l.length - shown) + ')</button></div>' : '') :
      '<div class="card"><p>' + (q ? T('Aucun produit ne correspond à « ', 'No product matches “') + esc(q) + T(' ». ', '”. ') : T('Pas encore de produit dans ce rayon. ', 'No product here yet. ')) +
      T('Demandez-nous directement :', 'Ask us directly:') + '</p><a class="btn small" target="_blank" rel="noopener" href="https://wa.me/' + (S.wa[cat] || S.wa.bmw) + '?text=' + encodeURIComponent(T('Bonjour, je cherche : ', 'Hello, I am looking for: ') + q + (cat === 'bmw' && veh.model ? ' (' + veh.model + ' ' + (veh.year || '') + ')' : '')) + '">💬 WhatsApp</a></div>';
    updateCart();
  }
  function badge(c) {
    if (c === true) return '<span class="tag ok">✓ ' + T('Compatible', 'Fits') + ' ' + esc(veh.model) + '</span>';
    if (c === 'all') return '';
    if (c === false) return '<span class="tag no">' + T('Autre modèle', 'Other model') + '</span>';
    return '';
  }
  function qtyCtl(p, n) {
    return n ? '<div class="qty"><button data-a="-" data-id="' + p.id + '" aria-label="−">−</button><b>' + n + '</b><button data-a="+" data-id="' + p.id + '" aria-label="+">+</button></div>'
      : '<button class="btn add" data-a="+" data-id="' + p.id + '">' + T('Ajouter au panier', 'Add to cart') + '</button>';
  }
  function card(p, c) {
    var n = cart[p.id] || 0, out = p.inStock === false, pr = price(p);
    return '<div class="pcard' + (out ? ' out' : '') + '" data-open="' + p.id + '">' +
      (p.photo ? '<img src="' + p.photo + '" alt="' + esc(pname(p)) + '" loading="lazy" decoding="async" width="300" height="300">' : '<div class="noimg">' + (catOf(p.cat).ico || '') + '</div>') +
      (pr !== p.price ? '<span class="promo">-' + Math.round(100 - pr * 100 / p.price) + ' %</span>' : '') +
      (p.spin ? '<span class="b360">360°</span>' : '') +
      '<div class="pbody">' + badge(c) + '<h3>' + esc(pname(p)) + '</h3>' +
      (p.ref ? '<p class="ref">' + esc(p.ref) + '</p>' : '') +
      (p.cond && COND[p.cond] ? '<p class="ref">' + COND[p.cond][FR ? 0 : 1] + '</p>' : '') +
      '<p class="price">' + (pr !== p.price ? '<s>' + money(p.price) + '</s> ' : '') + money(pr) + ' F <span>/ ' + unit(p.unit) + '</span></p>' +
      (out ? '<p class="oos">' + T('Épuisé', 'Out of stock') + '</p>' : qtyCtl(p, n)) +
      '</div></div>';
  }
  function bump(id, d) { cart[id] = Math.max(0, (cart[id] || 0) + d); if (!cart[id]) delete cart[id]; save(); }
  $('list').onclick = function (e) {
    if (e.target.id === 'more') { shown += 48; render(); return; }
    var b = e.target.closest('button[data-a]');
    if (b) { bump(b.dataset.id, b.dataset.a === '+' ? 1 : -1); render(); return; }
    var c = e.target.closest('[data-open]'); if (c) openProduct(c.dataset.open);
  };

  // ---------- Panneau ----------
  function sheet(html) { $('sheetIn').innerHTML = html; $('sheet').hidden = false; document.body.style.overflow = 'hidden'; $('sheetIn').scrollTop = 0; }
  function close() { $('sheet').hidden = true; document.body.style.overflow = ''; if (/^#p=/.test(location.hash)) history.replaceState(null, '', '#' + cat); }
  $('sheet').onclick = function (e) { if (e.target.id === 'sheet' || e.target.closest('[data-close]')) close(); };
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('sheet').hidden) close(); });

  // ---------- Fiche produit ----------
  function openFromHash() { var m = location.hash.match(/^#p=(.+)$/); if (m) openProduct(decodeURIComponent(m[1])); }
  function openProduct(id) {
    var p = products.filter(function (x) { return x.id === id; })[0]; if (!p) return;
    cat = p.cat; history.replaceState(null, '', '#p=' + encodeURIComponent(id));
    var photos = (p.photos && p.photos.length ? p.photos : (p.photo ? [p.photo] : [])), pr = price(p), c = p.cat === 'bmw' ? compatible(p) : null;
    var link = window.SITE_URL + '/' + (FR ? 'boutique.html' : 'shop.html') + '#p=' + encodeURIComponent(id);
    var share = pname(p) + ' – ' + money(pr) + ' F / ' + unit(p.unit) + '\n' + link;
    var ask = T('Bonjour, cette pièce est-elle compatible avec ma BMW ', 'Hello, does this part fit my BMW ') + (veh.model ? veh.model + ' ' + (veh.year || '') : '…') + ' ?\n' + pname(p) + (p.ref ? ' (' + p.ref + ')' : '') + '\n' + link;
    sheet('<div class="shead"><h3>' + esc(pname(p)) + '</h3><button class="x" data-close aria-label="' + T('Fermer', 'Close') + '">✕</button></div>' +
      (p.spin ? '<div id="spinBox" class="spinbox"><p class="muted small center">' + T('Chargement de la vue 360°…', 'Loading the 360° view…') + '</p></div>' : '') +
      (photos.length ? '<img id="gMain" class="gmain" src="' + photos[0] + '" alt="' + esc(pname(p)) + '">' + (photos.length > 1 ? '<div class="thumbs">' + photos.map(function (ph, i) { return '<img src="' + ph + '" data-g="' + i + '" class="' + (i ? '' : 'on') + '" alt="' + T('Photo ', 'Photo ') + (i + 1) + '">'; }).join('') + '</div>' : '') : '') +
      badge(c) +
      '<p class="price big">' + (pr !== p.price ? '<s>' + money(p.price) + '</s> ' : '') + money(pr) + ' F <span>/ ' + unit(p.unit) + '</span></p>' +
      (weighed(p) ? '<p class="note small">⚖️ ' + T('Prix au kilo : le poids réel est pesé à la préparation. Nous vous appelons si le total change.', 'Price per kilo: the real weight is measured when packing. We call you if the total changes.') + '</p>' : '') +
      '<table class="tbl spec">' +
      (p.ref ? '<tr><td>' + T('Référence(s) OEM', 'OEM number(s)') + '</td><td>' + esc(p.ref) + '</td></tr>' : '') +
      (p.cat === 'bmw' ? '<tr><td>' + T('Compatibilité', 'Fits') + '</td><td>' + (p.models && p.models.length ? esc(p.models.join(', ')) : (function () { var cs = window.BMW ? window.BMW.codesIn(p.name) : []; if (!cs.length) return T('Demandez-nous sur WhatsApp', 'Ask us on WhatsApp'); var ms = []; cs.forEach(function (c) { window.BMW.modelsOf(c).forEach(function (m) { if (ms.indexOf(m) < 0) ms.push(m); }); }); return esc(ms.join(', ') + ' (' + cs.join(', ') + ')'); })()) + (p.yearFrom || p.yearTo ? ' · ' + (p.yearFrom || '…') + '–' + (p.yearTo || '…') : '') + '</td></tr>' : '') +
      (p.cond && COND[p.cond] ? '<tr><td>' + T('État', 'Condition') + '</td><td>' + COND[p.cond][FR ? 0 : 1] + '</td></tr>' : '') +
      (p.warranty ? '<tr><td>' + T('Garantie', 'Warranty') + '</td><td>' + esc(p.warranty) + '</td></tr>' : '') +
      '<tr><td>' + T('Disponibilité', 'Availability') + '</td><td>' + (p.inStock === false ? T('Épuisé', 'Out of stock') : '✓ ' + T('En stock', 'In stock')) + '</td></tr></table>' +
      (p.desc ? '<p>' + esc(p.desc).replace(/\n/g, '<br>') + '</p>' : '') +
      (p.inStock === false ? '' : '<div id="pq">' + qtyCtl(p, cart[p.id] || 0) + '</div>') +
      (p.cat === 'bmw' ? '<a class="btn ghost dark wide" target="_blank" rel="noopener" href="https://wa.me/' + S.wa.bmw + '?text=' + encodeURIComponent(ask) + '">💬 ' + T('Vérifier la compatibilité sur WhatsApp', 'Check fit on WhatsApp') + '</a>' : '') +
      '<a class="btn ghost dark wide" target="_blank" rel="noopener" href="https://wa.me/?text=' + encodeURIComponent(share) + '">↗ ' + T('Partager ce produit', 'Share this product') + '</a>');
    if (p.spin && window.SPIN) window.SPIN.load(db, p.id).then(function (rows) { var bx = $('spinBox'); if (bx) { if (rows.length) window.SPIN.viewer(bx, rows, { alt: pname(p), hint: T('Glissez pour faire tourner', 'Drag to rotate') }); else bx.remove(); } }).catch(function () { var bx = $('spinBox'); if (bx) bx.remove(); });
    $('sheetIn').onclick = function (e) {
      var g = e.target.closest('[data-g]');
      if (g) { $('gMain').src = photos[+g.dataset.g]; [].forEach.call(document.querySelectorAll('.thumbs img'), function (t) { t.classList.toggle('on', t === g); }); return; }
      var b = e.target.closest('#pq button[data-a]');
      if (b) { bump(p.id, b.dataset.a === '+' ? 1 : -1); $('pq').innerHTML = qtyCtl(p, cart[p.id] || 0); render(); }
    };
  }

  // ---------- Panier ----------
  function lines() {
    return Object.keys(cart).map(function (id) { var p = products.filter(function (x) { return x.id === id; })[0]; return p ? { p: p, n: cart[id] } : null; }).filter(Boolean);
  }
  function updateCart() {
    var l = lines(), n = 0, t = 0;
    l.forEach(function (x) { n += x.n; t += x.n * price(x.p); });
    $('cartBtn').hidden = !n; $('cartN').textContent = n; $('cartT').textContent = money(t);
  }
  $('cartBtn').onclick = openCart;

  var DAY = 86400000;
  function deliveryDays() {
    var now = new Date(), out = [], d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (now.getHours() >= (S.cutoff || 12)) d = new Date(d.getTime() + DAY);
    while (out.length < (S.daysAhead || 4)) {
      if ((S.closedDays || []).indexOf(d.getDay()) < 0) out.push(new Date(d));
      d = new Date(d.getTime() + DAY);
    }
    return out;
  }
  function dayLabel(d) {
    var t = new Date(); t.setHours(0, 0, 0, 0);
    var diff = Math.round((d - t) / DAY);
    var name = d.toLocaleDateString(FR ? 'fr-FR' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
    return (diff === 0 ? T('Aujourd\'hui', 'Today') + ' · ' : diff === 1 ? T('Demain', 'Tomorrow') + ' · ' : '') + name;
  }
  function countdown() {
    var now = new Date(), cut = new Date(now); cut.setHours(S.cutoff || 12, 0, 0, 0);
    if (now >= cut || (S.closedDays || []).indexOf(now.getDay()) >= 0) return '';
    var m = Math.round((cut - now) / 60000), h = Math.floor(m / 60);
    return '⏱ ' + T('Commandez dans ', 'Order within ') + (h ? h + ' h ' : '') + (m % 60) + ' min ' + T('pour être livré aujourd\'hui.', 'for delivery today.');
  }
  function isPickup(z) { return z && /^retrait|^pickup/i.test(norm(z.name)); }

  function openCart() {
    var l = lines(); if (!l.length) { close(); return; }
    var sub = 0, wgh = false;
    var rows = l.map(function (x) {
      var s = x.n * price(x.p); sub += s; if (weighed(x.p)) wgh = true;
      return '<div class="cline"><div><b>' + esc(pname(x.p)) + '</b><br><small>' + money(price(x.p)) + ' F / ' + unit(x.p.unit) + '</small></div>' +
        '<div class="qty sm"><button data-c="-" data-id="' + x.p.id + '" aria-label="−">−</button><b>' + x.n + '</b><button data-c="+" data-id="' + x.p.id + '" aria-label="+">+</button></div>' +
        '<div class="r"><b>' + money(s) + ' F</b><br><button class="link" data-c="x" data-id="' + x.p.id + '">' + T('Retirer', 'Remove') + '</button></div></div>';
    }).join('');
    var days = deliveryDays(), cd = countdown(), min = +S.minOrder || 0;
    var req = ' <span class="req">*</span>', opt = ' <span class="opt">(' + T('facultatif', 'optional') + ')</span>';
    sheet('<div class="shead"><h3>' + T('Mon panier', 'My cart') + '</h3><button class="x" data-close aria-label="' + T('Fermer', 'Close') + '">✕</button></div>' + rows +
      '<div class="cline tot0"><span>' + T('Sous-total', 'Subtotal') + '</span><b>' + money(sub) + ' F</b></div>' +
      (wgh ? '<p class="note small">⚖️ ' + T('Les produits au kilo sont pesés à la préparation : nous vous appelons si le total change.', 'Items sold by the kilo are weighed when packing: we call you if the total changes.') + '</p>' : '') +
      (min && sub < min ? '<p class="note small">' + T('Montant minimum de commande : ', 'Minimum order: ') + money(min) + ' F</p>' : '') +
      '<form id="cf" class="form" novalidate><h4>' + T('Livraison', 'Delivery') + '</h4>' +
      '<label>' + T('Livraison ou retrait', 'Delivery or pickup') + req + '<select id="cZone">' + (S.zones || []).map(function (z, i) { return '<option value="' + i + '">' + esc(z.name) + (z.fee ? ' · ' + money(z.fee) + ' F' : '') + '</option>'; }).join('') + '</select></label>' +
      '<div class="row"><label>' + T('Jour', 'Day') + req + '<select id="cDay">' + days.map(function (d, i) { return '<option value="' + i + '">' + dayLabel(d) + '</option>'; }).join('') + '</select></label>' +
      '<label>' + T('Moment', 'Time') + req + '<select id="cSlot">' + (S.slots || []).map(function (s) { return '<option>' + esc(s) + '</option>'; }).join('') + '</select></label></div>' +
      (cd ? '<p class="small cd">' + cd + '</p>' : '') +
      '<label id="addrL">' + T('Adresse ou quartier', 'Address or area') + req + '<input id="cAddr" autocomplete="street-address" placeholder="' + T('Ex. Guédiawaye, près de la mairie', 'e.g. Guédiawaye, near the town hall') + '"></label>' +
      '<h4>' + T('Vos coordonnées', 'Your details') + '</h4>' +
      '<label>' + T('Votre nom', 'Your name') + req + '<input id="cName" autocomplete="name"></label>' +
      '<label>' + T('Téléphone (WhatsApp)', 'Phone (WhatsApp)') + req + '<input id="cPhone" type="tel" inputmode="tel" autocomplete="tel" placeholder="77 123 45 67"><small class="hint">' + T('Pour vous appeler et confirmer avant la livraison.', 'So we can call you to confirm before delivery.') + '</small></label>' +
      '<label>' + T('Remarque', 'Note') + opt + '<textarea id="cNote" rows="2"></textarea></label>' +
      '<fieldset><legend>' + T('Paiement', 'Payment') + req + '</legend><label class="rad"><input type="radio" name="pay" value="livraison" checked> ' + T('À la livraison (espèces ou Wave)', 'On delivery (cash or Wave)') + '</label>' +
      '<label class="rad"><input type="radio" name="pay" value="wave"> ' + T('Wave maintenant', 'Wave now') + ' · ' + esc(S.wave) + '</label></fieldset>' +
      '<label class="rad small"><input type="checkbox" id="cOk"> <span>' + T('J\'accepte les ', 'I accept the ') + '<a href="' + T('cgv.html', 'terms.html') + '" target="_blank">' + T('conditions de vente', 'terms of sale') + '</a>' + req + '</span></label>' +
      '<p id="cErr" class="err" role="alert"></p><p id="cTot" class="tot"></p><button class="btn wide" type="submit">' + T('Envoyer la commande', 'Send order') + '</button>' +
      '<p class="muted small center">🔒 ' + T('Aucun compte à créer. Rien n\'est payé avant notre appel de confirmation, sauf si vous choisissez Wave.', 'No account needed. Nothing is paid before our confirmation call, unless you choose Wave.') + '</p></form>');
    var tot = function () { var z = (S.zones || [])[$('cZone').value] || { fee: 0 }; $('addrL').hidden = isPickup(z); $('cTot').textContent = T('Total', 'Total') + ' : ' + money(sub + (z.fee || 0)) + ' F'; };
    $('cZone').onchange = tot; tot();
    var last = store.get('suns_me', {});
    if (last.name) $('cName').value = last.name; if (last.phone) $('cPhone').value = last.phone; if (last.addr) $('cAddr').value = last.addr;
    $('sheetIn').onclick = function (e) {
      var b = e.target.closest('[data-c]'); if (!b) return;
      if (b.dataset.c === 'x') { delete cart[b.dataset.id]; save(); } else bump(b.dataset.id, b.dataset.c === '+' ? 1 : -1);
      render(); openCart();
    };
    $('cf').onsubmit = function (e) { e.preventDefault(); submitCart(l, sub, days); };
  }

  function orderNo() {
    var d = new Date(), p = function (n) { return ('0' + n).slice(-2); }, r = '', c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for (var i = 0; i < 4; i++) r += c[Math.floor(Math.random() * c.length)];
    return 'C' + String(d.getFullYear()).slice(2) + p(d.getMonth() + 1) + p(d.getDate()) + '-' + r;
  }
  function fail(msg, field) { $('cErr').textContent = msg; if (field) { $(field).focus(); $(field).classList.add('bad'); } return null; }
  function iso(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }

  function submitCart(l, sub, days) {
    [].forEach.call(document.querySelectorAll('#cf .bad'), function (x) { x.classList.remove('bad'); });
    var z = (S.zones || [])[+$('cZone').value] || { name: '', fee: 0 }, pick = isPickup(z);
    var name = $('cName').value.trim(), phone = $('cPhone').value.trim(), addr = $('cAddr').value.trim();
    if (+S.minOrder && sub < +S.minOrder) return fail(T('Le montant minimum de commande est de ', 'Minimum order is ') + money(S.minOrder) + ' F.');
    if (!pick && addr.length < 3) return fail(T('Indiquez votre adresse ou votre quartier.', 'Enter your address or area.'), 'cAddr');
    if (name.length < 2) return fail(T('Indiquez votre nom.', 'Enter your name.'), 'cName');
    if (phone.replace(/\D/g, '').length < 7) return fail(T('Indiquez un numéro de téléphone valide, par exemple 77 123 45 67.', 'Enter a valid phone number, e.g. 77 123 45 67.'), 'cPhone');
    if (!$('cOk').checked) return fail(T('Cochez la case pour accepter les conditions de vente.', 'Tick the box to accept the terms of sale.'), 'cOk');
    store.set('suns_me', { name: name, phone: phone, addr: addr });
    var pay = document.querySelector('input[name=pay]:checked').value, day = days[+$('cDay').value], slot = $('cSlot').value;
    var groups = {}; l.forEach(function (x) { (groups[x.p.cat] = groups[x.p.cat] || []).push(x); });
    var done = [], btn = document.querySelector('#cf button[type=submit]');
    btn.disabled = true; btn.innerHTML = '<span class="spin"></span> ' + T('Envoi en cours…', 'Sending…');
    var slow = setTimeout(function () { $('cErr').textContent = T('La connexion est lente, patientez…', 'Slow connection, please wait…'); }, 8000);
    var jobs = Object.keys(groups).map(function (k, i) {
      var items = groups[k].map(function (x) { return { pid: x.p.id, name: x.p.name, ref: x.p.ref || '', unit: x.p.unit || 'piece', qty: x.n, price: price(x.p) }; });
      var s = items.reduce(function (a, it) { return a + it.qty * it.price; }, 0), f = i === 0 ? (z.fee || 0) : 0;
      var o = { no: orderNo(), type: 'commande', cat: k, items: items, subtotal: s, fee: f, total: s + f, zone: z.name, address: pick ? '' : addr.slice(0, 200), note: $('cNote').value.trim().slice(0, 500), pay: pay, date: iso(day), slot: slot, accept: true, name: name.slice(0, 80), phone: phone.slice(0, 25), lang: L, status: 'nouvelle', createdAt: Date.now() };
      return saveOrder(o).then(function () { done.push(o); });
    });
    Promise.all(jobs).then(function () { clearTimeout(slow); cart = {}; save(); render(); thanks(done); })
      .catch(function () { clearTimeout(slow); btn.disabled = false; btn.textContent = T('Envoyer la commande', 'Send order'); fail(T('La commande n\'a pas pu être envoyée. Vérifiez la connexion et réessayez.', 'The order could not be sent. Check your connection and try again.')); });
  }
  function saveOrder(o) {
    var b = db.batch();
    b.set(db.collection('orders').doc(), o);
    b.set(db.collection('track').doc(o.no), { status: 'nouvelle', type: o.type, cat: o.cat, total: o.total, date: o.date || '', slot: o.slot || '', zone: o.zone || '', ph4: String(o.phone).replace(/\D/g, '').slice(-4), createdAt: o.createdAt });
    return b.commit();
  }

  function waText(o) {
    var t = (o.type === 'devis' ? T('Demande de devis ', 'Quote request ') : T('Commande ', 'Order ')) + o.no + '\n';
    (o.items || []).forEach(function (it) { t += '• ' + it.qty + ' ' + unit(it.unit) + ' ' + it.name + (it.ref ? ' (' + it.ref + ')' : '') + ' : ' + money(it.qty * it.price) + ' F\n'; });
    if (o.type === 'devis') t += o.service + '\n' + o.details + '\n';
    else t += T('Total', 'Total') + ' : ' + money(o.total) + ' F · ' + (o.pay === 'wave' ? 'Wave' : T('paiement à la livraison', 'pay on delivery')) + '\n' + (o.date ? o.date + ' · ' + o.slot + '\n' : '');
    return t + o.name + ' · ' + o.phone + (o.zone ? '\n' + o.zone : '') + (o.address ? ' · ' + o.address : '');
  }
  function thanks(list) {
    var tr = T('suivi.html', 'track.html');
    sheet('<div class="shead"><h3>✅ ' + T('Merci, c\'est envoyé !', 'Thank you, it\'s sent!') + '</h3><button class="x" data-close aria-label="' + T('Fermer', 'Close') + '">✕</button></div>' +
      '<p>' + T('Nous vous appelons très vite pour confirmer. Gardez votre numéro de commande.', 'We will call you shortly to confirm. Keep your order number.') + '</p>' +
      list.map(function (o) {
        var c = catOf(o.cat), wa = (o.type === 'devis' && /BMW/.test(o.service) && S.wa.repair) || S.wa[o.cat] || S.wa.bmw;
        return '<div class="card mini"><p class="small muted">' + c.ico + ' ' + esc(FR ? c.fr : c.en) + '</p><p class="ono">N° ' + o.no + '</p>' +
          (o.total ? '<p><b>' + money(o.total) + ' F</b>' + (o.date ? ' · ' + esc(o.date) + ', ' + esc(o.slot) : '') + '</p>' : '') +
          (o.pay === 'wave' ? '<p class="note small">' + T('Envoyez le paiement Wave au ', 'Send the Wave payment to ') + '<b>' + esc(S.wave) + '</b>' + T(' en indiquant le numéro de commande.', ' with your order number.') + '</p>' : '') +
          '<a class="btn wide" target="_blank" rel="noopener" href="https://wa.me/' + wa + '?text=' + encodeURIComponent(waText(o)) + '">💬 ' + T('Envoyer aussi sur WhatsApp', 'Also send on WhatsApp') + '</a>' +
          '<a class="btn ghost dark wide" href="' + tr + '#' + o.no + '">📦 ' + T('Suivre cette commande', 'Track this order') + '</a></div>';
      }).join(''));
  }

  // ---------- Devis ----------
  function renderDevis() {
    if ($('devis').dataset.ok) return; $('devis').dataset.ok = 1;
    var svc = FR ? ['Transport de marchandises', 'Location de véhicule', 'Réparation / entretien BMW', 'Transit et logistique', 'Autre'] : ['Goods transport', 'Vehicle rental', 'BMW repair / service', 'Freight forwarding', 'Other'];
    var me = store.get('suns_me', {});
    $('devis').innerHTML = '<div class="card"><h3>' + T('Demander un devis', 'Request a quote') + '</h3><p class="muted">' + T('Décrivez votre besoin : nous vous répondons avec un prix, sans engagement.', 'Describe what you need: we reply with a price, no commitment.') + '</p>' +
      '<form id="df" class="form" novalidate><label>' + T('Service', 'Service') + '<select id="dSvc">' + svc.map(function (s) { return '<option>' + s + '</option>'; }).join('') + '</select></label>' +
      '<label>' + T('Détails : trajet, date, marchandise, modèle et année de la BMW…', 'Details: route, date, goods, BMW model and year…') + '<textarea id="dDet" rows="4"></textarea></label>' +
      '<label>' + T('Votre nom', 'Your name') + '<input id="dName" autocomplete="name" value="' + esc(me.name) + '"></label>' +
      '<label>' + T('Téléphone (WhatsApp)', 'Phone (WhatsApp)') + '<input id="dPhone" type="tel" autocomplete="tel" value="' + esc(me.phone) + '"><small class="hint">' + T('Pour vous envoyer le devis.', 'To send you the quote.') + '</small></label>' +
      '<p id="dErr" class="err" role="alert"></p><button class="btn wide" type="submit">' + T('Envoyer la demande', 'Send request') + '</button></form></div>';
    $('df').onsubmit = function (e) {
      e.preventDefault();
      var det = $('dDet').value.trim(), name = $('dName').value.trim(), phone = $('dPhone').value.trim();
      if (det.length < 5) { $('dErr').textContent = T('Décrivez votre besoin.', 'Describe your need.'); return; }
      if (name.length < 2 || phone.replace(/\D/g, '').length < 7) { $('dErr').textContent = T('Indiquez votre nom et un téléphone valide.', 'Enter your name and a valid phone.'); return; }
      store.set('suns_me', { name: name, phone: phone, addr: (store.get('suns_me', {}).addr || '') });
      var svcName = $('dSvc').value, k = /BMW/.test(svcName) ? 'bmw' : 'transport';
      var o = { no: orderNo(), type: 'devis', cat: k, items: [], subtotal: 0, fee: 0, total: 0, zone: '', address: '', note: '', pay: '', service: svcName, details: det.slice(0, 1000), accept: true, name: name.slice(0, 80), phone: phone.slice(0, 25), lang: L, status: 'nouvelle', createdAt: Date.now() };
      if (!db) { thanks([o]); return; }
      var b = document.querySelector('#df button'); b.disabled = true;
      saveOrder(o).then(function () { $('dDet').value = ''; b.disabled = false; thanks([o]); })
        .catch(function () { b.disabled = false; $('dErr').textContent = T('Envoi impossible. Réessayez.', 'Could not send. Try again.'); });
    };
  }
  render();
  boot();
})();
