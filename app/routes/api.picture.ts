import { guard, respond, text } from "~/lib/ai.server";
import { picture, served } from "~/lib/picture.server";
import type { Route } from "./+types/api.picture";

export async function loader({ params }: Route.LoaderArgs) {
  return served(decodeURIComponent(params["*"] ?? ""));
}

export async function action({ request }: Route.ActionArgs) {
  return respond(async () => {
    const body = await guard(request);
    const page = text(body.page, 1200);
    if (!page) throw new Error("Nothing to draw.");
    return picture({
      title: text(body.title, 80) || "A story",
      page,
      kind: ["book", "story", "series", "new"].includes(String(body.kind)) ? String(body.kind) : "new",
      cast: text(body.cast, 400),
      reference: text(body.reference, 4000),
      avoid: text(body.avoid, 200),
    });
  });
}
