/**
 * Password validation utilities
 */

export const PASSWORD_REQUIREMENTS = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecialChar: true,
};

/**
 * Check if password meets all requirements
 */
export const validatePassword = (password) => {
  const errors = [];

  if (!password) {
    return { isValid: false, errors: ['Password is required'] };
  }

  if (password.length < PASSWORD_REQUIREMENTS.minLength) {
    errors.push(`At least ${PASSWORD_REQUIREMENTS.minLength} characters`);
  }

  if (PASSWORD_REQUIREMENTS.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('One uppercase letter');
  }

  if (PASSWORD_REQUIREMENTS.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('One lowercase letter');
  }

  if (PASSWORD_REQUIREMENTS.requireNumber && !/[0-9]/.test(password)) {
    errors.push('One number');
  }

  if (PASSWORD_REQUIREMENTS.requireSpecialChar && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('One special character');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Calculate password strength (0-4)
 */
export const calculatePasswordStrength = (password) => {
  if (!password) return 0;

  let strength = 0;

  // Length check
  if (password.length >= PASSWORD_REQUIREMENTS.minLength) strength += 1;
  if (password.length >= 12) strength += 1;

  // Character variety
  if (/[a-z]/.test(password)) strength += 0.5;
  if (/[A-Z]/.test(password)) strength += 0.5;
  if (/[0-9]/.test(password)) strength += 0.5;
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) strength += 0.5;

  return Math.min(4, Math.floor(strength));
};

/**
 * Get password strength label
 */
export const getPasswordStrengthLabel = (strength) => {
  const labels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'];
  return labels[strength] || 'Very Weak';
};

/**
 * Get password strength color
 */
export const getPasswordStrengthColor = (strength) => {
  const colors = [
    'bg-red-500', // Very Weak
    'bg-orange-500', // Weak
    'bg-yellow-500', // Fair
    'bg-blue-500', // Good
    'bg-green-500', // Strong
  ];
  return colors[strength] || colors[0];
};
