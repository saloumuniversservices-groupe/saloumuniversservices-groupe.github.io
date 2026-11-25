(function () {
  var $ = function (id) { return document.getElementById(id); };
  var app = $('app'), CATS = window.SHOP_CATS, UNITS = window.SHOP_UNITS;
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var money = function (n) { return Math.round(n || 0).toLocaleString('fr-FR').replace(/ | /g, ' '); };
  var catName = function (id) { var c = CATS.filter(function (x) { return x.id === id; })[0]; return c ? c.ico + ' ' + c.fr : id; };
  var STAT = [['nouvelle', 'Nouvelle'], ['confirmee', 'Confirmée'], ['livree', 'Livrée'], ['payee', 'Payée'], ['annulee', 'Annulée']];
  var statName = function (s) { var x = STAT.filter(function (a) { return a[0] === s; })[0]; return x ? x[1] : s; };

  if (!window.SHOP_FIREBASE) {
    app.innerHTML = '<div class="card"><h3>Boutique pas encore branchée</h3><p>Le projet Firebase de la boutique n\'est pas encore configuré (fichier js/config.js).</p></div>';
    return;
  }
  firebase.initializeApp(window.SHOP_FIREBASE);
  var auth = firebase.auth(), db = firebase.firestore();
  var me = null, owner = false, view = 'orders', orders = [], products = [], S = JSON.parse(JSON.stringify(window.SHOP_DEFAULTS)), unsub = [];
  var fo = { st: 'nouvelle', cat: '', q: '' }, fp = { cat: 'bmw', q: '' };

  auth.getRedirectResult().catch(function (e) { msg('Connexion impossible : ' + e.message); });
  auth.onAuthStateChanged(function (u) {
    unsub.forEach(function (f) { f(); }); unsub = [];
    me = u; $('logout').hidden = !u; $('who').textContent = u ? u.email : '';
    if (!u) { login(); return; }
    owner = (u.email || '').toLowerCase() === window.SHOP_OWNER;
    var go = function () { start(); };
    if (owner) { go(); return; }
    db.collection('admins').doc((u.email || '').toLowerCase()).get().then(function (d) { if (d.exists) go(); else denied(); }).catch(denied);
  });
  $('logout').onclick = function (e) { e.preventDefault(); auth.signOut(); };

  function msg(t) { app.innerHTML = '<div class="card"><p>' + esc(t) + '</p></div>'; }
  function login() {
    app.innerHTML = '<div class="card center"><h3>Espace administration</h3><p class="muted">Connectez-vous avec le compte Google autorisé.</p><button class="btn" id="g">Se connecter avec Google</button></div>';
    $('g').onclick = function () {
      var p = new firebase.auth.GoogleAuthProvider();
      auth.signInWithPopup(p).catch(function (e) {
        if (e && (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment')) auth.signInWithRedirect(p);
        else if (e && e.code !== 'auth/popup-closed-by-user') msg('Connexion impossible : ' + e.message);
      });
    };
  }
  function denied() { app.innerHTML = '<div class="card"><h3>Accès refusé</h3><p>Le compte ' + esc(me.email) + ' n\'est pas administrateur de la boutique. Demandez au responsable de vous ajouter.</p></div>'; }

  function start() {
    unsub.push(db.collection('settings').doc('shop').onSnapshot(function (d) { if (d.exists) { var v = d.data(); for (var k in v) S[k] = v[k]; } if (view === 'settings') draw(); }));
    unsub.push(db.collection('orders').orderBy('createdAt', 'desc').limit(300).onSnapshot(function (qs) { orders = qs.docs.map(function (d) { var o = d.data(); o.id = d.id; return o; }); if (view === 'orders') draw(); }, function (e) { msg('Lecture des commandes refusée : ' + e.message); }));
    unsub.push(db.collection('products').onSnapshot(function (qs) { products = qs.docs.map(function (d) { var p = d.data(); p.id = d.id; return p; }); products.sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); }); if (view === 'products') draw(); }));
    draw();
  }

  function tabs() {
    var t = [['orders', 'Commandes'], ['products', 'Produits'], ['settings', 'Réglages']];
    if (owner) t.push(['admins', 'Administrateurs']);
    var nNew = orders.filter(function (o) { return o.status === 'nouvelle'; }).length;
    return '<div class="tabs">' + t.map(function (x) { return '<button data-v="' + x[0] + '" class="' + (view === x[0] ? 'on' : '') + '">' + x[1] + (x[0] === 'orders' && nNew ? ' (' + nNew + ')' : '') + '</button>'; }).join('') + '</div>';
  }
  function draw() {
    var h = tabs();
    if (view === 'orders') h += drawOrders();
    else if (view === 'products') h += drawProducts();
    else if (view === 'settings') h += drawSettings();
    else h += '<div id="adm"><p class="muted">Chargement…</p></div>';
    var keep = document.activeElement && document.activeElement.id === 'q' ? { v: $('q').value, s: $('q').selectionStart } : null;
    app.innerHTML = h;
    if (keep && $('q')) { $('q').focus(); try { $('q').setSelectionRange(keep.s, keep.s); } catch (e) {} }
    if (view === 'admins') loadAdmins();
  }
  app.onclick = function (e) {
    var b = e.target.closest('[data-v]'); if (b) { view = b.dataset.v; draw(); return; }
    b = e.target.closest('[data-fs]'); if (b) { fo.st = b.dataset.fs; draw(); return; }
    b = e.target.closest('[data-fc]'); if (b) { fo.cat = b.dataset.fc; draw(); return; }
    b = e.target.closest('[data-pc]'); if (b) { fp.cat = b.dataset.pc; draw(); return; }
    b = e.target.closest('[data-st]'); if (b) { setStatus(b.dataset.id, b.dataset.st); return; }
    b = e.target.closest('[data-edit]'); if (b) { editProduct(products.filter(function (p) { return p.id === b.dataset.edit; })[0]); return; }
    b = e.target.closest('#newP'); if (b) { editProduct(null); return; }
    b = e.target.closest('[data-rmadm]'); if (b) { if (confirm('Retirer ' + b.dataset.rmadm + ' des administrateurs ?')) db.collection('admins').doc(b.dataset.rmadm).delete().then(loadAdmins); return; }
  };
  app.oninput = function (e) {
    if (e.target.id === 'q') { if (view === 'orders') fo.q = e.target.value; else fp.q = e.target.value; draw(); }
  };

  function chips(list, cur, attr) { return '<div class="chips">' + list.map(function (x) { return '<button ' + attr + '="' + x[0] + '" class="' + (cur === x[0] ? 'on' : '') + '">' + x[1] + '</button>'; }).join('') + '</div>'; }

  // ---------- Commandes ----------
  function drawOrders() {
    var q = fo.q.trim().toLowerCase();
    var cnt = function (s) { return orders.filter(function (o) { return o.status === s; }).length; };
    var l = orders.filter(function (o) {
      if (fo.st && o.status !== fo.st) return false;
      if (fo.cat && o.cat !== fo.cat) return false;
      if (q && [o.no, o.name, o.phone, o.address, o.service, o.details, (o.items || []).map(function (i) { return i.name + ' ' + i.ref; }).join(' ')].join(' ').toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    return chips([['', 'Toutes (' + orders.length + ')']].concat(STAT.map(function (s) { return [s[0], s[1] + ' (' + cnt(s[0]) + ')']; })), fo.st, 'data-fs') +
      chips([['', 'Tous les rayons']].concat(CATS.map(function (c) { return [c.id, c.ico + ' ' + c.fr]; })), fo.cat, 'data-fc') +
      '<input id="q" class="search" type="search" placeholder="Rechercher : numéro, nom, téléphone, produit…" value="' + esc(fo.q) + '">' +
      (l.length ? l.map(orderCard).join('') : '<p class="muted">Aucune commande pour ces filtres.</p>');
  }
  function orderCard(o) {
    var d = new Date(o.createdAt || 0), wa = String(o.phone || '').replace(/\D/g, '');
    if (wa.length === 9) wa = '221' + wa;
    return '<div class="card order st-' + o.status + '"><div class="ohead"><b>' + esc(o.no) + '</b><span class="pill">' + statName(o.status) + '</span></div>' +
      '<p class="muted small">' + catName(o.cat) + ' · ' + (o.type === 'devis' ? 'Demande de devis' : 'Commande') + ' · ' + d.toLocaleString('fr-FR') + '</p>' +
      (o.type === 'devis' ? '<p><b>' + esc(o.service) + '</b><br>' + esc(o.details) + '</p>' :
        '<table class="tbl">' + (o.items || []).map(function (i) { return '<tr><td>' + i.qty + ' × ' + esc(i.name) + (i.ref ? ' <small>(' + esc(i.ref) + ')</small>' : '') + '</td><td class="r">' + money(i.qty * i.price) + ' F</td></tr>'; }).join('') +
        (o.fee ? '<tr><td>Livraison</td><td class="r">' + money(o.fee) + ' F</td></tr>' : '') + '<tr><td><b>Total</b></td><td class="r"><b>' + money(o.total) + ' F</b></td></tr></table>' +
        '<p class="small">' + (o.pay === 'wave' ? 'Paiement Wave' : 'Paiement à la livraison') + (o.zone ? ' · ' + esc(o.zone) : '') + (o.address ? ' · ' + esc(o.address) : '') + '</p>') +
      (o.note ? '<p class="small">Remarque : ' + esc(o.note) + '</p>' : '') +
      '<p><b>' + esc(o.name) + '</b> · <a href="tel:' + esc(o.phone) + '">' + esc(o.phone) + '</a> · <a target="_blank" rel="noopener" href="https://wa.me/' + wa + '?text=' + encodeURIComponent('Bonjour ' + o.name + ', ici Saloum Univers Services Groupe au sujet de votre ' + (o.type === 'devis' ? 'demande ' : 'commande ') + o.no + '.') + '">WhatsApp</a></p>' +
      '<div class="chips">' + STAT.filter(function (s) { return s[0] !== o.status; }).map(function (s) { return '<button data-st="' + s[0] + '" data-id="' + o.id + '">' + s[1] + '</button>'; }).join('') + '</div></div>';
  }
  function setStatus(id, st) {
    if (st === 'annulee' && !confirm('Annuler cette commande ?')) return;
    db.collection('orders').doc(id).update({ status: st, statusAt: Date.now(), statusBy: me.email }).catch(function (e) { alert('Refusé : ' + e.message); });
  }

  // ---------- Produits ----------
  function drawProducts() {
    var q = fp.q.trim().toLowerCase();
    var cats = CATS.filter(function (c) { return c.id !== 'transport'; });
    var l = products.filter(function (p) { return p.cat === fp.cat && (!q || [p.name, p.nameEn, p.ref, p.desc].join(' ').toLowerCase().indexOf(q) >= 0); });
    return chips(cats.map(function (c) { return [c.id, c.ico + ' ' + c.fr + ' (' + products.filter(function (p) { return p.cat === c.id; }).length + ')']; }), fp.cat, 'data-pc') +
      '<div class="row"><input id="q" class="search" type="search" placeholder="Rechercher un produit, une référence…" value="' + esc(fp.q) + '"><button class="btn" id="newP">+ Produit</button></div>' +
      (l.length ? '<div class="plist">' + l.map(function (p) {
        return '<div class="card prow" data-edit="' + p.id + '">' + (p.photo ? '<img src="' + p.photo + '" alt="">' : '<div class="noimg">' + (CATS.filter(function (c) { return c.id === p.cat; })[0] || {}).ico + '</div>') +
          '<div><b>' + esc(p.name) + '</b>' + (p.ref ? '<br><small>' + esc(p.ref) + '</small>' : '') + '<br>' + (p.promo > 0 ? '<s>' + money(p.price) + '</s> ' + money(p.promo) : money(p.price)) + ' F / ' + (UNITS[p.unit] || UNITS.piece)[0] +
          '<br>' + (p.visible === false ? '<span class="pill grey">Caché</span> ' : '') + (p.inStock === false ? '<span class="pill red">Épuisé</span>' : '<span class="pill green">En stock</span>') + '</div></div>';
      }).join('') + '</div>' : '<p class="muted">Aucun produit dans ce rayon. Touchez « + Produit ».</p>');
  }
  var sheet = function (h) { $('sheetIn').innerHTML = h; $('sheet').hidden = false; document.body.style.overflow = 'hidden'; };
  var closeS = function () { $('sheet').hidden = true; document.body.style.overflow = ''; };
  $('sheet').onclick = function (e) { if (e.target.id === 'sheet' || e.target.closest('[data-close]')) closeS(); };

  function editProduct(p) {
    var isNew = !p; p = p || { cat: fp.cat === 'transport' ? 'bmw' : fp.cat, unit: fp.cat === 'bmw' ? 'piece' : 'kg', inStock: true, visible: true, price: 0, promo: 0 };
    var photo = p.photo || '';
    sheet('<div class="shead"><h3>' + (isNew ? 'Nouveau produit' : 'Modifier le produit') + '</h3><button class="x" data-close>✕</button></div><form id="pf" class="form">' +
      '<label>Rayon<select id="pCat">' + CATS.filter(function (c) { return c.id !== 'transport'; }).map(function (c) { return '<option value="' + c.id + '"' + (c.id === p.cat ? ' selected' : '') + '>' + c.ico + ' ' + c.fr + '</option>'; }).join('') + '</select></label>' +
      '<label>Nom du produit<input id="pName" required value="' + esc(p.name) + '"></label>' +
      '<label>Nom en anglais (facultatif)<input id="pNameEn" value="' + esc(p.nameEn) + '"></label>' +
      '<label>Référence / modèle compatible (facultatif)<input id="pRef" value="' + esc(p.ref) + '" placeholder="Ex. 11 42 7 953 129 · Série 3 E90"></label>' +
      '<label>Description (facultatif)<textarea id="pDesc" rows="2">' + esc(p.desc) + '</textarea></label>' +
      '<div class="row"><label>Prix (F)<input id="pPrice" type="number" min="0" inputmode="numeric" required value="' + (p.price || '') + '"></label>' +
      '<label>Prix promo (F)<input id="pPromo" type="number" min="0" inputmode="numeric" value="' + (p.promo || '') + '"></label></div>' +
      '<label>Vendu par<select id="pUnit">' + Object.keys(UNITS).map(function (k) { return '<option value="' + k + '"' + (k === p.unit ? ' selected' : '') + '>' + UNITS[k][0] + '</option>'; }).join('') + '</select></label>' +
      '<label class="rad"><input type="checkbox" id="pStock"' + (p.inStock !== false ? ' checked' : '') + '> En stock</label>' +
      '<label class="rad"><input type="checkbox" id="pVis"' + (p.visible !== false ? ' checked' : '') + '> Visible sur le site</label>' +
      '<label>Photo<input id="pPhoto" type="file" accept="image/*"></label><div id="prev">' + (photo ? '<img src="' + photo + '" class="prev">' : '') + '</div>' +
      '<button class="btn wide" type="submit">Enregistrer</button>' + (isNew ? '' : '<button class="btn ghost wide danger" type="button" id="pDel">Supprimer ce produit</button>') + '</form>');
    $('pPhoto').onchange = function () {
      var f = this.files[0]; if (!f) return;
      shrink(f, function (d) { photo = d; $('prev').innerHTML = '<img src="' + d + '" class="prev">'; });
    };
    if (!isNew) $('pDel').onclick = function () { if (confirm('Supprimer « ' + p.name + ' » ?')) db.collection('products').doc(p.id).delete().then(closeS); };
    $('pf').onsubmit = function (e) {
      e.preventDefault();
      var price = Math.max(0, +$('pPrice').value || 0), promo = Math.max(0, +$('pPromo').value || 0);
      if (!$('pName').value.trim() || price <= 0) { alert('Indiquez le nom et le prix.'); return; }
      var d = { cat: $('pCat').value, name: $('pName').value.trim(), nameEn: $('pNameEn').value.trim(), ref: $('pRef').value.trim(), desc: $('pDesc').value.trim(),
        price: price, promo: promo > 0 && promo < price ? promo : 0, unit: $('pUnit').value, inStock: $('pStock').checked, visible: $('pVis').checked, photo: photo, updatedAt: Date.now(), updatedBy: me.email };
      var b = e.target.querySelector('button[type=submit]'); b.disabled = true; b.textContent = 'Enregistrement…';
      var w = isNew ? db.collection('products').add(Object.assign(d, { createdAt: Date.now() })) : db.collection('products').doc(p.id).set(d, { merge: true });
      w.then(function () { fp.cat = d.cat; closeS(); draw(); }).catch(function (err) { b.disabled = false; b.textContent = 'Enregistrer'; alert('Refusé : ' + err.message); });
    };
  }
  function shrink(file, cb) {
    var img = new Image(), url = URL.createObjectURL(file);
    img.onload = function () {
      var m = 640, w = img.width, h = img.height, k = Math.min(1, m / Math.max(w, h));
      var c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      cb(c.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = function () { alert('Image illisible.'); };
    img.src = url;
  }

  // ---------- Réglages ----------
  function drawSettings() {
    var wa = S.wa || {};
    var num = function (id, lab) { return '<label>' + lab + '<input id="w_' + id + '" inputmode="tel" value="' + esc(wa[id] || '') + '" placeholder="221771234567"></label>'; };
    return '<form id="sf" class="card form"><h3>WhatsApp qui reçoit les commandes</h3><p class="muted small">Numéro avec l\'indicatif, sans + ni espaces (ex. 221779483690).</p>' +
      num('bmw', '🚗 Pièces BMW') + num('agro', '🌱 Fruits et légumes') + num('agro2', '🌱 Fruits et légumes (2e numéro)') + num('tilapia', '🐟 Tilapias') + num('transport', '🚚 Transport et services') + num('repair', '🔧 Technique et réparation BMW') + num('repair2', '🔧 Technique et réparation (2e numéro)') +
      '<label>Numéro Wave pour les paiements<input id="sWave" value="' + esc(S.wave) + '"></label>' +
      '<h3>Zones de livraison</h3><p class="muted small">Une zone par ligne : nom ; frais en F (0 = gratuit ou à confirmer).</p>' +
      '<textarea id="sZones" rows="5">' + esc((S.zones || []).map(function (z) { return z.name + ' ; ' + (z.fee || 0); }).join('\n')) + '</textarea>' +
      '<label>Message affiché en haut de la boutique (facultatif)<input id="sNotice" value="' + esc(S.notice) + '" placeholder="Ex. Livraison gratuite ce week-end à Dakar"></label>' +
      '<button class="btn wide" type="submit">Enregistrer les réglages</button></form>';
  }
  document.addEventListener('submit', function (e) {
    if (e.target.id !== 'sf') return; e.preventDefault();
    var wa = {}; ['bmw', 'agro', 'agro2', 'tilapia', 'transport', 'repair', 'repair2'].forEach(function (k) { wa[k] = $('w_' + k).value.replace(/\D/g, ''); });
    var zones = $('sZones').value.split('\n').map(function (l) { var p = l.split(';'); return { name: (p[0] || '').trim(), fee: Math.max(0, parseInt((p[1] || '0').replace(/\D/g, ''), 10) || 0) }; }).filter(function (z) { return z.name; });
    db.collection('settings').doc('shop').set({ wa: wa, wave: $('sWave').value.trim(), zones: zones, notice: $('sNotice').value.trim(), updatedAt: Date.now(), updatedBy: me.email }, { merge: true })
      .then(function () { alert('Réglages enregistrés.'); }).catch(function (err) { alert('Refusé : ' + err.message); });
  });

  // ---------- Administrateurs ----------
  function loadAdmins() {
    db.collection('admins').get().then(function (qs) {
      var l = qs.docs.map(function (d) { return d.id; });
      $('adm').innerHTML = '<div class="card"><h3>Administrateurs</h3><p class="muted small">Ils se connectent avec leur compte Google. Le responsable (' + esc(window.SHOP_OWNER) + ') a toujours accès.</p>' +
        (l.length ? '<table class="tbl">' + l.map(function (m) { return '<tr><td>' + esc(m) + '</td><td class="r"><button class="link" data-rmadm="' + esc(m) + '">Retirer</button></td></tr>'; }).join('') + '</table>' : '<p class="muted">Aucun autre administrateur.</p>') +
        '<form id="af" class="row"><input id="aMail" type="email" placeholder="adresse Gmail" required><button class="btn">Ajouter</button></form></div>';
      $('af').onsubmit = function (e) {
        e.preventDefault(); var m = $('aMail').value.trim().toLowerCase(); if (!m) return;
        db.collection('admins').doc(m).set({ addedBy: me.email, addedAt: Date.now() }).then(loadAdmins).catch(function (err) { alert('Refusé : ' + err.message); });
      };
    }).catch(function (e) { $('adm').innerHTML = '<p class="muted">Lecture refusée : ' + esc(e.message) + '</p>'; });
  }
})();
