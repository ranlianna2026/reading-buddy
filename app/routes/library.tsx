import { redirect } from "react-router";

import { Buddy } from "~/components/buddy";
import { BottomNav, Crumbs, Screen, TopNav } from "~/components/chrome";
import { Cover } from "~/components/cover";
import { PLACES, seedOf, type Place } from "~/components/scene";
import { userOf } from "~/lib/auth.server";
import { heartsNow } from "~/lib/kid";
import { kidOf } from "~/lib/kid.server";
import { history } from "~/lib/memory.server";
import type { Route } from "./+types/library";

export const meta = () => [{ title: "Stories · Reading Buddy" }];

const SHELVES = [
  { name: "Animals", ideas: ["a brave snail", "a lost kitten", "the oldest tortoise", "a fox in the snow"] },
  { name: "Far away", ideas: ["outer space", "the deep sea", "a desert island", "the top of a mountain"] },
  { name: "Silly", ideas: ["a robot who cannot dance", "soup for breakfast", "a hat that talks", "the day it rained socks"] },
  { name: "Home", ideas: ["a birthday", "a new baby", "the first day of school", "grandma's kitchen"] },
];

export async function loader({ request }: Route.LoaderArgs) {
  const user = await userOf(request);
  if (!user) throw redirect("/hello");
  const kid = await kidOf(user.id);
  if (!kid) throw redirect("/hello?who=1");
  return { kid: { ...kid, hearts: heartsNow(kid) }, read: await history(kid.id, 8) };
}

export default function Library({ loaderData }: Route.ComponentProps) {
  const { kid, read } = loaderData;
  return (
    <Screen id="page-library">
      <TopNav left={<span className="text-lg font-medium">Stories</span>} right={<Crumbs kid={kid} />} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 pb-6">
        <div className="mb-6 flex items-center gap-4">
          <Buddy mood="hi" size={100} className="breathe" />
          <p className="bubble">Pick a book and I will write it just for you, {kid.name}.</p>
        </div>
        {read.length > 0 && (
          <section className="mb-7">
            <h2 className="mb-3 text-xl">Stories you have read</h2>
            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {read.map((row) => (
                <li key={row.id}>
                  <Cover title={row.title} by={kid.name} seed={row.seed} place={row.place as Place} />
                  <p className="mt-1.5 text-center text-xs text-muted">
                    {row.wcpm} wpm · {row.accuracy}%
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}
        {SHELVES.map((shelf) => (
          <section key={shelf.name} className="mb-7">
            <h2 className="mb-3 text-xl">{shelf.name}</h2>
            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {shelf.ideas.map((idea) => {
                const seed = seedOf(idea);
                return (
                  <li key={idea}>
                    <Cover
                      title={idea[0].toUpperCase() + idea.slice(1)}
                      seed={seed}
                      place={PLACES[seed % PLACES.length]}
                      to={`/read?topic=${encodeURIComponent(idea)}`}
                    />
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </main>
      <BottomNav />
    </Screen>
  );
}
