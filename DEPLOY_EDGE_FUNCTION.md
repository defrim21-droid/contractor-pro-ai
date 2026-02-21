# Deploy Edge Function - Quick Guide

## Fix 401 Unauthorized

If you get **401** when calling the function from the app, you need to deploy **via CLI** (Option 2) so that `supabase/config.toml` is applied. That file sets `verify_jwt = false` for this function so the frontend can invoke it. The function still checks that the user owns the project.

---

## Option 1: Via Supabase Dashboard (No CLI needed)

### Steps:

1. **Open Supabase Dashboard**
   - Go to https://app.supabase.com
   - Select your project

2. **Navigate to Edge Functions**
   - Click **Edge Functions** in the left sidebar
   - Click **Create Function** button (top right)

3. **Create the Function**
   - **Function Name**: `generate-renovation`
   - **Template**: Choose "Blank" or "Hello World" (we'll replace it)

4. **Copy Function Code**
   - Open `supabase/functions/generate-renovation/index.ts` in your editor
   - Copy ALL the code (Cmd+A, Cmd+C / Ctrl+A, Ctrl+C)

5. **Paste and Deploy**
   - Delete any template code in the Supabase editor
   - Paste your code
   - Click **Deploy** button (bottom right)

6. **Verify**
   - You should see "Function deployed successfully"
   - The function should appear in your Edge Functions list

---

## Option 2: Via Supabase CLI (Recommended – fixes 401)

Deploying via CLI applies `supabase/config.toml`, which sets `verify_jwt = false` for `generate-renovation` and fixes 401 errors when invoking from the frontend.

### Prerequisites:
- Node.js installed
- Supabase CLI installed

### Steps:

1. **Install Supabase CLI** (if not already installed)
   ```bash
   npm install -g supabase
   ```

2. **Login to Supabase**
   ```bash
   supabase login
   ```
   - This will open your browser to authenticate

3. **Link your project**
   ```bash
   cd /Users/defrimsuljejmani/contractor-pro-ai
   supabase link --project-ref YOUR_PROJECT_REF
   ```
   - Find your project ref in Supabase Dashboard → Settings → General → Reference ID

4. **Deploy the function** (this uses `supabase/config.toml` and fixes 401)
   ```bash
   supabase functions deploy generate-renovation
   ```

5. **Verify**
   - Check Supabase Dashboard → Edge Functions
   - You should see `generate-renovation` listed
   - Try "Generate AI Render" in the app; it should no longer return 401

---

## Verify Deployment

### Test the function:

```bash
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/generate-renovation \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"projectId": "test-id"}'
```

Replace:
- `YOUR_PROJECT_REF` - Found in Supabase Dashboard → Settings → General
- `YOUR_ANON_KEY` - Found in Supabase Dashboard → Settings → API → anon/public key

### Check Logs:

1. Go to **Edge Functions** → **generate-renovation**
2. Click **Logs** tab
3. You should see function invocations and any errors

---

## Troubleshooting

### "Function not found" error
- Make sure the function name is exactly `generate-renovation` (lowercase, with hyphen)
- Verify it appears in your Edge Functions list

### "REPLICATE_API_TOKEN not configured" error
- Go to Settings → Edge Functions → Secrets
- Verify `REPLICATE_API_TOKEN` exists and has the correct value
- Secrets are case-sensitive

### 401 Unauthorized when calling from the app
- Deploy **via CLI** (Option 2) so `supabase/config.toml` is applied (`verify_jwt = false`).
- Dashboard-only deploys do not use `config.toml`, so 401 can persist.

### Function deployment fails
- Check that you copied ALL the code from `index.ts`
- Make sure there are no syntax errors
- Try deploying via Dashboard if CLI fails

---

## Next Steps

Once deployed:
1. ✅ Test by creating a project in your app
2. ✅ Upload an image and add swatches
3. ✅ Click "Generate AI Render"
4. ✅ Check Edge Function logs for success/errors
