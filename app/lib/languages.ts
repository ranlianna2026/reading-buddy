export type Tongue = { name: string; own: string; tag: string };

export const LANGUAGES: Tongue[] = [
  { name: "English", own: "English", tag: "en-US" },
  { name: "Spanish", own: "Español", tag: "es-ES" },
  { name: "Portuguese", own: "Português", tag: "pt-BR" },
  { name: "French", own: "Français", tag: "fr-FR" },
  { name: "German", own: "Deutsch", tag: "de-DE" },
  { name: "Italian", own: "Italiano", tag: "it-IT" },
  { name: "Dutch", own: "Nederlands", tag: "nl-NL" },
  { name: "Swedish", own: "Svenska", tag: "sv-SE" },
  { name: "Norwegian", own: "Norsk", tag: "nb-NO" },
  { name: "Danish", own: "Dansk", tag: "da-DK" },
  { name: "Finnish", own: "Suomi", tag: "fi-FI" },
  { name: "Polish", own: "Polski", tag: "pl-PL" },
  { name: "Czech", own: "Čeština", tag: "cs-CZ" },
  { name: "Slovak", own: "Slovenčina", tag: "sk-SK" },
  { name: "Hungarian", own: "Magyar", tag: "hu-HU" },
  { name: "Romanian", own: "Română", tag: "ro-RO" },
  { name: "Greek", own: "Ελληνικά", tag: "el-GR" },
  { name: "Turkish", own: "Türkçe", tag: "tr-TR" },
  { name: "Russian", own: "Русский", tag: "ru-RU" },
  { name: "Ukrainian", own: "Українська", tag: "uk-UA" },
  { name: "Arabic", own: "العربية", tag: "ar-SA" },
  { name: "Hebrew", own: "עברית", tag: "he-IL" },
  { name: "Persian", own: "فارسی", tag: "fa-IR" },
  { name: "Hindi", own: "हिन्दी", tag: "hi-IN" },
  { name: "Bengali", own: "বাংলা", tag: "bn-IN" },
  { name: "Urdu", own: "اردو", tag: "ur-PK" },
  { name: "Punjabi", own: "ਪੰਜਾਬੀ", tag: "pa-IN" },
  { name: "Tamil", own: "தமிழ்", tag: "ta-IN" },
  { name: "Telugu", own: "తెలుగు", tag: "te-IN" },
  { name: "Marathi", own: "मराठी", tag: "mr-IN" },
  { name: "Chinese", own: "中文", tag: "zh-CN" },
  { name: "Japanese", own: "日本語", tag: "ja-JP" },
  { name: "Korean", own: "한국어", tag: "ko-KR" },
  { name: "Vietnamese", own: "Tiếng Việt", tag: "vi-VN" },
  { name: "Thai", own: "ไทย", tag: "th-TH" },
  { name: "Indonesian", own: "Bahasa Indonesia", tag: "id-ID" },
  { name: "Malay", own: "Bahasa Melayu", tag: "ms-MY" },
  { name: "Filipino", own: "Filipino", tag: "fil-PH" },
  { name: "Swahili", own: "Kiswahili", tag: "sw-KE" },
  { name: "Catalan", own: "Català", tag: "ca-ES" },
];

export const DEFAULT_TONGUE = "English";

export const tongueOf = (name?: string | null) =>
  LANGUAGES.find((one) => one.name === name) ?? LANGUAGES[0];

export const rightToLeft = (name?: string | null) =>
  ["Arabic", "Hebrew", "Persian", "Urdu"].includes(tongueOf(name).name);
