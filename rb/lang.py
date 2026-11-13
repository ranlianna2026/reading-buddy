"""Language support: tokenizing, normalizing and sentence splitting that work beyond English.

Chinese has no spaces between words, so each Han character is a token (reading speed becomes characters per
minute, the standard measure for Chinese oral reading). The same regexes live in static/index.html (tokens()).
"""
import re
import unicodedata

LANGS = {
    "en": {"name": "English", "speech": "en-US", "cjk": False},
    "es": {"name": "Spanish (español)", "speech": "es-ES", "cjk": False},
    "fr": {"name": "French (français)", "speech": "fr-FR", "cjk": False},
    "zh": {"name": "Simplified Chinese (简体中文)", "speech": "zh-CN", "cjk": True},
    "ar": {"name": "Arabic (العربية, Modern Standard Arabic)", "speech": "ar-SA", "cjk": False, "rtl": True},
}
ARABIC = "\u0600-\u06ff\u0750-\u077f\ufb50-\ufdff\ufe70-\ufeff"
# spelling variants that speech recognition and children's books write differently: hamza forms of alef,
# alef maqsura / ya, ta marbuta / ha, and the tatweel stretch character
_AR_FOLD = str.maketrans({"أ": "ا", "إ": "ا", "آ": "ا", "ٱ": "ا", "ى": "ي", "ة": "ه", "ـ": None})
HAN = "㐀-䶿一-鿿豈-﫿"
_CJK_TOKEN = re.compile(rf"[{HAN}]|[^\s{HAN}]+")
_NON_WORD = re.compile(r"[^\w']|_", re.UNICODE)


def get(lang):
    return LANGS.get(lang or "en", LANGS["en"])


def is_rtl(lang):
    return get(lang).get("rtl", False)


def is_cjk(lang):
    return get(lang)["cjk"]


def tokens(text, lang="en"):
    """Display tokens: whitespace-separated words, or single Han characters for Chinese."""
    return _CJK_TOKEN.findall(text) if is_cjk(lang) else text.split()


def norm(tok):
    """Lowercase, letters/digits only (any script), curly apostrophes folded."""
    t = _NON_WORD.sub("", tok.lower().replace("’", "'")).strip("'")
    # fold accents (affamé == affame) and Arabic short-vowel marks (harakat): speech recognition often drops them;
    # Han characters are unaffected
    t = "".join(c for c in unicodedata.normalize("NFKD", t) if not unicodedata.combining(c))
    return t.translate(_AR_FOLD)


def sentences(text, lang="en"):
    """Split into sentences without breaking on Mr./Mrs./Sr./Sra./M. etc.; handles 。！？ for Chinese."""
    t = re.sub(r"\b(Mr|Mrs|Ms|Dr|St|Mt|Jr|Sr|Sra|Srta|Mme|Mlle|M)\.", lambda m: m.group(1) + "․", text)
    parts = re.findall(r"[^.!?。！？؟]+[.!?。！？؟]+[\"”’'」』)»]?|[^.!?。！？؟]+$", t) or [t]
    return [x.replace("․", ".").strip() for x in parts if x.strip()]


def length(text, lang="en"):
    """Reading length in words, or in Han characters for Chinese."""
    return sum(1 for t in tokens(text, lang) if norm(t)) if is_cjk(lang) else len(text.split())


def detect_script_ok(text, lang):
    """Rough check that generated text is in the requested language's script."""
    han = len(re.findall(rf"[{HAN}]", text))
    letters = len(re.findall(r"[A-Za-zÀ-ÿ]", text))
    if lang == "ar":
        return len(re.findall(rf"[{ARABIC}]", text)) > letters and han == 0
    if is_cjk(lang):
        return han > letters
    if han > 0:
        return False
    if lang == "es":
        return bool(re.search(r"[áéíóúñ¿¡]|\b(el|la|los|las|que|y|de)\b", text, re.I))
    if lang == "fr":
        return bool(re.search(r"[àâçéèêëîïôûù]|\b(le|la|les|des|et|une|est)\b", text, re.I))
    return True
