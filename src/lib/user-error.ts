// Server actions: errors a person can act on ("score above the maximum",
// "this result is already submitted") must reach them as *values*. An
// exception thrown from a server action is replaced by a generic message in
// production builds, so throwing `UserError` inside the action and letting
// `toResult` turn it into `{ ok: false, error }` keeps the real message.
// Anything that isn't a UserError is a genuine bug and still throws.

export class UserError extends Error {}

export type ActionResult<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string };

export async function toResult<T extends object>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, ...(await fn()) };
  } catch (err) {
    if (err instanceof UserError) return { ok: false, error: err.message };
    throw err;
  }
}
