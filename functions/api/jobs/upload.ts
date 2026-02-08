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

export const onRequestPost = async ({
  request,
  env,
}: {
  request: Request;
  env: Env;
}) => {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ error: "Invalid form data" }, { status: 400 });
  }

  const jobId = String(form.get("jobId") || "").trim();
  const index = String(form.get("index") || "").trim();
  const mimeType = String(form.get("mimeType") || "").trim();
  const duration = String(form.get("duration") || "0").trim();
  const file = form.get("file");

  if (!jobId || !index || !file || !(file instanceof File)) {
    return json({ error: "Missing jobId/index/file" }, { status: 400 });
  }

  const finalMime = mimeType || file.type || "application/octet-stream";
  const ext = finalMime.split("/")[1] || "bin";
  const key = `jobs/${jobId}/segments/${index}.${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  await env.R2_BUCKET.put(key, arrayBuffer, {
    httpMetadata: { contentType: finalMime },
    customMetadata: { duration },
  });

  return json({ key });
};
