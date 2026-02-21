import { supabase } from '../supabaseClient';

/**
 * Trial abuse prevention utilities
 * Prevents users from creating multiple accounts to get free trials
 */

/**
 * Check if an email has already used a trial
 */
export const hasEmailUsedTrial = async (email) => {
  try {
    // Check trial_usage table in database
    const { data, error } = await supabase
      .from('trial_usage')
      .select('email')
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      throw error;
    }

    if (data) {
      return {
        hasUsedTrial: true,
        reason: 'This email has already used a free trial.',
      };
    }

    // Also check user metadata as fallback
    // Note: This requires admin access, so better done via Edge Function
    // For now, we'll rely on the database table

    return { hasUsedTrial: false, reason: null };
  } catch (error) {
    console.error('Error checking trial usage:', error);
    // Fail closed - don't allow trial if check fails (prevents abuse)
    return {
      hasUsedTrial: true,
      reason: 'Unable to verify trial eligibility. Please contact support.',
    };
  }
};

/**
 * Check if a payment method has already been used for a trial
 * This prevents using different emails with the same card
 */
export const hasPaymentMethodUsedTrial = async (paymentMethodId) => {
  try {
    if (!paymentMethodId) {
      return { hasUsedTrial: false, reason: null };
    }

    // Check trial_usage table for payment method
    const { data, error } = await supabase
      .from('trial_usage')
      .select('payment_method_id')
      .eq('payment_method_id', paymentMethodId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    if (data) {
      return {
        hasUsedTrial: true,
        reason: 'This payment method has already been used for a free trial.',
      };
    }

    // Also check Stripe customer metadata if stripeCustomerId is available
    // This would be done via Edge Function with Stripe API

    return { hasUsedTrial: false, reason: null };
  } catch (error) {
    console.error('Error checking payment method trial usage:', error);
    // Fail closed - don't allow trial if check fails
    return {
      hasUsedTrial: true,
      reason: 'Unable to verify payment method eligibility.',
    };
  }
};

/**
 * Mark an email as having used a trial
 */
export const markEmailTrialUsed = async (email, userId, planType, paymentMethodId = null, stripeCustomerId = null) => {
  try {
    // Insert into trial_usage table
    const { error } = await supabase
      .from('trial_usage')
      .insert({
        email: email.toLowerCase(),
        user_id: userId,
        payment_method_id: paymentMethodId,
        stripe_customer_id: stripeCustomerId,
        plan_type: planType,
        trial_start_date: new Date().toISOString(),
      });

    if (error) {
      // If email already exists, that's okay - they've already used a trial
      if (error.code === '23505') { // Unique constraint violation
        console.warn('Email already marked as trial used:', email);
        return { success: true, alreadyMarked: true };
      }
      throw error;
    }
    
    // Also update user metadata as backup
    await supabase.auth.updateUser({
      data: {
        trial_used: true,
        trial_used_date: new Date().toISOString(),
      },
    });
    
    return { success: true };
  } catch (error) {
    console.error('Error marking trial as used:', error);
    throw error;
  }
};

/**
 * Mark a payment method as having used a trial
 */
export const markPaymentMethodTrialUsed = async (paymentMethodId, customerId) => {
  try {
    // In production, update Stripe customer metadata
    // Example:
    // await stripe.customers.update(customerId, {
    //   metadata: {
    //     trial_used: 'true',
    //     trial_used_date: new Date().toISOString(),
    //   },
    // });
    
    return { success: true };
  } catch (error) {
    console.error('Error marking payment method trial as used:', error);
    throw error;
  }
};

/**
 * Comprehensive check before allowing trial
 */
export const canUserGetTrial = async (email, paymentMethodId = null) => {
  try {
    // Check email
    const emailCheck = await hasEmailUsedTrial(email);
    if (emailCheck.hasUsedTrial) {
      return {
        canGetTrial: false,
        reason: emailCheck.reason || 'This email has already used a free trial.',
      };
    }

    // Check payment method if provided
    if (paymentMethodId) {
      const paymentCheck = await hasPaymentMethodUsedTrial(paymentMethodId);
      if (paymentCheck.hasUsedTrial) {
        return {
          canGetTrial: false,
          reason: paymentCheck.reason || 'This payment method has already been used for a free trial.',
        };
      }
    }

    return { canGetTrial: true, reason: null };
  } catch (error) {
    console.error('Error checking trial eligibility:', error);
    // Fail closed - don't allow trial if check fails
    return {
      canGetTrial: false,
      reason: 'Unable to verify trial eligibility. Please contact support.',
    };
  }
};
