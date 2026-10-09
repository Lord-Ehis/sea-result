import { PageHeader } from "@/components/ui/PageHeader";
import { SUPPORT_EMAIL } from "@/lib/legal";
import { formatLength, type HelpVideo } from "@/lib/help-videos";

// A Help page: each video with its steps written out underneath. Plain server
// component, no data: the same markup serves every role.
export function HelpVideos({ videos, note }: { videos: HelpVideo[]; note?: string }) {
  return (
    <>
      <PageHeader
        eyebrow="Help"
        title="Help and tutorials"
        intro="Short voiced walk-throughs, recorded on a practice school. Press play, or read the steps underneath."
      />

      {note && <p className="mb-6 rounded-md border border-border bg-bg-card px-4 py-3 text-caption text-text-secondary">{note}</p>}

      {videos.length > 2 && (
        <nav aria-label="Videos on this page" className="mb-6 rounded-md border border-border bg-bg-card px-5 py-4">
          <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.1em] text-primary">On this page</div>
          <ol className="m-0 grid gap-1 pl-5 text-body">
            {videos.map((v) => (
              <li key={v.id}>
                <a href={`#${v.id}`} className="text-primary hover:underline">
                  {v.title}
                </a>{" "}
                <span className="text-caption text-text-muted">· {formatLength(v.seconds)}</span>
              </li>
            ))}
          </ol>
        </nav>
      )}

      <div className="grid gap-6">
        {videos.map((v) => (
          <section key={v.id} id={v.id} className="overflow-hidden rounded-md border border-border bg-bg-card">
            <div className="px-5 py-4">
              <h2 className="m-0 text-heading font-medium text-text-primary">{v.title}</h2>
              <p className="mt-1 mb-0 text-caption text-text-muted">
                {v.summary} · {formatLength(v.seconds)}
              </p>
            </div>
            <video controls preload="metadata" playsInline className="block aspect-video w-full bg-black" aria-label={`${v.title} (captioned video)`}>
              {/* #t=6 shows the preview picture just after the title card (4 to 5 seconds, then a short fade), so the still isn't blank. */}
              <source src={`${v.file}#t=6`} type="video/mp4" />
              Your browser can&apos;t play this video. The steps are written out below.
            </video>
            <details className="border-t border-border px-5 py-4">
              <summary className="cursor-pointer text-caption font-medium text-primary">Read the steps</summary>
              <ol className="mt-3 mb-0 grid gap-1.5 pl-5 text-body text-text-secondary">
                {v.steps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
            </details>
          </section>
        ))}
      </div>

      <p className="mt-6 text-body text-text-muted">
        Still stuck? Write to <a href={`mailto:${SUPPORT_EMAIL}`} className="text-primary hover:underline">{SUPPORT_EMAIL}</a> and say which page you were on.
      </p>
    </>
  );
}
