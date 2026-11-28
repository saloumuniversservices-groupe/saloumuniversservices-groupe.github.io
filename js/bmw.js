/* Saloum Automobile : modèles BMW et leurs codes châssis.
   Sert à trouver les pièces quand le client tape un modèle (X5, Série 3), un code châssis (G05, F30)
   ou choisit son véhicule : les noms des pièces contiennent les codes châssis. */
(function () {
  'use strict';
  var Y = 2100;
  var M = {
    'Série 1': [['E81', 2004, 2012], ['E82', 2007, 2013], ['E87', 2004, 2011], ['E88', 2008, 2013], ['F20', 2011, 2019], ['F21', 2012, 2019], ['F40', 2019, Y]],
    'Série 2': [['F22', 2014, 2021], ['F23', 2015, 2021], ['F45', 2014, 2021], ['F46', 2015, 2022], ['F44', 2020, Y], ['G42', 2021, Y], ['U06', 2022, Y], ['F87', 2016, 2021]],
    'Série 3': [['E30', 1982, 1994], ['E36', 1990, 2000], ['E46', 1998, 2006], ['E90', 2005, 2012], ['E91', 2005, 2012], ['E92', 2006, 2013], ['E93', 2007, 2013], ['F30', 2012, 2019], ['F31', 2012, 2019], ['F34', 2013, 2020], ['F35', 2012, 2019], ['F80', 2014, 2018], ['G20', 2019, Y], ['G21', 2019, Y], ['G28', 2019, Y], ['G80', 2021, Y]],
    'Série 4': [['F32', 2013, 2020], ['F33', 2014, 2020], ['F36', 2014, 2020], ['F82', 2014, 2020], ['F83', 2014, 2020], ['G22', 2020, Y], ['G23', 2021, Y], ['G26', 2021, Y], ['G82', 2021, Y]],
    'Série 5': [['E34', 1988, 1996], ['E39', 1995, 2004], ['E60', 2003, 2010], ['E61', 2004, 2010], ['F07', 2009, 2017], ['F10', 2010, 2017], ['F11', 2010, 2017], ['F18', 2010, 2017], ['F90', 2017, 2023], ['G30', 2017, 2023], ['G31', 2017, 2023], ['G38', 2017, 2023], ['G60', 2023, Y], ['G61', 2024, Y]],
    'Série 6': [['E63', 2003, 2010], ['E64', 2004, 2010], ['F06', 2012, 2018], ['F12', 2011, 2018], ['F13', 2011, 2018], ['G32', 2017, 2023]],
    'Série 7': [['E38', 1994, 2001], ['E65', 2001, 2008], ['E66', 2001, 2008], ['F01', 2008, 2015], ['F02', 2008, 2015], ['F04', 2009, 2015], ['G11', 2015, 2022], ['G12', 2015, 2022], ['G70', 2022, Y]],
    'Série 8': [['E31', 1989, 1999], ['G14', 2018, Y], ['G15', 2018, Y], ['G16', 2019, Y]],
    'X1': [['E84', 2009, 2015], ['F48', 2015, 2022], ['F49', 2016, 2022], ['U11', 2022, Y]],
    'X2': [['F39', 2017, 2023], ['U10', 2023, Y]],
    'X3': [['E83', 2003, 2010], ['F25', 2010, 2017], ['F97', 2018, 2024], ['G01', 2017, 2024], ['G08', 2018, Y], ['G45', 2024, Y]],
    'X4': [['F26', 2014, 2018], ['F98', 2018, Y], ['G02', 2018, Y]],
    'X5': [['E53', 1999, 2006], ['E70', 2006, 2013], ['F15', 2013, 2018], ['F85', 2014, 2018], ['G05', 2018, Y], ['F95', 2019, Y]],
    'X6': [['E71', 2008, 2014], ['E72', 2009, 2011], ['F16', 2014, 2019], ['F86', 2015, 2019], ['G06', 2019, Y], ['F96', 2019, Y]],
    'X7': [['G07', 2019, Y]],
    'Z3': [],
    'Z4': [['E85', 2002, 2008], ['E86', 2006, 2008], ['E89', 2009, 2016], ['G29', 2018, Y]],
    'i3': [['I01', 2013, 2022]],
    'i4': [['G26', 2021, Y]],
    'iX': [['I20', 2021, Y]],
    'Mini': [['R50', 2001, 2006], ['R52', 2004, 2008], ['R53', 2001, 2006], ['R55', 2007, 2014], ['R56', 2006, 2013], ['R57', 2009, 2015], ['R58', 2011, 2015], ['R59', 2012, 2015], ['R60', 2010, 2016], ['R61', 2012, 2016], ['F54', 2015, 2024], ['F55', 2014, 2024], ['F56', 2013, 2024], ['F57', 2016, 2024], ['F60', 2017, 2024]]
  };
  var BY = {};
  Object.keys(M).forEach(function (m) { M[m].forEach(function (c) { (BY[c[0]] = BY[c[0]] || []).push([m, c[1], c[2]]); }); });
  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  /* Codes châssis écrits dans un texte (ex. « ACTUATEUR F15 F16 N55 » → F15, F16). */
  function codesIn(text) {
    var out = [], m, re = /(^|[^a-z0-9])([efgriu]\d{2})(?=$|[^a-z0-9])/gi, t = String(text || '');
    while ((m = re.exec(t))) { var c = m[2].toUpperCase(); if (BY[c] && out.indexOf(c) < 0) out.push(c); }
    return out;
  }
  /* Codes d'un modèle, pour une année si elle est connue. */
  function codesOf(model, year) { var y = +year; return (M[model] || []).filter(function (c) { return !y || (y >= c[1] - 1 && y <= c[2] + 1); }).map(function (c) { return c[0]; }); }
  /* Modèle reconnu dans une recherche : « x5 », « serie 3 », « série 3 », « 3er », « mini ». */
  function modelIn(q) {
    var n = norm(q), m;
    if ((m = n.match(/(^|\s)(?:serie|series|s)\s*([1-8])(?=\s|$)/)) || (m = n.match(/(^|\s)([1-8])\s*er(?=\s|$)/))) return { model: 'Série ' + m[2], rest: n.replace(m[0], ' ').trim() };
    if ((m = n.match(/(^|\s)(x[1-7]|z[34]|i[34]|ix)(?=\s|$)/))) { var k = m[2] === 'ix' ? 'iX' : m[2][0] === 'i' ? m[2] : m[2].toUpperCase(); return { model: k, rest: n.replace(m[0], ' ').trim() }; }
    if ((m = n.match(/(^|\s)(mini)(?=\s|$)/))) return { model: 'Mini', rest: n.replace(m[0], ' ').trim() };
    return null;
  }
  function label(model) { return (M[model] || []).map(function (c) { return c[0] + ' (' + c[1] + (c[2] >= Y ? '+' : '–' + c[2]) + ')'; }).join(', '); }
  function modelsOf(code) { return (BY[code] || []).map(function (x) { return x[0]; }); }
  window.BMW = { MODELS: M, codesIn: codesIn, codesOf: codesOf, modelIn: modelIn, label: label, modelsOf: modelsOf };
})();
