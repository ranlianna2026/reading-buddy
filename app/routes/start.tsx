import { redirect } from "react-router";

import { userOf } from "~/lib/auth.server";
import { kidsOf } from "~/lib/kid.server";
import type { Route } from "./+types/start";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await userOf(request);
  if (!user) throw redirect("/hello");
  const kids = await kidsOf(user.id);
  throw redirect(kids.length ? "/read" : "/hello?who=1");
}

export default function Start() {
  return null;
}
