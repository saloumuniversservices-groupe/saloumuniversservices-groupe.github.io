(function () {
  var root = document.getElementById('track'); if (!root) return;
  var FR = root.dataset.lang !== 'en', T = function (a, b) { return FR ? a : b; };
  var $ = function (id) { return document.getElementById(id); };
  var money = function (n) { return Math.round(n || 0).toLocaleString('fr-FR').replace(/ | /g, ' '); };
  var STEPS = [['nouvelle', T('Reçue', 'Received')], ['confirmee', T('Confirmée', 'Confirmed')], ['prete', T('Prête', 'Ready')], ['livree', T('Livrée', 'Delivered')], ['payee', T('Payée', 'Paid')]];
  if (location.hash.length > 3) $('tNo').value = decodeURIComponent(location.hash.slice(1));
  var db = null;
  if (window.SHOP_FIREBASE && window.firebase) { firebase.initializeApp(window.SHOP_FIREBASE); db = firebase.firestore(); }
  $('tf').onsubmit = function (e) {
    e.preventDefault();
    var no = $('tNo').value.trim().toUpperCase().replace(/\s/g, ''), ph = $('tPh').value.replace(/\D/g, '');
    if (!db) { $('tRes').innerHTML = '<div class="card">' + T('Le suivi en ligne sera bientôt disponible. Écrivez-nous sur WhatsApp.', 'Online tracking is coming soon. Message us on WhatsApp.') + '</div>'; return; }
    $('tRes').innerHTML = '<p class="muted">' + T('Recherche…', 'Searching…') + '</p>';
    db.collection('track').doc(no).get().then(function (d) {
      if (!d.exists || d.data().ph4 !== ph) { $('tRes').innerHTML = '<div class="card"><p>' + T('Aucune commande trouvée avec ce numéro et ces chiffres. Vérifiez et réessayez.', 'No order found with this number and digits. Check and try again.') + '</p></div>'; return; }
      var o = d.data(), idx = STEPS.map(function (s) { return s[0]; }).indexOf(o.status);
      var tl = o.status === 'annulee' ? '<p class="err">' + T('Cette commande a été annulée.', 'This order was cancelled.') + '</p>' :
        '<ol class="tline">' + STEPS.map(function (s, i) { return '<li class="' + (i <= idx ? 'done' : '') + '">' + s[1] + '</li>'; }).join('') + '</ol>';
      $('tRes').innerHTML = '<div class="card"><p class="ono">N° ' + no + '</p>' + tl +
        (o.total ? '<p><b>' + money(o.total) + ' F</b></p>' : '') + (o.date ? '<p>' + T('Livraison prévue : ', 'Planned delivery: ') + o.date + ' · ' + (o.slot || '') + '</p>' : '') +
        (o.zone ? '<p class="small muted">' + o.zone + '</p>' : '') + '</div>';
    }).catch(function () { $('tRes').innerHTML = '<div class="card">' + T('Connexion impossible. Réessayez.', 'Connection failed. Try again.') + '</div>'; });
  };
  if ($('tNo').value) $('tPh').focus();
})();
