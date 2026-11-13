// Story / reading languages. The app UI stays in English; the chosen language drives the book or story,
// speech recognition while reading, the reading voice, questions and Buddy's feedback about the story.
window.LANGS = {
  en: { label: "🇺🇸 English", speech: "en-US", cjk: false, voices: /Samantha|Google US English|Ava|Allison/i },
  es: { label: "🇪🇸 Español", speech: "es-ES", cjk: false, voices: /Mónica|Monica|Paulina|Google español/i },
  fr: { label: "🇫🇷 Français", speech: "fr-FR", cjk: false, voices: /Amélie|Amelie|Thomas|Google français/i },
  zh: { label: "🇨🇳 中文", speech: "zh-CN", cjk: true, voices: /Tingting|Ting-Ting|Google 普通话|Meijia/i },
};
window.QUICK = {
  en: [["🐰 Velveteen Rabbit", "The Velveteen Rabbit"], ["🥕 Peter Rabbit", "The Tale of Peter Rabbit"], ["🦊 Fox & Grapes", "The Fox and the Grapes"]],
  es: [["🦊 La zorra y las uvas", "La zorra y las uvas"], ["📚 Fábulas de Samaniego", "Fábulas de Samaniego"]],
  fr: [["🦊 Le renard et les raisins", "Le renard et les raisins"], ["📚 Fables de La Fontaine", "Fables de La Fontaine"]],
  zh: [["🦊 狐狸和葡萄", "狐狸和葡萄"]],
};
