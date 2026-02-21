import React, { useState, useEffect, useRef } from 'react';
import { Elements } from '@stripe/react-stripe-js';
import { toast } from 'sonner';
import { supabase } from './supabaseClient';
import { getPlanLimit } from './utils/planLimits';
import { stripePromise } from './utils/stripeConfig';
import { validatePassword } from './utils/passwordValidation';
import { sendWelcomeEmail } from './services/emailService';
import { canUserGetTrial, markEmailTrialUsed } from './utils/trialPrevention';
import PaymentForm from './components/PaymentForm';
import PasswordStrengthIndicator from './components/PasswordStrengthIndicator';
import {
  CheckIcon,
  FireIcon,
  RocketLaunchIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';

export default function Auth({ onClose, defaultMode = 'login' }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [selectedTrade, setSelectedTrade] = useState('');
  const [selectedPlan, setSelectedPlan] = useState('pro'); // Default to Pro
  
  const [authMode, setAuthMode] = useState(defaultMode);
  const [loading, setLoading] = useState(false);
  const [signupStep, setSignupStep] = useState('info'); // 'info' or 'payment'
  const [paymentIntentClientSecret, setPaymentIntentClientSecret] = useState(null);
  const modalRef = useRef(null);

  const plans = {
    starter: { name: 'Starter', price: 149, limit: 20 },
    pro: { name: 'Contractor Pro', price: 199, limit: 100 },
    elite: { name: 'Elite', price: 249, limit: -1 },
  };

  const TRADES = [
    { value: '', label: 'Select your trade' },
    { value: 'masonry', label: 'Masonry' },
    { value: 'eifs', label: 'EIFS' },
    { value: 'siding', label: 'Siding' },
    { value: 'exterior_painting', label: 'Exterior Painting' },
    { value: 'roofing', label: 'Roofing' },
    { value: 'windows_doors', label: 'Windows & Doors' },
    { value: 'interior_painting', label: 'Interior Painting' },
    { value: 'flooring', label: 'Flooring' },
    { value: 'tile_work', label: 'Tile Work' },
    { value: 'cabinetry_millwork', label: 'Cabinetry / Millwork' },
    { value: 'countertops', label: 'Countertops' },
    { value: 'concrete_hardscape', label: 'Concrete / Hardscape' },
    { value: 'general_contractor', label: 'General Contractor' },
    { value: 'other', label: 'Other' },
  ];

  // Handle ESC key press
  useEffect(() => {
    const handleEsc = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  // Handle click outside modal
  const handleBackdropClick = (e) => {
    if (modalRef.current && !modalRef.current.contains(e.target)) {
      onClose();
    }
  };

  const handleInfoSubmit = async (e) => {
    e.preventDefault();
    
    // Validate required fields
    if (!firstName || !lastName || !companyName || !selectedTrade || !email || !password) {
      toast.error('Please fill in all required fields including your trade.');
      return;
    }

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      toast.error('Password does not meet requirements:\n' + passwordValidation.errors.join('\n'));
      return;
    }

    // Check trial eligibility for Pro plan (before payment step)
    if (selectedPlan === 'pro') {
      try {
        const trialCheck = await canUserGetTrial(email);
        if (!trialCheck.canGetTrial) {
          toast.error(trialCheck.reason || 'This email is not eligible for a free trial. You can still sign up, but will be charged immediately.');
          // Still allow them to proceed, but they won't get trial
          // Option: Uncomment below to block signup entirely
          // return;
        }
      } catch (error) {
        console.error('Error checking trial eligibility:', error);
        // Continue anyway - don't block signup if check fails
      }
    }

    // Move to payment step
    setSignupStep('payment');
  };

  const handlePaymentSuccess = async () => {
    setLoading(true);
    
    try {
      // Check trial eligibility before signup (only for Pro plan)
      let trialStartDate = null;
      if (selectedPlan === 'pro') {
        const trialCheck = await canUserGetTrial(email);
        
        if (!trialCheck.canGetTrial) {
          // User has already used a trial - don't assign another one
          toast.warning(trialCheck.reason || 'This account is not eligible for a free trial. You will be charged immediately upon signup.');
          // Still allow signup, but without trial
          trialStartDate = null;
        } else {
          // User is eligible for trial
          trialStartDate = new Date().toISOString();
        }
      }

      // Create user account after payment method is collected
      const { data: signupData, error } = await supabase.auth.signUp({
        email, password,
        options: { 
          emailRedirectTo: `${window.location.origin}/verify-email?type=signup`,
          data: { 
            first_name: firstName, 
            last_name: lastName, 
            company_name: companyName,
            trade: selectedTrade,
            plan_type: selectedPlan,
            plan_limit: getPlanLimit(selectedPlan),
            trial_start_date: trialStartDate,
          } 
        }
      });
      
      if (error) throw error;

      // Mark trial as used if trial was assigned
      if (trialStartDate && signupData?.user) {
        try {
          await markEmailTrialUsed(
            email,
            signupData.user.id,
            selectedPlan
            // Note: paymentMethodId and stripeCustomerId would be added here
            // once payment integration is complete
          );
        } catch (trialError) {
          console.error('Failed to mark trial as used:', trialError);
          // Don't block signup if this fails, but log it
        }
      }
      
      // Send welcome email (non-blocking)
      const userName = firstName || companyName || email.split('@')[0];
      sendWelcomeEmail(email, userName, selectedPlan).catch((err) => {
        console.error('Failed to send welcome email:', err);
        // Don't block signup if email fails
      });
      
      // Close modal and redirect to verification page
      if (onClose) onClose();
      window.location.href = `/verify-email?email=${encodeURIComponent(email)}`;
    } catch (error) {
      alert('Account creation failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (authMode === 'signup') {
        // This should not be called directly anymore - use handleInfoSubmit instead
        await handleInfoSubmit(e);
      } else if (authMode === 'login') {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        
        if (error) {
          // Check if error is due to unverified email
          if (error.message.includes('Email not confirmed') || error.message.includes('email_not_confirmed')) {
            // Redirect to verification page
            if (onClose) onClose();
            window.location.href = `/verify-email?email=${encodeURIComponent(email)}`;
            return;
          }
          throw error;
        }
        
        // Check if user email is verified
        if (data?.user && !data.user.email_confirmed_at) {
          // User is logged in but email not verified
          if (onClose) onClose();
          window.location.href = `/verify-email?email=${encodeURIComponent(email)}`;
          return;
        }
        
        // App.jsx will automatically detect the session and route to Dashboard
      } else if (authMode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/update-password`,
        });
        if (error) throw error;
        alert('Password reset link sent! Please check your email.');
        setAuthMode('login');
      }
    } catch (error) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { 
        redirectTo: window.location.origin,
        // Note: OAuth signups will default to Pro plan
        // Plan selection can be changed later in Billing settings
      }
    });
    if (error) alert(error.message);
  };

  // NEW: Microsoft Login Logic
  const handleMicrosoftLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'azure', // Supabase uses 'azure' for Microsoft accounts
      options: {
        scopes: 'email',
        redirectTo: window.location.origin,
        // Note: OAuth signups will default to Pro plan
        // Plan selection can be changed later in Billing settings
      }
    });
    if (error) alert(error.message);
  };

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm py-8 px-4 overflow-y-auto"
      onClick={handleBackdropClick}
    >
      <div 
        ref={modalRef}
        className="relative max-w-2xl w-full glass rounded-2xl shadow-large border border-slate-200/60 p-8 animate-fade-in max-h-[calc(100vh-4rem)] overflow-y-auto flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >

        <div className="text-center mb-8 mt-2">
          <h2 className="text-2xl font-extrabold text-slate-900">
            {authMode === 'login' 
              ? 'Welcome back' 
              : authMode === 'signup' 
                ? (signupStep === 'payment' ? 'Add Payment Method' : 'Create your account')
                : 'Reset your password'}
          </h2>
          <p className="text-sm text-slate-500 mt-2">
            {authMode === 'forgot' 
              ? "Enter your email and we'll send a reset link." 
              : authMode === 'signup' && signupStep === 'payment'
                ? 'Secure payment powered by Stripe'
                : "Continue to ContractorPro AI"}
          </p>
        </div>

        {authMode === 'signup' && signupStep === 'payment' ? (
          <Elements stripe={stripePromise} options={{ mode: 'setup', currency: 'usd' }}>
            <PaymentForm
              onPaymentSuccess={handlePaymentSuccess}
              planType={selectedPlan}
              planPrice={plans[selectedPlan].price}
              onCancel={() => setSignupStep('info')}
            />
          </Elements>
        ) : (
          <form onSubmit={authMode === 'signup' ? handleInfoSubmit : handleAuth} className="space-y-4">
            {authMode === 'signup' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <input type="text" placeholder="First Name" required value={firstName} onChange={(e) => setFirstName(e.target.value)} className="input-modern" />
                <input type="text" placeholder="Last Name" required value={lastName} onChange={(e) => setLastName(e.target.value)} className="input-modern" />
              </div>
              <input type="text" placeholder="Company Name" required value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="input-modern" />
              
              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">
                  Trade
                </label>
                <select
                  required
                  value={selectedTrade}
                  onChange={(e) => setSelectedTrade(e.target.value)}
                  className="input-modern w-full"
                >
                  {TRADES.map((t) => (
                    <option key={t.value || 'placeholder'} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Plan Selection */}
              <div className="mt-6">
                <label className="block text-sm font-semibold text-slate-900 mb-3">
                  Choose your plan
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {/* Starter Plan */}
                  <button
                    type="button"
                    onClick={() => setSelectedPlan('starter')}
                    className={`p-4 rounded-xl border-2 transition-all text-left ${
                      selectedPlan === 'starter'
                        ? 'border-blue-500 bg-blue-50 shadow-medium'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="font-bold text-slate-900 text-sm mb-1">Starter</div>
                    <div className="text-lg font-extrabold text-slate-900">
                      ${plans.starter.price}
                      <span className="text-xs text-slate-500 font-medium">/mo</span>
                    </div>
                    <div className="text-xs text-slate-600 mt-2">
                      {plans.starter.limit} renderings
                    </div>
                    {selectedPlan === 'starter' && (
                      <CheckIcon className="h-5 w-5 text-blue-600 mt-2" />
                    )}
                  </button>

                  {/* Pro Plan */}
                  <button
                    type="button"
                    onClick={() => setSelectedPlan('pro')}
                    className={`p-4 rounded-xl border-2 transition-all text-left relative ${
                      selectedPlan === 'pro'
                        ? 'border-blue-500 bg-blue-50 shadow-medium'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-2 py-0.5 rounded-full text-[10px] font-bold uppercase whitespace-nowrap">
                      Popular
                    </div>
                    <div className="font-bold text-slate-900 text-sm mb-1 mt-1">Pro</div>
                    <div className="text-lg font-extrabold text-slate-900">
                      ${plans.pro.price}
                      <span className="text-xs text-slate-500 font-medium">/mo</span>
                    </div>
                    <div className="text-xs text-slate-600 mt-2 flex items-center gap-1">
                      <SparklesIcon className="h-3 w-3 text-blue-600" />
                      {plans.pro.limit} renderings
                    </div>
                    {selectedPlan === 'pro' && (
                      <CheckIcon className="h-5 w-5 text-blue-600 mt-2" />
                    )}
                  </button>

                  {/* Elite Plan */}
                  <button
                    type="button"
                    onClick={() => setSelectedPlan('elite')}
                    className={`p-4 rounded-xl border-2 transition-all text-left ${
                      selectedPlan === 'elite'
                        ? 'border-blue-500 bg-blue-50 shadow-medium'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="font-bold text-slate-900 text-sm mb-1">Elite</div>
                    <div className="text-lg font-extrabold text-slate-900">
                      ${plans.elite.price}
                      <span className="text-xs text-slate-500 font-medium">/mo</span>
                    </div>
                    <div className="text-xs text-slate-600 mt-2 flex items-center gap-1">
                      <RocketLaunchIcon className="h-3 w-3 text-purple-600" />
                      Unlimited
                    </div>
                    {selectedPlan === 'elite' && (
                      <CheckIcon className="h-5 w-5 text-blue-600 mt-2" />
                    )}
                  </button>
                </div>
                {selectedPlan === 'pro' && (
                  <p className="text-xs text-blue-600 font-medium mt-2 text-center">
                    Includes a 2-Week Free Trial
                  </p>
                )}
              </div>
            </>
          )}

          <input type="email" placeholder="Email address" required value={email} onChange={(e) => setEmail(e.target.value)} className="input-modern" />
          
          {authMode !== 'forgot' && (
            <div>
              <input 
                type="password" 
                placeholder="Password" 
                required 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                className="input-modern" 
              />
              {authMode === 'signup' && (
                <PasswordStrengthIndicator password={password} showRequirements={true} />
              )}
            </div>
          )}

          {authMode === 'login' && (
            <div className="flex justify-end">
              <button type="button" onClick={() => setAuthMode('forgot')} className="text-sm text-blue-600 font-medium hover:underline cursor-pointer">
                Forgot password?
              </button>
            </div>
          )}

          {authMode === 'signup' && (
            <p className="text-xs text-slate-500 text-center px-2">
              By creating an account, you agree to our <a href="/terms" className="text-blue-600 hover:underline" target="_blank">Terms</a> and <a href="/privacy" className="text-blue-600 hover:underline" target="_blank">Privacy Policy</a>.
            </p>
          )}

          <button disabled={loading} type="submit" className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed">
            {loading 
              ? 'Processing...' 
              : authMode === 'login' 
                ? 'Log In' 
                : authMode === 'signup' 
                  ? 'Continue to Payment' 
                  : 'Send Reset Link'}
          </button>
        </form>
        )}

        {authMode !== 'forgot' && (
          <>
            <div className="mt-6 flex items-center justify-between">
              <span className="border-b border-slate-200 w-1/5 lg:w-1/4"></span>
              <span className="text-xs text-center text-slate-500 uppercase">Or continue with</span>
              <span className="border-b border-slate-200 w-1/5 lg:w-1/4"></span>
            </div>
            
            {/* NEW: Side-by-Side Auth Buttons */}
            <div className="mt-6 grid grid-cols-2 gap-4">
              <button onClick={handleGoogleLogin} type="button" className="btn-secondary w-full flex items-center justify-center gap-2">
                <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="w-5 h-5" />
                Google
              </button>
              
              <button onClick={handleMicrosoftLogin} type="button" className="btn-secondary w-full flex items-center justify-center gap-2">
                <img src="https://upload.wikimedia.org/wikipedia/commons/4/44/Microsoft_logo.svg" alt="Microsoft" className="w-4 h-4" />
                Microsoft
              </button>
            </div>
          </>
        )}

        <div className="mt-8 text-center text-sm text-slate-600">
          {authMode === 'login' ? (
            <>Don't have an account? <button onClick={() => { setAuthMode('signup'); setSignupStep('info'); }} className="text-blue-600 font-bold hover:underline cursor-pointer">Sign up</button></>
          ) : authMode === 'signup' ? (
            <>Already have an account? <button onClick={() => { setAuthMode('login'); setSignupStep('info'); }} className="text-blue-600 font-bold hover:underline cursor-pointer">Log in</button></>
          ) : (
            <button onClick={() => { setAuthMode('login'); setSignupStep('info'); }} className="text-blue-600 font-bold hover:underline cursor-pointer">← Back to Log in</button>
          )}
        </div>

      </div>
    </div>
  );
}