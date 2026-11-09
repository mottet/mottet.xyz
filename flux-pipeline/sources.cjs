'use strict';

// The official sources, one entry per dataset or document. Every figure in
// the graph points back at one of these through a provenance record. The
// URL is the public page or file; `licence` is what it is published under.
const SOURCES = {
  'insee-tee': {
    org: 'Insee',
    title: "Comptes nationaux annuels, base 2020 – Tableau économique d'ensemble (TEE)",
    url: 'https://www.insee.fr/fr/statistiques/8988861',
    licence: 'LO2',
    note: "Tableaux de synthèse : TES et TEE. Milliards d'euros, trois décimales. Emplois et ressources par secteur institutionnel (S11 sociétés non financières, S12 sociétés financières, S13 administrations publiques, S14 ménages, S15 ISBLSM, S2 reste du monde).",
    files: year => `https://www.insee.fr/fr/statistiques/fichier/8988861/TEE_${year}_fr.xlsx`,
  },
  'insee-apu': {
    org: 'Insee',
    title: 'Comptes nationaux annuels, base 2020 – Dépenses et recettes des administrations publiques (tableaux 3.201 à 3.217)',
    url: 'https://www.insee.fr/fr/statistiques/8988845',
    licence: 'LO2',
    note: "Comptes des administrations publiques en 2025 (publication de mai 2026, années 2023 à 2025 provisoires ou semi-définitives). Milliards d'euros.",
    files: table => `https://www.insee.fr/fr/statistiques/fichier/8988845/t_${table}_fr.xlsx`,
  },
  'plf25-nature': {
    org: 'Direction du Budget (ministère chargé des comptes publics)',
    title: 'PLF 2025 – Dépenses 2025 du budget général et des budgets annexes selon les nomenclatures par destination et par nature',
    url: 'https://data.economie.gouv.fr/explore/dataset/plf25-depenses-2025-du-bg-et-des-ba-selon-nomenclatures-destination-et-nature/',
    licence: 'LO2',
    note: 'Crédits de paiement et autorisations d’engagement du projet de loi de finances pour 2025 par mission, programme, action, sous-action, titre et catégorie, en euros.',
  },
  'vm-2025': {
    org: 'Gouvernement (annexe au projet de loi de finances pour 2025)',
    title: 'Évaluation des voies et moyens, tome I : les évaluations de recettes (PLF 2025)',
    url: 'https://www2.assemblee-nationale.fr/static/17/Annexes-DL/PLF-2025/Voies_et_moyens_Tome_1_2025.pdf',
    licence: 'PARL',
    note: 'Document budgétaire déposé avec le projet de loi de finances ; les chiffres sont lus dans le texte du PDF (pdftotext), page et ligne citées.',
  },
  'vm-2026': {
    org: 'Gouvernement (annexe au projet de loi de finances pour 2026)',
    title: 'Évaluation des voies et moyens, tome I : les évaluations de recettes (PLF 2026)',
    url: 'https://www.assemblee-nationale.fr/dyn/contenu/visualisation/1087930/file/PLF%202026%20-%20V%26M%20TI%20-%20Evaluations%20des%20recettes.pdf',
    licence: 'PARL',
    note: 'Document budgétaire déposé avec le projet de loi de finances ; les chiffres sont lus dans le texte du PDF (pdftotext), page et ligne citées.',
  },
  'eurostat-cofog': {
    org: 'Eurostat',
    title: 'General government expenditure by function (COFOG, gov_10a_exp), France',
    url: 'https://ec.europa.eu/eurostat/databrowser/view/gov_10a_exp/default/table',
    licence: 'CCBY4',
    note: "Dépense totale (TE) par fonction (classification COFOG à deux niveaux) et par sous-secteur, millions d'euros.",
  },
  'drees-cps': {
    org: 'DREES (ministère chargé de la santé et des solidarités)',
    title: 'Les comptes de la protection sociale – prestations par risque et par régime',
    url: 'https://data.drees.solidarites-sante.gouv.fr/explore/dataset/305_les-comptes-de-la-protection-sociale/',
    licence: 'LO2',
    note: "Compte satellite des comptes nationaux : prestations de protection sociale par risque (santé, vieillesse-survie, famille, emploi, logement, pauvreté) et par régime ou sous-secteur, millions d'euros. Comprend les prestations en nature produites par les administrations elles-mêmes (soins des hôpitaux publics), que la dépense des comptes nationaux porte en rémunérations et achats.",
  },
  'eurostat-gov': {
    org: 'Eurostat',
    title: 'Government revenue, expenditure and main aggregates (gov_10a_main), France',
    url: 'https://ec.europa.eu/eurostat/databrowser/view/gov_10a_main/default/table',
    licence: 'CCBY4',
    note: "Transmission de l'Insee à Eurostat (SEC 2010). Millions d'euros. Donne la ventilation par sous-secteur (S1311, S1313, S1314) et les transferts entre sous-secteurs (D7PAY_S13xx, D9PAY_S13xx, D4PAY_S13xx) ainsi que les flux avec les institutions européennes (S212).",
  },
};

module.exports = { SOURCES };
