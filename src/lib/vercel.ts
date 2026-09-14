const VERCEL_API = "https://api.vercel.com";

function config() {
  const token = process.env.VERCEL_API_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  const teamId = process.env.VERCEL_TEAM_ID;
  if (!token || !projectId) {
    throw new Error("Vercel domain management is not configured (VERCEL_API_TOKEN/VERCEL_PROJECT_ID missing).");
  }
  return { token, projectId, teamId };
}

function withTeam(path: string) {
  const { teamId } = config();
  return teamId ? `${path}${path.includes("?") ? "&" : "?"}teamId=${teamId}` : path;
}

async function vercelFetch(path: string, init?: RequestInit) {
  const { token } = config();
  const res = await fetch(`${VERCEL_API}${withTeam(path)}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.error?.message || `Vercel API request failed (${res.status}).`);
  }
  return json;
}

export type DomainVerification = { type: string; domain: string; value: string; reason: string };

export async function addDomainToProject(domain: string) {
  const { projectId } = config();
  return vercelFetch(`/v10/projects/${projectId}/domains`, {
    method: "POST",
    body: JSON.stringify({ name: domain }),
  }) as Promise<{ name: string; apexName: string; verified: boolean; verification?: DomainVerification[] }>;
}

export async function removeDomainFromProject(domain: string) {
  const { projectId } = config();
  return vercelFetch(`/v9/projects/${projectId}/domains/${domain}`, { method: "DELETE" });
}

export async function getDomainConfig(domain: string) {
  return vercelFetch(`/v6/domains/${domain}/config`) as Promise<{
    misconfigured: boolean;
    recommendedCNAME?: { rank: number; value: string }[];
  }>;
}
