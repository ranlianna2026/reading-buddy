import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("hello", "routes/hello.tsx"),
  route("read", "routes/read.tsx"),
  route("library", "routes/library.tsx"),
  route("me", "routes/me.tsx"),
  route("parent", "routes/parent.tsx"),
  route("api/auth/:action", "routes/api.auth.$action.ts"),
  route("api/passkey/:step", "routes/api.passkey.$step.ts"),
  route("api/settings", "routes/api.settings.ts"),
  route("api/story", "routes/api.story.ts"),
  route("api/talk", "routes/api.talk.ts"),
  route("api/speak", "routes/api.speak.ts"),
  route("api/voices", "routes/api.voices.ts"),
  route("api/listen", "routes/api.listen.ts"),
  route("api/finish", "routes/api.finish.ts"),
  route("api/picture/*", "routes/api.picture.ts"),
] satisfies RouteConfig;
