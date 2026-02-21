import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';

export default function FeedbackModal({ isOpen, onClose, userEmail }) {
  const [feedbackType, setFeedbackType] = useState('feature');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!subject.trim() || !message.trim()) {
      toast.error('Please fill in all fields.');
      return;
    }

    setIsSubmitting(true);

    try {
      // Create email body with user info
      const emailBody = `Feedback Type: ${feedbackType}\n\nMessage:\n${message}\n\n---\nSubmitted by: ${userEmail}`;
      const emailSubject = `[${feedbackType.toUpperCase()}] ${subject}`;
      
      // Open email client with pre-filled content
      window.location.href = `mailto:support@contractorproai.com?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
      
      toast.success('Opening your email client...');
      
      // Reset form and close after a short delay
      setTimeout(() => {
        setSubject('');
        setMessage('');
        setFeedbackType('feature');
        onClose();
      }, 1000);
    } catch (error) {
      toast.error('Failed to open email client.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const modal = (
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto pt-8 pb-8"
      onClick={handleBackdropClick}
    >
      <div className="relative max-w-2xl w-full max-h-[calc(100vh-4rem)] overflow-y-auto glass rounded-2xl shadow-large border border-slate-200/60 p-8 animate-fade-in shrink-0">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 transition text-xl font-bold cursor-pointer"
        >
          ✕
        </button>

        <div className="mb-6">
          <h2 className="text-2xl font-extrabold text-slate-900">Send Feedback</h2>
          <p className="text-sm text-slate-500 mt-2">
            We'd love to hear your thoughts, suggestions, or report any issues.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              Feedback Type
            </label>
            <select
              value={feedbackType}
              onChange={(e) => setFeedbackType(e.target.value)}
              className="input-modern"
            >
              <option value="feature">Feature Request</option>
              <option value="bug">Bug Report</option>
              <option value="improvement">Improvement Suggestion</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              Subject
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Brief description of your feedback"
              className="input-modern"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              Message
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Tell us more about your feedback..."
              rows="6"
              className="input-modern resize-none"
              required
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Sending...' : 'Send Feedback'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
