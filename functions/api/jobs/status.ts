type Env = {
  R2_BUCKET: any;
};

const json = (data: unknown, init: ResponseInit = {}) => {
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json; charset=utf-8");
  }
  return new Response(JSON.stringify(data), { ...init, headers });
};

export const onRequestGet = async ({
  request,
  env,
}: {
  request: Request;
  env: Env;
}) => {
  const url = new URL(request.url);
  const jobId = url.searchParams.get("jobId") || "";
  if (!jobId) return json({ status: "unknown" }, { status: 400 });

  const obj = await env.R2_BUCKET.get(`jobs/${jobId}/status.json`);
  if (!obj) return json({ status: "unknown" });

  try {
    const data = await obj.json();
    return json(data);
  } catch {
    return json({ status: "unknown" });
  }
};
