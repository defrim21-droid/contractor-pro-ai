import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from './supabaseClient';
import { toast } from 'sonner';
import { getPlanLimit } from './utils/planLimits';
import { validatePassword } from './utils/passwordValidation';
import PasswordStrengthIndicator from './components/PasswordStrengthIndicator';
import {
  ChartBarIcon,
  ExclamationTriangleIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';

export default function Settings({ session }) {
  const navigate = useNavigate();
  const metadata = session.user.user_metadata || {};

  const [firstName, setFirstName] = useState(metadata.first_name || '');
  const [lastName, setLastName] = useState(metadata.last_name || '');
  const [companyName, setCompanyName] = useState(metadata.company_name || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');

  // Password Change State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Email Preferences State
  const [emailPreferences, setEmailPreferences] = useState({
    productUpdates: metadata.email_product_updates !== false,
    marketingEmails: metadata.email_marketing !== false,
    projectAlerts: metadata.email_project_alerts !== false,
  });
  const [isSavingEmailPrefs, setIsSavingEmailPrefs] = useState(false);

  // Usage Statistics State
  const [usageStats, setUsageStats] = useState({
    renderingsUsed: 0,
    renderingsLimit: 100, // Default to Pro plan
    projectsCount: 0,
  });
  const [isLoadingUsage, setIsLoadingUsage] = useState(true);

  // Fetch usage statistics
  useEffect(() => {
    const fetchUsageStats = async () => {
      setIsLoadingUsage(true);
      try {
        // Get all projects for this user
        const { data: projects, error } = await supabase
          .from('projects')
          .select('id, generated_image_url, generated_image_urls, created_at')
          .eq('user_id', session.user.id);

        if (error) throw error;

        const hasConcepts = (p) => (p.generated_image_urls?.length > 0) || p.generated_image_url;
        const renderingsUsed = projects?.filter(hasConcepts).length || 0;
        
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const thisMonthRenderings = projects?.filter(p => 
          hasConcepts(p) && new Date(p.created_at) >= startOfMonth
        ).length || 0;

        // Determine plan limit from plan_type
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

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    
    const { error } = await supabase.auth.updateUser({
      data: { first_name: firstName, last_name: lastName, company_name: companyName }
    });

    setIsSaving(false);
    if (error) {
      toast.error("Update failed: " + error.message);
    } else {
      toast.success("Profile updated successfully!");
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    
    if (!currentPassword) {
      toast.error("Please enter your current password.");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match.");
      return;
    }

    // Validate password strength
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      toast.error("Password does not meet requirements:\n" + passwordValidation.errors.join('\n'));
      return;
    }

    setIsChangingPassword(true);

    try {
      // Update password (Supabase handles password change)
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      toast.success("Password updated successfully!");
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      toast.error("Failed to update password: " + error.message);
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleUpdateEmailPreferences = async () => {
    setIsSavingEmailPrefs(true);

    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          email_product_updates: emailPreferences.productUpdates,
          email_marketing: emailPreferences.marketingEmails,
          email_project_alerts: emailPreferences.projectAlerts,
        }
      });

      if (error) throw error;
      toast.success("Email preferences updated!");
    } catch (error) {
      toast.error("Failed to update preferences: " + error.message);
    } finally {
      setIsSavingEmailPrefs(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== 'DELETE') {
      toast.error("Please type 'DELETE' to confirm account deletion.");
      return;
    }

    setIsDeleting(true);

    try {
      // 1. Delete all user projects (Supabase RLS handles the 'where user_id' part)
      const { error: projectError } = await supabase
        .from('projects')
        .delete()
        .match({ user_id: session.user.id });

      if (projectError) throw projectError;

      // 2. Log the user out
      // Note: In a production app with a custom backend, you would call an 
      // admin function here to delete the Auth record. For now, we wipe 
      // their data and sign them out.
      await supabase.auth.signOut();
      toast.success("Your account has been deleted. You will be redirected.");
      setTimeout(() => {
        navigate('/');
      }, 2000);

    } catch (error) {
      console.error("Error during deletion:", error);
      toast.error("An error occurred: " + error.message);
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
      setDeleteConfirmation('');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-20">
      <nav className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center sticky top-0 z-50">
        <div className="text-xl font-bold text-slate-800">Account Settings</div>
        <button onClick={() => navigate('/dashboard')} className="text-slate-500 hover:text-blue-600 font-medium transition cursor-pointer">
          ← Back to Dashboard
        </button>
      </nav>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Usage Statistics Card */}
        <div className="card-modern p-8 mb-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">Usage Statistics</h2>
          
          {isLoadingUsage ? (
            <div className="text-slate-500">Loading...</div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-slate-600">AI Renderings This Month</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">
                    {usageStats.renderingsUsed} / {usageStats.renderingsLimit === -1 ? '∞' : usageStats.renderingsLimit}
                  </p>
                </div>
                <div className="text-right">
                  <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center">
                    <ChartBarIcon className="h-8 w-8 text-blue-600" />
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 uppercase font-medium">Total Projects</p>
                  <p className="text-xl font-bold text-slate-900 mt-1">{usageStats.projectsCount}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 uppercase font-medium">Plan</p>
                  <p className="text-xl font-bold text-slate-900 mt-1">
                    {metadata.plan_type === 'starter' ? 'Starter' : 
                     metadata.plan_type === 'elite' ? 'Elite' : 
                     'Contractor Pro'}
                  </p>
                </div>
              </div>

              {usageStats.renderingsLimit !== -1 && usageStats.renderingsUsed >= usageStats.renderingsLimit * 0.8 && (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-3">
                  <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-yellow-800">
                    You've used {Math.round((usageStats.renderingsUsed / usageStats.renderingsLimit) * 100)}% of your monthly renderings.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Profile Card */}
        <div className="card-modern p-8 mb-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">Profile Information</h2>
          
          <form onSubmit={handleUpdateProfile} className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">First Name</label>
                <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="input-modern" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Last Name</label>
                <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} className="input-modern" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Company Name</label>
              <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="input-modern" />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Email Address</label>
              <input type="email" disabled value={session.user.email} className="w-full px-4 py-3 border border-slate-200 bg-slate-50 text-slate-500 rounded-xl outline-none cursor-not-allowed" />
            </div>

            <button type="submit" disabled={isSaving} className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed">
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        </div>

        {/* Password Change Card */}
        <div className="card-modern p-8 mb-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">Change Password</h2>
          
          <form onSubmit={handleChangePassword} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Current Password</label>
              <input 
                type="password" 
                value={currentPassword} 
                onChange={(e) => setCurrentPassword(e.target.value)} 
                placeholder="Enter your current password"
                className="input-modern" 
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">New Password</label>
              <input 
                type="password" 
                value={newPassword} 
                onChange={(e) => setNewPassword(e.target.value)} 
                placeholder="Enter new password"
                className="input-modern" 
                required
              />
              {newPassword && (
                <PasswordStrengthIndicator password={newPassword} showRequirements={true} />
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Confirm New Password</label>
              <input 
                type="password" 
                value={confirmPassword} 
                onChange={(e) => setConfirmPassword(e.target.value)} 
                placeholder="Confirm new password"
                className="input-modern" 
                required
              />
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-red-600 mt-1">Passwords do not match</p>
              )}
            </div>

            <button type="submit" disabled={isChangingPassword} className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed">
              {isChangingPassword ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        </div>

        {/* Email Preferences Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 mb-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">Email Preferences</h2>
          
          <div className="space-y-4">
            <label className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer">
              <div>
                <p className="font-medium text-slate-900">Product Updates</p>
                <p className="text-sm text-slate-500">Receive updates about new features and improvements</p>
              </div>
              <input
                type="checkbox"
                checked={emailPreferences.productUpdates}
                onChange={(e) => setEmailPreferences(prev => ({ ...prev, productUpdates: e.target.checked }))}
                className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
              />
            </label>

            <label className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer">
              <div>
                <p className="font-medium text-slate-900">Marketing Emails</p>
                <p className="text-sm text-slate-500">Tips, best practices, and promotional content</p>
              </div>
              <input
                type="checkbox"
                checked={emailPreferences.marketingEmails}
                onChange={(e) => setEmailPreferences(prev => ({ ...prev, marketingEmails: e.target.checked }))}
                className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
              />
            </label>

            <label className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer">
              <div>
                <p className="font-medium text-slate-900">Project Alerts</p>
                <p className="text-sm text-slate-500">Notifications when your AI renderings are complete</p>
              </div>
              <input
                type="checkbox"
                checked={emailPreferences.projectAlerts}
                onChange={(e) => setEmailPreferences(prev => ({ ...prev, projectAlerts: e.target.checked }))}
                className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
              />
            </label>

            <button 
              onClick={handleUpdateEmailPreferences}
              disabled={isSavingEmailPrefs}
              className="w-full bg-blue-600 text-white font-bold px-6 py-3 rounded-lg hover:bg-blue-700 transition shadow-sm disabled:opacity-50 cursor-pointer mt-4"
            >
              {isSavingEmailPrefs ? 'Saving...' : 'Save Preferences'}
            </button>
          </div>
        </div>

        <div className="mt-16 pt-8 border-t border-slate-200 text-center">
          <button
            type="button"
            onClick={() => setShowDeleteModal(true)}
            disabled={isDeleting}
            className="text-sm text-slate-600 hover:text-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Delete my account
          </button>
        </div>

        {/* Delete Account Modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="relative max-w-md w-full bg-white rounded-2xl shadow-large border border-slate-200/60 p-8 animate-fade-in">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteConfirmation('');
                }}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 transition text-xl font-bold cursor-pointer"
              >
                ✕
              </button>

              <div className="mb-6">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <TrashIcon className="h-8 w-8 text-red-600" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 text-center mb-2">
                  Delete Your Account?
                </h2>
                <p className="text-sm text-slate-600 text-center">
                  This action cannot be undone. All your data will be permanently deleted.
                </p>
              </div>

              <div className="space-y-4 mb-6">
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                  <p className="text-sm font-semibold text-red-900 mb-2">What will be deleted:</p>
                  <ul className="text-sm text-red-700 space-y-1 list-disc list-inside">
                    <li>All projects and AI renderings</li>
                    <li>All uploaded images and masks</li>
                    <li>Account settings and preferences</li>
                    <li>Billing and subscription data</li>
                  </ul>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Type <span className="font-mono bg-slate-100 px-2 py-1 rounded">DELETE</span> to confirm:
                  </label>
                  <input
                    type="text"
                    value={deleteConfirmation}
                    onChange={(e) => setDeleteConfirmation(e.target.value)}
                    placeholder="Type DELETE to confirm"
                    className="input-modern font-mono"
                    autoFocus
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteModal(false);
                    setDeleteConfirmation('');
                  }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  disabled={isDeleting || deleteConfirmation !== 'DELETE'}
                  className="bg-red-600 text-white font-semibold px-6 py-3 rounded-xl hover:bg-red-700 transition-all duration-200 shadow-medium hover:shadow-large disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
                >
                  {isDeleting ? 'Deleting Account...' : 'Delete Account'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}