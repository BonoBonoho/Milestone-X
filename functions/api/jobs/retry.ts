type Env = {
  TRANSCRIBE_QUEUE: any;
  R2_BUCKET: any;
};

const json = (data: unknown, init: ResponseInit = {}) => {
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json; charset=utf-8");
  }
  return new Response(JSON.stringify(data), { ...init, headers });
};

export const onRequestPost = async ({
  request,
  env,
}: {
  request: Request;
  env: Env;
}) => {
  let body: any = null;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const jobId = String(body?.jobId || "").trim();
  if (!jobId) return json({ error: "Missing jobId" }, { status: 400 });

  let totalSegments = 0;
  const manifestObj = await env.R2_BUCKET.get(`jobs/${jobId}/manifest.json`);
  if (manifestObj) {
    try {
      const manifest = await manifestObj.json();
      totalSegments = Array.isArray(manifest.segments)
        ? manifest.segments.length
        : 0;
    } catch {}
  }

  await env.R2_BUCKET.put(
    `jobs/${jobId}/status.json`,
    JSON.stringify({
      status: "queued",
      totalSegments,
      completedSegments: 0,
      updatedAt: new Date().toISOString(),
    }),
    { httpMetadata: { contentType: "application/json" } }
  );

  await env.TRANSCRIBE_QUEUE.send({ jobId });
  return json({ success: true, jobId });
};
