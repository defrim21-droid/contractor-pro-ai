# Fixing 401 Error on Edge Function

## The Problem
Getting `401 Unauthorized` when calling the Edge Function, even though the user is authenticated.

## Root Cause
Supabase Edge Functions require proper authentication. The 401 error is coming from Supabase's gateway **before** the request reaches your function code.

## Solutions to Try

### Solution 1: Verify Edge Function is Deployed Correctly

1. Go to **Supabase Dashboard** → **Edge Functions** → **generate-renovation**
2. Make sure it shows as **"Deployed"** (green status)
3. Check the **Logs** tab - do you see any requests coming through?
4. If not, the function might not be deployed correctly

### Solution 2: Check Function Code

Make sure your Edge Function code includes:
- CORS headers
- OPTIONS request handling
- Proper error responses

### Solution 3: Verify Authentication

The `supabase.functions.invoke()` method should automatically handle authentication. Make sure:

1. User is logged in (check browser console for session)
2. Session is valid (not expired)
3. You're not manually adding Authorization headers (let Supabase handle it)

### Solution 4: Test Edge Function Directly

Test the function with curl to see if it's a frontend issue:

```bash
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/generate-renovation \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"projectId": "test-id"}'
```

Replace:
- `YOUR_PROJECT_REF` - Your Supabase project reference
- `YOUR_ANON_KEY` - Your Supabase anon key

### Solution 5: Check Supabase Project Settings

1. Go to **Settings** → **API**
2. Make sure **Edge Functions** are enabled
3. Check if there are any restrictions on Edge Function access

### Solution 6: Redeploy Function

Sometimes redeploying fixes configuration issues:

1. Copy entire code from `supabase/functions/generate-renovation/index.ts`
2. Go to **Edge Functions** → **generate-renovation**
3. Paste code
4. Click **Deploy**
5. Wait for deployment to complete
6. Test again

## Debugging Steps

1. **Check Browser Console:**
   - Look for "Session valid, invoking Edge Function"
   - Check for any auth errors

2. **Check Supabase Dashboard Logs:**
   - Go to **Edge Functions** → **generate-renovation** → **Logs**
   - Do you see any requests? If not, the 401 is happening at the gateway level

3. **Check Network Tab:**
   - Open browser DevTools → Network tab
   - Look for the request to `generate-renovation`
   - Check the request headers
   - Check the response

## Expected Behavior

When working correctly:
- Browser console: "Session valid, invoking Edge Function"
- Browser console: "Edge Function invoked successfully"
- Supabase logs: "Request method: POST"
- Supabase logs: "Edge Function invoked for project: [id]"

## If Still Not Working

If you've tried all the above and still get 401:

1. Check if other Edge Functions work (create a simple test function)
2. Contact Supabase support with:
   - Your project reference
   - The exact error message
   - Screenshot of Edge Function logs
   - Browser console errors

## Alternative: Use Database Webhooks

If Edge Functions continue to have auth issues, you could:
1. Use Supabase Database Webhooks to trigger AI generation
2. Use a separate backend service
3. Call Replicate API directly from frontend (less secure, but works)
