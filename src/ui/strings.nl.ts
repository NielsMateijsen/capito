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

  // Grammar screen
  GRAMMAR_PRACTICE: 'Oefen dit',
  GRAMMAR_NO_CONTENT: 'Grammaticatekst nog niet beschikbaar voor deze les.',

  // Dialogue screen
  DIALOGUE_NL_TOGGLE: 'Vertaling',
  DIALOGUE_SWITCH_TO_FORMAL: 'Wissel naar formeel',
  DIALOGUE_SWITCH_TO_INFORMAL: 'Wissel naar informeel',
}
