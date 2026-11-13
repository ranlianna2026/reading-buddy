import { Link, redirect } from "react-router";

import { Buddy } from "~/components/buddy";
import { BottomNav, Crumbs, Screen, TopNav } from "~/components/chrome";
import { userOf } from "~/lib/auth.server";
import { heartsNow, kidOf } from "~/lib/kid.server";
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
          <p className="bubble">Pick an idea and I will write a story just for you, {kid.name}.</p>
        </div>
        {SHELVES.map((shelf) => (
          <section key={shelf.name} className="mb-6">
            <h2 className="mb-2 text-xl">{shelf.name}</h2>
            <ul className="grid grid-cols-2 gap-3">
              {shelf.ideas.map((idea) => (
                <li key={idea}>
                  <Link
                    to={`/read?topic=${encodeURIComponent(idea)}`}
                    className="card flex h-full items-center px-4 py-5 text-[17px] font-medium hover:border-leaf"
                  >
                    {idea}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
        {read.length > 0 && (
          <section className="mb-6">
            <h2 className="mb-2 text-xl">Stories you have read</h2>
            <ul className="card divide-y-2 divide-line p-0">
              {read.map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-3 px-5 py-4">
                  <span className="font-medium">{row.title}</span>
                  <span className="text-sm text-muted">
                    {row.wcpm} wpm · {row.accuracy}%
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
      <BottomNav />
    </Screen>
  );
}
