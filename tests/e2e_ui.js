// End-to-end UI test, run inside the page (Chrome) with real backend calls.
// The microphone is simulated: reading transcripts and spoken answers are injected; taps are real clicks.
// Usage (DevTools console or automation): fetch('/static/../tests/e2e_ui.js') is not served, so paste this file.
(async () => {
  const R = window.E2E = { log: [], done: false, started: Date.now() };
  const ok = (name, cond, detail = "") => R.log.push(`${cond ? "PASS" : "FAIL"} ${name}${detail ? " — " + detail : ""}`);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const until = async (fn, ms = 60000) => { const t = Date.now(); while (Date.now() - t < ms) { if (fn()) return true; await sleep(250); } return false; };
  const said = [];
  window.say = async (t, show = true) => { said.push(t.replace(/<[^>]+>/g, "")); if (show) $(S.sayTarget || "#say").innerHTML = t; await sleep(60); };
  // simulated child: answers come from this queue; "tap:k" clicks option k, "hang" never answers (forces tapping)
  let plan = [];
  window.listenOnce = async () => {
    const a = plan.shift();
    if (a && a.startsWith("tap:")) { const k = +a.slice(4); setTimeout(() => document.querySelector(`.opt[data-k="${k}"]`)?.click(), 400); return new Promise(() => {}); }
    await sleep(300); return a || "";
  };
  const readAloud = (text, mistakes, seconds) => {      // stand-in for the microphone during read-aloud
    const w = text.split(/\s+/); mistakes.forEach(([i, rep]) => { if (rep === null) w.splice(i, 1); else w[i] = rep; });
    reader = { st: { text: w.join(" "), cur: "", interim: "", on: true, t0: performance.now() - seconds * 1000 }, r: { stop() {} } };
  };
  const answerPlan = qs => qs.flatMap(q => q.format === "choice"
      ? (q === qs[0] ? [`tap:${(q.answer_index + 1) % 3}`, `tap:${q.answer_index}`]          // Q1: wrong tap, then right tap
                     : [q.choices[q.answer_index]])                                           // other choice Qs: say the answer
      : ["because she likes cake", q.expected_answer]);                                       // open Q: wrong, then right

  try {
    localStorage.setItem("rb_learner", "E2E"); $("#learner").value = "E2E"; await loadProfile();
    const lvl0 = S.profile.level, sessions0 = S.profile.history.length;
    ok("home: two choices shown", !$("#chooser").hidden && document.querySelectorAll(".choice").length === 2);

    // ---------- A. existing illustrated book ----------
    await loadBook("The Tale of Peter Rabbit");
    ok("A1 book opens, chooser hides", !$("#book").hidden && $("#chooser").hidden, S.book.title);
    ok("A2 storybook pages + dots", S.pages.length > 1 && document.querySelectorAll("#dots span").length === S.pages.length, `${S.pages.length} pages`);
    ok("A3 original illustration on page 1", !!$("#pagepic img") && $("#pagepic img").src.includes("gutenberg"));
    $("#next").click(); ok("A4 next page", S.page === 1); $("#prev").click(); ok("A5 prev page", S.page === 0);
    // listen
    const seen = new Set(); const mo = new MutationObserver(() => document.querySelectorAll("#passage .speaking").forEach(x => seen.add(x.dataset.i)));
    mo.observe($("#passage"), { subtree: true, attributes: true }); $("#listen").click(); await sleep(4000); $("#listen").click(); mo.disconnect();
    ok("A6 Listen highlights words", seen.size >= 5, `${seen.size} words`);
    // read aloud with 3 mistakes; live page turn
    $("#readbtn").click(); await sleep(200);
    ok("A7 reading mode shows Done button", !!$("#donebtn"));
    const firstEnd = S.pages[0].end; markReached(S.book.text.split(/\s+/).slice(0, firstEnd + 3).join(" "));
    ok("A8 page turns as she reads", S.page >= 1);
    stopReading(); readAloud(S.book.text, [[6, "litle"], [20, null], [33, "badger"]], 75);
    const qsP = S.qsPromise; await qsP;
    plan = answerPlan((await qsP).questions);
    $("#donebtn").click();
    await until(() => S.score);
    ok("A9 reading scored, miscues marked", document.querySelectorAll("#passage .misread, #passage .skipped").length >= 2,
       `${S.score.wcpm} wpm, ${Math.round(S.score.accuracy * 100)}%`);
    ok("A10 quiz pop-up opens", await until(() => !$("#quiz").hidden, 30000));
    const want = S.profile.level <= 2 ? ["choice", "choice", "choice"] : null;
    ok("A11 3 questions, formats fit her level", S.questions.length === 3 && (want ? S.questions.every(q => q.format === "choice") : S.questions.some(q => q.format === "open")),
       S.questions.map(q => `${q.kind}:${q.format}`).join(", "));
    await until(() => document.querySelector(".opt.wrong"), 20000);
    ok("A12 wrong tap greyed out + proof shown", !!document.querySelector(".opt.wrong") && await until(() => $("#qproof")?.innerHTML.includes("From the story"), 8000));
    ok("A13 right tap turns green", await until(() => document.querySelector(".opt.right"), 15000));
    ok("A14 report card appears", await until(() => $("#qcard")?.innerText.includes("words / minute"), 120000));
    ok("A15 all questions answered", S.answers.length === 3, S.answers.map(a => `${a.kind}:${a.verdict}`).join(", "));
    ok("A16 inference answered correctly", S.answers.find(a => a.kind === "inference")?.verdict === "correct");
    ok("A17 session saved to profile", S.profile.history.length === sessions0 + 1, `level ${lvl0} → ${S.profile.level}`);
    ok("A18 fun fact with source on report", !!$("#qcard .learn a"), $("#qcard .learn a")?.href);
    $("#closerep").click(); await sleep(300);
    ok("A19 close report returns to book", $("#quiz").hidden && !$("#book").hidden);

    // ---------- B. story from an idea only (pictures drawn from scratch) ----------
    $("#newstory").click(); await sleep(200);
    ok("B1 New story shows chooser", !$("#chooser").hidden);
    S.storyFiles = []; S.storyImgs = []; $("#thumbs").innerHTML = ""; $("#idea").value = "a little turtle who wants to fly like the birds"; S.idea = "";
    await makeStory(false);
    ok("B2 story written from idea", S.book.via === "story" && S.pages.length >= 2, `${S.book.title} · ${S.book.level_label}`);
    ok("B3 level check passed", S.book.check.word_count_ok && S.book.check.sentence_ok, `${S.book.check.word_count} words`);
    const practice = S.profile.practice.slice(0, 3);
    ok("B4 practice words woven in", !S.book.check.practice_missing.length, `wanted [${practice}] used [${S.book.check.practice_used}]`);
    ok("B5 page 1 picture drawn from scratch", await until(() => S.pages[0].gen, 60000));
    ok("B6 other pages drawn (consistent)", await until(() => S.pages.every(p => p.gen), 90000), `${S.pages.filter(p => p.gen).length}/${S.pages.length}`);
    ok("B7 'drawn by Buddy' label", (showPage(1), $("#pagepic .badge")?.textContent.includes("drawn by Buddy")));

    // ---------- C. story from a drawing ----------
    $("#newstory").click();
    const c = document.createElement("canvas"); c.width = 480; c.height = 360; const g = c.getContext("2d");
    g.fillStyle = "#7cc3ff"; g.fillRect(0, 0, 480, 360); g.fillStyle = "#ff8c28"; g.beginPath(); g.arc(240, 150, 70, 0, 7); g.fill();
    for (let x = 185; x <= 295; x += 22) g.fillRect(x, 200, 14, 110);
    const blob = await new Promise(r => c.toBlob(r, "image/png"));
    S.storyFiles = [new File([blob], "octopus.png", { type: "image/png" })]; S.storyImgs = [c.toDataURL()]; $("#idea").value = "an octopus who is shy"; S.idea = "";
    await makeStory(false);
    ok("C1 story from drawing", S.book.via === "story" && $("#pagepic img")?.src.startsWith("data:image/png"), S.book.title);
    ok("C2 later pages drawn in her style", await until(() => S.pages.slice(1).every(p => p.gen), 90000));

    // ---------- D. page photo ----------
    $("#newstory").click();
    const pc = document.createElement("canvas"); pc.width = 900; pc.height = 300; const pg = pc.getContext("2d");
    pg.fillStyle = "#fff"; pg.fillRect(0, 0, 900, 300); pg.fillStyle = "#000"; pg.font = "32px Georgia";
    ["The little red hen found a grain of wheat.", "Who will help me plant it? she asked."].forEach((l, i) => pg.fillText(l, 30, 80 + i * 60));
    const pb = await new Promise(r => pc.toBlob(r, "image/jpeg"));
    const dt = new DataTransfer(); dt.items.add(new File([pb], "page.jpg", { type: "image/jpeg" })); $("#photo").files = dt.files;
    $("#photo").dispatchEvent(new Event("change"));
    ok("D1 page photo read by Muse", await until(() => S.book && S.book.via === "muse-vision", 60000) && /red hen/i.test(S.book.text), S.book.text.slice(0, 50));

    // ---------- E. errors ----------
    $("#newstory").click(); said.length = 0;
    await loadBook("zzqx nonexistent book qwv");
    ok("E1 unknown book → friendly message", said.some(t => /couldn't find/i.test(t)) && !$("#chooser").hidden === false || said.some(t => /couldn't find/i.test(t)));
    S.storyFiles = []; S.storyImgs = []; $("#idea").value = ""; said.length = 0; await makeStory(false);
    ok("E2 empty story → asks for idea", said.some(t => /picture or tell me/i.test(t)));
  } catch (e) { ok("harness error", false, e.stack || String(e)); }
  R.done = true; R.secs = Math.round((Date.now() - R.started) / 1000);
})();
