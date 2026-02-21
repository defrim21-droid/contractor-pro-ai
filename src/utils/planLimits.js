import { supabase } from '../supabaseClient';

/**
 * Get plan limits based on plan type
 */
export const getPlanLimit = (planType) => {
  const planLimits = {
    starter: 20,
    pro: 100,
    elite: -1, // -1 means unlimited
  };
  return planLimits[planType] || 100; // Default to pro limit
};

/**
 * Get current month's rendering count for a user
 */
export const getCurrentMonthRenderings = async (userId) => {
  try {
    const { data: projects, error } = await supabase
      .from('projects')
      .select('id, generated_image_url, generated_image_urls, created_at')
      .eq('user_id', userId);

    if (error) throw error;

    const hasConcepts = (p) => (p.generated_image_urls?.length > 0) || p.generated_image_url;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const thisMonthRenderings = projects?.filter(
      (p) => hasConcepts(p) && new Date(p.created_at) >= startOfMonth
    ).length || 0;

    return thisMonthRenderings;
  } catch (error) {
    console.error('Error fetching current month renderings:', error);
    throw error;
  }
};

/**
 * Check if user can generate a new rendering based on their plan limits
 * @param {string} userId - User ID
 * @param {string} planType - Plan type (starter, pro, elite)
 * @returns {Promise<{canGenerate: boolean, renderingsUsed: number, renderingsLimit: number, message?: string}>}
 */
export const checkRenderingLimit = async (userId, planType) => {
  try {
    const renderingsLimit = getPlanLimit(planType);
    
    // Elite plan is unlimited
    if (renderingsLimit === -1) {
      return {
        canGenerate: true,
        renderingsUsed: 0,
        renderingsLimit: -1,
      };
    }

    const renderingsUsed = await getCurrentMonthRenderings(userId);

    if (renderingsUsed >= renderingsLimit) {
      return {
        canGenerate: false,
        renderingsUsed,
        renderingsLimit,
        message: `You've reached your monthly limit of ${renderingsLimit} renderings. Please upgrade your plan to continue generating.`,
      };
    }

    return {
      canGenerate: true,
      renderingsUsed,
      renderingsLimit,
    };
  } catch (error) {
    console.error('Error checking rendering limit:', error);
    return {
      canGenerate: false,
      renderingsUsed: 0,
      renderingsLimit: 0,
      message: 'Unable to verify your rendering limit. Please try again.',
    };
  }
};
