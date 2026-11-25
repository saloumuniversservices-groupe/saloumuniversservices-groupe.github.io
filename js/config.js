/* Boutique SUNS : réglages de base.
   FIREBASE : à remplir avec la configuration du projet Firebase de la boutique (Console Firebase › Paramètres du projet › Vos applications › Web). */
window.SHOP_FIREBASE = null;
/* Exemple :
window.SHOP_FIREBASE = {
  apiKey: "…", authDomain: "….firebaseapp.com", projectId: "…",
  storageBucket: "….appspot.com", messagingSenderId: "…", appId: "…"
};
*/
window.SHOP_OWNER = "sunsgroupesarl@gmail.com";
window.SHOP_DEFAULTS = {
  wa: { bmw: "221779483690", agro: "221775929199", agro2: "221777281699", tilapia: "221775929199", transport: "221779483690", repair: "221775374030", repair2: "221779483690" },
  wave: "+221 77 948 36 90",
  zones: [
    { name: "Retrait sur place", fee: 0 },
    { name: "Dakar", fee: 1000 },
    { name: "Banlieue (Pikine, Guédiawaye, Rufisque…)", fee: 1500 },
    { name: "Régions (prix confirmé par téléphone)", fee: 0 }
  ],
  notice: ""
};
window.SHOP_CATS = [
  { id: "bmw", fr: "Pièces BMW", en: "BMW parts", ico: "🚗" },
  { id: "agro", fr: "Fruits et légumes", en: "Fruit & vegetables", ico: "🌱" },
  { id: "tilapia", fr: "Tilapias", en: "Tilapia", ico: "🐟" },
  { id: "transport", fr: "Transport et services", en: "Transport & services", ico: "🚚" }
];
window.SHOP_UNITS = { piece: ["pièce", "piece"], kg: ["kg", "kg"], sac: ["sac", "bag"], carton: ["carton", "box"], caisse: ["caisse", "crate"], lot: ["lot", "lot"], litre: ["litre", "litre"] };
