export async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error((await res.text()) || `That did not work (${res.status}).`);
  return res.json() as Promise<T>;
}

export async function send<T>(path: string, form: FormData): Promise<T> {
  const res = await fetch(path, { method: "POST", body: form });
  if (!res.ok) throw new Error((await res.text()) || `That did not work (${res.status}).`);
  return (res.status === 204 ? null : await res.json()) as T;
}

export const fields = (values: Record<string, string | number | null | undefined>) => {
  const form = new FormData();
  for (const [key, value] of Object.entries(values)) if (value !== null && value !== undefined) form.set(key, String(value));
  return form;
};
