/**
 * Enqueue image generation job for Railway worker.
 * Does NOT perform image generation; inserts into generation_jobs table.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed. Use POST.' }),
      { status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: 'Missing Authorization header.' }),
      { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  let body: {
    projectId?: string;
    prompt?: string;
    samples?: { name: string; url: string }[];
    mask?: string;
    inputImageUrl?: string;
  };
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body.' }),
      { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  const { projectId, prompt, samples: rawSamples, mask: maskImageUrl, inputImageUrl: rawInputImageUrl } = body;
  const samples = Array.isArray(rawSamples)
    ? rawSamples.filter((s) => s && typeof s.url === 'string' && s.url.trim().length > 0)
    : [];

  if (!projectId || typeof prompt !== 'string' || !prompt.trim()) {
    return new Response(
      JSON.stringify({ error: 'Missing or invalid projectId or prompt.' }),
      { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabaseAuth = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  const { data: project, error: fetchError } = await supabaseAuth
    .from('projects')
    .select('id, user_id, original_image_url, project_type')
    .eq('id', projectId)
    .single();

  if (fetchError || !project) {
    return new Response(
      JSON.stringify({ error: 'Project not found or access denied.' }),
      { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  const userId = project.user_id;
  if (!userId) {
    return new Response(
      JSON.stringify({ error: 'Project has no owner.' }),
      { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  const originalImageUrl = project.original_image_url;
  if (!originalImageUrl || typeof originalImageUrl !== 'string') {
    return new Response(
      JSON.stringify({ error: 'Project has no photo. Upload a photo first.' }),
      { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  const validProjectTypes = ['new_build', 'existing', 'architectural_drawing'];
  const projectType = project.project_type;
  if (!projectType || !validProjectTypes.includes(projectType)) {
    return new Response(
      JSON.stringify({ error: 'Project type is required. Select New build, Existing, or Architectural drawing.' }),
      { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  const payload = {
    prompt: prompt.trim(),
    samples,
    mask: maskImageUrl && typeof maskImageUrl === 'string' && maskImageUrl.trim().length > 0 ? maskImageUrl.trim() : undefined,
    inputImageUrl: rawInputImageUrl && typeof rawInputImageUrl === 'string' && rawInputImageUrl.trim().length > 0 ? rawInputImageUrl.trim() : undefined,
    projectType,
  };

  await supabaseAdmin.from('projects').update({ status: 'processing' }).eq('id', projectId);

  const { data: job, error: jobError } = await supabaseAdmin
    .from('generation_jobs')
    .insert({ project_id: projectId, user_id: userId, payload })
    .select('id')
    .single();

  if (jobError || !job) {
    await supabaseAdmin.from('projects').update({ status: 'draft' }).eq('id', projectId);
    return new Response(
      JSON.stringify({ error: 'Failed to enqueue job.', details: jobError?.message }),
      { status: 502, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  return new Response(
    JSON.stringify({ jobId: job.id, status: 'processing' }),
    { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
  );
});
