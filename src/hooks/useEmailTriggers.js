import { useEffect } from 'react';
import { supabase } from '../supabaseClient';
import {
  sendFirstProjectEmail,
  sendTrialEndingReminder,
  sendTrialExpiredEmail,
} from '../services/emailService';
import { getTrialInfo, shouldShowTrialWarning } from '../utils/trialTracking';

/**
 * Hook to handle email triggers based on user actions and state
 */
export const useEmailTriggers = (session, projects) => {
  useEffect(() => {
    if (!session?.user) return;

    const metadata = session.user.user_metadata || {};
    const trialStartDate = metadata.trial_start_date;
    const planType = metadata.plan_type || 'pro';
    const userName = metadata.first_name || metadata.company_name || session.user.email.split('@')[0];

    // Check trial status and send reminders
    if (trialStartDate && planType === 'pro') {
      const trialInfo = getTrialInfo(trialStartDate, planType);
      
      // Send trial ending reminder (3 days before)
      if (shouldShowTrialWarning(trialInfo) && trialInfo.daysRemaining === 3) {
        sendTrialEndingReminder(
          session.user.email,
          userName,
          trialInfo.daysRemaining
        ).catch((err) => {
          console.error('Failed to send trial ending reminder:', err);
        });
      }

      // Send trial expired email (on expiration day)
      if (trialInfo.isExpired && !metadata.trial_expired_email_sent) {
        sendTrialExpiredEmail(session.user.email, userName).catch((err) => {
          console.error('Failed to send trial expired email:', err);
        });
        
        // Mark as sent (would be done via backend in production)
        // supabase.auth.updateUser({
        //   data: { trial_expired_email_sent: true }
        // });
      }
    }

    // Send first project email
    if (projects && projects.length === 1 && !metadata.first_project_email_sent) {
      sendFirstProjectEmail(session.user.email, userName).catch((err) => {
        console.error('Failed to send first project email:', err);
      });
      
      // Mark as sent (would be done via backend in production)
      // supabase.auth.updateUser({
      //   data: { first_project_email_sent: true }
      // });
    }
  }, [session, projects]);
};
