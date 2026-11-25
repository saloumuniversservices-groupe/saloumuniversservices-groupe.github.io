(function () {
  var root = document.getElementById('shop'); if (!root) return;
  var L = root.dataset.lang === 'en' ? 'en' : 'fr', FR = L === 'fr';
  var T = function (fr, en) { return FR ? fr : en; };
  var CATS = window.SHOP_CATS, UNITS = window.SHOP_UNITS;
  var S = JSON.parse(JSON.stringify(window.SHOP_DEFAULTS));
  var products = [], cat = 'bmw', cart = {}, db = null;
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var money = function (n) { return Math.round(n || 0).toLocaleString('fr-FR').replace(/ | /g, ' '); };
  var unit = function (u) { var x = UNITS[u] || UNITS.piece; return FR ? x[0] : x[1]; };
  var price = function (p) { return p.promo > 0 && p.promo < p.price ? p.promo : p.price; };
  try { cart = JSON.parse(localStorage.getItem('suns_cart') || '{}') || {}; } catch (e) { cart = {}; }
  var save = function () { try { localStorage.setItem('suns_cart', JSON.stringify(cart)); } catch (e) {} };

  // Onglets des rayons
  $('tabs').innerHTML = CATS.map(function (c) { return '<button data-c="' + c.id + '">' + c.ico + ' ' + esc(FR ? c.fr : c.en) + '</button>'; }).join('');
  $('tabs').onclick = function (e) { var b = e.target.closest('button'); if (!b) return; cat = b.dataset.c; render(); };
  $('q').oninput = render;
  if (location.hash && CATS.some(function (c) { return '#' + c.id === location.hash; })) cat = location.hash.slice(1);

  if (!window.SHOP_FIREBASE) {
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
    products = qs.docs.map(function (d) { var p = d.data(); p.id = d.id; return p; });
    products.sort(function (a, b) { return (a.order || 0) - (b.order || 0) || String(a.name).localeCompare(String(b.name)); });
    for (var id in cart) if (!products.some(function (p) { return p.id === id; })) delete cart[id];
    render();
  }, function () { $('list').innerHTML = '<p class="muted">' + T('Impossible de charger les produits. Vérifiez la connexion.', 'Could not load products. Check your connection.') + '</p>'; });

  function waButtons() {
    return '<div class="cta">' + CATS.map(function (c) { var n = S.wa[c.id]; return n ? '<a class="btn small" href="https://wa.me/' + n + '">' + c.ico + ' ' + esc(FR ? c.fr : c.en) + '</a>' : ''; }).join('') + (S.wa.repair ? '<a class="btn small" href="https://wa.me/' + S.wa.repair + '">🔧 ' + T('Réparation BMW', 'BMW repair') + '</a>' : '') + '</div>';
  }

  function render() {
    [].forEach.call($('tabs').children, function (b) { b.classList.toggle('on', b.dataset.c === cat); });
    var dv = cat === 'transport';
    $('devis').hidden = !dv; $('q').hidden = dv; $('list').hidden = dv;
    if (dv) { renderDevis(); updateCart(); return; }
    if (!db) { updateCart(); return; }
    var q = $('q').value.trim().toLowerCase();
    var l = products.filter(function (p) {
      if (p.cat !== cat) return false;
      if (!q) return true;
      return [p.name, p.nameEn, p.ref, p.desc].join(' ').toLowerCase().indexOf(q) >= 0;
    });
    $('list').innerHTML = l.length ? l.map(card).join('') : '<p class="muted">' + (q ? T('Aucun produit ne correspond à la recherche.', 'No product matches your search.') : T('Pas encore de produit dans ce rayon. Écrivez-nous sur WhatsApp.', 'No product here yet. Message us on WhatsApp.')) + '</p>';
    updateCart();
  }

  function card(p) {
    var n = cart[p.id] || 0, out = p.inStock === false, pr = price(p);
    var name = FR || !p.nameEn ? p.name : p.nameEn;
    return '<div class="pcard' + (out ? ' out' : '') + '">' +
      (p.photo ? '<img src="' + p.photo + '" alt="' + esc(name) + '" loading="lazy">' : '<div class="noimg">' + (CATS.filter(function (c) { return c.id === p.cat; })[0] || {}).ico + '</div>') +
      '<div class="pbody"><h3>' + esc(name) + '</h3>' +
      (p.ref ? '<p class="ref">' + esc(p.ref) + '</p>' : '') +
      (p.desc ? '<p class="pdesc">' + esc(p.desc) + '</p>' : '') +
      '<p class="price">' + (pr !== p.price ? '<s>' + money(p.price) + '</s> ' : '') + money(pr) + ' F <span>/ ' + unit(p.unit) + '</span></p>' +
      (out ? '<p class="oos">' + T('Épuisé', 'Out of stock') + '</p>' :
        n ? '<div class="qty"><button data-a="-" data-id="' + p.id + '">−</button><b>' + n + '</b><button data-a="+" data-id="' + p.id + '">+</button></div>'
          : '<button class="btn add" data-a="+" data-id="' + p.id + '">' + T('Ajouter au panier', 'Add to cart') + '</button>') +
      '</div></div>';
  }
  $('list').onclick = function (e) {
    var b = e.target.closest('button[data-a]'); if (!b) return;
    var id = b.dataset.id; cart[id] = Math.max(0, (cart[id] || 0) + (b.dataset.a === '+' ? 1 : -1));
    if (!cart[id]) delete cart[id]; save(); render();
  };

  function lines() {
    return Object.keys(cart).map(function (id) { var p = products.filter(function (x) { return x.id === id; })[0]; return p ? { p: p, n: cart[id] } : null; }).filter(Boolean);
  }
  function updateCart() {
    var l = lines(), n = 0, t = 0;
    l.forEach(function (x) { n += x.n; t += x.n * price(x.p); });
    $('cartBtn').hidden = !n; $('cartN').textContent = n; $('cartT').textContent = money(t);
  }
  $('cartBtn').onclick = openCart;

  function sheet(html) { $('sheetIn').innerHTML = html; $('sheet').hidden = false; document.body.style.overflow = 'hidden'; }
  function close() { $('sheet').hidden = true; document.body.style.overflow = ''; }
  $('sheet').onclick = function (e) { if (e.target.id === 'sheet' || e.target.closest('[data-close]')) close(); };

  function zoneOpts() { return (S.zones || []).map(function (z, i) { return '<option value="' + i + '">' + esc(z.name) + (z.fee ? ' · ' + money(z.fee) + ' F' : '') + '</option>'; }).join(''); }
  function custFields(x) {
    return '<label>' + T('Votre nom', 'Your name') + '<input id="' + x + 'Name" autocomplete="name" required></label>' +
      '<label>' + T('Téléphone (WhatsApp)', 'Phone (WhatsApp)') + '<input id="' + x + 'Phone" type="tel" autocomplete="tel" required></label>';
  }
  function openCart() {
    var l = lines(); if (!l.length) return;
    var sub = 0;
    var rows = l.map(function (x) { var s = x.n * price(x.p); sub += s; return '<tr><td>' + esc(FR || !x.p.nameEn ? x.p.name : x.p.nameEn) + '<br><small>' + x.n + ' ' + unit(x.p.unit) + ' × ' + money(price(x.p)) + ' F</small></td><td class="r">' + money(s) + ' F</td></tr>'; }).join('');
    sheet('<div class="shead"><h3>' + T('Mon panier', 'My cart') + '</h3><button class="x" data-close>✕</button></div>' +
      '<table class="tbl">' + rows + '<tr><td>' + T('Sous-total', 'Subtotal') + '</td><td class="r"><b>' + money(sub) + ' F</b></td></tr></table>' +
      '<form id="cf" class="form">' + custFields('c') +
      '<label>' + T('Livraison', 'Delivery') + '<select id="cZone">' + zoneOpts() + '</select></label>' +
      '<label>' + T('Adresse ou quartier', 'Address or area') + '<input id="cAddr" autocomplete="street-address"></label>' +
      '<label>' + T('Remarque (facultatif)', 'Note (optional)') + '<textarea id="cNote" rows="2"></textarea></label>' +
      '<fieldset><legend>' + T('Paiement', 'Payment') + '</legend><label class="rad"><input type="radio" name="pay" value="livraison" checked> ' + T('À la livraison', 'On delivery') + '</label>' +
      '<label class="rad"><input type="radio" name="pay" value="wave"> Wave · ' + esc(S.wave) + '</label></fieldset>' +
      '<p id="cTot" class="tot"></p><button class="btn wide" type="submit">' + T('Envoyer la commande', 'Send order') + '</button><p class="muted small">' + T('Nous vous appelons pour confirmer avant la livraison.', 'We will call you to confirm before delivery.') + '</p></form>');
    var tot = function () { var z = (S.zones || [])[$('cZone').value] || { fee: 0 }; $('cTot').textContent = T('Total', 'Total') + ' : ' + money(sub + (z.fee || 0)) + ' F'; };
    $('cZone').onchange = tot; tot();
    $('cf').onsubmit = function (e) { e.preventDefault(); submitCart(l); };
  }

  function orderNo() {
    var d = new Date(), p = function (n) { return ('0' + n).slice(-2); };
    var r = ''; var c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; for (var i = 0; i < 4; i++) r += c[Math.floor(Math.random() * c.length)];
    return 'C' + String(d.getFullYear()).slice(2) + p(d.getMonth() + 1) + p(d.getDate()) + '-' + r;
  }
  function customer(x) {
    var name = $(x + 'Name').value.trim(), phone = $(x + 'Phone').value.trim();
    if (name.length < 2 || phone.replace(/\D/g, '').length < 7) { alert(T('Indiquez votre nom et un numéro de téléphone valide.', 'Enter your name and a valid phone number.')); return null; }
    return { name: name.slice(0, 80), phone: phone.slice(0, 25) };
  }

  function submitCart(l) {
    var c = customer('c'); if (!c) return;
    var zi = +$('cZone').value, z = (S.zones || [])[zi] || { name: '', fee: 0 };
    var pay = document.querySelector('input[name=pay]:checked').value;
    var groups = {};
    l.forEach(function (x) { (groups[x.p.cat] = groups[x.p.cat] || []).push(x); });
    var keys = Object.keys(groups), fee = z.fee || 0, done = [], btn = document.querySelector('#cf button[type=submit]');
    btn.disabled = true; btn.textContent = T('Envoi…', 'Sending…');
    var jobs = keys.map(function (k, i) {
      var items = groups[k].map(function (x) { return { pid: x.p.id, name: x.p.name, ref: x.p.ref || '', unit: x.p.unit || 'piece', qty: x.n, price: price(x.p) }; });
      var sub = items.reduce(function (s, it) { return s + it.qty * it.price; }, 0), f = i === 0 ? fee : 0;
      var o = { no: orderNo(), type: 'commande', cat: k, items: items, subtotal: sub, fee: f, total: sub + f, zone: z.name, address: $('cAddr').value.trim().slice(0, 200), note: $('cNote').value.trim().slice(0, 500), pay: pay, name: c.name, phone: c.phone, lang: L, status: 'nouvelle', createdAt: Date.now() };
      return db.collection('orders').add(o).then(function () { done.push(o); });
    });
    Promise.all(jobs).then(function () { cart = {}; save(); render(); thanks(done); })
      .catch(function () { btn.disabled = false; btn.textContent = T('Envoyer la commande', 'Send order'); alert(T('La commande n\'a pas pu être envoyée. Vérifiez la connexion et réessayez.', 'The order could not be sent. Check your connection and try again.')); });
  }

  function waText(o) {
    var t = (o.type === 'devis' ? T('Demande de devis ', 'Quote request ') : T('Commande ', 'Order ')) + o.no + '\n';
    (o.items || []).forEach(function (it) { t += '• ' + it.qty + ' ' + unit(it.unit) + ' ' + it.name + (it.ref ? ' (' + it.ref + ')' : '') + ' : ' + money(it.qty * it.price) + ' F\n'; });
    if (o.type === 'devis') t += o.service + '\n' + o.details + '\n';
    else t += T('Total', 'Total') + ' : ' + money(o.total) + ' F · ' + (o.pay === 'wave' ? 'Wave' : T('paiement à la livraison', 'pay on delivery')) + '\n';
    t += o.name + ' · ' + o.phone + (o.zone ? '\n' + o.zone : '') + (o.address ? ' · ' + o.address : '');
    return t;
  }
  function thanks(list) {
    sheet('<div class="shead"><h3>' + T('Merci !', 'Thank you!') + '</h3><button class="x" data-close>✕</button></div>' +
      '<p>' + T('Votre demande est bien enregistrée. Nous vous appelons très vite.', 'Your request is saved. We will call you shortly.') + '</p>' +
      list.map(function (o) {
        var c = CATS.filter(function (x) { return x.id === o.cat; })[0] || {};
        return '<div class="card mini"><b>' + c.ico + ' ' + esc(FR ? c.fr : c.en) + ' · N° ' + o.no + '</b>' + (o.total ? '<br>' + money(o.total) + ' F' : '') +
          (o.pay === 'wave' ? '<br><small>' + T('Envoyez le paiement Wave au ', 'Send the Wave payment to ') + esc(S.wave) + T(' avec le numéro de commande.', ' with the order number.') + '</small>' : '') +
          '<a class="btn wide" target="_blank" rel="noopener" href="https://wa.me/' + ((o.type === 'devis' && /BMW/.test(o.service) && S.wa.repair) || S.wa[o.cat] || S.wa.bmw) + '?text=' + encodeURIComponent(waText(o)) + '">' + T('Envoyer aussi sur WhatsApp', 'Also send on WhatsApp') + '</a></div>';
      }).join(''));
  }

  function renderDevis() {
    if ($('devis').dataset.ok) return; $('devis').dataset.ok = 1;
    var svc = FR ? ['Transport de marchandises', 'Location de véhicule', 'Réparation / entretien BMW', 'Transit et logistique', 'Autre'] : ['Goods transport', 'Vehicle rental', 'BMW repair / service', 'Freight forwarding', 'Other'];
    $('devis').innerHTML = '<div class="card"><h3>' + T('Demander un devis', 'Request a quote') + '</h3><p class="muted">' + T('Décrivez votre besoin : nous vous répondons avec un prix.', 'Describe what you need: we reply with a price.') + '</p>' +
      '<form id="df" class="form"><label>' + T('Service', 'Service') + '<select id="dSvc">' + svc.map(function (s) { return '<option>' + s + '</option>'; }).join('') + '</select></label>' +
      '<label>' + T('Détails (trajet, date, marchandise, modèle BMW…)', 'Details (route, date, goods, BMW model…)') + '<textarea id="dDet" rows="4" required></textarea></label>' +
      custFields('d') + '<button class="btn wide" type="submit">' + T('Envoyer la demande', 'Send request') + '</button></form></div>';
    $('df').onsubmit = function (e) {
      e.preventDefault();
      var c = customer('d'); if (!c) return;
      var det = $('dDet').value.trim(); if (det.length < 5) { alert(T('Décrivez votre besoin.', 'Describe your need.')); return; }
      var svcName = $('dSvc').value, k = /BMW/.test(svcName) ? 'bmw' : 'transport';
      var o = { no: orderNo(), type: 'devis', cat: k, items: [], subtotal: 0, fee: 0, total: 0, zone: '', address: '', note: '', pay: '', service: svcName, details: det.slice(0, 1000), name: c.name, phone: c.phone, lang: L, status: 'nouvelle', createdAt: Date.now() };
      if (!db) { thanks([o]); return; }
      var b = document.querySelector('#df button'); b.disabled = true;
      db.collection('orders').add(o).then(function () { $('df').reset(); b.disabled = false; thanks([o]); })
        .catch(function () { b.disabled = false; alert(T('Envoi impossible. Réessayez.', 'Could not send. Try again.')); });
    };
  }
  render();
})();
