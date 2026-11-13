import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";

import { Buddy } from "~/components/buddy";
import { Focus, Screen } from "~/components/chrome";
import { Hero } from "~/components/hero";
import { fields, post, send } from "~/lib/api";
import { GRADES, SPAN } from "~/lib/grades";
import { userOf } from "~/lib/auth.server";
import { kidsOf } from "~/lib/kid.server";
import type { Route } from "./+types/hello";

export const meta = () => [{ title: "Hello · Reading Buddy" }];

export async function loader({ request }: Route.LoaderArgs) {
  const user = await userOf(request);
  return { signedIn: Boolean(user), kids: user ? (await kidsOf(user.id)).length : 0 };
}

export default function Hello({ loaderData }: Route.ComponentProps) {
  const [params] = useSearchParams();
  const go = useNavigate();
  const [step, setStep] = useState<"in" | "who">(loaderData.signedIn || params.has("who") ? "who" : "in");
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [grade, setGrade] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const run = async (what: string, work: () => Promise<void>) => {
    setBusy(what);
    setError("");
    try {
      await work();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "That did not work.");
    }
    setBusy("");
  };

  const withPassword = () =>
    run("password", async () => {
      const result = await send<{ fresh: boolean }>(`/api/auth/${mode === "up" ? "signup" : "signin"}`, fields({ email, password }));
      result.fresh ? setStep("who") : go("/read");
    });

  const withPasskey = () =>
    run("passkey", async () => {
      const options = await post<Parameters<typeof startAuthentication>[0]["optionsJSON"]>("/api/passkey/options", { email: email || undefined });
      const response = await startAuthentication({ optionsJSON: options });
      const result = await post<{ fresh: boolean }>("/api/passkey/check", { response });
      result.fresh ? setStep("who") : go("/read");
    });

  const addPasskey = () =>
    run("add", async () => {
      const options = await post<Parameters<typeof startRegistration>[0]["optionsJSON"]>("/api/passkey/add-options", {});
      const response = await startRegistration({ optionsJSON: options });
      await post("/api/passkey/add", { response, label: "This device" });
    });

  const addKid = () =>
    run("kid", async () => {
      await send("/api/auth/kid", fields({ name, grade }));
      go("/read");
    });

  if (step === "who") {
    return (
      <Screen id="page-who">
        <Hero />
        <Focus intro={step}>
          <Buddy mood="hi" size={170} className="breathe" />
          <h1 className="text-4xl">Who is reading today?</h1>
          <p className="mono text-muted">{SPAN}</p>
          <p className="text-muted">Fig will remember them: what they love, and which words are still tricky.</p>
          <form
            className="card flex w-full flex-col gap-5 bg-surface/92 p-6 text-left backdrop-blur-sm"
            onSubmit={(event) => {
              event.preventDefault();
              if (name.trim() && grade) addKid();
            }}
          >
            <fieldset>
              <legend className="mb-2 font-medium">Which grade are you in?</legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {GRADES.map((one) => (
                  <button
                    key={one.id}
                    type="button"
                    className="option text-center"
                    aria-pressed={grade === one.id}
                    onClick={() => setGrade(one.id)}
                  >
                    <span className="block font-medium">{one.short}</span>
                    <span className="mono block text-muted">age {one.age}</span>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-sm text-muted">
                Reading Buddy writes for {SPAN}. The grade sets the first reading level and the words-a-minute
                Fig measures against; it moves with them as they read.
              </p>
            </fieldset>
            <label className="flex flex-col gap-2 font-medium">
              Their name
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={40}
                placeholder="Mila"
                className="h-14 rounded-2xl border-2 border-line bg-page px-4 text-lg outline-none focus:border-leaf"
              />
            </label>
            <button className="btn btn-leaf w-full" disabled={!name.trim() || !grade || busy === "kid"}>
              {busy === "kid" ? "One moment…" : "Start reading"}
            </button>
            <button type="button" className="text-sm font-medium text-leaf-ink underline" onClick={addPasskey} disabled={busy === "add"}>
              {busy === "add" ? "Asking your device…" : "Add a passkey, so next time there is no password"}
            </button>
            {error && <p className="text-berry-ink">{error}</p>}
          </form>
        </Focus>
      </Screen>
    );
  }

  return (
    <Screen id="page-hello">
      <Hero />
      <Focus intro={mode}>
        <Buddy mood="hi" size={180} className="breathe" />
        <h1 className="text-4xl">Reading Buddy</h1>
        <p className="text-lg text-muted">Pick a story, read it out loud to Fig, then talk about it.</p>
        <p className="mono text-muted">{SPAN}</p>
        <form
          className="card flex w-full flex-col gap-4 bg-surface/92 p-6 text-left backdrop-blur-sm"
          onSubmit={(event) => {
            event.preventDefault();
            withPassword();
          }}
        >
          <label className="flex flex-col gap-2 font-medium">
            Grown-up's email
            <input
              type="email"
              autoComplete="username webauthn"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@home.com"
              className="h-14 rounded-2xl border-2 border-line bg-page px-4 text-lg outline-none focus:border-leaf"
            />
          </label>
          <label className="flex flex-col gap-2 font-medium">
            Password
            <input
              type="password"
              autoComplete={mode === "up" ? "new-password" : "current-password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="at least 8 characters"
              className="h-14 rounded-2xl border-2 border-line bg-page px-4 text-lg outline-none focus:border-leaf"
            />
          </label>
          <button className="btn btn-leaf w-full" disabled={busy === "password"}>
            {busy === "password" ? "One moment…" : mode === "up" ? "Make an account" : "Sign in"}
          </button>
          <button type="button" className="btn btn-quiet w-full" onClick={withPasskey} disabled={busy === "passkey"}>
            {busy === "passkey" ? "Asking your device…" : "Use a passkey"}
          </button>
          <button type="button" className="text-sm font-medium text-leaf-ink underline" onClick={() => setMode(mode === "up" ? "in" : "up")}>
            {mode === "up" ? "I already have an account" : "New here? Make an account"}
          </button>
          {error && <p className="text-berry-ink">{error}</p>}
        </form>
      </Focus>
    </Screen>
  );
}
