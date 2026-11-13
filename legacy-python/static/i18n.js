// Story / reading languages. The app UI stays in English; the chosen language drives the book or story,
// speech recognition while reading, the reading voice, questions and Buddy's feedback about the story.
window.LANGS = {
  en: { label: "🇺🇸 English", speech: "en-US", cjk: false, voices: /Samantha|Google US English|Ava|Allison/i },
  es: { label: "🇪🇸 Español", speech: "es-ES", cjk: false, voices: /Mónica|Monica|Paulina|Google español/i },
  fr: { label: "🇫🇷 Français", speech: "fr-FR", cjk: false, voices: /Amélie|Amelie|Thomas|Google français/i },
  zh: { label: "🇨🇳 中文", speech: "zh-CN", cjk: true, voices: /Tingting|Ting-Ting|Google 普通话|Meijia/i },
  ar: { label: "🌙 العربية", speech: "ar-SA", cjk: false, rtl: true, voices: /Majed|Maged|Laila|Tarik|Google العربية|Arabic/i },
};
window.QUICK = {
  en: [["🐉 Demo: Pip and the Fireflies", "demo:pip"], ["🐰 Velveteen Rabbit", "The Velveteen Rabbit"], ["🥕 Peter Rabbit", "The Tale of Peter Rabbit"], ["🦊 Fox & Grapes", "The Fox and the Grapes"]],
  es: [["🦊 La zorra y las uvas", "La zorra y las uvas"], ["📚 Fábulas de Samaniego", "Fábulas de Samaniego"]],
  fr: [["🦊 Le renard et les raisins", "Le renard et les raisins"], ["📚 Fables de La Fontaine", "Fables de La Fontaine"]],
  zh: [["🦊 狐狸和葡萄", "狐狸和葡萄"]],
  ar: [["🦊 الثعلب والعنب", "الثعلب والعنب"]],
};

// What Buddy says during the quiz and report, in the story's language (buttons stay English).
window.QP = {
  es: { "Let's try again.": "Intentémoslo otra vez.", "Hmm, let me think…": "Mmm, déjame pensar…", "Ooh, interesting…": "Oh, interesante…",
    "Let me check the story…": "Voy a mirar el cuento…", "I didn't catch that. Tap your answer!": "No te entendí. ¡Toca tu respuesta!",
    "That's okay! Let's go to the next one.": "¡No pasa nada! Vamos a la siguiente.", "Yes! That's right!": "¡Sí! ¡Correcto!", "You got it!": "¡Lo lograste!",
    "Great job!": "¡Muy bien!", "Not quite. Let's look at the story again, then pick another one.": "Casi. Miremos el cuento otra vez y elige otra.",
    "The answer is:": "La respuesta es:", "You'll get it next time!": "¡La próxima vez lo lograrás!",
    "I didn't catch that. Tap the microphone and try again!": "No te entendí. ¡Toca el micrófono y prueba otra vez!",
    "Look at this part of the story!": "¡Mira esta parte del cuento!", "Okay, let me read the story again carefully…": "Vale, voy a leer el cuento otra vez con cuidado…",
    "Now let's talk about the story!": "¡Ahora hablemos del cuento!", "Wow, super smooth reading!": "¡Guau, qué lectura tan fluida!", "Nice reading!": "¡Muy bien leído!",
    "Good effort! Reading out loud takes practice.": "¡Buen esfuerzo! Leer en voz alta requiere práctica.", "Great job, {name}!": "¡Muy bien, {name}!",
    "Amazing reading, {name}!": "¡Lectura increíble, {name}!", "Good try, {name}!": "¡Buen intento, {name}!", "You moved up to level {n}!": "¡Subiste al nivel {n}!" },
  fr: { "Let's try again.": "Essayons encore.", "Hmm, let me think…": "Hmm, je réfléchis…", "Ooh, interesting…": "Oh, intéressant…",
    "Let me check the story…": "Je regarde l'histoire…", "I didn't catch that. Tap your answer!": "Je n'ai pas compris. Touche ta réponse !",
    "That's okay! Let's go to the next one.": "Ce n'est pas grave ! Passons à la suivante.", "Yes! That's right!": "Oui ! C'est ça !", "You got it!": "Tu as trouvé !",
    "Great job!": "Bravo !", "Not quite. Let's look at the story again, then pick another one.": "Presque. Regardons encore l'histoire, puis choisis une autre réponse.",
    "The answer is:": "La réponse est :", "You'll get it next time!": "Tu y arriveras la prochaine fois !",
    "I didn't catch that. Tap the microphone and try again!": "Je n'ai pas compris. Touche le micro et réessaie !",
    "Look at this part of the story!": "Regarde ce passage de l'histoire !", "Okay, let me read the story again carefully…": "D'accord, je relis l'histoire attentivement…",
    "Now let's talk about the story!": "Maintenant, parlons de l'histoire !", "Wow, super smooth reading!": "Waouh, quelle lecture fluide !", "Nice reading!": "Bien lu !",
    "Good effort! Reading out loud takes practice.": "Bel effort ! Lire à voix haute, ça s'entraîne.", "Great job, {name}!": "Bravo, {name} !",
    "Amazing reading, {name}!": "Lecture incroyable, {name} !", "Good try, {name}!": "Bien essayé, {name} !", "You moved up to level {n}!": "Tu passes au niveau {n} !" },
  zh: { "Let's try again.": "我们再试一次。", "Hmm, let me think…": "嗯，我想一想……", "Ooh, interesting…": "哦，很有意思……",
    "Let me check the story…": "我看看故事……", "I didn't catch that. Tap your answer!": "我没听清楚。点一下你的答案吧！",
    "That's okay! Let's go to the next one.": "没关系！我们看下一题。", "Yes! That's right!": "对啦！答对了！", "You got it!": "你答对啦！",
    "Great job!": "真棒！", "Not quite. Let's look at the story again, then pick another one.": "差一点。我们再看看故事，然后选另一个。",
    "The answer is:": "答案是：", "You'll get it next time!": "下次你一定行！",
    "I didn't catch that. Tap the microphone and try again!": "我没听清楚。点麦克风再试一次！",
    "Look at this part of the story!": "看看故事里的这一段！", "Okay, let me read the story again carefully…": "好的，我再仔细读一遍故事……",
    "Now let's talk about the story!": "现在我们来聊聊这个故事吧！", "Wow, super smooth reading!": "哇，读得真流利！", "Nice reading!": "读得很好！",
    "Good effort! Reading out loud takes practice.": "很努力！大声朗读需要多练习。", "Great job, {name}!": "做得好，{name}！",
    "Amazing reading, {name}!": "读得太棒了，{name}！", "Good try, {name}!": "很努力，{name}！", "You moved up to level {n}!": "你升到第 {n} 级啦！" },
};
window.qp = (lang, s, v = {}) => ((window.QP[lang] || {})[s] || s).replace(/\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m));
