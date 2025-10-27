import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const POLYGON_AMOY_RPC = "https://rpc-amoy.polygon.technology";
const USDC_CONTRACT = "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582";

// ERC20 Transfer event signature
const TRANSFER_EVENT_SIGNATURE = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    console.log('Syncing blockchain transactions for user:', user.id);

    // Get user's wallet address
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('wallet_address')
      .eq('id', user.id)
      .single();

    if (!profile) {
      throw new Error('User profile not found');
    }

    const walletAddress = profile.wallet_address.toLowerCase();
    console.log('Wallet address:', walletAddress);

    // Get the latest block number
    const latestBlockResponse = await fetch(POLYGON_AMOY_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_blockNumber',
        params: [],
        id: 1,
      }),
    });

    const latestBlockData = await latestBlockResponse.json();
    const latestBlock = parseInt(latestBlockData.result, 16);
    
    // Scan last 50000 blocks for testnet to capture full transaction history
    const fromBlock = Math.max(0, latestBlock - 50000);
    
    console.log(`Scanning from block ${fromBlock} to ${latestBlock}`);


    // Fetch USDC transfer events
    const usdcIncomingResponse = await fetch(POLYGON_AMOY_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getLogs',
        params: [{
          fromBlock: `0x${fromBlock.toString(16)}`,
          toBlock: 'latest',
          address: USDC_CONTRACT,
          topics: [
            TRANSFER_EVENT_SIGNATURE,
            null,
            `0x000000000000000000000000${walletAddress.slice(2)}`
          ]
        }],
        id: 3,
      }),
    });

    const usdcOutgoingResponse = await fetch(POLYGON_AMOY_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getLogs',
        params: [{
          fromBlock: `0x${fromBlock.toString(16)}`,
          toBlock: 'latest',
          address: USDC_CONTRACT,
          topics: [
            TRANSFER_EVENT_SIGNATURE,
            `0x000000000000000000000000${walletAddress.slice(2)}`
          ]
        }],
        id: 4,
      }),
    });

    const usdcIncomingData = await usdcIncomingResponse.json();
    const usdcOutgoingData = await usdcOutgoingResponse.json();

    const incomingLogs = usdcIncomingData.result || [];
    const outgoingLogs = usdcOutgoingData.result || [];

    console.log(`Found ${incomingLogs.length} incoming and ${outgoingLogs.length} outgoing USDC transactions`);

    let syncedCount = 0;
    const allLogs = [...incomingLogs, ...outgoingLogs];

    // Process each transaction
    for (const log of allLogs) {
      const txHash = log.transactionHash;
      
      // Check if transaction already exists
      const { data: existing } = await supabaseClient
        .from('transactions')
        .select('id')
        .eq('transaction_hash', txHash)
        .maybeSingle();

      if (existing) {
        console.log(`Transaction ${txHash} already synced`);
        continue;
      }

      // Decode the transfer event
      const from = `0x${log.topics[1].slice(26)}`.toLowerCase();
      const to = `0x${log.topics[2].slice(26)}`.toLowerCase();
      const amountHex = log.data;
      const amount = Number(BigInt(amountHex)) / 1e6; // USDC has 6 decimals

      const isIncoming = to === walletAddress;
      
      console.log(`Processing ${isIncoming ? 'incoming' : 'outgoing'} transaction:`, {
        hash: txHash,
        from,
        to,
        amount
      });

      // For incoming transactions, sender_id should be null (external)
      // For outgoing transactions, sender_id is the user
      // Use 'external' as transaction_type for all blockchain transactions
      // Check if this is a sweep transaction (to master wallet)
      const isSweep = to.toLowerCase() === '0xc56200868ED6B741A9958f4AA8cEC3CEDA2D22d6'.toLowerCase();
      
      // Skip sweep transactions - they're handled by the sweep function
      if (isSweep && !isIncoming) {
        console.log(`Skipping sweep transaction ${txHash} - handled by sweep function`);
        continue;
      }
      
      // Check if transaction already exists
      const { data: existingTx } = await supabaseClient
        .from('transactions')
        .select('id')
        .eq('transaction_hash', txHash)
        .single();
      
      if (existingTx) {
        console.log(`Transaction ${txHash} already exists, skipping`);
        continue;
      }

      const { error: insertError } = await supabaseClient
        .from('transactions')
        .insert({
          sender_id: isIncoming ? null : user.id,
          recipient_id: isIncoming ? user.id : null,
          sender_wallet: from,
          recipient_wallet: to,
          amount: amount,
          token: 'USDC',
          transaction_type: isIncoming ? 'deposit' : 'withdrawal',
          status: 'completed',
          transaction_hash: txHash,
          chain_id: 80002,
          chain_name: 'Polygon Amoy'
        });

      if (insertError) {
        console.error(`Error inserting transaction ${txHash}:`, insertError);
      } else {
        syncedCount++;
        console.log(`Synced transaction ${txHash}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        synced_count: syncedCount,
        total_found: allLogs.length,
        blocks_scanned: latestBlock - fromBlock,
        message: `Synced ${syncedCount} new blockchain transactions`
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Sync error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});
