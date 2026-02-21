# Email Integration Setup Guide

## Overview
Welcome email automation has been integrated into the application. The frontend is ready, but backend integration is required for full functionality.

## What's Implemented

### Frontend Components
1. **Email Service** (`src/services/emailService.js`)
   - Functions for sending various email types
   - Ready to connect to Supabase Edge Functions or email service API

2. **Email Templates** (`src/templates/emailTemplates.js`)
   - HTML and text templates for:
     - Welcome email
     - Trial ending reminder
     - Trial expired notification
     - Email verified confirmation
     - First project creation

3. **Email Triggers** (`src/hooks/useEmailTriggers.js`)
   - Automatically triggers emails based on user actions
   - Trial reminder emails
   - First project emails

4. **Integration Points**
   - Welcome email sent after signup
   - Welcome email sent after email verification
   - Trial reminders (3 days before expiration)
   - Trial expired notifications
   - First project celebration email

## Backend Requirements

### Option 1: Supabase Edge Functions (Recommended)

Create a Supabase Edge Function at `supabase/functions/send-email/index.ts`:

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { Resend } from 'https://esm.sh/resend@2.0.0'

const resend = new Resend(Deno.env.get('RESEND_API_KEY'))

serve(async (req) => {
  try {
    const { to, subject, html, text } = await req.json()

    const { data, error } = await resend.emails.send({
      from: 'ContractorPro AI <noreply@contractorproai.com>',
      to: [to],
      subject: subject,
      html: html,
      text: text,
    })

    if (error) throw error

    return new Response(
      JSON.stringify({ success: true, id: data.id }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
```

### Option 2: Direct Email Service Integration

Update `src/services/emailService.js` to call your email service directly:

```javascript
import { Resend } from 'resend'; // or SendGrid, etc.

const resend = new Resend(import.meta.env.VITE_RESEND_API_KEY);

export const sendWelcomeEmail = async (userEmail, userName, planType) => {
  const template = emailTemplates.welcome({
    userName,
    planType,
    trialDays: planType === 'pro' ? 14 : null,
  });

  const { data, error } = await resend.emails.send({
    from: 'ContractorPro AI <noreply@contractorproai.com>',
    to: [userEmail],
    subject: template.subject,
    html: template.html,
    text: template.text,
  });

  if (error) throw error;
  return { success: true };
};
```

## Email Service Options

### 1. Resend (Recommended)
- **Setup**: https://resend.com
- **Pros**: Simple API, great developer experience, good free tier
- **Cost**: Free up to 3,000 emails/month

### 2. SendGrid
- **Setup**: https://sendgrid.com
- **Pros**: Robust features, good deliverability
- **Cost**: Free up to 100 emails/day

### 3. Mailgun
- **Setup**: https://mailgun.com
- **Pros**: Good for transactional emails
- **Cost**: Free up to 5,000 emails/month

### 4. AWS SES
- **Setup**: https://aws.amazon.com/ses
- **Pros**: Very cost-effective at scale
- **Cost**: $0.10 per 1,000 emails

## Environment Variables

Add to your `.env.local`:

```env
# For Resend
VITE_RESEND_API_KEY=re_xxxxxxxxxxxxx

# Or for SendGrid
VITE_SENDGRID_API_KEY=SG.xxxxxxxxxxxxx

# App URL for email links
VITE_APP_URL=https://app.contractorproai.com
```

## Email Types Implemented

### 1. Welcome Email
- **Trigger**: After signup or email verification
- **Content**: Welcome message, plan details, trial info, getting started steps
- **Template**: `emailTemplates.welcome()`

### 2. Trial Ending Reminder
- **Trigger**: 3 days before trial expiration
- **Content**: Days remaining, upgrade CTA
- **Template**: `emailTemplates.trialEnding()`

### 3. Trial Expired
- **Trigger**: On trial expiration day
- **Content**: Expiration notice, subscribe CTA
- **Template**: `emailTemplates.trialExpired()`

### 4. Email Verified
- **Trigger**: After email verification
- **Content**: Confirmation, dashboard link
- **Template**: `emailTemplates.emailVerified()`

### 5. First Project
- **Trigger**: When user creates first project
- **Content**: Celebration, tips for success
- **Template**: (Can be added to `emailTemplates.js`)

## Testing

### Test Email Flow
1. Sign up → Should trigger welcome email
2. Verify email → Should send verification confirmation
3. Create first project → Should send first project email
4. Wait for trial reminder → Should send 3-day warning
5. Trial expires → Should send expiration email

### Email Service Testing
- Use test mode for development
- Verify email delivery in service dashboard
- Check spam folders
- Test email rendering across clients

## Next Steps

1. ✅ Email templates created
2. ✅ Frontend integration points set up
3. ⏳ Choose email service provider
4. ⏳ Set up API keys and environment variables
5. ⏳ Create Supabase Edge Function or direct integration
6. ⏳ Update `emailService.js` with actual API calls
7. ⏳ Test email delivery end-to-end
8. ⏳ Set up email tracking and analytics

## Notes

- All email sending is currently non-blocking (won't fail signup if email fails)
- Email templates use inline CSS for better client compatibility
- Email links use `VITE_APP_URL` environment variable
- In production, consider adding email tracking (opens, clicks)
- Respect user email preferences from Settings
