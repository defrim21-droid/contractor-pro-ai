/**
 * Trial period tracking utilities
 */

export const TRIAL_DURATION_DAYS = 14; // 2 weeks

/**
 * Get trial information for a user
 * @param {string} trialStartDate - ISO date string
 * @param {string} planType - User's plan type
 * @returns {Object} Trial information
 */
export const getTrialInfo = (trialStartDate, planType) => {
  // Only Pro plan has trial
  if (planType !== 'pro' || !trialStartDate) {
    return {
      isOnTrial: false,
      daysRemaining: 0,
      trialEndDate: null,
      isExpired: false,
    };
  }

  const startDate = new Date(trialStartDate);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + TRIAL_DURATION_DAYS);
  
  const now = new Date();
  const daysRemaining = Math.max(0, Math.ceil((endDate - now) / (1000 * 60 * 60 * 24)));
  const isExpired = now >= endDate;

  return {
    isOnTrial: !isExpired,
    daysRemaining,
    trialEndDate: endDate,
    trialStartDate: startDate,
    isExpired,
  };
};

/**
 * Check if user should see trial warning (3 days or less remaining)
 */
export const shouldShowTrialWarning = (trialInfo) => {
  return trialInfo.isOnTrial && trialInfo.daysRemaining <= 3 && trialInfo.daysRemaining > 0;
};

/**
 * Format trial end date for display
 */
export const formatTrialEndDate = (trialEndDate) => {
  if (!trialEndDate) return null;
  return trialEndDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

/**
 * Get trial status message
 */
export const getTrialStatusMessage = (trialInfo) => {
  if (!trialInfo.isOnTrial) {
    return null;
  }

  if (trialInfo.isExpired) {
    return 'Your trial has expired. Please upgrade to continue using ContractorPro AI.';
  }

  if (trialInfo.daysRemaining === 0) {
    return 'Your trial ends today. Upgrade now to continue using ContractorPro AI.';
  }

  if (trialInfo.daysRemaining === 1) {
    return 'Your trial ends tomorrow. Upgrade now to continue using ContractorPro AI.';
  }

  return `${trialInfo.daysRemaining} days remaining in your free trial.`;
};
