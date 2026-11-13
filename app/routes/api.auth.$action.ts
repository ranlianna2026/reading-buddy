import { checkPassword, clearedCookie, createUser, endSession, readerCookie, sessionCookie, startSession, userByEmail, userOf, EMAIL } from "~/lib/auth.server";
import { gradeOf } from "~/lib/grades";
import { addKid, kidsOf } from "~/lib/kid.server";
import type { Route } from "./+types/api.auth.$action";

const bad = (message: string, status = 400) => new Response(message, { status });

export async function action({ request, params }: Route.ActionArgs) {
  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");

  if (params.action === "signout") {
    await endSession(request);
    return new Response(null, { status: 204, headers: { "Set-Cookie": clearedCookie(request) } });
  }

  if (params.action === "reader") {
    const user = await userOf(request);
    if (!user) return bad("Sign in first.", 401);
    const want = String(form.get("kidId") ?? "");
    const kids = await kidsOf(user.id);
    if (!kids.some((kid) => kid.id === want)) return bad("No such reader.", 404);
    return Response.json({ kidId: want }, { headers: { "Set-Cookie": readerCookie(request, want) } });
  }

  if (params.action === "kid") {
    const user = await userOf(request);
    if (!user) return bad("Sign in first.", 401);
    const name = String(form.get("name") ?? "").trim();
    if (!name) return bad("What is your reader called?");
    const grade = gradeOf(String(form.get("grade") ?? ""));
    const age = Number(form.get("age"));
    const kidId = await addKid(user.id, name, Number.isFinite(age) && age > 0 ? age : grade.age, grade.id);
    return Response.json({ kidId, kids: await kidsOf(user.id) }, { headers: { "Set-Cookie": readerCookie(request, kidId) } });
  }

  if (!EMAIL.test(email)) return bad("That email does not look right.");
  if (password.length < 8) return bad("Use at least 8 characters for the password.");

  if (params.action === "signup") {
    if (await userByEmail(email)) return bad("That email already has an account. Sign in instead.");
    const userId = await createUser(email, password);
    const token = await startSession(userId);
    return Response.json({ ok: true, fresh: true }, { headers: { "Set-Cookie": sessionCookie(request, token) } });
  }

  if (params.action === "signin") {
    const user = await userByEmail(email);
    if (!user || !(await checkPassword(password, user.password_hash))) return bad("That email and password do not match.", 401);
    const token = await startSession(user.id);
    const kids = await kidsOf(user.id);
    return Response.json({ ok: true, fresh: kids.length === 0 }, { headers: { "Set-Cookie": sessionCookie(request, token) } });
  }

  return bad("Unknown action.", 404);
}
