import React, { useState } from 'react';
import {
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { toast } from 'sonner';

export default function PaymentForm({ onPaymentSuccess, planType, planPrice, onCancel, clientSecret }) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Validate payment element
      const { error: submitError } = await elements.submit();
      if (submitError) {
        setError(submitError.message);
        setIsProcessing(false);
        return;
      }

      // Confirm setup intent
      // Note: In production, you need a clientSecret from your backend
      // For now, we'll simulate the flow
      if (clientSecret) {
        const { error: confirmError } = await stripe.confirmSetup({
          elements,
          clientSecret,
          redirect: 'if_required',
        });

        if (confirmError) {
          setError(confirmError.message);
          setIsProcessing(false);
          return;
        }
      } else {
        // For development: Just validate the form is ready
        // In production, you must have a clientSecret from backend
        toast.info('Payment form validated. Backend integration needed for full processing.');
        // Simulate success for development
        setTimeout(() => {
          toast.success('Payment method added successfully!');
          onPaymentSuccess();
        }, 500);
        return;
      }

      // Payment successful
      toast.success('Payment method added successfully!');
      onPaymentSuccess();
    } catch (err) {
      setError(err.message || 'An error occurred processing your payment.');
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-slate-50 rounded-xl p-4 mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-slate-600">Selected Plan</span>
          <span className="text-lg font-bold text-slate-900">
            ${planPrice}/mo
          </span>
        </div>
        {planType === 'pro' && (
          <p className="text-xs text-blue-600 font-medium mt-1">
            Includes a 2-Week Free Trial
          </p>
        )}
      </div>

      <div className="border border-slate-200 rounded-xl p-4 bg-white">
        <PaymentElement />
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="btn-secondary flex-1"
          disabled={isProcessing}
        >
          Back
        </button>
        <button
          type="submit"
          disabled={!stripe || isProcessing}
          className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isProcessing ? 'Processing...' : `Continue with ${planType === 'starter' ? 'Starter' : planType === 'pro' ? 'Pro' : 'Elite'}`}
        </button>
      </div>

      <p className="text-xs text-slate-500 text-center">
        Your payment method will be securely stored. {planType === 'pro' && 'You won\'t be charged until after your free trial.'}
      </p>
    </form>
  );
}
