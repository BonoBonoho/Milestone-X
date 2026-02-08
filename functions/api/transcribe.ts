type Env = {
  GEMINI_API_KEY: string;
  GEMINI_MODEL_TRANSCRIBE?: string;
};

const DEFAULT_MODEL = "gemini-2.5-flash";

const json = (data: unknown, init: ResponseInit = {}) => {
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json; charset=utf-8");
  }
  return new Response(JSON.stringify(data), { ...init, headers });
};

const safeJsonParse = (text: string) => {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
};

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }) => {
  if (!env.GEMINI_API_KEY) {
    return json({ error: "Missing GEMINI_API_KEY" }, { status: 500 });
  }

  let body: any = null;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const data = body?.data;
  const mimeType = body?.mimeType;
  const offsetLabel = body?.offsetLabel || "00:00";

  if (!data || !mimeType) {
    return json({ error: "Missing data or mimeType" }, { status: 400 });
  }

  const model = env.GEMINI_MODEL_TRANSCRIBE || DEFAULT_MODEL;

  const prompt = [
    `받아쓰기 및 화자 분리 수행(${offsetLabel}부터).`,
    "반드시 JSON으로만 응답하세요.",
    "timestamp는 MM:SS 형식이며 현재 청크 기준입니다.",
    "speaker는 사람이름 또는 Speaker 1, Speaker 2 형태로 작성하세요.",
  ].join(" ");

  const payload = {
    contents: [
      {
        role: "user",
        parts: [
          {
            inline_data: {
              mime_type: mimeType,
              data,
            },
          },
          { text: prompt },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          transcript: {
            type: "array",
            items: {
              type: "object",
              properties: {
                speaker: { type: "string" },
                text: { type: "string" },
                timestamp: { type: "string" },
              },
              required: ["speaker", "text", "timestamp"],
            },
          },
        },
        required: ["transcript"],
      },
    },
  };

  const apiRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": env.GEMINI_API_KEY,
      },
      body: JSON.stringify(payload),
    }
  );

  const apiJson = await apiRes.json().catch(() => ({}));
  if (!apiRes.ok) {
    const message =
      apiJson?.error?.message || `Gemini API error (${apiRes.status})`;
    return json({ error: message }, { status: apiRes.status });
  }

  const text =
    apiJson?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  const parsed = safeJsonParse(text) || {};

  return json({ transcript: parsed.transcript || [] });
};
