import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ethers } from "https://esm.sh/ethers@6.13.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ERC20_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address owner) view returns (uint256)",
];

const SIMPLE_ACCOUNT_ABI = [
  "function execute(address dest, uint256 value, bytes calldata func) external",
  "function getNonce() view returns (uint256)"
];

const SIMPLE_ACCOUNT_FACTORY_ABI = [
  "function createAccount(address owner, uint256 salt) returns (address)"
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Configuration
    const masterWalletKey = Deno.env.get('MASTER_WALLET_PRIVATE_KEY');
    if (!masterWalletKey) throw new Error('MASTER_WALLET_PRIVATE_KEY not configured');

    const masterWallet = new ethers.Wallet(masterWalletKey);
    const masterWalletAddress = masterWallet.address;
    
    const alchemyApiKey = Deno.env.get('ALCHEMY_API_KEY');
    const gasPolicyId = Deno.env.get('ALCHEMY_GAS_MANAGER_POLICY_ID');
    const factoryAddress = Deno.env.get('AA_FACTORY_ADDRESS');
    const entryPointAddress = Deno.env.get('AA_ENTRYPOINT_ADDRESS') || '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789';
    
    if (!alchemyApiKey || !gasPolicyId || !factoryAddress) {
      throw new Error('Missing required AA configuration: ALCHEMY_API_KEY, ALCHEMY_GAS_MANAGER_POLICY_ID, or AA_FACTORY_ADDRESS');
    }

    const chainId = 80002; // Polygon Amoy
    const usdcAddress = "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582";
    
    const bundlerUrl = `https://polygonAmoy-aa.g.alchemy.com/v1/${alchemyApiKey}`;
    const rpcUrl = `https://polygon-amoy.g.alchemy.com/v2/${alchemyApiKey}`;
    const provider = new ethers.JsonRpcProvider(rpcUrl);

    console.log('Starting AA gasless sweep...');

    // Get all users with AA wallets
    const { data: profiles, error: fetchError } = await supabaseClient
      .from('profiles')
      .select('id, aa_wallet_address, aa_wallet_deployed, aa_wallet_salt')
      .not('aa_wallet_address', 'is', null);

    if (fetchError) throw fetchError;

    const sweepResults = [];

    for (const profile of profiles || []) {
      try {
        const scwAddress = profile.aa_wallet_address;
        
        console.log(`Checking balance for ${scwAddress}...`);

        // Check USDC balance
        const usdcContract = new ethers.Contract(usdcAddress, ERC20_ABI, provider);
        const balance = await usdcContract.balanceOf(scwAddress);
        const balanceFormatted = parseFloat(ethers.formatUnits(balance, 6));

        if (balanceFormatted < 0.01) {
          console.log(`Skipping ${scwAddress} - balance too low: ${balanceFormatted}`);
          continue;
        }

        console.log(`Found ${balanceFormatted} USDC in ${scwAddress} - initiating gasless sweep`);

        // Encode the transfer call
        const transferCalldata = usdcContract.interface.encodeFunctionData(
          'transfer',
          [masterWalletAddress, balance]
        );

        // Get nonce for the SCW
        const accountContract = new ethers.Contract(scwAddress, SIMPLE_ACCOUNT_ABI, provider);
        let nonce = 0;
        try {
          nonce = await accountContract.getNonce();
          console.log(`Current nonce: ${nonce}`);
        } catch {
          console.log('Wallet not deployed yet, nonce is 0');
        }

        // Build initCode if wallet not deployed
        let initCode = '0x';
        if (!profile.aa_wallet_deployed) {
          const factoryInterface = new ethers.Interface(SIMPLE_ACCOUNT_FACTORY_ABI);
          const createAccountCall = factoryInterface.encodeFunctionData('createAccount', [
            masterWallet.address,
            BigInt(profile.aa_wallet_salt)
          ]);
          initCode = ethers.concat([factoryAddress, createAccountCall]);
          console.log('Including initCode for wallet deployment');
        }

        // Encode execute call
        const accountInterface = new ethers.Interface(SIMPLE_ACCOUNT_ABI);
        const callData = accountInterface.encodeFunctionData('execute', [
          usdcAddress,
          0,
          transferCalldata
        ]);

        // Get gas prices
        const feeData = await provider.getFeeData();
        const maxFeePerGas = feeData.maxFeePerGas || BigInt(40000000000);
        const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas || BigInt(2000000000);

        // Build UserOperation
        const userOp = {
          sender: scwAddress,
          nonce: ethers.toBeHex(nonce),
          initCode: initCode,
          callData: callData,
          callGasLimit: ethers.toBeHex(200000),
          verificationGasLimit: ethers.toBeHex(profile.aa_wallet_deployed ? 150000 : 500000),
          preVerificationGas: ethers.toBeHex(50000),
          maxFeePerGas: ethers.toBeHex(maxFeePerGas),
          maxPriorityFeePerGas: ethers.toBeHex(maxPriorityFeePerGas),
          paymasterAndData: '0x',
          signature: '0x'
        };

        console.log('Requesting Paymaster sponsorship...');

        // Request Paymaster sponsorship
        const paymasterResponse = await fetch(bundlerUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'alchemy_requestPaymasterAndData',
            params: [{
              policyId: gasPolicyId,
              entryPoint: entryPointAddress,
              userOperation: userOp,
            }]
          })
        });

        const paymasterData = await paymasterResponse.json();
        
        if (paymasterData.error) {
          throw new Error(`Paymaster error: ${paymasterData.error.message}`);
        }

        // Update userOp with paymaster data
        userOp.paymasterAndData = paymasterData.result.paymasterAndData;
        userOp.callGasLimit = paymasterData.result.callGasLimit;
        userOp.verificationGasLimit = paymasterData.result.verificationGasLimit;
        userOp.preVerificationGas = paymasterData.result.preVerificationGas;

        console.log('Paymaster approved - gas sponsored by FinMo');

        // Compute UserOpHash for signing
        const packed = ethers.solidityPacked(
          ['address', 'uint256', 'bytes32', 'bytes32', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256', 'bytes32'],
          [
            userOp.sender,
            userOp.nonce,
            ethers.keccak256(userOp.initCode),
            ethers.keccak256(userOp.callData),
            userOp.callGasLimit,
            userOp.verificationGasLimit,
            userOp.preVerificationGas,
            userOp.maxFeePerGas,
            userOp.maxPriorityFeePerGas,
            ethers.keccak256(userOp.paymasterAndData),
          ]
        );
        
        const userOpHash = ethers.keccak256(packed);
        const finalHash = ethers.solidityPackedKeccak256(
          ['bytes32', 'address', 'uint256'],
          [userOpHash, entryPointAddress, chainId]
        );

        // Sign with Master Wallet
        const signature = await masterWallet.signMessage(ethers.getBytes(finalHash));
        userOp.signature = signature;

        console.log('UserOperation signed by Master Wallet');

        // Submit to Bundler
        const bundlerResponse = await fetch(bundlerUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'eth_sendUserOperation',
            params: [userOp, entryPointAddress]
          })
        });

        const bundlerResult = await bundlerResponse.json();
        
        if (bundlerResult.error) {
          throw new Error(`Bundler error: ${bundlerResult.error.message}`);
        }

        const userOpHashSubmitted = bundlerResult.result;
        console.log(`UserOperation submitted: ${userOpHashSubmitted}`);

        // Wait for transaction to be mined (with timeout)
        let receipt = null;
        for (let i = 0; i < 30; i++) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          const receiptResponse = await fetch(bundlerUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: 1,
              method: 'eth_getUserOperationReceipt',
              params: [userOpHashSubmitted]
            })
          });
          
          const receiptResult = await receiptResponse.json();
          if (receiptResult.result) {
            receipt = receiptResult.result;
            console.log('UserOperation mined:', receipt.receipt.transactionHash);
            break;
          }
        }

        if (!receipt) {
          throw new Error('UserOperation not mined within timeout');
        }

        // Record sweep in database
        await supabaseClient.from('wallet_sweeps').insert({
          user_id: profile.id,
          user_wallet_address: scwAddress,
          master_wallet_address: masterWalletAddress,
          token: 'USDC',
          amount: balanceFormatted,
          sweep_tx_hash: receipt.receipt.transactionHash,
          status: 'completed',
          completed_at: new Date().toISOString(),
        });

        // Update wallet balance
        const { data: currentBalance } = await supabaseClient
          .from('wallet_balances')
          .select('balance')
          .eq('user_id', profile.id)
          .eq('token', 'USDC')
          .single();

        const newBalance = (currentBalance?.balance || 0) + balanceFormatted;

        await supabaseClient.from('wallet_balances').upsert({
          user_id: profile.id,
          token: 'USDC',
          balance: newBalance,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,token' });

        // Create deposit transaction
        await supabaseClient.from('transactions').insert({
          sender_id: profile.id,
          recipient_id: profile.id,
          sender_wallet: scwAddress,
          recipient_wallet: masterWalletAddress,
          amount: balanceFormatted,
          token: 'USDC',
          transaction_type: 'deposit',
          transaction_hash: receipt.receipt.transactionHash,
          chain_id: chainId,
          chain_name: 'Polygon Amoy (AA)',
          status: 'completed',
        });

        // Mark wallet as deployed
        if (!profile.aa_wallet_deployed) {
          await supabaseClient
            .from('profiles')
            .update({ aa_wallet_deployed: true })
            .eq('id', profile.id);
          console.log('Wallet marked as deployed');
        }

        sweepResults.push({
          user_id: profile.id,
          wallet: scwAddress,
          amount: balanceFormatted,
          txHash: receipt.receipt.transactionHash,
          gasSponsored: true,
        });

      } catch (error) {
        console.error(`Error sweeping ${profile.aa_wallet_address}:`, error);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        sweeps_completed: sweepResults.length,
        details: sweepResults,
        message: 'Gasless sweeps completed - all gas fees sponsored by FinMo'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('AA sweep error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
