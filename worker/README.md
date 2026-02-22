# Image Generation Worker

Processes image generation jobs from the `generation_jobs` queue. Runs on Railway (or any Docker host).

## Setup

1. Install dependencies:
   ```bash
   cd worker && npm install
   ```

2. Create `.env` with:
   ```
   SUPABASE_URL=https://xxx.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   OPENAI_API_KEY=sk-xxx
   ```

3. Build:
   ```bash
   npm run build
   ```

4. Run locally:
   ```bash
   npm start
   ```

## Railway Deployment

1. Connect the repo to Railway
2. Set root directory to `worker`
3. Build: `npm run build`
4. Start: `node dist/index.js`
5. Add env vars:
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`
   - For masked edits (brush strokes): `GEMINI_API_KEY` (get at https://aistudio.google.com/app/apikey)

Or use the Dockerfile:

- Build context: `worker/`
- Dockerfile expects `dist/` from `npm run build`
