<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1TOdZornhOU8jK_UaIOJejWWo6QMKmKU9

## Run Locally (Cloudflare Functions)

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Create `.dev.vars` with your Gemini key (for Cloudflare Functions):
   `GEMINI_API_KEY=YOUR_KEY`
3. (Optional) Create `.env.local` if you want to override Supabase in dev:
   `VITE_SUPABASE_URL=...`
   `VITE_SUPABASE_ANON_KEY=...`
4. Start Vite:
   `npm run dev`
5. Start Cloudflare Pages Functions (proxy to Vite):
   `npx wrangler pages dev --proxy 5173 --port 8788`
6. Open:
   `http://localhost:8788`

## Long Recording Notes

- Live recording is automatically split into 2-minute chunks for stability.
- Very large uploaded files may take longer and require the browser tab to stay open.

## Deploy (Cloudflare Pages)

1. Build:
   `npm run build`
2. In Cloudflare Pages, set:
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
3. Add environment variables:
   - `GEMINI_API_KEY`
   - (Optional) `GEMINI_MODEL_TRANSCRIBE`
   - (Optional) `GEMINI_MODEL_SUMMARIZE`
   - (Optional) `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

## Background Processing (R2 + Queues + Worker)

This app offloads transcription/summarization to a background Worker.

### 1) Create Cloudflare Resources
- R2 bucket (e.g. `milestone-audio`)
- Queue (e.g. `transcribe-queue`)

### 2) Bind Resources to Pages Functions
Bindings expected by Pages Functions:
- R2 bucket binding: `R2_BUCKET`
- Queue binding: `TRANSCRIBE_QUEUE`

### 3) Deploy Queue Consumer Worker
Worker source: `workers/queue-consumer.ts`

Required Worker environment variables:
- `GEMINI_API_KEY`
- (Optional) `GEMINI_MODEL_TRANSCRIBE`
- (Optional) `GEMINI_MODEL_SUMMARIZE`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- R2 binding: `R2_BUCKET`

The worker deletes audio segments after processing and only keeps transcript + minutes in Supabase.

Example `wrangler.toml` for the worker:
```toml
name = "milestone-queue-consumer"
main = "queue-consumer.ts"
compatibility_date = "2025-02-01"

[[r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "milestone-audio"

[queues]
consumers = [{ queue = "transcribe-queue" }]
```

Note: A ready config is included at `workers/wrangler.toml`.

Deploy:
`npm run worker:deploy`

## Notifications

- Desktop notification actions (e.g., "회의록 열기") require HTTPS and Service Worker.
- In production builds the app registers `/sw.js` automatically.

## Korea Latency Tips

- Create the Supabase project in the closest region to Korea (e.g., Seoul or nearby).
- Cloudflare Pages runs on the edge globally; for Workers/Queues, enable Smart Placement if available.
