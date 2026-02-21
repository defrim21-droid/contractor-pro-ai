import React, { useState } from 'react';
import { ArrowDownTrayIcon, PencilSquareIcon, ShareIcon } from '@heroicons/react/24/outline';
import ShareWithClientModal from './components/ShareWithClientModal';

export default function ProjectRenderDetail({
  project,
  selectedRender,
  onBackToFolder,
  onEditRender,
}) {
  const [showShareModal, setShowShareModal] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    if (!selectedRender || downloading) return;
    setDownloading(true);
    try {
      const res = await fetch(selectedRender, { mode: 'cors' });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `render-${(project?.name || 'image').replace(/\s+/g, '-')}-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      window.open(selectedRender, '_blank');
    } finally {
      setDownloading(false);
    }
  };

  if (!project || !selectedRender) return null;

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in slide-in-from-right-8 duration-300">
      <button
        type="button"
        onClick={onBackToFolder}
        className="text-slate-500 font-medium hover:text-blue-600 mb-6"
      >
        ← Back to Folder
      </button>

      <div className="flex justify-between items-center mb-8">
        <h2 className="text-2xl font-bold text-slate-900">AI Result</h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowShareModal(true)}
            className="btn-secondary px-4 py-2 flex items-center gap-2"
          >
            <ShareIcon className="h-5 w-5" />
            Share with client
          </button>
          {onEditRender && (
            <button
              type="button"
              onClick={() => onEditRender(project, selectedRender)}
              className="btn-secondary px-4 py-2 flex items-center gap-2"
            >
              <PencilSquareIcon className="h-5 w-5" />
              Edit render
            </button>
          )}
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            className="btn-primary px-4 py-2 flex items-center gap-2"
          >
            <ArrowDownTrayIcon className="h-5 w-5" />
            {downloading ? 'Downloading…' : 'Download'}
          </button>
        </div>
      </div>

      <ShareWithClientModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        project={project}
        renderUrl={selectedRender}
      />

      <div className="card-modern p-4">
        <div className="rounded-2xl overflow-hidden shadow-inner bg-slate-100">
          <img
            src={selectedRender}
            alt="AI concept"
            className="w-full h-auto max-h-[700px] object-contain"
          />
        </div>
      </div>
    </main>
  );
}
