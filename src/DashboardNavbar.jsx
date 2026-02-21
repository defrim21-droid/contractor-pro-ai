import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from './supabaseClient';
import FeedbackModal from './FeedbackModal';
import {
  Cog6ToothIcon,
  CreditCardIcon,
  ChatBubbleLeftRightIcon,
  ArrowRightOnRectangleIcon,
} from '@heroicons/react/24/outline';

export default function DashboardNavbar({ session, onGoHub }) {
  const navigate = useNavigate();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const menuRef = useRef(null);

  const metadata = session.user.user_metadata || {};
  const displayName =
    metadata.company_name || metadata.first_name || session.user.email;
  const initial = displayName.charAt(0).toUpperCase();

  useEffect(() => {
    if (!isDropdownOpen) return;

    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isDropdownOpen]);

  return (
    <nav className="glass border-b border-slate-200/60 px-6 py-4 flex justify-between items-center sticky top-0 z-50 backdrop-blur-xl">
      <button
        type="button"
        onClick={onGoHub}
        className="text-2xl font-bold text-blue-600 cursor-pointer hover:text-blue-700 transition-colors"
      >
        ContractorPro AI
      </button>

      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setIsDropdownOpen((open) => !open)}
          className="flex items-center space-x-3 hover:bg-slate-50/80 p-2 rounded-xl transition-all duration-200 cursor-pointer group"
        >
          <div className="text-right hidden md:block">
            <div className="text-sm font-semibold text-slate-900">
              {displayName}
            </div>
            <div className="text-xs text-slate-500">Contractor Pro Plan</div>
          </div>
          <div className="h-10 w-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-lg shadow-medium group-hover:shadow-glow transition-all duration-200">
            {initial}
          </div>
        </button>

        {isDropdownOpen && (
          <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-large border border-slate-200/60 py-2 z-50 animate-slide-up backdrop-blur-xl">
            <div className="px-4 py-3 border-b border-slate-100 mb-1">
              <p className="text-sm text-slate-500">Signed in as</p>
              <p className="text-sm font-bold text-slate-900 truncate">
                {session.user.email}
              </p>
            </div>

            <div className="py-1">
              <button
                type="button"
                onClick={() => navigate('/settings')}
                className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50/80 hover:text-blue-600 transition-all duration-200 cursor-pointer flex items-center rounded-lg mx-1 group"
              >
                <Cog6ToothIcon className="mr-3 h-5 w-5 group-hover:scale-110 transition-transform" />
                Account Settings
              </button>
              <button
                type="button"
                onClick={() => navigate('/billing')}
                className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50/80 hover:text-blue-600 transition-all duration-200 cursor-pointer flex items-center rounded-lg mx-1 group"
              >
                <CreditCardIcon className="mr-3 h-5 w-5 group-hover:scale-110 transition-transform" />
                Plan & Billing
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsDropdownOpen(false);
                  setIsFeedbackOpen(true);
                }}
                className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50/80 hover:text-blue-600 transition-all duration-200 cursor-pointer flex items-center rounded-lg mx-1 group"
              >
                <ChatBubbleLeftRightIcon className="mr-3 h-5 w-5 group-hover:scale-110 transition-transform" />
                Feedback
              </button>
            </div>

            <div className="border-t border-slate-200/60 mt-1 pt-1">
              <button
                type="button"
                onClick={() => supabase.auth.signOut()}
                className="w-full text-left px-4 py-2 text-sm text-red-600 font-medium hover:bg-red-50/80 transition-all duration-200 cursor-pointer flex items-center rounded-lg mx-1 group"
              >
                <ArrowRightOnRectangleIcon className="mr-3 h-5 w-5 group-hover:scale-110 transition-transform" />
                Sign Out
              </button>
            </div>
          </div>
        )}
      </div>

      <FeedbackModal
        isOpen={isFeedbackOpen}
        onClose={() => setIsFeedbackOpen(false)}
        userEmail={session.user.email}
      />
    </nav>
  );
}

