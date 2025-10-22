# Security Enhancements Documentation

## Overview
This document details the comprehensive security enhancements implemented for authentication, session management, and two-factor authentication (2FA).

## 1. Single Device Login Enforcement

### Implementation
- **Location**: `useSessionManager.ts` hook (used globally in `App.tsx`)
- **Mechanism**: 
  - Stores active session ID in `user_sessions` table
  - Periodically checks (every 60 seconds) if current session matches stored session
  - Automatically logs out old device when new login detected
  - Works across both mobile and desktop platforms

### User Experience
- When a user logs in on a new device, any previous sessions are automatically terminated
- Users receive notification: "You've been logged out because you signed in on another device"
- Prevents account sharing and unauthorized concurrent access

## 2. Automatic Logout After Inactivity

### Implementation
- **Location**: `useAutoLogout.ts` hook (used globally in `App.tsx`)
- **Timeout**: 5 minutes (300,000 milliseconds)
- **Activity Detection**: Monitors user interactions (mousedown, keypress, scroll, touchstart, click)

### Features
- Warning displayed 30 seconds before logout
- Throttled activity detection to prevent excessive processing
- Automatically clears session and redirects to login page
- Only active when user is authenticated

### User Experience
- Users see warning: "You will be logged out in 30 seconds due to inactivity"
- After 5 minutes of no activity: "You have been logged out due to inactivity"
- Countdown toast notification provides clear feedback

## 3. Mandatory Two-Factor Authentication (2FA)

### Implementation
- **Location**: `Auth.tsx` login flow
- **Enforcement**: All users MUST have 2FA enabled to access the application

### Login Flow
1. User enters phone number and password
2. System authenticates credentials
3. **MANDATORY CHECK**: Verifies user has verified 2FA factor enrolled
4. If no 2FA: Login fails with message to contact support
5. If 2FA exists: Requires 2FA code verification
6. Only after successful 2FA verification: Access granted

### Error Handling
- No 2FA enrolled: "Two-Factor Authentication is required. Please contact support to enable 2FA for your account."
- Unverified 2FA: "Two-Factor Authentication setup is incomplete. Please contact support."
- Failed verification: User remains on login page, can retry

## 4. 2FA Protection for Security Settings

### Implementation
- **Location**: `Settings.tsx` with `use2FAGuard` hook
- **Protected Actions**:
  - Enabling/disabling biometric authentication
  - Enabling/disabling two-factor authentication
  - Any security preference changes

### User Flow
1. User attempts to change security setting (toggle switch)
2. System immediately prompts for 2FA code via `TwoFactorDialog`
3. User enters 6-digit code from authenticator app
4. System verifies code using MFA challenge/verify flow
5. If verified: Setting change applied
6. If failed: Setting change rejected, switch reverts

### Special Case: Disabling 2FA
- Users CAN disable 2FA (per requirements)
- BUT must provide valid 2FA code to do so
- Warning displayed: "Two-Factor Authentication disabled. Your account is now less secure. You may not be able to login until 2FA is re-enabled."
- Note: Since 2FA is mandatory for login, disabling it effectively locks the account until re-enabled

## Security Architecture

### Session Management
```
User Login → Session Created → Session ID Stored in DB
           ↓
New Device Login → New Session ID → Old Session Invalidated
           ↓
Old Device → Periodic Check → Session Mismatch → Auto Logout
```

### Auto-Logout Flow
```
User Activity → Timer Reset → Continue Session
           ↓
No Activity (5 min) → Warning (30 sec) → Logout → Redirect to Auth
```

### 2FA Enforcement Flow
```
Login Attempt → Credentials Valid → Check 2FA Status
           ↓
No 2FA → Reject Login → Show Error
           ↓
2FA Verified → Show 2FA Dialog → Require Code → Verify → Grant Access
```

## Database Schema

### user_sessions Table
- `user_id`: UUID (unique per user)
- `session_id`: TEXT (current active session token)
- `device_info`: JSONB (browser/device details)
- `last_active`: TIMESTAMP (last activity time)

## Configuration

### Timeouts
- **Inactivity Timeout**: 5 minutes (300,000ms)
- **Warning Before Logout**: 30 seconds
- **Session Check Interval**: 60 seconds
- **Activity Throttle**: 1 second

### 2FA Settings
- **Code Length**: 6 digits
- **Algorithm**: TOTP (Time-based One-Time Password)
- **Challenge Timeout**: Per Supabase MFA defaults

## Testing Recommendations

### Single Device Login
1. Login on Device A
2. Login on Device B with same credentials
3. Verify Device A is automatically logged out
4. Verify toast notification appears on Device A

### Auto-Logout
1. Login to application
2. Wait 4.5 minutes without interaction
3. Verify warning toast appears
4. Wait additional 30 seconds
5. Verify logout and redirect to auth page

### Mandatory 2FA
1. Create new account without 2FA
2. Attempt login
3. Verify login is rejected
4. Set up 2FA
5. Login again and verify 2FA prompt appears
6. Enter valid code and verify access granted

### 2FA Settings Protection
1. Login with 2FA enabled
2. Navigate to Settings
3. Attempt to toggle biometric or 2FA switch
4. Verify 2FA dialog appears
5. Enter valid 2FA code
6. Verify setting change is applied

## Security Considerations

### Strengths
- ✅ Prevents account sharing
- ✅ Protects against session hijacking
- ✅ Reduces risk of unauthorized access
- ✅ Enforces strong authentication
- ✅ Protects security settings from unauthorized changes

### Potential Issues
- ⚠️ Users who disable 2FA cannot login (by design)
- ⚠️ Lost authenticator app requires admin intervention
- ⚠️ No backup codes implemented (future enhancement)
- ⚠️ Session check every 60s may cause slight performance impact

### Recommendations
1. Implement backup codes for 2FA recovery
2. Add admin tools to reset user 2FA
3. Consider adding SMS 2FA as fallback
4. Implement "Trust This Device" for reduced 2FA frequency
5. Add rate limiting on 2FA attempts

## Compliance

These implementations help meet security compliance requirements for:
- PCI DSS (Payment Card Industry Data Security Standard)
- GDPR (General Data Protection Regulation)
- SOC 2 Type II
- Financial services regulations

## Support Documentation

For end users:
- How to set up 2FA: See `2FA_USAGE_GUIDE.md`
- How to use authenticator apps: Link to Authy, Google Authenticator guides
- What to do if locked out: Contact support with identity verification

For administrators:
- How to reset user 2FA: Future admin tool documentation
- Monitoring session anomalies: Check `user_sessions` table
- Audit logging: Review `reward_activities` and transaction logs
