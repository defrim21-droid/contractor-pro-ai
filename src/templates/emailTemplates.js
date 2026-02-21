/**
 * Email templates for transactional emails
 * These templates can be used with email services like Resend, SendGrid, etc.
 */

export const emailTemplates = {
  welcome: (data) => {
    const { userName, planType, trialDays } = data;
    const planName = planType === 'starter' ? 'Starter' : planType === 'pro' ? 'Contractor Pro' : 'Elite';
    
    return {
      subject: `Welcome to ContractorPro AI, ${userName}!`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to ContractorPro AI</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #334155; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700;">Welcome to ContractorPro AI!</h1>
          </div>
          
          <div style="background: white; padding: 40px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
            <p style="font-size: 18px; margin-top: 0;">Hi ${userName},</p>
            
            <p>Thank you for joining ContractorPro AI! We're excited to help you win more bids with AI-powered mockups.</p>
            
            <div style="background: #f8fafc; border-left: 4px solid #3b82f6; padding: 20px; margin: 30px 0; border-radius: 4px;">
              <p style="margin: 0; font-weight: 600; color: #1e293b;">Your Plan: ${planName}</p>
              ${planType === 'pro' && trialDays ? `
                <p style="margin: 10px 0 0 0; color: #64748b;">You're on a ${trialDays}-day free trial. No charges until ${new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.</p>
              ` : ''}
            </div>
            
            <h2 style="color: #1e293b; font-size: 22px; margin-top: 40px;">Get Started</h2>
            <ol style="padding-left: 20px; color: #475569;">
              <li style="margin-bottom: 10px;">Upload a photo of your client's space</li>
              <li style="margin-bottom: 10px;">Draw the areas you want to renovate</li>
              <li style="margin-bottom: 10px;">Generate photorealistic renderings in seconds</li>
            </ol>
            
            <div style="text-align: center; margin: 40px 0;">
              <a href="${process.env.VITE_APP_URL || 'https://app.contractorproai.com'}/dashboard" 
                 style="background: #3b82f6; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">
                Go to Dashboard
              </a>
            </div>
            
            <p style="color: #64748b; font-size: 14px; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
              Need help? Check out our <a href="${process.env.VITE_APP_URL || 'https://app.contractorproai.com'}/docs" style="color: #3b82f6;">documentation</a> or reply to this email.
            </p>
            
            <p style="color: #64748b; font-size: 14px; margin-top: 20px;">
              Best regards,<br>
              The ContractorPro AI Team
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 20px; color: #94a3b8; font-size: 12px;">
            <p>© ${new Date().getFullYear()} ContractorPro AI. All rights reserved.</p>
          </div>
        </body>
        </html>
      `,
      text: `
Welcome to ContractorPro AI, ${userName}!

Thank you for joining ContractorPro AI! We're excited to help you win more bids with AI-powered mockups.

Your Plan: ${planName}
${planType === 'pro' && trialDays ? `You're on a ${trialDays}-day free trial. No charges until ${new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.` : ''}

Get Started:
1. Upload a photo of your client's space
2. Draw the areas you want to renovate
3. Generate photorealistic renderings in seconds

Visit your dashboard: ${process.env.VITE_APP_URL || 'https://app.contractorproai.com'}/dashboard

Need help? Reply to this email or check out our documentation.

Best regards,
The ContractorPro AI Team
      `,
    };
  },

  trialEnding: (data) => {
    const { userName, daysRemaining, trialEndDate } = data;
    
    return {
      subject: `Your ContractorPro AI trial ends in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Trial Ending Soon</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #334155; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700;">Trial Ending Soon</h1>
          </div>
          
          <div style="background: white; padding: 40px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
            <p style="font-size: 18px; margin-top: 0;">Hi ${userName},</p>
            
            <p>Your free trial ends in <strong>${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}</strong> (${trialEndDate}).</p>
            
            <p>Don't lose access to your projects! Upgrade now to continue using ContractorPro AI and keep all your renderings.</p>
            
            <div style="text-align: center; margin: 40px 0;">
              <a href="${process.env.VITE_APP_URL || 'https://app.contractorproai.com'}/billing" 
                 style="background: #3b82f6; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">
                Upgrade Now
              </a>
            </div>
            
            <p style="color: #64748b; font-size: 14px; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
              Questions? Reply to this email and we'll help you out.
            </p>
          </div>
        </body>
        </html>
      `,
    };
  },

  trialExpired: (data) => {
    const { userName } = data;
    
    return {
      subject: 'Your ContractorPro AI trial has ended',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Trial Expired</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #334155; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700;">Trial Expired</h1>
          </div>
          
          <div style="background: white; padding: 40px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
            <p style="font-size: 18px; margin-top: 0;">Hi ${userName},</p>
            
            <p>Your free trial has ended. To continue using ContractorPro AI and access your projects, please upgrade your plan.</p>
            
            <div style="text-align: center; margin: 40px 0;">
              <a href="${process.env.VITE_APP_URL || 'https://app.contractorproai.com'}/billing" 
                 style="background: #3b82f6; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">
                Subscribe Now
              </a>
            </div>
            
            <p style="color: #64748b; font-size: 14px;">Your projects are safe and will be available once you subscribe.</p>
          </div>
        </body>
        </html>
      `,
    };
  },

  emailVerified: (data) => {
    const { userName } = data;
    
    return {
      subject: 'Email verified - Welcome to ContractorPro AI!',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Email Verified</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #334155; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700;">Email Verified!</h1>
          </div>
          
          <div style="background: white; padding: 40px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
            <p style="font-size: 18px; margin-top: 0;">Hi ${userName},</p>
            
            <p>Great! Your email has been verified. You now have full access to ContractorPro AI.</p>
            
            <div style="text-align: center; margin: 40px 0;">
              <a href="${process.env.VITE_APP_URL || 'https://app.contractorproai.com'}/dashboard" 
                 style="background: #3b82f6; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">
                Go to Dashboard
              </a>
            </div>
          </div>
        </body>
        </html>
      `,
    };
  },
};
