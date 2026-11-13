import type { AuthenticationResponseJSON, RegistrationResponseJSON } from "@simplewebauthn/server";

import { sessionCookie, startSession, userOf } from "~/lib/auth.server";
import { kidsOf } from "~/lib/kid.server";
import { registerCheck, registerOptions, signInCheck, signInOptions } from "~/lib/passkey.server";
import type { Route } from "./+types/api.passkey.$step";

export async function action({ request, params }: Route.ActionArgs) {
  try {
    if (params.step === "add-options") {
      const user = await userOf(request);
      if (!user) return new Response("Sign in first.", { status: 401 });
      const { options, cookie } = await registerOptions(request, user);
      return Response.json(options, { headers: { "Set-Cookie": cookie } });
    }

    if (params.step === "add") {
      const user = await userOf(request);
      if (!user) return new Response("Sign in first.", { status: 401 });
      const body = (await request.json()) as { response: RegistrationResponseJSON; label?: string };
      const id = await registerCheck(request, user, body.response, (body.label ?? "This device").slice(0, 40));
      return Response.json({ id });
    }

    if (params.step === "options") {
      const body = (await request.json().catch(() => ({}))) as { email?: string };
      const { options, cookie } = await signInOptions(request, body.email);
      return Response.json(options, { headers: { "Set-Cookie": cookie } });
    }

    if (params.step === "check") {
      const body = (await request.json()) as { response: AuthenticationResponseJSON };
      const userId = await signInCheck(request, body.response);
      const token = await startSession(userId);
      const kids = await kidsOf(userId);
      return Response.json({ ok: true, fresh: kids.length === 0 }, { headers: { "Set-Cookie": sessionCookie(request, token) } });
    }

    return new Response("Unknown step.", { status: 404 });
  } catch (error) {
    return new Response(error instanceof Error ? error.message : "That passkey did not work.", { status: 400 });
  }
}
