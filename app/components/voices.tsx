import { useEffect, useRef, useState } from "react";

import { post } from "~/lib/api";
import { Modal } from "./modal";
import { hush } from "~/lib/talk";

type Voice = { id: string; name: string; gender: string; kind: string; mine: boolean; preview: string };
type Picks = { female: { id: string; name: string }; male: { id: string; name: string } };
type Bundle = { now: string; nowName: string; picks: Picks; voices: Voice[] };

const SAMPLE = "Once upon a time, a small dragon opened a very big book.";

export function VoiceRow({ onPicked }: { onPicked?: (name: string) => void }) {
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [open, setOpen] = useState<"" | "all" | "clone">("");
  const [error, setError] = useState("");

  const load = () =>
    fetch("/api/voices")
      .then(async (res) => (res.ok ? ((await res.json()) as Bundle) : Promise.reject(new Error(await res.text()))))
      .then(setBundle)
      .catch((problem: Error) => setError(problem.message));

  useEffect(() => {
    load();
  }, []);

  const choose = async (id: string, name: string) => {
    setBundle((was) => (was ? { ...was, now: id, nowName: name } : was));
    try {
      await post("/api/voices", { voice: id, name });
      onPicked?.(name);
      hush();
      void play(id, "");
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "That did not save.");
    }
  };

  if (error) return <p className="text-berry-ink">{error}</p>;
  if (!bundle) return <p className="text-muted">One moment…</p>;

  const mine = bundle.voices.find((voice) => voice.mine && voice.id === bundle.now);
  const on = (id: string) => bundle.now === id;

  return (
    <>
      <div className="flex gap-2">
        <Chip on={on(bundle.picks.female.id)} onClick={() => choose(bundle.picks.female.id, bundle.picks.female.name)}>
          Female
        </Chip>
        <Chip on={on(bundle.picks.male.id)} onClick={() => choose(bundle.picks.male.id, bundle.picks.male.name)}>
          Male
        </Chip>
        <Chip on={Boolean(mine)} onClick={() => setOpen("clone")}>
          {mine ? mine.name : "Clone mine"}
        </Chip>
      </div>
      <button className="mt-2 text-sm font-medium text-leaf-ink underline" onClick={() => setOpen("all")}>
        {bundle.nowName ? `Now: ${bundle.nowName} · all voices` : "All voices"}
      </button>

      {open === "all" && (
        <Sheet title="Pick a voice" onClose={() => setOpen("")}>
          <ul className="grid gap-2">
            {bundle.voices.map((voice) => (
              <li key={voice.id}>
                <div
                  className={`flex items-center gap-3 rounded-2xl border-2 px-4 py-3 ${
                    on(voice.id) ? "border-leaf bg-leaf-soft" : "border-line bg-page"
                  }`}
                >
                  <button className="min-w-0 flex-1 text-left" onClick={() => choose(voice.id, voice.name)}>
                    <span className="font-medium">{voice.name}</span>
                    <span className="block truncate text-xs text-muted">
                      {voice.mine ? "yours" : voice.gender} · {voice.id}
                    </span>
                  </button>
                  <button
                    onClick={() => play(voice.id, voice.preview)}
                    aria-label={`Hear ${voice.name}`}
                    className="grid size-11 shrink-0 place-items-center rounded-xl border-2 border-line bg-surface"
                  >
                    ▶
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </Sheet>
      )}

      {open === "clone" && (
        <Clone
          onClose={() => setOpen("")}
          onDone={async (name) => {
            setOpen("");
            await load();
            onPicked?.(name);
          }}
        />
      )}
    </>
  );
}

async function play(id: string, preview: string) {
  hush();
  if (preview) {
    void new Audio(preview).play().catch(() => {});
    return;
  }
  const res = await fetch("/api/speak", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: SAMPLE, voice: id, mood: "read" }),
  });
  if (res.ok) void new Audio(URL.createObjectURL(await res.blob())).play().catch(() => {});
}

function Clone({ onClose, onDone }: { onClose: () => void; onDone: (name: string) => void }) {
  const [name, setName] = useState("My voice");
  const [seconds, setSeconds] = useState(0);
  const [taping, setTaping] = useState(false);
  const [clip, setClip] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const tape = useRef<MediaRecorder | null>(null);

  useEffect(() => {
    if (!taping) return;
    const tick = setInterval(() => setSeconds((was) => was + 1), 1000);
    return () => clearInterval(tick);
  }, [taping]);

  useEffect(() => {
    if (taping && seconds >= 60) stop();
  }, [seconds, taping]);

  const start = async () => {
    setError("");
    setClip(null);
    setSeconds(0);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const parts: Blob[] = [];
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (event) => parts.push(event.data);
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        setClip(new Blob(parts, { type: recorder.mimeType || "audio/webm" }));
      };
      recorder.start();
      tape.current = recorder;
      setTaping(true);
    } catch {
      setError("The microphone is blocked. Allow it and try again.");
    }
  };

  const stop = () => {
    tape.current?.stop();
    tape.current = null;
    setTaping(false);
  };

  const send = async () => {
    if (!clip) return;
    setBusy(true);
    setError("");
    const form = new FormData();
    form.set("name", name.trim() || "My voice");
    form.set("audio", clip, "voice.webm");
    const res = await fetch("/api/voices", { method: "POST", body: form });
    if (res.ok) {
      onDone(name.trim() || "My voice");
    } else {
      setError((await res.text()) || "That did not work.");
    }
    setBusy(false);
  };

  return (
    <Sheet title="Clone my voice" onClose={onClose}>
      <p className="text-muted">
        Read out loud for about thirty seconds — any book will do. Fig will then read in that voice.
      </p>
      <label className="mt-4 flex flex-col gap-2 font-medium">
        Call it
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={40}
          className="h-12 rounded-2xl border-2 border-line bg-page px-3 outline-none focus:border-leaf"
        />
      </label>
      <p className="mt-4 text-center text-4xl font-medium tabular-nums">
        {String(Math.floor(seconds / 60)).padStart(2, "0")}:{String(seconds % 60).padStart(2, "0")}
      </p>
      <div className="mt-3 flex flex-col gap-3">
        <button className={`btn w-full ${taping ? "btn-sun listening" : "btn-leaf"}`} onClick={taping ? stop : start} disabled={busy}>
          {taping ? "Stop recording" : clip ? "Record again" : "Start recording"}
        </button>
        <button className="btn btn-quiet w-full" onClick={send} disabled={!clip || busy || seconds < 20}>
          {busy ? "Making your voice…" : seconds && seconds < 20 ? `Keep going — ${20 - seconds}s more` : "Use this voice"}
        </button>
      </div>
      {error && <p className="mt-3 text-berry-ink">{error}</p>}
    </Sheet>
  );
}

function Sheet({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <Modal label={title} onClose={onClose} z={60}>
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-xl">{title}</h3>
        <button onClick={onClose} aria-label="Close" className="text-3xl leading-none text-muted">
          ×
        </button>
      </div>
      {children}
    </Modal>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={`h-12 flex-1 rounded-2xl border-2 px-2 font-medium ${on ? "border-leaf bg-leaf-soft text-leaf-ink" : "border-line bg-page text-muted"}`}
    >
      {children}
    </button>
  );
}
