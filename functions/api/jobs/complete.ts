type Env = {
  R2_BUCKET: any;
  TRANSCRIBE_QUEUE: any;
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
  const userEmail = String(body?.userEmail || "").trim();
  const segments = Array.isArray(body?.segments) ? body.segments : [];

  if (!jobId || !userEmail || segments.length === 0) {
    return json({ error: "Missing jobId/userEmail/segments" }, { status: 400 });
  }

  const manifest = {
    jobId,
    userEmail,
    totalDuration: body?.totalDuration || "00:00",
    type: body?.type || "meeting",
    keywords: body?.keywords || [],
    title: body?.title || "",
    author: body?.author || userEmail,
    date: body?.date || new Date().toISOString().split("T")[0],
    category: body?.category || "기타",
    speakers: body?.speakers || [],
    segments,
    createdAt: new Date().toISOString(),
  };

  await env.R2_BUCKET.put(
    `jobs/${jobId}/manifest.json`,
    JSON.stringify(manifest),
    { httpMetadata: { contentType: "application/json" } }
  );

  await env.R2_BUCKET.put(
    `jobs/${jobId}/status.json`,
    JSON.stringify({
      status: "queued",
      totalSegments: segments.length,
      completedSegments: 0,
      updatedAt: new Date().toISOString(),
    }),
    { httpMetadata: { contentType: "application/json" } }
  );

  await env.TRANSCRIBE_QUEUE.send({ jobId });

  return json({ success: true, jobId });
};
