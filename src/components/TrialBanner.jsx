import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getTrialInfo,
  shouldShowTrialWarning,
  getTrialStatusMessage,
  formatTrialEndDate,
} from '../utils/trialTracking';
import { ExclamationTriangleIcon, ClockIcon } from '@heroicons/react/24/outline';

export default function TrialBanner({ trialStartDate, planType, onUpgrade }) {
  const navigate = useNavigate();
  
  if (!trialStartDate || planType !== 'pro') {
    return null;
  }

  const trialInfo = getTrialInfo(trialStartDate, planType);
  
  if (!trialInfo.isOnTrial && !trialInfo.isExpired) {
    return null;
  }

  const showWarning = shouldShowTrialWarning(trialInfo);
  const statusMessage = getTrialStatusMessage(trialInfo);

  const handleUpgrade = () => {
    if (onUpgrade) {
      onUpgrade();
    } else {
      navigate('/billing');
    }
  };

  return (
    <div
      className={`w-full p-4 rounded-xl border-2 ${
        trialInfo.isExpired
          ? 'bg-red-50 border-red-200'
          : showWarning
          ? 'bg-yellow-50 border-yellow-200'
          : 'bg-blue-50 border-blue-200'
      } mb-6`}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          {trialInfo.isExpired ? (
            <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
          ) : (
            <ClockIcon className="h-6 w-6 text-blue-600" />
          )}
        </div>
        <div className="flex-1">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3
                className={`font-bold text-sm mb-1 ${
                  trialInfo.isExpired ? 'text-red-900' : showWarning ? 'text-yellow-900' : 'text-blue-900'
                }`}
              >
                {trialInfo.isExpired ? 'Trial Expired' : 'Free Trial Active'}
              </h3>
              <p
                className={`text-sm ${
                  trialInfo.isExpired ? 'text-red-800' : showWarning ? 'text-yellow-800' : 'text-blue-800'
                }`}
              >
                {statusMessage}
                {trialInfo.trialEndDate && !trialInfo.isExpired && (
                  <span className="block mt-1 text-xs opacity-75">
                    Trial ends on {formatTrialEndDate(trialInfo.trialEndDate)}
                  </span>
                )}
              </p>
            </div>
            {!trialInfo.isExpired && (
              <button
                onClick={handleUpgrade}
                className="btn-primary text-sm px-4 py-2 whitespace-nowrap flex-shrink-0"
              >
                Upgrade Now
              </button>
            )}
            {trialInfo.isExpired && (
              <button
                onClick={handleUpgrade}
                className="bg-red-600 text-white font-semibold text-sm px-4 py-2 rounded-lg hover:bg-red-700 transition-colors whitespace-nowrap flex-shrink-0"
              >
                Subscribe Now
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
