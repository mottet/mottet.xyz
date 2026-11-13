'use strict';

// The words the family reads, in French, English and Traditional Chinese.
// The parents' tools stay in English; only the gate and the news speak all three.
(function () {
  const STRINGS = {
    en: {
      lang: 'English', locale: 'en-GB',
      gate: 'A little site for Maïa', password: 'Password', enter: 'Come in', wrong: 'That is not the word.', tooMany: 'Too many tries. Wait a quarter of an hour.', off: 'The door is locked on this server for now.',
      born: 'Born on {date} at {time}', measures: '{weight} kg and {height} cm', age: 'Today she is {age}',
      days: { one: '{n} day old', other: '{n} days old' }, weeks: '{w} weeks and {d} days old', weeksOnly: '{w} weeks old', months: '{m} months and {d} days old', monthsOnly: '{m} months old',
      news: 'News', noNews: 'No news yet. Her parents are busy.', signOut: 'Leave', language: 'Language', theme: 'Night and day',
      untitled: 'A day', photoAlt: 'A photo of Maïa', prevPhoto: 'Previous photo', nextPhoto: 'Next photo', photoOf: 'Photo {i} of {n}', familyWelcome: 'Her parents write here when they can, with photos. Come back often.',
      newPost: 'New', newSince: { one: '{n} new post since your last visit', other: '{n} new posts since your last visit' }, upToDate: 'You are up to date: you have seen all the news.', react: 'React with {emoji}', reactions: 'Reactions',
    },
    fr: {
      lang: 'Français', locale: 'fr-FR',
      gate: 'Un petit site pour Maïa', password: 'Mot de passe', enter: 'Entrer', wrong: 'Ce n’est pas le mot.', tooMany: 'Trop d’essais. Attendez un quart d’heure.', off: 'La porte est fermée sur ce serveur pour l’instant.',
      born: 'Née le {date} à {time}', measures: '{weight} kg et {height} cm', age: 'Aujourd’hui elle a {age}',
      days: { one: '{n} jour', other: '{n} jours' }, weeks: '{w} semaines et {d} jours', weeksOnly: '{w} semaines', months: '{m} mois et {d} jours', monthsOnly: '{m} mois',
      news: 'Nouvelles', noNews: 'Pas encore de nouvelles. Ses parents sont occupés.', signOut: 'Sortir', language: 'Langue', theme: 'Nuit et jour',
      untitled: 'Une journée', photoAlt: 'Une photo de Maïa', prevPhoto: 'Photo précédente', nextPhoto: 'Photo suivante', photoOf: 'Photo {i} sur {n}', familyWelcome: 'Ses parents écrivent ici quand ils le peuvent, avec des photos. Revenez souvent.',
      newPost: 'Nouveau', newSince: { one: '{n} nouvelle publication depuis votre dernière visite', other: '{n} nouvelles publications depuis votre dernière visite' }, upToDate: 'Vous êtes à jour : vous avez tout lu.', react: 'Réagir avec {emoji}', reactions: 'Réactions',
    },
    zh: {
      lang: '繁體中文', locale: 'zh-Hant-TW',
      gate: 'Maïa 的小網站', password: '密碼', enter: '進來', wrong: '不是這個密碼。', tooMany: '嘗試次數太多，請等十五分鐘。', off: '這個伺服器暫時還沒開門。',
      born: '{date} {time} 出生', measures: '{weight} 公斤，{height} 公分', age: '今天她 {age}',
      days: { one: '{n} 天大', other: '{n} 天大' }, weeks: '{w} 週又 {d} 天大', weeksOnly: '{w} 週大', months: '{m} 個月又 {d} 天大', monthsOnly: '{m} 個月大',
      news: '近況', noNews: '還沒有新消息，爸爸媽媽正忙著。', signOut: '離開', language: '語言', theme: '日夜',
      untitled: '一天', photoAlt: 'Maïa 的照片', prevPhoto: '上一張照片', nextPhoto: '下一張照片', photoOf: '第 {i} 張，共 {n} 張', familyWelcome: '爸爸媽媽有空時會在這裡寫下近況和照片，常回來看看。',
      newPost: '新', newSince: { one: '自上次來訪後有 {n} 則新消息', other: '自上次來訪後有 {n} 則新消息' }, upToDate: '您已看完所有近況。', react: '用 {emoji} 回應', reactions: '回應',
    },
  };
  const LANGS = ['fr', 'en', 'zh'];

  const fill = (s, vars) => s.replace(/\{(\w+)\}/g, (_, k) => (vars && k in vars ? vars[k] : `{${k}}`));
  const t = (lang, key, vars) => {
    const table = STRINGS[lang] || STRINGS.en;
    const s = table[key] ?? STRINGS.en[key] ?? key;
    if (typeof s === 'object') { const n = vars && vars.n; return fill(n === 1 ? s.one : s.other, vars); }
    return fill(s, vars);
  };
  // A post's title or text in the reader's language, or the first language it was written in.
  const pick = (obj, lang) => {
    if (!obj || typeof obj !== 'object') return '';
    if (obj[lang]) return obj[lang];
    for (const l of [lang].concat(LANGS)) if (obj[l]) return obj[l];
    return '';
  };
  const guess = () => {
    const nav = (navigator.language || 'en').toLowerCase();
    if (nav.startsWith('fr')) return 'fr';
    if (nav.startsWith('zh')) return 'zh';
    return 'en';
  };
  const locale = lang => (STRINGS[lang] || STRINGS.en).locale;
  const dateLong = (lang, d, timeZone) => new Intl.DateTimeFormat(locale(lang), { day: 'numeric', month: 'long', year: 'numeric', timeZone }).format(d);
  const timeShort = (lang, d, timeZone) => new Intl.DateTimeFormat(locale(lang), { hour: '2-digit', minute: '2-digit', hour12: false, timeZone }).format(d);
  const number = (lang, n, digits) => new Intl.NumberFormat(locale(lang), { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);

  // Her age on a day: days under two weeks, then weeks and days, then calendar months and days.
  function ageParts(born, now) {
    const b = new Date(born), n = new Date(now);
    const dayStart = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const days = Math.max(0, Math.round((dayStart(n) - dayStart(b)) / 86400000));
    if (days < 14) return { days };
    if (days < 8 * 7) return { weeks: Math.floor(days / 7), days: days % 7 };
    let months = (n.getFullYear() - b.getFullYear()) * 12 + n.getMonth() - b.getMonth();
    let anchor = new Date(b); anchor.setMonth(b.getMonth() + months);
    if (dayStart(anchor) > dayStart(n)) { months -= 1; anchor = new Date(b); anchor.setMonth(b.getMonth() + months); }
    return { months, days: Math.round((dayStart(n) - dayStart(anchor)) / 86400000) };
  }
  function age(lang, born, now = Date.now()) {
    const p = ageParts(born, now);
    if ('months' in p) return t(lang, p.days ? 'months' : 'monthsOnly', { m: p.months, d: p.days });
    if ('weeks' in p) return t(lang, p.days ? 'weeks' : 'weeksOnly', { w: p.weeks, d: p.days });
    return t(lang, 'days', { n: p.days });
  }

  const api = { STRINGS, LANGS, t, pick, guess, locale, dateLong, timeShort, number, age, ageParts };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else window.MaiaI18n = api;
})();
