import { supabase } from '../supabaseClient';

/**
 * Email service for sending transactional emails
 * In production, this should call a Supabase Edge Function or email service API
 */

/**
 * Send welcome email after signup
 */
export const sendWelcomeEmail = async (userEmail, userName, planType) => {
  try {
    // In production, call Supabase Edge Function or email service
    // Example with Supabase Edge Function:
    // const { data, error } = await supabase.functions.invoke('send-welcome-email', {
    //   body: { email: userEmail, name: userName, planType }
    // });

    // For now, this is a placeholder
    console.log('Welcome email would be sent to:', userEmail);
    
    // Placeholder - replace with actual email service call
    // await sendEmail({
    //   to: userEmail,
    //   subject: `Welcome to ContractorPro AI, ${userName}!`,
    //   template: 'welcome',
    //   data: { userName, planType }
    // });

    return { success: true };
  } catch (error) {
    console.error('Error sending welcome email:', error);
    throw error;
  }
};

/**
 * Send email verification reminder
 */
export const sendVerificationReminder = async (userEmail, userName) => {
  try {
    // Placeholder for email service integration
    console.log('Verification reminder would be sent to:', userEmail);
    return { success: true };
  } catch (error) {
    console.error('Error sending verification reminder:', error);
    throw error;
  }
};

/**
 * Send trial ending reminder (3 days before expiration)
 */
export const sendTrialEndingReminder = async (userEmail, userName, daysRemaining) => {
  try {
    // Placeholder for email service integration
    console.log(`Trial ending reminder would be sent to: ${userEmail}, ${daysRemaining} days remaining`);
    return { success: true };
  } catch (error) {
    console.error('Error sending trial ending reminder:', error);
    throw error;
  }
};

/**
 * Send trial expired notification
 */
export const sendTrialExpiredEmail = async (userEmail, userName) => {
  try {
    // Placeholder for email service integration
    console.log('Trial expired email would be sent to:', userEmail);
    return { success: true };
  } catch (error) {
    console.error('Error sending trial expired email:', error);
    throw error;
  }
};

/**
 * Send first project creation email
 */
export const sendFirstProjectEmail = async (userEmail, userName) => {
  try {
    // Placeholder for email service integration
    console.log('First project email would be sent to:', userEmail);
    return { success: true };
  } catch (error) {
    console.error('Error sending first project email:', error);
    throw error;
  }
};
