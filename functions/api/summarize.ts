type Env = {
  GEMINI_API_KEY: string;
  GEMINI_MODEL_SUMMARIZE?: string;
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

  const title = body?.title || "";
  const transcriptText = body?.transcriptText || "";

  if (!transcriptText) {
    return json({
      minutes: { agenda: [], summary: "실패", todos: [], schedules: [] },
    });
  }

  const model = env.GEMINI_MODEL_SUMMARIZE || DEFAULT_MODEL;

  const finalPrompt = `
다음 대화 내용을 바탕으로 회의록을 작성하세요.
중요: "액션 아이템(todos)"과 "주요 일정(schedules)"은 반드시 대화에서 언급된 각각의 항목들을 하나씩 별도의 배열 요소로 나누어 추출하세요.
절대로 여러 개의 할 일을 하나의 문자열로 합치지 마세요.

회의 제목: ${title}

대화 내용:
${transcriptText}
`;

  const payload = {
    contents: [{ role: "user", parts: [{ text: finalPrompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          minutes: {
            type: "object",
            properties: {
              agenda: {
                type: "array",
                items: { type: "string" },
              },
              summary: { type: "string" },
              todos: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    task: { type: "string" },
                    assignee: { type: "string" },
                    dueDate: { type: "string" },
                  },
                  required: ["task", "assignee", "dueDate"],
                },
              },
              schedules: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    event: { type: "string" },
                    date: { type: "string" },
                    time: { type: "string" },
                  },
                  required: ["event", "date", "time"],
                },
              },
            },
            required: ["agenda", "summary", "todos", "schedules"],
          },
        },
        required: ["minutes"],
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

  return json({
    minutes:
      parsed.minutes || { agenda: [], summary: "실패", todos: [], schedules: [] },
  });
};
