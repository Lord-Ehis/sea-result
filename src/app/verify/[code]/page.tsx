import { redirect } from "next/navigation";

// Lets a code be shared as a link (/verify/R7K4-P2M9); the check itself lives on /verify.
export default async function VerifyCodeRedirect({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  redirect(`/verify?code=${encodeURIComponent(code)}`);
}
