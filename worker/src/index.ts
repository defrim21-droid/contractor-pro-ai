import { supabase } from './supabase.js';
import { processJob } from './processor.js';
import type { JobPayload } from './processor.js';

const POLL_INTERVAL_MS = 3000;

async function pollAndProcess(): Promise<void> {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    console.error('OPENAI_API_KEY not set');
    return;
  }

  const { data: rows, error } = await supabase
    .from('generation_jobs')
    .select('id, project_id, user_id, payload')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(1);

  if (error) {
    console.error('Poll error:', error);
    return;
  }

  if (!rows || rows.length === 0) {
    return;
  }

  const job = rows[0];
  const jobId = job.id as string;
  const projectId = job.project_id as string;
  const userId = job.user_id as string;
  const payload = job.payload as JobPayload;

  const { data: claimed, error: claimError } = await supabase
    .from('generation_jobs')
    .update({ status: 'processing', started_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', jobId)
    .eq('status', 'pending')
    .select()
    .maybeSingle();

  if (claimError || !claimed) {
    return;
  }

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('original_image_url, project_type')
    .eq('id', projectId)
    .single();

  if (projectError || !project?.original_image_url) {
    await supabase
      .from('generation_jobs')
      .update({
        status: 'failed',
        error_message: projectError?.message || 'Project not found or no image',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId);
    await supabase.from('projects').update({ status: 'failed' }).eq('id', projectId);
    return;
  }

  try {
    const generatedUrl = await processJob(
      openaiKey,
      projectId,
      userId,
      project.original_image_url,
      (project.project_type as string | null) || null,
      payload
    );

    const { data: current } = await supabase
      .from('projects')
      .select('generated_image_urls')
      .eq('id', projectId)
      .single();

    const existingUrls: string[] = Array.isArray(current?.generated_image_urls) ? current.generated_image_urls : [];
    const newUrls = [...existingUrls, generatedUrl];

    await supabase
      .from('projects')
      .update({
        generated_image_url: generatedUrl,
        generated_image_urls: newUrls,
        status: 'completed',
      })
      .eq('id', projectId);

    await supabase
      .from('generation_jobs')
      .update({
        status: 'completed',
        result_url: generatedUrl,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    console.log(`Job ${jobId} completed for project ${projectId}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Job failed:', msg);
    await supabase
      .from('generation_jobs')
      .update({
        status: 'failed',
        error_message: msg,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId);
    await supabase.from('projects').update({ status: 'failed' }).eq('id', projectId);
  }
}

async function run(): Promise<void> {
  console.log('Worker started, polling every', POLL_INTERVAL_MS, 'ms');
  while (true) {
    try {
      await pollAndProcess();
    } catch (err) {
      console.error('Poll cycle error:', err);
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
}

run();
