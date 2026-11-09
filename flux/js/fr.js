// French words and numbers for the site. Amounts arrive as integer thousands
// of euros (k€) and leave as "1 234,5 Md€", "845 M€", "320 k€" or "850 €",
// with the narrow no-break space of fr-FR between thousands, a no-break
// space before the unit and a real minus sign.
const NBSP = ' ';
const NNBSP = ' ';
const MINUS = '−';

const group = (int) => String(int).replace(/\B(?=(\d{3})+(?!\d))/g, NNBSP);

/** A number with `digits` decimals, French style. */
export function formatNumber(n, digits = 0) {
  const sign = n < 0 ? MINUS : '';
  const abs = Math.abs(n);
  const fixed = abs.toFixed(digits);
  const [int, frac] = fixed.split('.');
  return sign + group(int) + (frac ? ',' + frac : '');
}

/** An amount in k€ as Md€ / M€ / k€ / €, with a sensible number of decimals. */
export function formatEuros(keur, { digits } = {}) {
  if (keur === null || keur === undefined || Number.isNaN(keur)) return '—';
  const abs = Math.abs(keur);
  if (abs >= 1e6) return formatNumber(keur / 1e6, digits ?? (abs >= 1e8 ? 0 : 1)) + NBSP + 'Md€';
  if (abs >= 1e3) return formatNumber(keur / 1e3, digits ?? (abs >= 1e5 ? 0 : 1)) + NBSP + 'M€';
  if (abs >= 1) return formatNumber(keur, digits ?? 0) + NBSP + 'k€';
  return formatNumber(keur * 1000, 0) + NBSP + '€';
}

/** Always in Md€ with one decimal (for columns that must line up). */
export const formatMd = keur => formatNumber(keur / 1e6, keur !== 0 && Math.abs(keur) < 5e4 ? 2 : 1) + NBSP + 'Md€';

/** A share: 0.1234 -> "12,3 %". */
export const formatShare = x => formatNumber(x * 100, Math.abs(x) < 0.01 ? 2 : 1) + NBSP + '%';

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
/** "2026-11-09" -> "9 novembre 2026". */
export function formatDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return iso;
  return `${d === 1 ? '1er' : d} ${MONTHS[m - 1]} ${y}`;
}

export const BASES = {
  sna: { label: 'Comptabilité nationale', short: 'Comptes nationaux', note: 'Comptes nationaux (SEC 2010, base 2020) : la mesure officielle du déficit et de la dépense publique, consolidée entre administrations.' },
  'budget-exec': { label: 'Budget exécuté', short: 'Exécution', note: "Crédits de paiement consommés, en comptabilité budgétaire de l'État." },
  'budget-lfi': { label: 'Loi de finances initiale', short: 'LFI', note: 'Crédits votés pour l’année.' },
  'budget-plf': { label: 'Projet de loi de finances', short: 'Budget de l’État (PLF)', note: 'Budget général de l’État tel que déposé par le Gouvernement : crédits de paiement par mission, programme, action et sous-action, recettes nettes par impôt, prélèvements sur recettes. Budgets annexes et comptes spéciaux non compris.' },
};

export const COLUMNS = {
  payeurs: { label: 'Qui paie', short: 'Payeurs' },
  apu: { label: 'Administrations publiques', short: 'Administrations' },
  benef: { label: 'Qui reçoit', short: 'Bénéficiaires' },
};

export const T = {
  title: 'Flux — qui paie quoi, qui reçoit quoi',
  subtitle: "Les flux d'argent des administrations publiques françaises",
  year: 'Année',
  basis: 'Base',
  detail: 'Détail',
  sources: 'Sources',
  sourcesFooter: n => `Sources officielles : ${n}`,
  nd: 'non détaillé',
  unsplit: 'non ventilé',
  others: n => `Autres (${n})`,
  expand: 'Développer',
  collapse: 'Replier',
  close: 'Fermer',
  copyLink: 'Copier le lien',
  copied: 'Lien copié',
  table: 'Tableau des flux affichés',
  theme: 'Thème',
  themeLight: 'Clair',
  themeDark: 'Sombre',
  themeAuto: 'Automatique',
  in: 'Reçoit',
  out: 'Verse',
  balance: 'Solde',
  intra: 'Transferts entre administrations',
  imputed: 'écriture comptable, sans flux monétaire',
  loading: 'Chargement des données…',
  error: 'Les données n’ont pas pu être chargées.',
  retrieved: 'consulté le',
  licence: 'licence',
  locator: 'emplacement',
  hubLevels: ['Administrations publiques', 'Centrale, locale, sociale', 'État, ODAC, collectivités, ODAL, régimes, hôpitaux', 'Communes, départements, régions, syndicats'],
  budgetLevels: ['État (budget général)', 'Missions', 'Programmes', 'Actions', 'Sous-actions'],
  sideLevels: ['Par secteur', 'Par opération'],
  op: 'Opération',
  from: 'De',
  to: 'À',
  amount: 'Montant',
  share: 'Part',
  keyboardHint: 'Tab pour entrer dans le graphique, Entrée pour développer, Échap pour replier.',
};

export { NBSP, NNBSP, MINUS };
