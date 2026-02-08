type Env = {
  GEMINI_API_KEY: string;
  GEMINI_MODEL_TRANSCRIBE?: string;
  GEMINI_MODEL_SUMMARIZE?: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  R2_BUCKET: any;
};

type TranscriptPart = {
  speaker: string;
  text: string;
  timestamp: string;
};

type MeetingMinutes = {
  agenda: string[];
  summary: string;
  todos: Array<{ id: string; task: string; assignee: string; dueDate?: string; completed?: boolean; confirmed?: boolean }>;
  schedules: Array<{ id: string; event: string; date: string; time?: string; confirmed?: boolean }>;
};

const DEFAULT_MODEL = "gemini-2.5-flash";
const CHUNK_DURATION_SEC = 120;

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

const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
};

const formatOffset = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
};

const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const putStatus = async (
  env: Env,
  jobId: string,
  payload: Record<string, any>
) => {
  await env.R2_BUCKET.put(
    `jobs/${jobId}/status.json`,
    JSON.stringify({ ...payload, updatedAt: new Date().toISOString() }),
    { httpMetadata: { contentType: "application/json" } }
  );
};

const geminiGenerate = async (env: Env, model: string, payload: any) => {
  const res = await fetch(
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

  const apiJson = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = apiJson?.error?.message || `Gemini API error (${res.status})`;
    throw new Error(message);
  }
  return apiJson;
};

const transcribeChunk = async (
  env: Env,
  data: string,
  mimeType: string,
  offsetLabel: string
) => {
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

  const model = env.GEMINI_MODEL_TRANSCRIBE || DEFAULT_MODEL;
  const apiJson = await geminiGenerate(env, model, payload);
  const text = apiJson?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  const parsed = safeJsonParse(text) || {};
  return (parsed.transcript || []) as TranscriptPart[];
};

const summarizeTranscript = async (env: Env, title: string, transcriptText: string) => {
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
              agenda: { type: "array", items: { type: "string" } },
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

  const model = env.GEMINI_MODEL_SUMMARIZE || DEFAULT_MODEL;
  const apiJson = await geminiGenerate(env, model, payload);
  const text = apiJson?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  const parsed = safeJsonParse(text) || {};
  return (parsed.minutes || { agenda: [], summary: "실패", todos: [], schedules: [] }) as MeetingMinutes;
};

const normalizeMinutes = (minutes: MeetingMinutes): MeetingMinutes => {
  minutes.todos = (minutes.todos || []).map((t) => ({
    ...t,
    id: t.id || generateId(),
    completed: false,
    confirmed: false,
  }));
  minutes.schedules = (minutes.schedules || []).map((s) => ({
    ...s,
    id: s.id || generateId(),
    confirmed: false,
  }));
  return minutes;
};

const saveMeetingToSupabase = async (env: Env, meeting: any, userEmail: string) => {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/meetings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      id: meeting.id,
      user_email: userEmail,
      content: meeting,
      created_at: new Date(meeting.createdAt).toISOString(),
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Supabase insert failed: ${text || res.status}`);
  }
};

export default {
  async queue(batch: any, env: Env, ctx: any) {
    for (const message of batch.messages) {
      const { jobId } = message.body || {};
      if (!jobId) {
        message.ack();
        continue;
      }

      let stage = "init";
      let segmentIndex = -1;
      let segmentKey = "";
      try {
        stage = "load-manifest";
        const manifestObj = await env.R2_BUCKET.get(
          `jobs/${jobId}/manifest.json`
        );
        if (!manifestObj) {
          message.ack();
          continue;
        }

        const manifest = await manifestObj.json();
        const segments = Array.isArray(manifest.segments)
          ? manifest.segments
          : [];
        const totalSegments = segments.length;
        stage = "processing";
        await putStatus(env, jobId, {
          status: "processing",
          totalSegments,
          completedSegments: 0,
        });

        let fullTranscript: TranscriptPart[] = [];
        let offsetSeconds = 0;
        let completedSegments = 0;

        for (let i = 0; i < segments.length; i++) {
          const seg = segments[i];
          segmentIndex = i;
          segmentKey = seg.key || "";
          stage = "fetch-segment";
          const obj = await env.R2_BUCKET.get(seg.key);
          if (!obj) {
            offsetSeconds += seg.duration || CHUNK_DURATION_SEC;
            completedSegments += 1;
            await putStatus(env, jobId, {
              status: "processing",
              totalSegments,
              completedSegments,
            });
            continue;
          }
          stage = "decode-segment";
          const buffer = await obj.arrayBuffer();
          const base64 = arrayBufferToBase64(buffer);
          const offsetLabel = seg.offsetLabel || formatOffset(offsetSeconds);
          stage = "transcribe";
          const transcript = await transcribeChunk(
            env,
            base64,
            seg.mime,
            offsetLabel
          );
          if (transcript?.length) fullTranscript.push(...transcript);
          offsetSeconds += seg.duration || CHUNK_DURATION_SEC;
          completedSegments += 1;
          await putStatus(env, jobId, {
            status: "processing",
            totalSegments,
            completedSegments,
          });
        }

        const transcriptText = fullTranscript
          .map((t) => `[${t.timestamp}] ${t.speaker}: ${t.text}`)
          .join("\n");
        stage = "summarize";
        const minutes = normalizeMinutes(
          await summarizeTranscript(env, manifest.title, transcriptText)
        );

        const meetingDate = new Date(manifest.date)
          .toISOString()
          .split("T")[0];
        const meeting = {
          id: crypto.randomUUID(),
          jobId: manifest.jobId,
          title: manifest.title,
          author: manifest.author,
          category: manifest.category,
          group: "회의록",
          speakers: manifest.speakers || [],
          date: meetingDate,
          duration: manifest.totalDuration || "00:00",
          type: manifest.type || "meeting",
          transcript: fullTranscript,
          minutes,
          keywords: manifest.keywords || [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        stage = "save-supabase";
        await saveMeetingToSupabase(env, meeting, manifest.userEmail);

        stage = "finalize";
        await putStatus(env, jobId, {
          status: "completed",
          meetingId: meeting.id,
          totalSegments,
          completedSegments,
        });

        // Delete audio segments to reduce storage cost
        for (const seg of segments) {
          await env.R2_BUCKET.delete(seg.key);
        }

        message.ack();
      } catch (err: any) {
        await putStatus(env, jobId, {
          status: "failed",
          error: err?.message || String(err),
          stage,
          segmentIndex,
          segmentKey,
        });
        message.retry();
      }
    }
  },
};
