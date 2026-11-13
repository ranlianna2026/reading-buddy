import { startRegistration } from "@simplewebauthn/browser";
import { useState } from "react";
import { redirect, useNavigate } from "react-router";

import { Buddy } from "~/components/buddy";
import { BottomNav, Crumbs, Flame, Heart, Screen, Star, TopNav } from "~/components/chrome";
import { post, send } from "~/lib/api";
import { userOf } from "~/lib/auth.server";
import { heartsNow, kidOf, MAX_HEARTS, nextHeartIn } from "~/lib/kid.server";
import { history, recall } from "~/lib/memory.server";
import { say } from "~/lib/talk";
import type { Route } from "./+types/me";

export const meta = () => [{ title: "Me · Reading Buddy" }];

const KINDS: Record<string, string> = {
  likes: "Loves",
  word: "Still tricky",
  fact: "About you",
  win: "Proud of",
};

export async function loader({ request }: Route.LoaderArgs) {
  const user = await userOf(request);
  if (!user) throw redirect("/hello");
  const kid = await kidOf(user.id);
  if (!kid) throw redirect("/hello?who=1");
  return {
    email: user.email,
    kid: { ...kid, hearts: heartsNow(kid) },
    waitMinutes: Math.ceil(nextHeartIn(kid) / 60000),
    memories: await recall(kid.id, 30),
    read: await history(kid.id, 30),
  };
}

export default function Me({ loaderData }: Route.ComponentProps) {
  const { kid, email, memories, read, waitMinutes } = loaderData;
  const go = useNavigate();
  const [note, setNote] = useState("");
  const best = read.reduce((top, row) => Math.max(top, row.wcpm), 0);

  const addPasskey = async () => {
    setNote("");
    try {
      const options = await post<Parameters<typeof startRegistration>[0]["optionsJSON"]>("/api/passkey/add-options", {});
      const response = await startRegistration({ optionsJSON: options });
      await post("/api/passkey/add", { response, label: "This device" });
      setNote("Passkey saved. Next time, no password.");
    } catch (problem) {
      setNote(problem instanceof Error ? problem.message : "That did not work.");
    }
  };

  const signOut = async () => {
    await send("/api/auth/signout", new FormData());
    go("/hello");
  };

  return (
    <Screen id="page-me">
      <TopNav left={<span className="text-lg font-medium">{kid.name}</span>} right={<Crumbs kid={kid} />} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 pb-6">
        <div className="mb-6 flex items-center gap-4">
          <Buddy mood="cheer" size={120} className="breathe" />
          <div>
            <h1 className="text-3xl">{kid.name}</h1>
            <p className="text-muted">{read.length} stories read with Fig</p>
          </div>
        </div>

        <dl className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile icon={<Flame on={kid.streak > 0} size={28} />} value={kid.streak} label="day streak" />
          <Tile icon={<Star size={28} />} value={kid.stars} label="stars" />
          <Tile icon={<Heart on={kid.hearts > 0} size={28} />} value={kid.hearts} label={kid.hearts < MAX_HEARTS ? `+1 in ${waitMinutes}m` : "hearts"} />
          <Tile value={best} label="best words a minute" />
        </dl>

        <section className="card mb-6 p-5">
          <h2 className="text-xl">What Fig remembers</h2>
          {memories.length === 0 ? (
            <p className="mt-2 text-muted">Nothing yet. Read a story and Fig will start remembering.</p>
          ) : (
            <ul className="mt-3 grid gap-2">
              {memories.map((memory) => (
                <li key={`${memory.kind}-${memory.subject}`} className="flex items-start gap-3">
                  <span className="mt-0.5 shrink-0 rounded-full bg-leaf-soft px-3 py-1 text-xs font-medium text-leaf-ink">{KINDS[memory.kind] ?? memory.kind}</span>
                  <span>
                    <button className="font-medium underline decoration-line underline-offset-4" onClick={() => say(memory.subject, "read")}>
                      {memory.subject}
                    </button>
                    <span className="text-muted"> — {memory.note}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card p-5">
          <h2 className="text-xl">Grown-ups</h2>
          <p className="mt-1 text-muted">{email}</p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <button className="btn btn-quiet flex-1" onClick={addPasskey}>
              Add a passkey
            </button>
            <button className="btn btn-quiet flex-1" onClick={signOut}>
              Sign out
            </button>
          </div>
          {note && <p className="mt-3 text-leaf-ink">{note}</p>}
        </section>
      </main>
      <BottomNav />
    </Screen>
  );
}

function Tile({ icon, value, label }: { icon?: React.ReactNode; value: string | number; label: string }) {
  return (
    <div className="card flex flex-col items-center gap-1 px-2 py-4">
      {icon}
      <dd className="text-2xl font-medium">{value}</dd>
      <dt className="text-center text-xs text-muted">{label}</dt>
    </div>
  );
}
