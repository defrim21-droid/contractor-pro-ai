import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from './supabaseClient';
import { processAiRenovation } from './aiService';
import { checkRenderingLimit } from './utils/planLimits';
import { getTrialInfo } from './utils/trialTracking';
import { createEditMaskFromBrushCanvas, createEditMaskForColor, getColorsWithStrokes, getImageDimensionsFromUrl } from './utils/maskProcessing';
import { convertHeicToJpegIfNeeded } from './utils/heicConversion';
import { TrashIcon, SparklesIcon, ArrowDownTrayIcon, ArrowLeftIcon, PaintBrushIcon, XMarkIcon, ArrowUturnLeftIcon } from '@heroicons/react/24/outline';

const SWATCH_COLORS = ['#ef4444', '#22c55e', '#eab308', '#a855f7', '#f97316'];

export default function WorkspaceEditor({
  userId,
  planType = 'pro',
  project,
  editFromImageUrl,
  trialStartDate,
  onProjectSaved,
  onProjectCreated,
  onCancelToHub,
  onCancelToProject,
}) {
  const navigate = useNavigate();
  const [projectName, setProjectName] = useState(project?.name || '');
  const [projectAddress, setProjectAddress] = useState(project?.address || '');
  const [projectType, setProjectType] = useState(project?.project_type || '');
  const [clientEmail, setClientEmail] = useState(project?.client_email || '');
  const [selectedImage, setSelectedImage] = useState(
    editFromImageUrl || project?.original_image_url || null,
  );
  const [imageFile, setImageFile] = useState(null);
  const [customPrompt, setCustomPrompt] = useState(project?.prompt || '');
  const [swatches, setSwatches] = useState([]);
  const [activeSwatchId, setActiveSwatchId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [pendingCompletionProjectId, setPendingCompletionProjectId] = useState(null);
  const [isSavingPhotoAndBack, setIsSavingPhotoAndBack] = useState(false);
  const [isCreatingProject, setIsCreatingProject] = useState(false);

  // Wait for render completion, then redirect to project folder
  const completionHandledRef = useRef(false);
  useEffect(() => {
    if (!pendingCompletionProjectId) return;
    completionHandledRef.current = false;
    const projectId = pendingCompletionProjectId;
    const handleComplete = async (p) => {
      if (completionHandledRef.current) return;
      completionHandledRef.current = true;
      const { data } = await supabase.from('projects').select('*').eq('id', projectId).single();
      onProjectSaved(data || p);
      setPendingCompletionProjectId(null);
      setProjectName('');
      setProjectAddress('');
      setSelectedImage(null);
      setImageFile(null);
      setCustomPrompt('');
      setSwatches([]);
      setIsGenerating(false);
      toast.success('Rendering complete!');
    };
    const handleFailed = () => {
      if (completionHandledRef.current) return;
      completionHandledRef.current = true;
      setPendingCompletionProjectId(null);
      setIsGenerating(false);
      toast.error('Rendering failed. Please try again.');
    };
    const channel = supabase
      .channel(`workspace-completion-${projectId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'projects', filter: `id=eq.${projectId}` }, async (payload) => {
        const p = payload.new;
        if (p.status === 'completed') {
          handleComplete(p);
        } else if (p.status === 'failed') {
          handleFailed();
        }
      })
      .subscribe();
    const poll = setInterval(async () => {
      const { data } = await supabase.from('projects').select('status').eq('id', projectId).single();
      if (!data) return;
      if (data.status === 'completed') {
        clearInterval(poll);
        handleComplete(data);
      } else if (data.status === 'failed') {
        clearInterval(poll);
        handleFailed();
      }
    }, 2500);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, [pendingCompletionProjectId, onProjectSaved]);

  // Simulated progress bar during generation (API doesn't expose real progress)
  useEffect(() => {
    if (!isGenerating) return;
    setGenerationProgress(0);
    const start = Date.now();
    const TYPICAL_SECONDS = 30;
    const TARGET_MAX = 92;

    const tick = () => {
      const elapsed = (Date.now() - start) / 1000;
      // Ease-out: fast start, slows near target. Reaches ~90% at ~25s
      const p = TARGET_MAX * (1 - Math.exp(-elapsed / (TYPICAL_SECONDS * 0.4)));
      setGenerationProgress(Math.min(p, TARGET_MAX));
    };

    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [isGenerating]);

  const imageRef = useRef(null);
  const imageInputRef = useRef(null);
  const imageWrapperRef = useRef(null);
  const brushCanvasRef = useRef(null);
  const isDrawingRef = useRef(false);
  const brushHistoryRef = useRef([]);
  const [imageNaturalSize, setImageNaturalSize] = useState(null);
  const [brushMode, setBrushMode] = useState(false);
  const [eraserMode, setEraserMode] = useState(false);
  const [brushSize, setBrushSize] = useState(20);
  const [brushColor, setBrushColor] = useState(SWATCH_COLORS[0]);
  const [canUndoBrush, setCanUndoBrush] = useState(false);
  const [cursorPos, setCursorPos] = useState({ x: -9999, y: -9999 });

  useEffect(() => {
    if (activeSwatchId && swatches.length > 0) {
      const s = swatches.find((x) => x.id === activeSwatchId);
      if (s?.color) setBrushColor(s.color);
    }
  }, [activeSwatchId, swatches]);

  const handleImageUpload = async (e) => {
    const input = e.target;
    if (!input.files?.[0]) return;
    const rawFile = input.files[0];
    input.value = '';
    const isHeic = /\.(heic|heif)$/i.test(rawFile.name);
    if (isHeic) toast.info('Converting HEIC image…');
    try {
      const file = await convertHeicToJpegIfNeeded(rawFile);
      setImageFile(file);
      setSelectedImage(URL.createObjectURL(file));
      setBrushMode(false);
      setEraserMode(false);
      setCanUndoBrush(false);
      brushHistoryRef.current = [];
    } catch (err) {
      toast.error('Failed to process image. Please try a JPEG or PNG.');
    }
  };

  const handleSwatchUpload = async (e) => {
    const input = e.target;
    if (!input.files?.length) return;
    const files = Array.from(input.files);
    input.value = '';
    const hasHeic = files.some((f) => /\.(heic|heif)$/i.test(f.name));
    if (hasHeic) toast.info('Converting HEIC images…');
    try {
      const converted = await Promise.all(files.map((f) => convertHeicToJpegIfNeeded(f)));
      const newSwatches = converted.map((file, index) => {
        const colorIndex = (swatches.length + index) % SWATCH_COLORS.length;
        const color = SWATCH_COLORS[colorIndex];
        const id = Math.random().toString(36).substring(7);
        const name = `Sample ${swatches.length + index + 1}`;
        return { id, file, previewUrl: URL.createObjectURL(file), color, name };
      });
      setSwatches((prev) => {
        const updated = [...prev, ...newSwatches];
        if (!activeSwatchId && updated.length > 0) setActiveSwatchId(updated[0].id);
        return updated;
      });
    } catch (err) {
      toast.error('Failed to process some images. Please try JPEG or PNG.');
    }
  };

  const handleRenameSwatch = (id, newName) => {
    setSwatches((prev) =>
      prev.map((s) => (s.id === id ? { ...s, name: newName } : s))
    );
  };

  const handleRemoveSwatch = (id) => {
    setSwatches((prev) => {
      const filtered = prev.filter((s) => s.id !== id);
      // If we removed the active swatch, pick another or clear
      if (activeSwatchId === id) {
        setActiveSwatchId(filtered.length > 0 ? filtered[0].id : null);
      }
      return filtered;
    });
  };

  const handleImageLoad = (e) => {
    const img = e.target;
    if (img && img.naturalWidth > 0 && img.naturalHeight > 0) {
      setImageNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
    }
  };

  useLayoutEffect(() => {
    if (!selectedImage || !imageWrapperRef.current || !brushCanvasRef.current) return;
    const wrapper = imageWrapperRef.current;
    const canvas = brushCanvasRef.current;
    const rect = wrapper.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width));
    const h = Math.max(1, Math.floor(rect.height));
    if (canvas.width !== w || canvas.height !== h) {
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      let imgData = null;
      if (canvas.width > 0 && canvas.height > 0 && ctx) {
        try {
          imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        } catch (_) { /* ignore */ }
      }
      canvas.width = w;
      canvas.height = h;
      if (imgData && imgData.width > 0 && imgData.height > 0 && ctx) {
        ctx.putImageData(imgData, 0, 0);
      }
    }
  }, [selectedImage, imageNaturalSize]);

  const getBrushCoords = (e) => {
    const canvas = brushCanvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const drawAt = (x, y) => {
    const canvas = brushCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    const half = brushSize / 2;
    if (eraserMode) {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(0,0,0,1)';
      ctx.fillRect(x - half, y - half, brushSize, brushSize);
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.fillStyle = brushColor;
      ctx.beginPath();
      ctx.arc(x, y, half, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  const handleBrushMouseDown = (e) => {
    if (!brushMode || !selectedImage) return;
    const canvas = brushCanvasRef.current;
    if (canvas && canvas.width > 0 && canvas.height > 0) {
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        try {
          brushHistoryRef.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
          setCanUndoBrush(true);
        } catch (_) { /* ignore */ }
      }
    }
    const coords = getBrushCoords(e);
    if (coords) {
      isDrawingRef.current = true;
      drawAt(coords.x, coords.y);
    }
  };

  const handleBrushMouseMove = (e) => {
    if (!isDrawingRef.current) return;
    const coords = getBrushCoords(e);
    if (coords) drawAt(coords.x, coords.y);
  };

  const handleBrushMouseUp = () => {
    isDrawingRef.current = false;
  };

  const handleBrushMouseLeave = () => {
    isDrawingRef.current = false;
    setCursorPos({ x: -9999, y: -9999 });
  };

  const handleBrushMouseMoveForCursor = (e) => {
    if (!brushMode) return;
    const coords = getBrushCoords(e);
    if (coords) setCursorPos(coords);
  };

  const handleUndoBrush = () => {
    const canvas = brushCanvasRef.current;
    const history = brushHistoryRef.current;
    if (!canvas || history.length === 0) return;
    const imgData = history.pop();
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (ctx && imgData) ctx.putImageData(imgData, 0, 0);
    setCanUndoBrush(history.length > 0);
  };

  const handleClearBrush = () => {
    const canvas = brushCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    brushHistoryRef.current = [];
    setCanUndoBrush(false);
  };

  const hasBrushStrokes = () => {
    const canvas = brushCanvasRef.current;
    if (!canvas || canvas.width === 0 || canvas.height === 0) return false;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return false;
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] > 10 || data[i + 1] > 10 || data[i + 2] > 10) return true;
    }
    return false;
  };

  const effectiveProjectName = project?.name || projectName || 'Untitled';
  const effectiveProjectAddress = project?.address ?? projectAddress ?? '';
  const effectiveClientEmail = clientEmail || project?.client_email || null;

  const handleSaveProject = async () => {
    if (!selectedImage) return toast.error('Please provide a photo.');
    if (!(imageFile instanceof File) && !project?.original_image_url) {
      return toast.error('Please re-upload the photo before saving.');
    }

    setIsSaving(true);
    try {
      const newProject = await processAiRenovation(
        userId,
        effectiveProjectName,
        effectiveProjectAddress,
        imageFile || project?.original_image_url,
        null,
        [],
        swatches,
        customPrompt,
        project?.id,
        effectiveClientEmail,
      );

      toast.success('Project saved!');
      onProjectSaved(newProject);

      setProjectName('');
      setProjectAddress('');
      setSelectedImage(null);
      setImageFile(null);
      setCustomPrompt('');
      setSwatches([]);
    } catch (error) {
      toast.error(error?.message || 'Failed to save project.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerateAI = async () => {
    // Check trial expiration
    if (planType === 'pro' && trialStartDate) {
      const trialInfo = getTrialInfo(trialStartDate, planType);
      if (trialInfo.isExpired) {
        toast.error('Your trial has expired. Please upgrade to continue generating renderings.', {
          action: {
            label: 'Upgrade',
            onClick: () => navigate('/billing'),
          },
        });
        return;
      }
    }

    // Check if this is a new generation (not editing existing project that already has concepts)
    const hasConcepts = project?.generated_image_urls?.length > 0 || project?.generated_image_url;
    const isNewGeneration = !hasConcepts;
    
    // Only check limits for new generations
    if (isNewGeneration) {
      try {
        const limitCheck = await checkRenderingLimit(userId, planType);
        
        if (!limitCheck.canGenerate) {
          toast.error(limitCheck.message || 'You have reached your rendering limit.');
          return;
        }
        
        // Show warning if approaching limit
        if (limitCheck.renderingsLimit !== -1) {
          const remaining = limitCheck.renderingsLimit - limitCheck.renderingsUsed;
          if (remaining <= 3 && remaining > 0) {
            toast.warning(`You have ${remaining} rendering${remaining !== 1 ? 's' : ''} remaining this month.`);
          }
        }
      } catch (error) {
        toast.error('Unable to verify your rendering limit. Please try again.');
        return;
      }
    }

    setIsGenerating(true);
    let waitingForWorker = false;

    try {
      // Validate required fields
      if (!selectedImage) {
        toast.error('Please provide a photo.');
        setIsGenerating(false);
        return;
      }
      if (!(imageFile instanceof File) && !project?.original_image_url) {
        toast.error('Please re-upload the photo before generating.');
        setIsGenerating(false);
        return;
      }
      const trimmedPrompt = (customPrompt || '').trim();
      if (!trimmedPrompt) {
        toast.error('Please enter generation instructions (prompt) to render.');
        setIsGenerating(false);
        return;
      }

      const newProject = await processAiRenovation(
        userId,
        effectiveProjectName,
        effectiveProjectAddress,
        imageFile || project?.original_image_url,
        null,
        [],
        swatches,
        customPrompt,
        project?.id,
        effectiveClientEmail,
      );

      const projectId = newProject.id;
      const samples = (newProject.swatch_data || []).map((s, i) => ({
        name: s.name || `Sample ${i + 1}`,
        url: s.url,
      }));
      let maskDataURL = null;
      let maskRegions = null;
      if (hasBrushStrokes() && brushCanvasRef.current) {
        let maskSize;
        try {
          maskSize = await getImageDimensionsFromUrl(editFromImageUrl || newProject.original_image_url);
        } catch (e) {
          maskSize = imageNaturalSize || { w: 1024, h: 1024 };
        }
        const colorsWithStrokes = getColorsWithStrokes(brushCanvasRef.current, swatches);
        if (colorsWithStrokes.length >= 1) {
          maskRegions = await Promise.all(
            colorsWithStrokes.map(async (sampleIndex) => ({
              sampleIndex,
              mask: await createEditMaskForColor(brushCanvasRef.current, maskSize, swatches[sampleIndex].color),
            }))
          );
        } else {
          maskDataURL = await createEditMaskFromBrushCanvas(brushCanvasRef.current, maskSize);
        }
      }
      const { data: fnData, error: fnError } = await supabase.functions.invoke('generate-image', {
        body: {
          projectId,
          prompt: trimmedPrompt,
          samples,
          mask: maskDataURL || undefined,
          maskRegions: maskRegions || undefined,
          inputImageUrl: editFromImageUrl || undefined,
        },
      });

      if (fnError) {
        let message = fnError.message || 'Image generation failed.';
        const status = fnError.context?.status;
        if (status === 546 || status === 504) {
          message =
            'Generation timed out or hit resource limits. Try a smaller image, fewer reference samples, or check your Supabase plan limits.';
        } else {
          try {
            const ctx = fnError.context;
            if (ctx && typeof ctx.json === 'function') {
              const body = await ctx.json();
              if (body?.error) message = body.details ? `${body.error}: ${body.details}` : body.error;
            }
          } catch (_) { /* ignore */ }
        }
        console.error('Generate image error:', fnError);
        toast.error(message);
        setIsGenerating(false);
        return;
      }
      if (fnData?.error) {
        toast.error(fnData.details || fnData.error || 'Image generation failed.');
        setIsGenerating(false);
        return;
      }

      toast.success('Rendering started. The image will appear when complete.');
      setPendingCompletionProjectId(projectId);
      // Stay in isGenerating until worker completes; useEffect handles redirect
      waitingForWorker = true;
    } catch (error) {
      console.error('Save error:', error);
      toast.error(error?.message || 'Failed to save project.');
    } finally {
      if (!waitingForWorker) setIsGenerating(false);
    }
  };

  const handleCancel = async () => {
    if (project && imageFile instanceof File && selectedImage) {
      setIsSavingPhotoAndBack(true);
      try {
        const updated = await processAiRenovation(
          userId,
          effectiveProjectName,
          effectiveProjectAddress,
          imageFile,
          null,
          [],
          swatches,
          customPrompt,
          project.id,
          effectiveClientEmail,
        );
        onCancelToProject(updated);
      } catch (err) {
        console.error('Failed to save photo before going back:', err);
        toast.error('Could not save photo. Save manually or try again.');
      } finally {
        setIsSavingPhotoAndBack(false);
      }
    } else if (project) {
      onCancelToProject();
    } else {
      onCancelToHub();
    }
    setSelectedImage(null);
  };

  const handleCreateProject = async (e) => {
    e?.preventDefault();
    const name = (projectName || '').trim();
    const address = (projectAddress || '').trim();
    const email = (clientEmail || '').trim();
    if (!name) {
      toast.error('Please enter a project name.');
      return;
    }
    if (!address) {
      toast.error('Please enter an address.');
      return;
    }
    if (!projectType) {
      toast.error('Please select a project type.');
      return;
    }
    setIsCreatingProject(true);
    try {
      const { data, error } = await supabase
        .from('projects')
        .insert([{
          user_id: userId,
          name: name || 'Untitled',
          address: address || '',
          project_type: projectType,
          client_email: email || null,
          original_image_url: null,
          mask_url: null,
          swatch_data: [],
          status: 'draft',
        }])
        .select()
        .single();
      if (error) throw error;
      toast.success('Project created.');
      onProjectCreated(data);
    } catch (err) {
      console.error('Create project error:', err);
      toast.error(err?.message || 'Failed to create project.');
    } finally {
      setIsCreatingProject(false);
    }
  };

  const displayName = project?.name || projectName || 'New project';

  // New project: show project details first, then auto-save and go to upload step
  if (!project) {
    return (
      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <header className="flex items-center gap-3 mb-6">
          <button
            type="button"
            onClick={onCancelToHub}
            className="text-slate-500 hover:text-blue-600 flex items-center p-0.5"
            aria-label="Back to projects"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-bold text-slate-800">New project</h1>
        </header>
        <div className="card-modern p-6 max-w-lg mx-auto">
          <form onSubmit={handleCreateProject} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Project name</label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="e.g. 123 Main St Renovation"
                className="input-modern w-full"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Address</label>
              <input
                type="text"
                value={projectAddress}
                onChange={(e) => setProjectAddress(e.target.value)}
                placeholder="e.g. 123 Main St, City"
                className="input-modern w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Project type</label>
              <select
                value={projectType}
                onChange={(e) => setProjectType(e.target.value)}
                className="input-modern w-full"
              >
                <option value="">Select project type…</option>
                <option value="new_build">New build</option>
                <option value="existing">Existing</option>
                <option value="architectural_drawing">Architectural drawing</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Client email <span className="text-slate-400 font-normal">(optional)</span></label>
              <input
                type="email"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                placeholder="e.g. client@example.com"
                className="input-modern w-full"
              />
            </div>
            <button
              type="submit"
              disabled={
                isCreatingProject ||
                !(projectName || '').trim() ||
                !(projectAddress || '').trim() ||
                !projectType
              }
              className="btn-primary w-full py-3 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isCreatingProject ? 'Creating…' : 'Create project'}
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Top bar: Back + project name + Change photo + Render + Save */}
      <header className="flex flex-wrap items-center justify-between gap-3 py-3 px-4 rounded-xl bg-slate-100/80 border border-slate-200/60 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={handleCancel}
            disabled={isSavingPhotoAndBack}
            className="text-slate-500 hover:text-blue-600 flex items-center flex-shrink-0 disabled:opacity-70 disabled:cursor-wait p-0.5"
            aria-label={project ? 'Back to project' : 'Back to projects'}
          >
            {isSavingPhotoAndBack ? (
              <span className="text-sm font-medium">Saving…</span>
            ) : (
              <ArrowLeftIcon className="h-5 w-5" />
            )}
          </button>
          <div className="h-5 w-px bg-slate-200 flex-shrink-0" aria-hidden />
          <h1 className="text-lg font-bold text-slate-800 truncate min-w-0">{displayName}</h1>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0 border-l border-slate-200 pl-3">
          {selectedImage && (
            <>
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                className="text-sm text-slate-600 hover:text-blue-600 font-medium"
              >
                Change photo
              </button>
              <button
                type="button"
                onClick={() => setBrushMode((m) => !m)}
                className={`text-sm font-medium py-1.5 px-2.5 rounded-lg ${brushMode ? 'bg-blue-600 text-white' : 'text-slate-600 hover:text-blue-600 hover:bg-slate-100'}`}
                title="Brush to highlight areas—each colour maps to a reference sample"
              >
                <PaintBrushIcon className="h-4 w-4 inline-block align-middle mr-1" />
                {brushMode ? 'Done' : 'Brush'}
              </button>
              {brushMode && (
                <>
                  <button
                    type="button"
                    onClick={() => setEraserMode(false)}
                    className={`text-sm font-medium py-1.5 px-2.5 rounded-lg ${!eraserMode ? 'bg-blue-500 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                    title="Paint with brush"
                  >
                    Brush
                  </button>
                  <button
                    type="button"
                    onClick={() => setEraserMode(true)}
                    className={`text-sm font-medium py-1.5 px-2.5 rounded-lg ${eraserMode ? 'bg-blue-500 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                    title="Erase strokes"
                  >
                    Eraser
                  </button>
                </>
              )}
            </>
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleGenerateAI}
              disabled={isGenerating || !(customPrompt || '').trim() || (hasBrushStrokes() && brushMode)}
              title={
                hasBrushStrokes() && brushMode
                  ? 'Click Done to finish brush strokes before rendering'
                  : !(customPrompt || '').trim()
                  ? 'Enter instructions to render'
                  : undefined
              }
              className="btn-primary py-2 px-4 text-sm disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              {isGenerating ? (
                'Generating...'
              ) : (
                <>
                  <SparklesIcon className="h-4 w-4" />
                  Render
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleSaveProject}
              disabled={isSaving}
              className="btn-secondary py-2 px-4 text-sm disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              {isSaving ? (
                'Saving...'
              ) : (
                <>
                  <ArrowDownTrayIcon className="h-4 w-4" />
                  Save
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {isGenerating && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-slate-900/80 backdrop-blur-sm">
          <div className="text-center max-w-sm px-6">
            <SparklesIcon className="h-14 w-14 text-blue-400 mx-auto mb-4 animate-pulse" aria-hidden />
            <h3 className="text-xl font-bold text-white mb-2">Generating your image</h3>
            <p className="text-slate-300 text-sm mb-6">Usually takes 15–45 seconds</p>
            <div className="h-2.5 w-full rounded-full bg-slate-700 overflow-hidden">
              <div
                className="h-full rounded-full bg-blue-500 transition-all duration-300 ease-out"
                style={{ width: `${Math.round(generationProgress)}%` }}
              />
            </div>
            <p className="text-slate-400 text-xs mt-3">{Math.round(generationProgress)}%</p>
          </div>
        </div>
      )}

      <input
        ref={imageInputRef}
        type="file"
        accept="image/*,.heic,.heif"
        onChange={handleImageUpload}
        className="hidden"
      />

      <div className="space-y-6">
        {/* Image workspace - sizes to image */}
        <div className="card-modern p-4 flex flex-col min-w-0 min-h-0">
          <div
            className={`rounded-xl relative overflow-auto select-none flex items-center justify-center ${selectedImage ? 'bg-slate-100 min-h-[300px] p-4' : 'border-2 border-dashed border-slate-300 bg-slate-50 h-[400px]'}`}
            role="img"
            aria-label="Image workspace"
            onClick={!selectedImage ? () => imageInputRef.current?.click() : undefined}
            style={{ cursor: selectedImage ? 'default' : 'pointer' }}
          >
            {selectedImage ? (
              <div ref={imageWrapperRef} className="relative inline-block max-w-full">
                <img
                  ref={imageRef}
                  src={selectedImage}
                  onLoad={handleImageLoad}
                  crossOrigin="anonymous"
                  className="max-w-full w-auto h-auto block pointer-events-none"
                  style={{ maxHeight: 'min(85vh, 1200px)' }}
                  alt=""
                />
                {selectedImage && (
                  <>
                    <canvas
                      ref={brushCanvasRef}
                      className="absolute inset-0 w-full h-full"
                      style={{
                        pointerEvents: brushMode ? 'auto' : 'none',
                        opacity: 0.85,
                        cursor: brushMode ? 'none' : 'default',
                      }}
                      onMouseDown={handleBrushMouseDown}
                      onMouseMove={(e) => {
                        handleBrushMouseMove(e);
                        handleBrushMouseMoveForCursor(e);
                      }}
                      onMouseUp={handleBrushMouseUp}
                      onMouseLeave={handleBrushMouseLeave}
                      aria-label="Brush or eraser to select areas"
                    />
                    {brushMode && cursorPos.x >= 0 && cursorPos.y >= 0 && (
                      <div
                        className="absolute pointer-events-none"
                        style={{
                          left: cursorPos.x,
                          top: cursorPos.y,
                          width: brushSize,
                          height: brushSize,
                          marginLeft: -brushSize / 2,
                          marginTop: -brushSize / 2,
                          border: '2px solid rgba(0,0,0,0.6)',
                          borderRadius: eraserMode ? 0 : '50%',
                          boxSizing: 'border-box',
                        }}
                      />
                    )}
                  </>
                )}
                </div>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500">
                Click to upload photo
              </div>
            )}
          </div>
          {selectedImage && (
            <div className="mt-3 min-h-[44px] flex flex-wrap items-center gap-3 text-sm">
              {brushMode ? (
                <>
                  <span className="text-slate-600 font-medium">{eraserMode ? 'Eraser:' : 'Brush:'}</span>
                  <label className="flex items-center gap-2">
                    <input
                      type="range"
                      min="8"
                      max="40"
                      value={brushSize}
                      onChange={(e) => setBrushSize(Number(e.target.value))}
                      className="w-24"
                    />
                    <span className="text-slate-600 w-8">{brushSize}</span>
                  </label>
                  {swatches.length > 0 && (
                    <div className="flex items-center gap-1">
                      {swatches.map((s, i) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => { setActiveSwatchId(s.id); setBrushColor(s.color); }}
                          className={`w-6 h-6 rounded-full border-2 ${activeSwatchId === s.id ? 'border-blue-600 scale-110' : 'border-slate-300'}`}
                          style={{ backgroundColor: s.color }}
                          title={`Paint for ${s.name || `Sample ${i + 1}`} (${['red','green','yellow','purple','orange'][i] || ''})`}
                        />
                      ))}
                    </div>
                  )}
                  <button type="button" onClick={handleUndoBrush} disabled={!canUndoBrush} className="text-slate-500 hover:text-blue-600 text-xs flex items-center gap-1 disabled:opacity-50" title="Undo last stroke">
                    <ArrowUturnLeftIcon className="h-4 w-4" /> Undo
                  </button>
                  <button type="button" onClick={handleClearBrush} className="text-slate-500 hover:text-red-600 text-xs flex items-center gap-1">
                    <XMarkIcon className="h-4 w-4" /> Clear
                  </button>
                  <span className="text-slate-500 text-xs">Red=Sample 1, Green=Sample 2, etc. Refer to your sample names in the prompt.</span>
                </>
              ) : (
                <span className="text-slate-500 text-xs">Refer to your sample names in your instructions. Use Brush to mask specific areas.</span>
              )}
            </div>
          )}
        </div>

        {/* Bottom panel: Reference samples + Instructions */}
        <div className="card-modern p-6 space-y-6">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">
              Reference samples
            </label>
            <div className="flex flex-wrap items-start gap-3">
              {swatches.map((swatch, index) => (
                <div key={swatch.id} className="flex flex-col items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setActiveSwatchId(swatch.id)}
                    className={`h-12 w-12 rounded-lg overflow-hidden border-2 transition-all relative flex-shrink-0 ${
                      activeSwatchId === swatch.id
                        ? 'border-blue-600 scale-110'
                        : 'border-transparent'
                    }`}
                    title={`${swatch.name || `Sample ${index + 1}`} – refer to this in your prompt`}
                  >
                    <img
                      src={swatch.previewUrl}
                      className="h-full w-full object-cover"
                      alt={swatch.name || `Sample ${index + 1}`}
                    />
                    <div
                      className="absolute bottom-0 left-0 right-0 h-1"
                      style={{ backgroundColor: swatch.color }}
                    />
                  </button>
                  <input
                    type="text"
                    value={swatch.name ?? ''}
                    onChange={(e) => handleRenameSwatch(swatch.id, e.target.value)}
                    placeholder={`Sample ${index + 1}`}
                    className="text-xs font-medium text-slate-600 bg-transparent border-none border-b border-slate-300 focus:border-blue-500 focus:outline-none w-24 min-w-0 text-center py-0.5"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveSwatch(swatch.id)}
                    className="text-slate-400 hover:text-red-500"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <div className="flex flex-col items-center gap-1">
                <div className="h-12 w-12 border-2 border-dashed border-slate-300 rounded-lg flex items-center justify-center hover:bg-slate-50 flex-shrink-0 relative">
                  <input
                    type="file"
                    multiple
                    accept="image/*,.heic,.heif"
                    onChange={handleSwatchUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <span className="text-slate-400 pointer-events-none">+</span>
                </div>
                <span className="text-xs font-medium text-slate-600">Add</span>
                <div className="h-4 w-4" aria-hidden="true" />
              </div>
            </div>
            {swatches.length > 0 && (
              <p className="text-xs text-slate-500 mt-2">
                Each sample has a colour (red, green, yellow, etc.) for masking. Refer to sample names in your prompt.
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Instructions
            </label>
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="e.g. Replace the red brick with the stone in Sample 1 photo"
              rows="3"
              className="input-modern text-sm resize-none w-full"
            />
          </div>
        </div>
      </div>
    </main>
  );
}

