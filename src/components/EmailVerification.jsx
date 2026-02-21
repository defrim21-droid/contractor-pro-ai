import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { toast } from 'sonner';
import { sendWelcomeEmail } from '../services/emailService';
import { EnvelopeIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';

export default function EmailVerification() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [isResending, setIsResending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState(null); // 'success', 'error', null

  // Check if there's a token in the URL (from email link)
  const token = searchParams.get('token');
  const type = searchParams.get('type');

  useEffect(() => {
    // Handle Supabase email verification redirect (uses hash fragments)
    const handleHashVerification = async () => {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      const typeParam = hashParams.get('type');

      if (accessToken && refreshToken && typeParam === 'signup') {
        setIsVerifying(true);
        try {
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error) throw error;

      setVerificationStatus('success');
      toast.success('Email verified successfully!');
      
      // Send welcome email after verification (if not already sent)
      if (data?.user) {
        const metadata = data.user.user_metadata || {};
        const userName = metadata.first_name || metadata.company_name || email.split('@')[0];
        const planType = metadata.plan_type || 'pro';
        
        sendWelcomeEmail(email, userName, planType).catch((err) => {
          console.error('Failed to send welcome email:', err);
        });
      }
      
      // Clear hash from URL
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      
      // Redirect to dashboard after a short delay
      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);
        } catch (error) {
          setVerificationStatus('error');
          toast.error('Verification failed: ' + error.message);
        } finally {
          setIsVerifying(false);
        }
        return true;
      }
      return false;
    };

    // Try hash-based verification first (Supabase default)
    handleHashVerification().then((handled) => {
      if (!handled) {
        // Get email from URL params first, then session
        const emailParam = searchParams.get('email');
        if (emailParam) {
          setEmail(emailParam);
        }

        // If token exists in query params, verify it
        if (token && type === 'signup') {
          verifyEmailToken(token);
        }

        // Get email from session if not in URL
        if (!emailParam) {
          supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user?.email) {
              setEmail(session.user.email);
            }
          });
        }
      }
    });
  }, [token, type, searchParams, navigate]);

  const verifyEmailToken = async (tokenToVerify) => {
    setIsVerifying(true);
    try {
      // Supabase handles email verification via URL hash, not query params
      // The token comes from the email link redirect
      const { data, error } = await supabase.auth.verifyOtp({
        token_hash: tokenToVerify,
        type: 'signup',
      });

      if (error) {
        // Try alternative verification method
        // Sometimes Supabase uses the hash fragment instead
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        
        if (accessToken && refreshToken) {
          // Set session directly
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          
          if (sessionError) throw sessionError;
        } else {
          throw error;
        }
      }

      setVerificationStatus('success');
      toast.success('Email verified successfully!');
      
      // Redirect to dashboard after a short delay
      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);
    } catch (error) {
      setVerificationStatus('error');
      toast.error('Verification failed: ' + error.message);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResendVerification = async () => {
    if (!email) {
      toast.error('Please enter your email address.');
      return;
    }

    setIsResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
        options: {
          emailRedirectTo: `${window.location.origin}/verify-email?type=signup`,
        },
      });

      if (error) throw error;

      toast.success('Verification email sent! Please check your inbox.');
    } catch (error) {
      toast.error('Failed to send verification email: ' + error.message);
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 font-sans p-4">
      <div className="max-w-md w-full card-modern p-8 text-center">
        <div className="mb-6">
          {verificationStatus === 'success' ? (
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircleIcon className="h-10 w-10 text-green-600" />
            </div>
          ) : verificationStatus === 'error' ? (
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <XCircleIcon className="h-10 w-10 text-red-600" />
            </div>
          ) : (
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <EnvelopeIcon className="h-10 w-10 text-blue-600" />
            </div>
          )}
        </div>

        {isVerifying ? (
          <>
            <h1 className="text-2xl font-extrabold text-slate-900 mb-2">
              Verifying your email...
            </h1>
            <p className="text-slate-600 mb-6">
              Please wait while we verify your email address.
            </p>
            <div className="flex justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
            </div>
          </>
        ) : verificationStatus === 'success' ? (
          <>
            <h1 className="text-2xl font-extrabold text-slate-900 mb-2">
              Email Verified!
            </h1>
            <p className="text-slate-600 mb-6">
              Your email has been successfully verified. Redirecting to your dashboard...
            </p>
          </>
        ) : verificationStatus === 'error' ? (
          <>
            <h1 className="text-2xl font-extrabold text-slate-900 mb-2">
              Verification Failed
            </h1>
            <p className="text-slate-600 mb-6">
              The verification link may have expired or is invalid. Please request a new verification email.
            </p>
            <div className="space-y-4">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="input-modern w-full"
              />
              <button
                onClick={handleResendVerification}
                disabled={isResending}
                className="btn-primary w-full disabled:opacity-50"
              >
                {isResending ? 'Sending...' : 'Resend Verification Email'}
              </button>
            </div>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-extrabold text-slate-900 mb-2">
              Verify Your Email
            </h1>
            <p className="text-slate-600 mb-6">
              We've sent a verification link to your email address. Please check your inbox and click the link to verify your account.
            </p>

            {email && (
              <div className="bg-slate-50 rounded-lg p-4 mb-6">
                <p className="text-sm text-slate-600 mb-1">Email sent to:</p>
                <p className="font-semibold text-slate-900">{email}</p>
              </div>
            )}

            <div className="space-y-4">
              {!email && (
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="input-modern w-full"
                />
              )}
              
              <button
                onClick={handleResendVerification}
                disabled={isResending}
                className="btn-primary w-full disabled:opacity-50"
              >
                {isResending ? 'Sending...' : 'Resend Verification Email'}
              </button>

              <button
                onClick={() => navigate('/')}
                className="btn-secondary w-full"
              >
                Back to Home
              </button>
            </div>

            <div className="mt-6 pt-6 border-t border-slate-200">
              <p className="text-xs text-slate-500">
                Didn't receive the email? Check your spam folder or try resending.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
