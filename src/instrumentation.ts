import type { Instrumentation } from "next";

// Next.js calls this for every error it catches on the server: a page that
// fails to render, an API route that throws, a form action that crashes. They
// are recorded for the owner's Errors page and the owner is emailed (see
// src/lib/error-capture.ts). The sign-in check (proxy) runs on a different
// runtime without database access, so only the Node.js runtime records. The
// import has to sit inside this exact check for Next to leave the database
// code out of the other runtime's bundle.
export const onRequestError: Instrumentation.onRequestError = async (err, _request, context) => {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { captureServerError } = await import("@/lib/error-capture");
    await captureServerError(err, { routePath: context.routePath, routeType: context.routeType });
  }
};
