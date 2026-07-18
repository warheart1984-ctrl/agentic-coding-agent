export interface PRParams {
  owner: string;
  repo: string;
  title: string;
  body: string;
  head: string;
  base: string;
  token: string;
}

export interface PRResult {
  html_url: string;
  number: number;
  state: string;
}

export async function createPR(params: PRParams): Promise<PRResult> {
  const url = `https://api.github.com/repos/${params.owner}/${params.repo}/pulls`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: params.title,
      body: params.body,
      head: params.head,
      base: params.base,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub PR failed (${res.status}): ${text.slice(0, 500)}`);
  }

  return (await res.json()) as PRResult;
}
