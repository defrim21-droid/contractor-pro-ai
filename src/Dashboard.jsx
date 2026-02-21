import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from './supabaseClient';
import { toast } from 'sonner';
import DashboardNavbar from './DashboardNavbar';
import ProjectsHub from './ProjectsHub';
import ProjectDetail from './ProjectDetail';
import ProjectRenderDetail from './ProjectRenderDetail';
import WorkspaceEditor from './WorkspaceEditor';
import TrialBanner from './components/TrialBanner';
import { useEmailTriggers } from './hooks/useEmailTriggers';

export default function Dashboard({ session }) {
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState('hub');
  const [activeProject, setActiveProject] = useState(null);
  const [selectedRender, setSelectedRender] = useState(null);
  const [editFromImageUrl, setEditFromImageUrl] = useState(null);
  
  const metadata = session.user.user_metadata || {};
  const trialStartDate = metadata.trial_start_date;
  const planType = metadata.plan_type || 'pro';

  // REAL Database State
  const [projects, setProjects] = useState([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);

  // Email triggers for welcome emails, trial reminders, etc.
  useEmailTriggers(session, projects);

  useEffect(() => { fetchProjects(); }, []);

  useEffect(() => {
    const channel = supabase
      .channel('projects-realtime')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'projects' }, (payload) => {
          const updatedProject = payload.new;
          setProjects((currentProjects) => currentProjects.map((p) => (p.id === updatedProject.id ? updatedProject : p)));
          setActiveProject((currentActive) => (currentActive && currentActive.id === updatedProject.id ? updatedProject : currentActive));
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // When viewing a project that's "processing", poll until it completes (backup if realtime misses the update)
  useEffect(() => {
    if (activeView !== 'project_detail' || !activeProject?.id || activeProject?.status !== 'processing') return;
    const projectId = activeProject.id;
    const interval = setInterval(async () => {
      const { data, error } = await supabase.from('projects').select('*').eq('id', projectId).single();
      if (error || !data) return;
      const hasConcepts = (data.generated_image_urls?.length > 0) || data.generated_image_url;
      if (data.status !== 'processing' || hasConcepts) {
        setProjects((current) => current.map((p) => (p.id === data.id ? data : p)));
        setActiveProject((current) => (current?.id === data.id ? data : current));
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [activeView, activeProject?.id, activeProject?.status]);

  const fetchProjects = async () => {
    setIsLoadingProjects(true);
    const { data, error } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
    if (error) console.error('Error fetching projects:', error);
    else setProjects(data || []);
    setIsLoadingProjects(false);
  };

  const handleDeleteProject = (projectId, projectName) => {
    toast.custom((t) => (
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-md max-w-sm">
        <p className="text-sm font-semibold text-slate-900">
          Delete project{projectName ? ` “${projectName}”` : ''}?
        </p>
        <p className="mt-1 text-xs text-slate-500">
          This will permanently remove this project and its renderings. This action cannot be undone.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
            onClick={() => toast.dismiss(t.id)}
          >
            Cancel
          </button>
          <button
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700 cursor-pointer"
            onClick={async () => {
              try {
                await supabase.from('projects').delete().eq('id', projectId);
                setActiveProject(null);
                fetchProjects();
                toast.success('Project deleted.');
              } catch (error) {
                toast.error('Error deleting project.');
              } finally {
                toast.dismiss(t.id);
              }
            }}
          >
            Delete
          </button>
        </div>
      </div>
    ));
  };

  const handleDeleteConcept = (project, conceptUrl) => {
    toast.custom((t) => (
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-md max-w-sm">
        <p className="text-sm font-semibold text-slate-900">
          Remove this concept?
        </p>
        <p className="mt-1 text-xs text-slate-500">
          It will be removed from the project. The image will no longer appear in your concepts list.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
            onClick={() => toast.dismiss(t.id)}
          >
            Cancel
          </button>
          <button
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700 cursor-pointer"
            onClick={async () => {
              try {
                const concepts = project.generated_image_urls?.length
                  ? project.generated_image_urls
                  : project.generated_image_url
                    ? [project.generated_image_url]
                    : [];
                const newUrls = concepts.filter((u) => u !== conceptUrl);
                const generated_image_url = newUrls.length > 0 ? newUrls[newUrls.length - 1] : null;
                const { data, error } = await supabase
                  .from('projects')
                  .update({
                    generated_image_urls: newUrls,
                    generated_image_url,
                  })
                  .eq('id', project.id)
                  .select()
                  .single();
                if (error) throw error;
                setProjects((current) => current.map((p) => (p.id === data.id ? data : p)));
                if (activeProject?.id === data.id) setActiveProject(data);
                if (selectedRender === conceptUrl) setSelectedRender(null);
                toast.success('Concept removed.');
              } catch (error) {
                console.error('Failed to delete concept:', error);
                toast.error('Could not remove concept.');
              } finally {
                toast.dismiss(t.id);
              }
            }}
          >
            Remove
          </button>
        </div>
      </div>
    ));
  };

  const handleBulkDeleteProjects = (projectIds) => {
    toast.custom((t) => (
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-md max-w-sm">
        <p className="text-sm font-semibold text-slate-900">
          Delete {projectIds.length} project{projectIds.length !== 1 ? 's' : ''}?
        </p>
        <p className="mt-1 text-xs text-slate-500">
          This will permanently remove {projectIds.length === 1 ? 'this project' : 'these projects'} and {projectIds.length === 1 ? 'its' : 'their'} renderings. This action cannot be undone.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
            onClick={() => toast.dismiss(t.id)}
          >
            Cancel
          </button>
          <button
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700 cursor-pointer"
            onClick={async () => {
              try {
                await supabase
                  .from('projects')
                  .delete()
                  .in('id', projectIds);
                
                // Clear active project if it was deleted
                if (activeProject && projectIds.includes(activeProject.id)) {
                  setActiveProject(null);
                }
                
                fetchProjects();
                toast.success(`${projectIds.length} project${projectIds.length !== 1 ? 's' : ''} deleted.`);
              } catch (error) {
                toast.error('Error deleting projects.');
              } finally {
                toast.dismiss(t.id);
              }
            }}
          >
            Delete
          </button>
        </div>
      </div>
    ));
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <DashboardNavbar session={session} onGoHub={() => setActiveView('hub')} />

      {/* Trial Banner */}
      {activeView === 'hub' && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
          <TrialBanner
            trialStartDate={trialStartDate}
            planType={planType}
            onUpgrade={() => navigate('/billing')}
          />
        </div>
      )}

      {/* HUB VIEW */}
      {activeView === 'hub' && (
        <ProjectsHub
          projects={projects}
          onNewProject={() => {
            setActiveProject(null);
            setSelectedRender(null);
            setActiveView('workspace');
          }}
          onOpenProject={(project) => {
            // Fetch fresh project data when opening to get latest status
            const freshProject = projects.find(p => p.id === project.id) || project;
            setActiveProject(freshProject);
            setSelectedRender(null);
            setActiveView('project_detail');
          }}
          onDeleteProjects={handleBulkDeleteProjects}
        />
      )}

      {/* FOLDER VIEW */}
      {activeView === 'project_detail' && activeProject && !selectedRender && (
        <ProjectDetail
          project={activeProject}
          onBackToHub={async () => {
            // Clear processing status when navigating away (Edge Function continues in background)
            if (activeProject.status === 'processing') {
              try {
                await supabase
                  .from('projects')
                  .update({ status: null })
                  .eq('id', activeProject.id);
                // Update local state
                setProjects((currentProjects) =>
                  currentProjects.map((p) =>
                    p.id === activeProject.id ? { ...p, status: null } : p
                  )
                );
              } catch (error) {
                console.error('Failed to clear processing status:', error);
              }
            }
            setEditFromImageUrl(null);
            setActiveProject(null);
            setActiveView('hub');
          }}
          onOpenEditorFromProject={async (project, editFromUrl = null) => {
            // Clear processing status when opening editor (Edge Function continues in background)
            if (project.status === 'processing') {
              try {
                await supabase
                  .from('projects')
                  .update({ status: null })
                  .eq('id', project.id);
                const updatedProject = { ...project, status: null };
                setProjects((currentProjects) =>
                  currentProjects.map((p) =>
                    p.id === project.id ? updatedProject : p
                  )
                );
                setActiveProject(updatedProject);
              } catch (error) {
                console.error('Failed to clear processing status:', error);
                setActiveProject(project);
              }
            } else {
              setActiveProject(project);
            }
            setSelectedRender(null);
            setEditFromImageUrl(editFromUrl ?? null);
            setActiveView('workspace');
          }}
          onEditProject={async (projectId, updates) => {
            try {
              const { data, error } = await supabase
                .from('projects')
                .update(updates)
                .eq('id', projectId)
                .select()
                .single();
              if (error) throw error;
              setProjects((current) =>
                current.map((p) => (p.id === projectId ? data : p))
              );
              if (activeProject?.id === projectId) setActiveProject(data);
              toast.success('Project updated.');
            } catch (err) {
              toast.error(err?.message || 'Failed to update project.');
              throw err;
            }
          }}
          onDeleteProject={(project) =>
            handleDeleteProject(project.id, project.name)
          }
          onDeleteConcept={handleDeleteConcept}
          onSelectRender={(renderUrl) => {
            setSelectedRender(renderUrl);
          }}
        />
      )}

      {/* RENDER DETAIL VIEW */}
      {activeView === 'project_detail' && activeProject && selectedRender && (
        <ProjectRenderDetail
          project={activeProject}
          selectedRender={selectedRender}
          onBackToFolder={() => setSelectedRender(null)}
          onEditRender={(project, renderUrl) => {
            setEditFromImageUrl(renderUrl);
            setSelectedRender(null);
            setActiveView('workspace');
          }}
        />
      )}

      {/* WORKSPACE VIEW */}
      {activeView === 'workspace' && (
        <WorkspaceEditor
          userId={session.user.id}
          planType={session.user.user_metadata?.plan_type || 'pro'}
          trialStartDate={trialStartDate}
          project={activeProject}
          editFromImageUrl={editFromImageUrl}
          onProjectSaved={async (newProject) => {
            await fetchProjects();
            setActiveProject(newProject);
            setSelectedRender(null);
            setEditFromImageUrl(null);
            setActiveView('project_detail');
          }}
          onProjectCreated={(newProject) => {
            setActiveProject(newProject);
            setProjects((prev) => [newProject, ...prev]);
          }}
          onCancelToHub={async () => {
            // Clear processing status when navigating away (Edge Function continues in background)
            if (activeProject?.status === 'processing') {
              try {
                await supabase
                  .from('projects')
                  .update({ status: null })
                  .eq('id', activeProject.id);
                // Update local state
                setProjects((currentProjects) =>
                  currentProjects.map((p) =>
                    p.id === activeProject.id ? { ...p, status: null } : p
                  )
                );
              } catch (error) {
                console.error('Failed to clear processing status:', error);
              }
            }
            // Clear activeProject when canceling to workspace
            setEditFromImageUrl(null);
            setActiveProject(null);
            setActiveView('hub');
          }}
          onCancelToProject={(updatedProject) => {
            setEditFromImageUrl(null);
            if (updatedProject) {
              setProjects((current) =>
                current.map((p) => (p.id === updatedProject.id ? updatedProject : p))
              );
              setActiveProject(updatedProject);
            } else if (activeProject) {
              const freshProject = projects.find((p) => p.id === activeProject.id) || activeProject;
              setActiveProject(freshProject);
            }
            setActiveView('project_detail');
          }}
        />
      )}
    </div>
  );
}