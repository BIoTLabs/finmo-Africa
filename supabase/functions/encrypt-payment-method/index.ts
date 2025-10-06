import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { crypto } from "https://deno.land/std@0.224.0/crypto/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple encryption/decryption using AES-GCM
async function getEncryptionKey(): Promise<CryptoKey> {
  const keyMaterial = Deno.env.get('ENCRYPTION_KEY') || 'default-key-please-change-in-production';
  const encoder = new TextEncoder();
  const keyData = encoder.encode(keyMaterial.padEnd(32, '0').substring(0, 32));
  
  return await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encryptData(plaintext: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await getEncryptionKey();
  
  const encryptedData = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );
  
  // Combine IV and encrypted data, then base64 encode
  const combined = new Uint8Array(iv.length + encryptedData.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encryptedData), iv.length);
  
  return btoa(String.fromCharCode(...combined));
}

async function decryptData(encrypted: string): Promise<string> {
  const combined = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);
  const key = await getEncryptionKey();
  
  const decryptedData = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );
  
  const decoder = new TextDecoder();
  return decoder.decode(decryptedData);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { action, payment_method_id, account_number } = await req.json();

    if (action === 'encrypt') {
      // Encrypt and store account number
      if (!account_number) {
        throw new Error('Account number required for encryption');
      }

      const encrypted = await encryptData(account_number);
      
      console.log('Encrypting account number for user:', user.id);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          encrypted_value: encrypted 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (action === 'decrypt') {
      // Decrypt account number for display
      if (!payment_method_id) {
        throw new Error('Payment method ID required for decryption');
      }

      // Verify user owns this payment method
      const { data: paymentMethod, error: pmError } = await supabase
        .from('payment_methods')
        .select('account_number_encrypted, user_id')
        .eq('id', payment_method_id)
        .single();

      if (pmError || !paymentMethod) {
        throw new Error('Payment method not found');
      }

      if (paymentMethod.user_id !== user.id) {
        throw new Error('Unauthorized access to payment method');
      }

      if (!paymentMethod.account_number_encrypted) {
        throw new Error('No encrypted data found');
      }

      const decrypted = await decryptData(paymentMethod.account_number_encrypted);
      
      console.log('Decrypting account number for user:', user.id);

      return new Response(
        JSON.stringify({ 
          success: true, 
          account_number: decrypted 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else {
      throw new Error('Invalid action. Use "encrypt" or "decrypt"');
    }

  } catch (error) {
    console.error('Encryption error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Encryption operation failed';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
