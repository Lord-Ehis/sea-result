import { PageHeader } from "@/components/ui/PageHeader";
import { SUPPORT_EMAIL } from "@/lib/legal";
import { formatLength, type HelpVideo } from "@/lib/help-videos";

// A Help page: each video with its steps written out underneath. Plain server
// component, no data: the same markup serves every role.
export function HelpVideos({ videos }: { videos: HelpVideo[] }) {
  return (
    <>
      <PageHeader
        eyebrow="Help"
        title="Help and tutorials"
        intro="Short walk-throughs with captions, recorded on a practice school. Press play, or read the steps underneath."
      />

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
              {/* #t=5 starts the preview just past the 4-second title card, so the still isn't black. */}
              <source src={`${v.file}#t=5`} type="video/mp4" />
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
