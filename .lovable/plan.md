

# Add Google Authentication

## Overview
Add a "Sign in with Google" button to the Auth page using Lovable Cloud's managed Google OAuth, which works out of the box with no additional configuration needed.

## Changes

### 1. Configure Google OAuth
Use the `configure-social-auth` tool to set up Google OAuth and generate the required integration module (`src/integrations/lovable/`).

### 2. Update Auth Page (src/pages/Auth.tsx)
- Import `lovable` from `@/integrations/lovable/index`
- Add a "Sign in with Google" button below the existing login form
- Add a visual divider ("or") between the phone/password form and the Google button
- The Google sign-in handler will call:
  ```typescript
  await lovable.auth.signInWithOAuth("google", {
    redirect_uri: window.location.origin,
  });
  ```
- On success, the existing `onAuthStateChange` listener already handles the `SIGNED_IN` event and redirects to `/dashboard`

### 3. Handle New Google Users
Google sign-in users won't have a phone number in their profile initially. The existing `handle_new_user` trigger will still create a profile row using their email. No database changes needed -- the `profiles` table already has nullable `phone_number`.

## UI Layout
The Google button will appear between the submit button and the "Don't have an account?" toggle, separated by a styled "or" divider:

```
[  Sign In  ]
---- or ----
[G  Continue with Google  ]
Don't have an account? Sign up
```

## Technical Details
- No API keys required -- Lovable Cloud provides managed Google OAuth credentials
- No database migrations needed
- No new edge functions required
- The `ProtectedRoute` and `RootRedirect` components already handle session detection correctly for OAuth flows

