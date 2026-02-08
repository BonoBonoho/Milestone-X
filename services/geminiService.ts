import {
  AnalysisResponse,
  KeywordCorrection,
  MeetingMinutes,
  MeetingType,
  TranscriptPart,
} from "../types";

// Keep chunks small to avoid serverless request limits.
const CHUNK_DURATION_SEC = 120;

interface UploadChunk {
  blob: Blob;
  mime: string;
  duration: number;
}

const generateId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const API_BASE = (import.meta.env.VITE_AI_API_BASE || "").replace(/\/$/, "");

const postJson = async <T>(path: string, body: any, signal?: AbortSignal): Promise<T> => {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    const message = await res.text().catch(() => "");
    throw new Error(message || `요청 실패 (${res.status})`);
  }
  try {
    return await res.json();
  } catch {
    throw new Error("서버 응답 파싱 실패");
  }
};

const formatOffset = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
};

// --- WAV Encoder Helpers ---
function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

function floatTo16BitPCM(
  output: DataView,
  offset: number,
  input: Float32Array
) {
  for (let i = 0; i < input.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
}

function createWavBlob(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, "data");
  view.setUint32(40, samples.length * 2, true);
  floatTo16BitPCM(view, 44, samples);
  return new Blob([view], { type: "audio/wav" });
}

async function decodeAndSplitAudio(file: File): Promise<UploadChunk[]> {
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  const audioContext = new AudioContextClass({ sampleRate: 16000 });
  try {
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    const pcmData = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    const samplesPerChunk = sampleRate * CHUNK_DURATION_SEC;
    const chunks: UploadChunk[] = [];
    for (let i = 0; i < pcmData.length; i += samplesPerChunk) {
      const slice = pcmData.slice(i, i + samplesPerChunk);
      const wavBlob = createWavBlob(slice, sampleRate);
      chunks.push({
        blob: wavBlob,
        duration: slice.length / sampleRate,
        mime: "audio/wav",
      });
    }
    return chunks;
  } finally {
    audioContext.close();
  }
}

const base64ToBlob = (base64: string, mime: string): Blob => {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
};

const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve((reader.result as string).split(",")[1] || "");
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

const uploadChunk = async (
  jobId: string,
  index: number,
  chunk: UploadChunk,
  signal?: AbortSignal
) => {
  const form = new FormData();
  const ext = chunk.mime.split("/")[1] || "wav";
  const file = new File([chunk.blob], `chunk-${index}.${ext}`, {
    type: chunk.mime,
  });
  form.append("jobId", jobId);
  form.append("index", String(index));
  form.append("mimeType", chunk.mime);
  form.append("duration", String(Math.round(chunk.duration || 0)));
  form.append("file", file);

  const res = await fetch(`${API_BASE}/api/jobs/upload`, {
    method: "POST",
    body: form,
    signal,
  });
  if (!res.ok) {
    const message = await res.text().catch(() => "");
    throw new Error(message || `업로드 실패 (${res.status})`);
  }
  const json = await res.json().catch(() => ({}));
  if (!json?.key) throw new Error("업로드 응답 오류");
  return { key: json.key as string, mime: chunk.mime, duration: chunk.duration };
};

const createJobId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

export const enqueueAudioMeeting = async (
  audioSegments: {
    base64?: string;
    file?: File;
    mimeType: string;
    duration?: number;
  }[],
  totalDuration: string,
  type: MeetingType,
  keywords: KeywordCorrection[],
  metadata: {
    title: string;
    author: string;
    date: string;
    category: string;
    speakers: string[];
  },
  userEmail: string,
  options?: { signal?: AbortSignal }
): Promise<{ jobId: string; segmentCount: number }> => {
  if (!audioSegments || audioSegments.length === 0)
    throw new Error("분석할 데이터 없음");

  const processedChunks: UploadChunk[] = [];
  for (const seg of audioSegments) {
    if (seg.file) {
      const wavChunks = await decodeAndSplitAudio(seg.file);
      processedChunks.push(...wavChunks);
    } else if (seg.base64) {
      processedChunks.push({
        blob: base64ToBlob(seg.base64, seg.mimeType),
        duration: seg.duration || 0,
        mime: seg.mimeType,
      });
    }
  }

  const jobId = createJobId();
  const uploadedSegments = [];
  let offsetSeconds = 0;
  for (let i = 0; i < processedChunks.length; i++) {
    if (options?.signal?.aborted) {
      throw new Error("업로드가 취소되었습니다.");
    }
    const uploaded = await uploadChunk(jobId, i, processedChunks[i], options?.signal);
    uploadedSegments.push({
      ...uploaded,
      offsetLabel: formatOffset(offsetSeconds),
    });
    offsetSeconds += Math.round(processedChunks[i].duration || CHUNK_DURATION_SEC);
  }

  if (uploadedSegments.length === 0) {
    throw new Error("업로드할 오디오가 없습니다.");
  }

  await postJson(
    "/api/jobs/complete",
    {
    jobId,
    userEmail,
    totalDuration,
    type,
    keywords,
    title: metadata.title,
    author: metadata.author,
    date: metadata.date,
    category: metadata.category,
    speakers: metadata.speakers,
    segments: uploadedSegments,
    },
    options?.signal
  );

  return { jobId, segmentCount: uploadedSegments.length };
};

