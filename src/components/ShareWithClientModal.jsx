import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';

const DEFAULT_SUBJECT = (projectName) =>
  `Your renovation concept – ${projectName || 'Project'}`;

const DEFAULT_MESSAGE = (projectName, imageUrl) =>
  `Hi,

Please find your renovation concept below. You can view the full image by clicking the link.

View your render: ${imageUrl}

Let me know if you have any questions.`;

export default function ShareWithClientModal({
  isOpen,
  onClose,
  project,
  renderUrl,
}) {
  const [clientEmail, setClientEmail] = useState(project?.client_email || '');
  const [subject, setSubject] = useState(DEFAULT_SUBJECT(project?.name));
  const [message, setMessage] = useState(
    DEFAULT_MESSAGE(project?.name, renderUrl || '')
  );

  useEffect(() => {
    if (isOpen) {
      setClientEmail(project?.client_email || '');
      setSubject(DEFAULT_SUBJECT(project?.name));
      setMessage(DEFAULT_MESSAGE(project?.name, renderUrl || ''));
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, project?.client_email, project?.name, renderUrl]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleOpenInEmail = (e) => {
    e.preventDefault();
    if (!clientEmail.trim()) {
      toast.error('Please enter the client email address.');
      return;
    }
    const mailtoBody = encodeURIComponent(message);
    const mailtoSubject = encodeURIComponent(subject);
    window.location.href = `mailto:${encodeURIComponent(clientEmail.trim())}?subject=${mailtoSubject}&body=${mailtoBody}`;
    toast.success('Opening your email client…');
    onClose();
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(renderUrl || '');
    toast.success('Image link copied to clipboard.');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overscroll-contain"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-modal-title"
    >
      <div
        className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[calc(90vh-2rem)] overflow-y-auto overscroll-contain p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="share-modal-title" className="text-xl font-bold text-slate-900 mb-4">
          Share with client
        </h2>
        <p className="text-sm text-slate-500 mb-4">
          Opens your email client with the client email, subject, and message filled in. The message includes a link to view the image.
        </p>
        <form onSubmit={handleOpenInEmail} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Client email
            </label>
            <input
              type="email"
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
              placeholder="client@example.com"
              className="input-modern w-full"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Subject
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Your renovation concept"
              className="input-modern w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Message
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Add a personal message…"
              className="input-modern w-full min-h-[120px] resize-y"
              rows={5}
            />
          </div>
          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="submit"
              className="flex-1 btn-primary py-2.5 min-w-[140px]"
            >
              Open in email client
            </button>
            <button
              type="button"
              onClick={handleCopyLink}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-medium hover:bg-slate-50"
            >
              Copy image link
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
