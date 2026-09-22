export const S = {
  START_SESSION: 'Start sessie',
  LOADING: 'Laden…',

  INTRO_HEADER: 'Nieuw item',
  INTRO_DONE: 'Klaar',

  HINT: 'Hint',
  AUDIO: '🔊',
  REPORT: 'Meld fout',
  CHECK: 'Controleren',
  NEXT: 'Volgende',

  CORRECT: 'Goed!',
  ALMOST: 'Bijna goed',
  WRONG: 'Fout',
  CORRECT_ANSWER: 'Juiste antwoord:',

  LAPSE_RETYPE: 'Type het juiste antwoord over:',
  LAPSE_CONFIRM: 'Bevestigen',

  FLASHCARD_REVEAL: 'Toon antwoord',
  FLASHCARD_AGAIN: 'Opnieuw',
  FLASHCARD_GOOD: 'Goed',
  FLASHCARD_EASY: 'Makkelijk',

  SESSION_DONE: 'Sessie klaar!',
  REVIEWED: (n: number) => `${n} kaarten geoefend`,
  ANOTHER_ROUND: 'Nog een ronde',

  REPORT_TITLE: 'Fout melden',
  REPORT_KIND_WRONG: 'Inhoud klopt niet',
  REPORT_KIND_ALSO: 'Mijn antwoord was ook goed',
  REPORT_KIND_AUDIO: 'Audio-probleem',
  REPORT_NOTE_LABEL: 'Toelichting (optioneel)',
  REPORT_SUBMIT: 'Versturen',
  REPORT_CANCEL: 'Annuleren',

  LEECH_BADGE: 'Lastig',
  WELCOME_BACK: 'Welkom terug! Lichte sessie vandaag.',

  // Home
  TODAY: 'Vandaag',
  UNIT_LIST_HEADER: 'Eenheden',
  LOCKED: 'Vergrendeld',
  MASTERY: (pct: number) => `${pct}% beheerst`,
  BACKUP_BANNER: 'Maak een back-up van je voortgang zodat je geen oefendata verliest.',
  BACKUP_BTN: 'Back-up exporteren (beschikbaar in fase 6)',
  IOS_ADVICE: 'Voeg Capito toe aan je beginscherm voor de beste ervaring: tik op Delen → Zet op beginscherm.',

  // Unit
  UNIT_CANDO_HEADER: 'Na deze unit kun je…',
  UNIT_WORDS_HEADER: 'Woorden',
  UNIT_VERBS_HEADER: 'Werkwoorden',
  UNIT_DIALOGUES_HEADER: 'Dialogen',
  UNIT_GRAMMAR_HEADER: 'Grammatica',
  PRACTICE_UNIT: 'Oefen deze unit',
  EXAM: 'Eindtoets',
  EXAM_UNAVAILABLE: (threshold: number, current: number) =>
    `Beschikbaar vanaf ${threshold}% beheersing (nu: ${current}%)`,
  BACK: '← Terug',

  // Session end (also-round from home resets)
  HOME: 'Terug naar home',

  // Settings screen
  SETTINGS: 'Instellingen',
  SETTINGS_LEARNING: 'Leerbeleid',
  SETTINGS_NEW_PER_DAY: 'Nieuwe kaarten per dag',
  SETTINGS_AUTOPLAY: 'Autoplay audio',
  SETTINGS_UNLOCK: 'Alles ontgrendelen',
  SETTINGS_UNLOCK_ON: 'Ingeschakeld',
  SETTINGS_UNLOCK_OFF: 'Uitgeschakeld',
  SETTINGS_UNLOCK_CONFIRM: 'Hiermee worden alle units direct toegankelijk. Doorgaan?',
  SETTINGS_BACKUP: 'Back-up',
  SETTINGS_LAST_BACKUP: (date: string | undefined) => date ? `Laatste back-up: ${new Date(date).toLocaleDateString('nl-NL')}` : 'Laatste back-up: nooit',
  SETTINGS_STORAGE: (granted: boolean | undefined) => `Opslagbescherming: ${granted ? 'ja' : 'nee'}`,
  SETTINGS_EXPORT: 'Exporteer back-up (beschikbaar in fase 6)',
  SETTINGS_IMPORT: 'Importeer back-up (beschikbaar in fase 6)',
  SETTINGS_DANGER: 'Reset',
  SETTINGS_RESET: 'Reset voortgang',
  SETTINGS_RESET_CONFIRM: 'Wil je echt alle voortgang wissen? Dit kan niet ongedaan worden gemaakt.',
  SETTINGS_VERSION: 'Versie-info',
  SETTINGS_VERSION_APP: (v: string) => `App: ${v}`,
  SETTINGS_VERSION_COMMIT: (c: string) => `Commit: ${c}`,
  SETTINGS_VERSION_CONTENT: (h: string) => `Content: ${h}`,

  // Reports screen
  REPORTS: 'Meldingen',
  REPORTS_EMPTY: 'Geen meldingen.',
  REPORTS_EXPORT: 'Exporteer als JSON',

  // Leech screen
  LEECH: 'Lastig',
  LEECH_EMPTY: 'Geen lastige kaarten.',
  LEECH_LAPSES: (n: number) => `${n}× fout`,
  LEECH_EXAMPLE: 'Voorbeeldzin:',

  // Home nav
  NAV_SETTINGS: 'Instellingen',
  NAV_REPORTS: 'Meldingen',
  NAV_LEECH: 'Lastig',

  // Grammar screen
  GRAMMAR_PRACTICE: 'Oefen dit',
  GRAMMAR_NO_CONTENT: 'Grammaticatekst nog niet beschikbaar voor deze les.',

  // Dialogue screen
  DIALOGUE_NL_TOGGLE: 'Vertaling',
  DIALOGUE_SWITCH_TO_FORMAL: 'Wissel naar formeel',
  DIALOGUE_SWITCH_TO_INFORMAL: 'Wissel naar informeel',
}