const getJson = async <T>(path: string): Promise<T> => {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) {
    const message = await res.text().catch(() => "");
    throw new Error(message || `요청 실패 (${res.status})`);
  }
  return (await res.json()) as T;
};

export const fetchJobStatus = async (jobId: string) => {
  const qp = encodeURIComponent(jobId);
  return await getJson<{
    status: "queued" | "processing" | "completed" | "failed" | "unknown";
    totalSegments?: number;
    completedSegments?: number;
    error?: string;
    updatedAt?: string;
  }>(`/api/jobs/status?jobId=${qp}`);
};

export const retryJob = async (jobId: string) => {
  return await postJson<{ success: boolean; jobId: string }>(
    "/api/jobs/retry",
    { jobId }
  );
};

export const processAudioMeeting = async (
  audioSegments: {
    base64?: string;
    file?: File;
    mimeType: string;
    duration?: number;
  }[],
  totalDuration: string,
  title: string,
  type: MeetingType = "meeting",
  keywords: KeywordCorrection[] = [],
  speakers: string[] = []
): Promise<AnalysisResponse> => {
  if (!audioSegments || audioSegments.length === 0)
    throw new Error("분석할 데이터 없음");

  const processedChunks: { data: string; mime: string; duration?: number }[] =
    [];
  for (const seg of audioSegments) {
    if (seg.file) {
      const wavChunks = await decodeAndSplitAudio(seg.file);
      for (const chunk of wavChunks) {
        const data = await blobToBase64(chunk.blob);
        processedChunks.push({
          data,
          mime: chunk.mime,
          duration: chunk.duration,
        });
      }
    } else if (seg.base64) {
      processedChunks.push({
        data: seg.base64,
        mime: seg.mimeType,
        duration: seg.duration,
      });
    }
  }

  return await processInChunks(processedChunks, title);
};

const processInChunks = async (
  chunks: { data: string; mime: string; duration?: number }[],
  title: string
): Promise<AnalysisResponse> => {
  let fullTranscript: TranscriptPart[] = [];
  let currentOffsetSeconds = 0;

  for (let i = 0; i < chunks.length; i++) {
    const offsetLabel = formatOffset(currentOffsetSeconds);
    try {
      const result = await postJson<{ transcript?: TranscriptPart[] }>(
        "/api/transcribe",
        {
          data: chunks[i].data,
          mimeType: chunks[i].mime,
          offsetLabel,
        }
      );
      if (result?.transcript)
        fullTranscript = [...fullTranscript, ...result.transcript];
      currentOffsetSeconds += chunks[i].duration || CHUNK_DURATION_SEC;
    } catch (e) {
      console.error(e);
    }
  }

  const transcriptText = fullTranscript
    .map((t) => `[${t.timestamp}] ${t.speaker}: ${t.text}`)
    .join("\n");
  const finalJson = await postJson<{ minutes?: MeetingMinutes }>(
    "/api/summarize",
    { title, transcriptText }
  );
  const minutes = finalJson.minutes || {
    agenda: [],
    summary: "실패",
    todos: [],
    schedules: [],
  };

  minutes.todos = (minutes.todos || []).map((t: any) => ({
    ...t,
    id: generateId(),
    completed: false,
    confirmed: false,
  }));
  minutes.schedules = (minutes.schedules || []).map((s: any) => ({
    ...s,
    id: generateId(),
    confirmed: false,
  }));

  return { transcript: fullTranscript, minutes };
};
