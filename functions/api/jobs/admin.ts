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
  const statusFilter = url.searchParams.get("status");
  const limit = Math.min(
    Math.max(parseInt(url.searchParams.get("limit") || "30", 10), 1),
    100
  );

  const list = await env.R2_BUCKET.list({
    prefix: "jobs/",
    delimiter: "/",
    limit: 1000,
  });

  const prefixes = list?.prefixes || [];
  const records: any[] = [];

  for (const prefix of prefixes) {
    const jobId = prefix.replace("jobs/", "").replace("/", "");
    if (!jobId) continue;

    const statusObj = await env.R2_BUCKET.get(
      `jobs/${jobId}/status.json`
    );
    if (!statusObj) continue;
    let status: any = {};
    try {
      status = await statusObj.json();
    } catch {
      status = { status: "unknown" };
    }

    if (statusFilter && status.status !== statusFilter) continue;

    let manifest: any = {};
    const manifestObj = await env.R2_BUCKET.get(
      `jobs/${jobId}/manifest.json`
    );
    if (manifestObj) {
      try {
        manifest = await manifestObj.json();
      } catch {}
    }

    records.push({
      jobId,
      status: status.status || "unknown",
      error: status.error,
      stage: status.stage,
      segmentIndex: status.segmentIndex,
      segmentKey: status.segmentKey,
      totalSegments: status.totalSegments,
      completedSegments: status.completedSegments,
      updatedAt: status.updatedAt,
      title: manifest.title,
      userEmail: manifest.userEmail,
      createdAt: manifest.createdAt,
    });
  }

  records.sort((a, b) => {
    const ta = a.updatedAt ? Date.parse(a.updatedAt) : 0;
    const tb = b.updatedAt ? Date.parse(b.updatedAt) : 0;
    return tb - ta;
  });

  return json({ data: records.slice(0, limit) });
};
