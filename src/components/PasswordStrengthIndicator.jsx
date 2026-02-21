import React from 'react';
import {
  calculatePasswordStrength,
  getPasswordStrengthLabel,
  getPasswordStrengthColor,
  validatePassword,
} from '../utils/passwordValidation';
import { CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';

export default function PasswordStrengthIndicator({ password, showRequirements = true }) {
  const strength = calculatePasswordStrength(password);
  const validation = validatePassword(password);
  const strengthLabel = getPasswordStrengthLabel(strength);
  const strengthColor = getPasswordStrengthColor(strength);

  if (!password) return null;

  return (
    <div className="mt-2 space-y-3">
      {/* Strength Bar */}
      <div>
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs font-medium text-slate-600">Password Strength</span>
          <span className={`text-xs font-semibold ${strengthColor.replace('bg-', 'text-')}`}>
            {strengthLabel}
          </span>
        </div>
        <div className="w-full bg-slate-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-300 ${strengthColor}`}
            style={{ width: `${((strength + 1) / 5) * 100}%` }}
          />
        </div>
      </div>

      {/* Requirements List */}
      {showRequirements && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-slate-700 mb-1">Requirements:</p>
          {[
            { check: password.length >= 8, label: 'At least 8 characters' },
            { check: /[A-Z]/.test(password), label: 'One uppercase letter' },
            { check: /[a-z]/.test(password), label: 'One lowercase letter' },
            { check: /[0-9]/.test(password), label: 'One number' },
            { check: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password), label: 'One special character' },
          ].map((req, index) => (
            <div key={index} className="flex items-center gap-2 text-xs">
              {req.check ? (
                <CheckIcon className="h-4 w-4 text-green-600 flex-shrink-0" />
              ) : (
                <XMarkIcon className="h-4 w-4 text-slate-300 flex-shrink-0" />
              )}
              <span className={req.check ? 'text-green-700' : 'text-slate-500'}>
                {req.label}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
