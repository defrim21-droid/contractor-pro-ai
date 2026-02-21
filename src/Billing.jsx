import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { toast } from 'sonner';
import { getPlanLimit } from './utils/planLimits';
import {
  getTrialInfo,
  formatTrialEndDate,
  getTrialStatusMessage,
} from './utils/trialTracking';
import TrialBanner from './components/TrialBanner';
import {
  ChartBarIcon,
  ExclamationTriangleIcon,
  CheckIcon,
  FireIcon,
  RocketLaunchIcon,
} from '@heroicons/react/24/outline';

export default function Billing({ session }) {
  const metadata = session.user.user_metadata || {};

  // Usage Statistics State
  const [usageStats, setUsageStats] = useState({
    renderingsUsed: 0,
    renderingsLimit: 100,
    projectsCount: 0,
  });
  const [isLoadingUsage, setIsLoadingUsage] = useState(true);

  // Billing Information State
  const [billingInfo, setBillingInfo] = useState({
    nextBillingDate: null,
    paymentMethod: 'Card ending in •••• 4242', // Placeholder
    billingEmail: session.user.email,
    status: 'active',
  });

  // Trial Information
  const trialStartDate = metadata.trial_start_date;
  const trialInfo = getTrialInfo(trialStartDate, metadata.plan_type || 'pro');

  // Plan Change State
  const [currentPlan, setCurrentPlan] = useState('pro'); // starter, pro, elite
  const [planChangeModal, setPlanChangeModal] = useState({ isOpen: false, targetPlan: null });
  const [isChangingPlan, setIsChangingPlan] = useState(false);

  const plans = {
    starter: { name: 'Starter', price: 149, limit: 20 },
    pro: { name: 'Contractor Pro', price: 199, limit: 100 },
    elite: { name: 'Elite', price: 249, limit: -1 }, // -1 means unlimited
  };

  // Billing History State
  const [billingHistory, setBillingHistory] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);

  // Fetch usage statistics
  useEffect(() => {
    const fetchUsageStats = async () => {
      setIsLoadingUsage(true);
      try {
        const { data: projects, error } = await supabase
          .from('projects')
          .select('id, generated_image_url, generated_image_urls, created_at')
          .eq('user_id', session.user.id);

        if (error) throw error;

        const hasConcepts = (p) => (p.generated_image_urls?.length > 0) || p.generated_image_url;
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const thisMonthRenderings = projects?.filter(
          (p) => hasConcepts(p) && new Date(p.created_at) >= startOfMonth
        ).length || 0;

        const planType = metadata.plan_type || 'pro';
        const planLimit = getPlanLimit(planType);

        setUsageStats({
          renderingsUsed: thisMonthRenderings,
          renderingsLimit: planLimit,
          projectsCount: projects?.length || 0,
        });
      } catch (error) {
        console.error('Error fetching usage stats:', error);
      } finally {
        setIsLoadingUsage(false);
      }
    };

    fetchUsageStats();
  }, [session.user.id, metadata.plan_type]);

  // Fetch billing history (placeholder for now)
  useEffect(() => {
    const fetchBillingHistory = async () => {
      setIsLoadingHistory(true);
      // In production, this would fetch from a billing/invoices table
      // For now, we'll create placeholder data
      setTimeout(() => {
        const placeholderHistory = [
          {
            id: 1,
            date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            amount: 199.0,
            status: 'paid',
            invoiceNumber: 'INV-2024-001',
          },
          {
            id: 2,
            date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
            amount: 199.0,
            status: 'paid',
            invoiceNumber: 'INV-2024-002',
          },
        ];
        setBillingHistory(placeholderHistory);
        setIsLoadingHistory(false);
      }, 500);
    };

    fetchBillingHistory();
  }, []);

  // Calculate next billing date (trial end date or 30 days from now)
  useEffect(() => {
    let nextDate;
    
    if (trialInfo.isOnTrial && trialInfo.trialEndDate) {
      // If on trial, next billing is trial end date
      nextDate = trialInfo.trialEndDate;
    } else {
      // Otherwise, 30 days from now (placeholder)
      nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + 30);
    }
    
    setBillingInfo((prev) => ({
      ...prev,
      nextBillingDate: nextDate,
      status: trialInfo.isExpired ? 'trial_expired' : trialInfo.isOnTrial ? 'trial' : 'active',
    }));
  }, [trialInfo]);

  // Determine current plan from metadata
  useEffect(() => {
    const planFromMetadata = metadata.plan_type || 'pro';
    setCurrentPlan(planFromMetadata);
    // Update usage limit based on plan
    const planLimit = getPlanLimit(planFromMetadata);
    setUsageStats((prev) => ({ ...prev, renderingsLimit: planLimit }));
  }, [metadata.plan_type]);

  const handlePlanChange = (targetPlan) => {
    if (targetPlan === currentPlan) return;
    setPlanChangeModal({ isOpen: true, targetPlan });
  };

  const confirmPlanChange = async () => {
    const { targetPlan } = planChangeModal;
    setIsChangingPlan(true);

    try {
      // Update user metadata with new plan
      const { error } = await supabase.auth.updateUser({
        data: {
          plan_type: targetPlan,
          plan_limit: plans[targetPlan].limit,
        },
      });

      if (error) throw error;

      setCurrentPlan(targetPlan);
      setUsageStats((prev) => ({
        ...prev,
        renderingsLimit: plans[targetPlan].limit,
      }));

      toast.success(`Successfully changed to ${plans[targetPlan].name} plan!`);
      setPlanChangeModal({ isOpen: false, targetPlan: null });
    } catch (error) {
      toast.error('Failed to change plan: ' + error.message);
    } finally {
      setIsChangingPlan(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-20">
      {/* Trial Banner */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <TrialBanner
          trialStartDate={trialStartDate}
          planType={metadata.plan_type || 'pro'}
          onUpgrade={() => {}}
        />
      </div>
      {/* Mini Nav */}
      <nav className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center sticky top-0 z-50">
        <div className="text-xl font-bold text-slate-800">Plan & Billing</div>
        <a href="/dashboard" className="text-slate-500 hover:text-blue-600 font-medium transition cursor-pointer">
          ← Back to Dashboard
        </a>
      </nav>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-extrabold text-slate-900">Manage Your Subscription</h1>
          <p className="text-slate-600 mt-2">Upgrade your plan to unlock more AI renderings and client features.</p>
        </div>

        {/* Current Usage Section */}
        <div className="card-modern p-8 mb-8">
          <h2 className="text-xl font-bold text-slate-900 mb-6">Current Usage</h2>
          {isLoadingUsage ? (
            <div className="text-slate-500">Loading...</div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-slate-600">AI Renderings This Month</p>
                  <p className="text-3xl font-bold text-slate-900 mt-1">
                    {usageStats.renderingsUsed} / {usageStats.renderingsLimit === -1 ? '∞' : usageStats.renderingsLimit}
                  </p>
                </div>
                <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center">
                  <ChartBarIcon className="h-10 w-10 text-blue-600" />
                </div>
              </div>
              
              {/* Progress Bar */}
              {usageStats.renderingsLimit !== -1 && (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>Usage</span>
                    <span>{Math.round((usageStats.renderingsUsed / usageStats.renderingsLimit) * 100)}%</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all ${
                        usageStats.renderingsUsed >= usageStats.renderingsLimit * 0.9
                          ? 'bg-red-500'
                          : usageStats.renderingsUsed >= usageStats.renderingsLimit * 0.8
                          ? 'bg-yellow-500'
                          : 'bg-blue-600'
                      }`}
                      style={{
                        width: `${Math.min((usageStats.renderingsUsed / usageStats.renderingsLimit) * 100, 100)}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {usageStats.renderingsLimit !== -1 && usageStats.renderingsUsed >= usageStats.renderingsLimit * 0.8 && (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-3">
                  <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-yellow-800">
                      You've used {Math.round((usageStats.renderingsUsed / usageStats.renderingsLimit) * 100)}% of your monthly renderings.
                      {usageStats.renderingsUsed >= usageStats.renderingsLimit && (
                        <span className="block mt-1 font-semibold">Consider upgrading to continue generating renderings.</span>
                      )}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Billing Information Section */}
        <div className="card-modern p-8 mb-8">
          <h2 className="text-xl font-bold text-slate-900 mb-6">Billing Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-slate-500 mb-1">
                {trialInfo.isOnTrial ? 'Trial Ends' : 'Next Billing Date'}
              </p>
              <p className="text-lg font-bold text-slate-900">
                {billingInfo.nextBillingDate
                  ? billingInfo.nextBillingDate.toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })
                  : 'N/A'}
              </p>
              {trialInfo.isOnTrial && (
                <p className="text-xs text-blue-600 font-medium mt-1">
                  {getTrialStatusMessage(trialInfo)}
                </p>
              )}
            </div>
            <div>
              <p className="text-sm text-slate-500 mb-1">Payment Method</p>
              <p className="text-lg font-bold text-slate-900">{billingInfo.paymentMethod}</p>
              <button className="text-sm text-blue-600 hover:text-blue-700 font-medium mt-1">
                Update Payment Method
              </button>
            </div>
            <div>
              <p className="text-sm text-slate-500 mb-1">Billing Email</p>
              <p className="text-lg font-bold text-slate-900">{billingInfo.billingEmail}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500 mb-1">Subscription Status</p>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                trialInfo.isExpired
                  ? 'bg-red-100 text-red-800'
                  : trialInfo.isOnTrial
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-green-100 text-green-800'
              }`}>
                {trialInfo.isExpired
                  ? 'Trial Expired'
                  : trialInfo.isOnTrial
                  ? 'Free Trial'
                  : billingInfo.status.charAt(0).toUpperCase() + billingInfo.status.slice(1)}
              </span>
            </div>
          </div>
        </div>

        {/* Billing History Section */}
        <div className="card-modern p-8 mb-8">
          <h2 className="text-xl font-bold text-slate-900 mb-6">Billing History</h2>
          {isLoadingHistory ? (
            <div className="text-slate-500">Loading...</div>
          ) : billingHistory.length === 0 ? (
            <p className="text-slate-500">No billing history available.</p>
          ) : (
            <div className="space-y-4">
              {billingHistory.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="font-bold text-slate-900">{invoice.invoiceNumber}</p>
                        <p className="text-sm text-slate-500">
                          {invoice.date.toLocaleDateString('en-US', {
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </p>
                      </div>
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          invoice.status === 'paid'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-slate-900">${invoice.amount.toFixed(2)}</p>
                    <button className="text-sm text-blue-600 hover:text-blue-700 font-medium mt-1">
                      Download
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto items-stretch">
          {/* Starter Plan */}
          <div
            className={`card-modern p-8 flex flex-col ${
              currentPlan === 'starter' ? 'border-2 border-blue-500 shadow-glow' : ''
            }`}
          >
            {currentPlan === 'starter' && (
              <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase whitespace-nowrap">
                Current Plan
              </div>
            )}
            <h3 className="text-xl font-bold text-slate-900 mb-2">Starter</h3>
            <p className="text-slate-500 text-sm mb-6">Perfect for independent contractors.</p>
            <div className="text-4xl font-extrabold text-slate-900 mb-6">
              ${plans.starter.price}
              <span className="text-lg text-slate-500 font-medium">/mo</span>
            </div>
            <ul className="space-y-3 mb-8 text-sm text-slate-600 flex-grow">
              <li className="flex items-center gap-2">
                <CheckIcon className="h-5 w-5 text-green-600 flex-shrink-0" />
                20 AI Renderings per month
              </li>
              <li className="flex items-center gap-2">
                <CheckIcon className="h-5 w-5 text-green-600 flex-shrink-0" />
                Standard resolution exports
              </li>
            </ul>
            {currentPlan === 'starter' ? (
              <button className="w-full bg-blue-600 text-white font-semibold py-3 rounded-xl cursor-default shadow-medium">
                Current Plan
              </button>
            ) : (
              <button
                onClick={() => handlePlanChange('starter')}
                className="btn-secondary w-full"
              >
                {currentPlan === 'pro' ? 'Downgrade' : 'Switch to Starter'}
              </button>
            )}
          </div>

          {/* Pro Plan */}
          <div
            className={`card-modern p-8 relative flex flex-col ${
              currentPlan === 'pro' ? 'border-2 border-blue-500 shadow-glow' : ''
            }`}
          >
            {currentPlan === 'pro' && (
              <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase whitespace-nowrap">
                Current Plan
              </div>
            )}
            <h3 className="text-xl font-bold text-slate-900 mb-2">Contractor Pro</h3>
            <p className="text-slate-500 text-sm mb-6">Everything you need to win more bids.</p>
            <div className="text-4xl font-extrabold text-slate-900 mb-6">
              ${plans.pro.price}
              <span className="text-lg text-slate-500 font-medium">/mo</span>
            </div>
            <ul className="space-y-3 mb-8 text-sm text-slate-600 flex-grow">
              <li className="flex items-center gap-2">
                <FireIcon className="h-5 w-5 text-orange-500 flex-shrink-0" />
                100 AI Renderings per month
              </li>
              <li className="flex items-center gap-2">
                <FireIcon className="h-5 w-5 text-orange-500 flex-shrink-0" />
                4K High-Resolution exports
              </li>
            </ul>
            {currentPlan === 'pro' ? (
              <button className="w-full bg-blue-600 text-white font-semibold py-3 rounded-xl cursor-default shadow-medium">
                Current Plan
              </button>
            ) : (
              <button
                onClick={() => handlePlanChange('pro')}
                className="btn-primary w-full"
              >
                {currentPlan === 'starter' ? 'Upgrade to Pro' : 'Switch to Pro'}
              </button>
            )}
          </div>

          {/* Elite Plan */}
          <div
            className={`card-modern p-8 flex flex-col ${
              currentPlan === 'elite' ? 'border-2 border-blue-500 shadow-glow' : ''
            }`}
          >
            {currentPlan === 'elite' && (
              <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase whitespace-nowrap">
                Current Plan
              </div>
            )}
            <h3 className="text-xl font-bold text-slate-900 mb-2">Elite</h3>
            <p className="text-slate-500 text-sm mb-6">For high-volume design teams.</p>
            <div className="text-4xl font-extrabold text-slate-900 mb-6">
              ${plans.elite.price}
              <span className="text-lg text-slate-500 font-medium">/mo</span>
            </div>
            <ul className="space-y-3 mb-8 text-sm text-slate-600 flex-grow">
              <li className="flex items-center gap-2">
                <RocketLaunchIcon className="h-5 w-5 text-purple-600 flex-shrink-0" />
                Unlimited AI Renderings
              </li>
              <li className="flex items-center gap-2">
                <RocketLaunchIcon className="h-5 w-5 text-purple-600 flex-shrink-0" />
                Team Workspaces
              </li>
            </ul>
            {currentPlan === 'elite' ? (
              <button className="w-full bg-blue-600 text-white font-semibold py-3 rounded-xl cursor-default shadow-medium">
                Current Plan
              </button>
            ) : (
              <button
                onClick={() => handlePlanChange('elite')}
                className="w-full bg-slate-800 text-white font-semibold py-3 rounded-xl hover:bg-slate-900 transition shadow-medium hover:shadow-large cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
              >
                Upgrade to Elite
              </button>
            )}
          </div>
        </div>

        {/* Plan Change Confirmation Modal */}
        {planChangeModal.isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <div className="relative max-w-md w-full bg-white rounded-2xl shadow-2xl border border-slate-200 p-8 animate-in fade-in zoom-in duration-200">
              <button
                type="button"
                onClick={() => setPlanChangeModal({ isOpen: false, targetPlan: null })}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 transition text-xl font-bold cursor-pointer"
              >
                ✕
              </button>

              <div className="mb-6">
                <h2 className="text-2xl font-extrabold text-slate-900">
                  {currentPlan === 'starter' && planChangeModal.targetPlan === 'pro'
                    ? 'Upgrade'
                    : currentPlan === 'pro' && planChangeModal.targetPlan === 'starter'
                    ? 'Downgrade'
                    : 'Change'} Plan
                </h2>
                <p className="text-sm text-slate-500 mt-2">
                  You're about to change from <strong>{plans[currentPlan].name}</strong> to{' '}
                  <strong>{plans[planChangeModal.targetPlan].name}</strong>.
                </p>
              </div>

              <div className="space-y-4 mb-6">
                <div className="p-4 bg-slate-50 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-slate-600">Current Plan</span>
                    <span className="font-bold text-slate-900">
                      ${plans[currentPlan].price}/mo
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600">New Plan</span>
                    <span className="font-bold text-blue-600">
                      ${plans[planChangeModal.targetPlan].price}/mo
                    </span>
                  </div>
                  {plans[planChangeModal.targetPlan].price > plans[currentPlan].price && (
                    <div className="mt-3 pt-3 border-t border-slate-200">
                      <p className="text-xs text-slate-500">
                        💡 Your billing will be prorated. You'll be charged the difference
                        immediately.
                      </p>
                    </div>
                  )}
                </div>

                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>What changes:</strong>
                  </p>
                  <ul className="text-sm text-blue-700 mt-2 space-y-1 list-disc list-inside">
                    <li>
                      Renderings limit: {plans[currentPlan].limit === -1 ? 'Unlimited' : plans[currentPlan].limit} →{' '}
                      {plans[planChangeModal.targetPlan].limit === -1
                        ? 'Unlimited'
                        : plans[planChangeModal.targetPlan].limit}
                    </li>
                    <li>Plan change takes effect immediately</li>
                    <li>Your next billing date will remain the same</li>
                  </ul>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setPlanChangeModal({ isOpen: false, targetPlan: null })}
                  className="px-6 py-3 border border-slate-300 text-slate-700 font-bold rounded-lg hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmPlanChange}
                  disabled={isChangingPlan}
                  className="px-6 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {isChangingPlan ? 'Processing...' : 'Confirm Change'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}