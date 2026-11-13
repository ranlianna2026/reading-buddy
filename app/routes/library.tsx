import { redirect } from "react-router";

import { Buddy } from "~/components/buddy";
import { BottomNav, Crumbs, PAGE, Screen, TopNav } from "~/components/chrome";
import { Cover } from "~/components/cover";
import { seedOf } from "~/lib/seed";
import { userOf } from "~/lib/auth.server";
import { heartsNow } from "~/lib/kid";
import { reading } from "~/lib/kid.server";
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
  const kid = await reading(request, user.id);
  if (!kid) throw redirect("/hello?who=1");
  return { kid: { ...kid, hearts: heartsNow(kid) }, read: await history(kid.id, 8) };
}

export default function Library({ loaderData }: Route.ComponentProps) {
  const { kid, read } = loaderData;
  return (
    <Screen id="page-library">
      <TopNav left={<span className="text-lg font-medium">Stories</span>} right={<Crumbs kid={kid} />} />
      <main className={`mx-auto w-full flex-1 px-5 pb-6 ${PAGE}`}>
        <div className="mb-6 flex items-center gap-4">
          <Buddy mood="hi" size={100} className="breathe" />
        </div>
        {read.length > 0 && (
          <section className="mb-7">
            <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {read.map((row, i) => (
                <li key={row.id} className="h-full">
                  <Cover title={row.title} by={kid.name} picture={row.picture} seed={row.seed} n={read.length - i} note={`${row.wcpm} wpm`} />
                </li>
              ))}
            </ul>
          </section>
        )}
        {SHELVES.map((shelf) => (
          <section key={shelf.name} className="mb-7">
            <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {shelf.ideas.map((idea, at) => {
                const seed = seedOf(idea);
                return (
                  <li key={idea} className="h-full">
                    <Cover
                      title={idea[0].toUpperCase() + idea.slice(1)}
                      seed={seed}
                      draw={`A children's picture-book cover about ${idea}.`}
                      at={at}
                      label={shelf.name}
                      note="unread"
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
