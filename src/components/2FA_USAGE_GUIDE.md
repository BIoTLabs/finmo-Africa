# 2FA Guard Usage Guide

This guide shows how to use the `use2FAGuard` hook to protect sensitive actions with 2FA verification.

## Basic Usage

```tsx
import { use2FAGuard } from "@/hooks/use2FAGuard";

function MyComponent() {
  const { TwoFactorDialog, requireVerification, isVerifying } = use2FAGuard();

  const handleSensitiveAction = async () => {
    await requireVerification("require_on_send", async () => {
      // Your sensitive action code here
      console.log("Sending money...");
      // Make API call, update state, etc.
    });
  };

  return (
    <>
      <button 
        onClick={handleSensitiveAction}
        disabled={isVerifying}
      >
        {isVerifying ? "Verifying..." : "Send Money"}
      </button>
      
      <TwoFactorDialog />
    </>
  );
}
```

## Available 2FA Actions

- `require_on_login` - Login verification
- `require_on_send` - Sending money
- `require_on_withdraw` - Withdrawing to external wallets
- `require_on_p2p_trade` - P2P trading
- `require_on_marketplace_purchase` - Marketplace purchases
- `require_on_security_changes` - Security settings changes
- `require_on_payment_method_changes` - Payment method changes
- `require_on_staking` - Staking/unstaking

## Example: Send Money Page

```tsx
import { use2FAGuard } from "@/hooks/use2FAGuard";

function SendMoney() {
  const { TwoFactorDialog, requireVerification, isVerifying } = use2FAGuard();

  const handleSend = async () => {
    await requireVerification("require_on_send", async () => {
      // Call your send money API
      const response = await supabase.functions.invoke("process-transaction", {
        body: { amount, recipient }
      });
      
      if (response.error) {
        toast.error("Transaction failed");
      } else {
        toast.success("Money sent successfully!");
      }
    });
  };

  return (
    <>
      <Button onClick={handleSend} disabled={isVerifying}>
        {isVerifying ? "Verifying..." : "Send"}
      </Button>
      
      <TwoFactorDialog />
    </>
  );
}
```

## Example: Security Settings

```tsx
import { use2FAGuard } from "@/hooks/use2FAGuard";

function SecuritySettings() {
  const { TwoFactorDialog, requireVerification } = use2FAGuard();

  const handleChangePassword = async () => {
    await requireVerification("require_on_security_changes", async () => {
      // Update password
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });
      
      if (!error) {
        toast.success("Password changed successfully!");
      }
    });
  };

  return (
    <>
      <Button onClick={handleChangePassword}>Change Password</Button>
      <TwoFactorDialog />
    </>
  );
}
```

## How It Works

1. When `requireVerification` is called, it checks if 2FA is required for that action based on user preferences
2. If 2FA is not required or user doesn't have 2FA enabled, the callback executes immediately
3. If 2FA is required, it creates a challenge and shows the verification dialog
4. Once verified, the callback executes automatically
5. The dialog closes and the action completes

## Error Handling

The hook handles errors gracefully:
- If 2FA check fails, it still executes the callback (fail-open for better UX)
- If verification fails, the callback is not executed
- You can wrap calls in try-catch for custom error handling

```tsx
try {
  await requireVerification("require_on_withdraw", async () => {
    await withdrawFunds();
  });
} catch (error) {
  console.error("Withdrawal failed:", error);
  toast.error("Failed to complete withdrawal");
}
```
