import React, { useState } from 'react';
import {
  MapPinIcon,
  EnvelopeIcon,
  SparklesIcon,
  TrashIcon,
  PencilIcon,
  PencilSquareIcon,
  ShareIcon,
} from '@heroicons/react/24/outline';
import ShareWithClientModal from './components/ShareWithClientModal';

export default function ProjectDetail({
  project,
  onBackToHub,
  onOpenEditorFromProject,
  onDeleteProject,
  onEditProject,
  onDeleteConcept,
  onSelectRender,
}) {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editName, setEditName] = useState(project?.name || '');
  const [editAddress, setEditAddress] = useState(project?.address || '');
  const [editClientEmail, setEditClientEmail] = useState(project?.client_email || '');
  const [isSaving, setIsSaving] = useState(false);
  const [shareRenderUrl, setShareRenderUrl] = useState(null);

  if (!project) return null;

  const handleOpenEdit = () => {
    setEditName(project.name || '');
    setEditAddress(project.address || '');
    setEditClientEmail(project.client_email || '');
    setIsEditOpen(true);
  };

  const handleSaveEdit = async (e) => {
    e?.preventDefault();
    if (!onEditProject) return;
    setIsSaving(true);
    try {
      await onEditProject(project.id, {
        name: editName.trim() || project.name,
        address: editAddress.trim() || project.address,
        client_email: editClientEmail.trim() || null,
      });
      setIsEditOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-300">
      <button
        type="button"
        onClick={onBackToHub}
        className="text-slate-500 font-medium hover:text-blue-600 mb-6 flex items-center"
      >
        ← Back to Hub
      </button>

      <div className="flex justify-between items-end mb-10">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900">
            {project.name}
          </h1>
          <p className="text-slate-600 flex items-center gap-2">
            <MapPinIcon className="h-4 w-4" />
            {project.address || 'No address'}
          </p>
          {project.client_email && (
            <p className="text-slate-600 flex items-center gap-2 text-sm">
              <EnvelopeIcon className="h-4 w-4" />
              {project.client_email}
            </p>
          )}
        </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => onOpenEditorFromProject(project)}
              className="btn-primary px-5 py-2.5 flex items-center gap-2"
            >
              <SparklesIcon className="h-5 w-5" />
              New AI Render
            </button>
            {onEditProject && (
              <button
                type="button"
                onClick={handleOpenEdit}
                className="bg-white border border-slate-200 text-slate-700 font-semibold px-4 py-2 rounded-xl hover:bg-slate-50 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2"
              >
                <PencilSquareIcon className="h-5 w-5" />
                Edit project
              </button>
            )}
            <button
              type="button"
              onClick={() => onDeleteProject(project)}
              className="bg-white border border-red-200 text-red-600 font-semibold px-4 py-2 rounded-xl hover:bg-red-50 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2"
            >
              <TrashIcon className="h-5 w-5" />
              Delete
            </button>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Original Space */}
        <div className="lg:col-span-1 space-y-4">
          <h2 className="text-xl font-bold text-slate-800 border-b border-slate-200 pb-2">
            Original Space
          </h2>
          <button
            type="button"
            onClick={() => onOpenEditorFromProject(project)}
            className="bg-white p-3 rounded-2xl shadow-sm border border-slate-200 group relative overflow-hidden w-full text-left"
          >
            <div className="aspect-square rounded-xl overflow-hidden relative">
              <img
                src={project.original_image_url}
                className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                alt=""
              />
              <div className="absolute inset-0 bg-slate-900/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20">
                <span className="bg-white text-blue-600 font-extrabold px-4 py-2 rounded-lg shadow-xl flex items-center gap-2">
                  <PencilIcon className="h-5 w-5" />
                  Open Editor
                </span>
              </div>
            </div>
          </button>
        </div>

        {/* Gallery */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-xl font-bold text-slate-800 border-b border-slate-200 pb-2">
            AI Concepts
          </h2>
          {(() => {
            const concepts = project.generated_image_urls?.length
              ? project.generated_image_urls
              : project.generated_image_url
                ? [project.generated_image_url]
                : [];
            if (concepts.length > 0) {
              return (
                <div className="grid grid-cols-2 gap-6">
                  {concepts.map((url, i) => (
                    <div
                      key={url}
                      className="relative group bg-white p-3 rounded-2xl border border-slate-200 hover:border-blue-500 shadow-sm transition-all"
                    >
                      <button
                        type="button"
                        onClick={() => onSelectRender(url)}
                        className="w-full text-left"
                      >
                        <img
                          src={url}
                          className="w-full aspect-video object-cover rounded-xl"
                          alt=""
                        />
                        <p className="font-bold text-slate-800 mt-2">Concept {i + 1}</p>
                      </button>
                      <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShareRenderUrl(url);
                          }}
                          className="p-1.5 rounded-lg bg-white/90 shadow border border-slate-200 text-blue-600 hover:bg-blue-50"
                          title="Share with client"
                        >
                          <ShareIcon className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenEditorFromProject(project, url);
                          }}
                          className="p-1.5 rounded-lg bg-white/90 shadow border border-slate-200 text-blue-600 hover:bg-blue-50"
                          title="Edit this render"
                        >
                          <PencilSquareIcon className="h-4 w-4" />
                        </button>
                        {onDeleteConcept && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteConcept(project, url);
                            }}
                            className="p-1.5 rounded-lg bg-white/90 shadow border border-slate-200 text-red-600 hover:bg-red-50"
                            title="Remove concept"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              );
            }
            if (project.status === 'processing') {
              return (
                <div className="p-20 text-center border-2 border-dashed border-blue-200 rounded-2xl bg-blue-50">
                  <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mb-4"></div>
                  <p className="text-blue-700 font-semibold">AI generation in progress...</p>
                  <p className="text-sm text-blue-600 mt-2">This may take 1-2 minutes. The page will update automatically when complete.</p>
                </div>
              );
            }
            if (project.status === 'failed') {
              return (
                <div className="p-20 text-center border-2 border-dashed border-red-200 rounded-2xl bg-red-50">
                  <p className="text-red-700 font-semibold mb-2">Generation failed</p>
                  <p className="text-sm text-red-600">Please try generating again or contact support if the issue persists.</p>
                </div>
              );
            }
            return (
              <div className="p-20 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl">
                No renderings generated yet.
              </div>
            );
          })()}
        </div>
      </div>

      {/* Edit project modal */}
      {isEditOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setIsEditOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-project-title"
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="edit-project-title" className="text-xl font-bold text-slate-900 mb-4">Edit project</h2>
            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Project name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="e.g. 123 Main St Renovation"
                  className="input-modern w-full"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Address</label>
                <input
                  type="text"
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  placeholder="e.g. 123 Main St, City"
                  className="input-modern w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Client email <span className="text-slate-400 font-normal">(optional)</span></label>
                <input
                  type="email"
                  value={editClientEmail}
                  onChange={(e) => setEditClientEmail(e.target.value)}
                  placeholder="e.g. client@example.com"
                  className="input-modern w-full"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-medium hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 btn-primary py-2.5 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSaving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ShareWithClientModal
        isOpen={!!shareRenderUrl}
        onClose={() => setShareRenderUrl(null)}
        project={project}
        renderUrl={shareRenderUrl}
      />
    </main>
  );
}

