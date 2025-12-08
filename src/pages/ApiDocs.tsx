import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  ArrowLeft, 
  Copy, 
  Check, 
  Wallet, 
  ArrowRightLeft, 
  Download, 
  Upload,
  Webhook,
  DollarSign,
  Code,
  Terminal,
  Book,
  Shield,
  CreditCard,
  UserCheck,
  QrCode
} from "lucide-react";
import { toast } from "sonner";

const ApiDocs = () => {
  const navigate = useNavigate();
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<"curl" | "javascript" | "python" | "php">("curl");

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(id);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const CodeBlock = ({ code, id, language = "bash" }: { code: string; id: string; language?: string }) => (
    <div className="relative">
      <pre className="bg-muted/50 p-4 rounded-lg overflow-x-auto text-sm">
        <code className={`language-${language}`}>{code}</code>
      </pre>
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2"
        onClick={() => copyToClipboard(code, id)}
      >
        {copiedCode === id ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </Button>
    </div>
  );

  const endpoints = [
    {
      category: "Wallets",
      icon: Wallet,
      endpoints: [
        { method: "POST", path: "/partner-wallets", description: "Create a new wallet for your customer" },
        { method: "GET", path: "/partner-wallets", description: "List all wallets" },
        { method: "GET", path: "/partner-wallets/{id}", description: "Get wallet details" },
        { method: "GET", path: "/partner-wallets/{id}/transactions", description: "Get wallet transaction history" },
      ]
    },
    {
      category: "Transfers",
      icon: ArrowRightLeft,
      endpoints: [
        { method: "POST", path: "/partner-transfers", description: "Create internal transfer" },
        { method: "POST", path: "/partner-transfers/batch", description: "Create batch transfers" },
        { method: "GET", path: "/partner-transfers", description: "List all transfers" },
        { method: "GET", path: "/partner-transfers/{id}", description: "Get transfer details" },
      ]
    },
    {
      category: "Pay-ins",
      icon: Download,
      endpoints: [
        { method: "POST", path: "/partner-payins/address", description: "Generate deposit address" },
        { method: "POST", path: "/partner-payins/payment-link", description: "Create payment link" },
        { method: "GET", path: "/partner-payins/{id}", description: "Get pay-in status" },
        { method: "GET", path: "/partner-payins/{id}/qr", description: "Generate QR code for payment" },
      ]
    },
    {
      category: "Payouts",
      icon: Upload,
      endpoints: [
        { method: "POST", path: "/partner-payouts/crypto", description: "Crypto payout to external wallet" },
        { method: "POST", path: "/partner-payouts/mobile-money", description: "Mobile money disbursement" },
        { method: "POST", path: "/partner-payouts/bank", description: "Bank transfer payout" },
        { method: "POST", path: "/partner-payouts/batch", description: "Batch payouts" },
        { method: "GET", path: "/partner-payouts/{id}", description: "Get payout status" },
      ]
    },
    {
      category: "Escrow",
      icon: Shield,
      endpoints: [
        { method: "POST", path: "/partner-escrow", description: "Create escrow transaction" },
        { method: "POST", path: "/partner-escrow/{id}/fund", description: "Fund escrow" },
        { method: "POST", path: "/partner-escrow/{id}/release", description: "Release funds to seller" },
        { method: "POST", path: "/partner-escrow/{id}/dispute", description: "Raise a dispute" },
        { method: "POST", path: "/partner-escrow/{id}/refund", description: "Refund to buyer" },
        { method: "GET", path: "/partner-escrow/{id}", description: "Get escrow status" },
      ]
    },
    {
      category: "Virtual Cards",
      icon: CreditCard,
      endpoints: [
        { method: "POST", path: "/partner-cards", description: "Issue virtual card" },
        { method: "POST", path: "/partner-cards/{id}/fund", description: "Fund card" },
        { method: "POST", path: "/partner-cards/{id}/freeze", description: "Freeze card" },
        { method: "POST", path: "/partner-cards/{id}/unfreeze", description: "Unfreeze card" },
        { method: "PUT", path: "/partner-cards/{id}/limit", description: "Update spending limit" },
        { method: "GET", path: "/partner-cards/{id}", description: "Get card details" },
        { method: "GET", path: "/partner-cards/{id}/transactions", description: "Get card transactions" },
      ]
    },
    {
      category: "KYC",
      icon: UserCheck,
      endpoints: [
        { method: "POST", path: "/partner-kyc", description: "Initiate KYC verification" },
        { method: "POST", path: "/partner-kyc/{id}/documents", description: "Upload verification documents" },
        { method: "POST", path: "/partner-kyc/{id}/submit", description: "Submit for review" },
        { method: "GET", path: "/partner-kyc/{id}", description: "Get KYC status" },
        { method: "GET", path: "/partner-kyc", description: "List KYC verifications" },
      ]
    },
    {
      category: "FX Rates",
      icon: DollarSign,
      endpoints: [
        { method: "GET", path: "/partner-fx-rates", description: "Get current exchange rates" },
        { method: "GET", path: "/partner-fx-rates/convert", description: "Convert currency" },
        { method: "GET", path: "/partner-fx-rates/pairs", description: "List supported currency pairs" },
        { method: "POST", path: "/partner-fx-rates/quote", description: "Lock a quote for 30 seconds" },
        { method: "GET", path: "/partner-fx-rates/quote/{id}", description: "Get locked quote status" },
      ]
    },
    {
      category: "Webhooks",
      icon: Webhook,
      endpoints: [
        { method: "POST", path: "/partner-webhooks", description: "Create webhook endpoint" },
        { method: "GET", path: "/partner-webhooks", description: "List webhooks" },
        { method: "PUT", path: "/partner-webhooks/{id}", description: "Update webhook" },
        { method: "DELETE", path: "/partner-webhooks/{id}", description: "Delete webhook" },
        { method: "POST", path: "/partner-webhooks/{id}/test", description: "Test webhook delivery" },
        { method: "GET", path: "/partner-webhooks/{id}/logs", description: "Get delivery logs" },
      ]
    },
  ];

  const codeExamples = {
    createWallet: {
      curl: `curl -X POST https://khqsseqrmanpcbeyvkdp.supabase.co/functions/v1/partner-wallets \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: YOUR_API_KEY" \\
  -d '{
    "external_customer_id": "customer_123",
    "label": "Customer Wallet"
  }'`,
      javascript: `import { FinmoClient } from '@finmo/sdk';

const finmo = new FinmoClient({
  apiKey: 'YOUR_API_KEY',
  environment: 'production'
});

const wallet = await finmo.wallets.create({
  externalCustomerId: 'customer_123',
  label: 'Customer Wallet'
});

console.log('Wallet created:', wallet.address);`,
      python: `from finmo import FinmoClient

client = FinmoClient(api_key='YOUR_API_KEY')

wallet = client.wallets.create(
    external_customer_id='customer_123',
    label='Customer Wallet'
)

print(f'Wallet created: {wallet.address}')`,
      php: `<?php
use Finmo\\FinmoClient;

$client = new FinmoClient('YOUR_API_KEY');

$wallet = $client->wallets->create([
    'external_customer_id' => 'customer_123',
    'label' => 'Customer Wallet'
]);

echo "Wallet created: " . $wallet->address;`
    },
    cryptoPayout: {
      curl: `curl -X POST https://khqsseqrmanpcbeyvkdp.supabase.co/functions/v1/partner-payouts/crypto \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: YOUR_API_KEY" \\
  -d '{
    "source_wallet_id": "wallet_uuid",
    "destination_address": "0x742d35Cc...",
    "amount": 100.50,
    "token": "USDC",
    "chain_id": 137
  }'`,
      javascript: `const payout = await finmo.payouts.crypto({
  sourceWalletId: 'wallet_uuid',
  destinationAddress: '0x742d35Cc...',
  amount: 100.50,
  token: 'USDC',
  chainId: 137
});

console.log('Payout ID:', payout.id);
console.log('Status:', payout.status);`,
      python: `payout = client.payouts.crypto(
    source_wallet_id='wallet_uuid',
    destination_address='0x742d35Cc...',
    amount=100.50,
    token='USDC',
    chain_id=137
)

print(f'Payout ID: {payout.id}')
print(f'Status: {payout.status}')`,
      php: `<?php
$payout = $client->payouts->crypto([
    'source_wallet_id' => 'wallet_uuid',
    'destination_address' => '0x742d35Cc...',
    'amount' => 100.50,
    'token' => 'USDC',
    'chain_id' => 137
]);

echo "Payout ID: " . $payout->id;`
    },
    mobileMoneyPayout: {
      curl: `curl -X POST https://khqsseqrmanpcbeyvkdp.supabase.co/functions/v1/partner-payouts/mobile-money \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: YOUR_API_KEY" \\
  -d '{
    "source_wallet_id": "wallet_uuid",
    "phone_number": "+254712345678",
    "amount": 5000,
    "token": "USDC",
    "currency": "KES"
  }'`,
      javascript: `const payout = await finmo.payouts.mobileMoney({
  sourceWalletId: 'wallet_uuid',
  phoneNumber: '+254712345678',
  amount: 5000,
  token: 'USDC',
  currency: 'KES'
});

console.log('Payout status:', payout.status);
console.log('Est. completion:', payout.estimatedCompletion);`,
      python: `payout = client.payouts.mobile_money(
    source_wallet_id='wallet_uuid',
    phone_number='+254712345678',
    amount=5000,
    token='USDC',
    currency='KES'
)

print(f'Payout status: {payout.status}')`,
      php: `<?php
$payout = $client->payouts->mobileMoney([
    'source_wallet_id' => 'wallet_uuid',
    'phone_number' => '+254712345678',
    'amount' => 5000,
    'token' => 'USDC',
    'currency' => 'KES'
]);`
    },
    paymentLink: {
      curl: `curl -X POST https://khqsseqrmanpcbeyvkdp.supabase.co/functions/v1/partner-payins/payment-link \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: YOUR_API_KEY" \\
  -d '{
    "amount": 50,
    "token": "USDC",
    "description": "Order #12345",
    "expires_in_minutes": 60,
    "redirect_url": "https://yourapp.com/success"
  }'`,
      javascript: `const paymentLink = await finmo.payins.createPaymentLink({
  amount: 50,
  token: 'USDC',
  description: 'Order #12345',
  expiresInMinutes: 60,
  redirectUrl: 'https://yourapp.com/success'
});

console.log('Payment URL:', paymentLink.paymentUrl);
console.log('Deposit Address:', paymentLink.depositAddress);`,
      python: `payment_link = client.payins.create_payment_link(
    amount=50,
    token='USDC',
    description='Order #12345',
    expires_in_minutes=60,
    redirect_url='https://yourapp.com/success'
)

print(f'Payment URL: {payment_link.payment_url}')`,
      php: `<?php
$paymentLink = $client->payins->createPaymentLink([
    'amount' => 50,
    'token' => 'USDC',
    'description' => 'Order #12345',
    'expires_in_minutes' => 60,
    'redirect_url' => 'https://yourapp.com/success'
]);`
    },
    webhook: {
      curl: `curl -X POST https://khqsseqrmanpcbeyvkdp.supabase.co/functions/v1/partner-webhooks \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: YOUR_API_KEY" \\
  -d '{
    "url": "https://yourapp.com/webhooks/finmo",
    "events": ["transfer.completed", "payout.completed", "payin.received"]
  }'`,
      javascript: `const webhook = await finmo.webhooks.create({
  url: 'https://yourapp.com/webhooks/finmo',
  events: ['transfer.completed', 'payout.completed', 'payin.received']
});

// Webhook verification example
app.post('/webhooks/finmo', (req, res) => {
  const signature = req.headers['x-finmo-signature'];
  const isValid = finmo.webhooks.verify(req.body, signature, webhook.secret);
  
  if (!isValid) return res.status(401).send('Invalid signature');
  
  const event = req.body;
  switch(event.type) {
    case 'transfer.completed':
      handleTransferCompleted(event.data);
      break;
  }
  res.status(200).send('OK');
});`,
      python: `webhook = client.webhooks.create(
    url='https://yourapp.com/webhooks/finmo',
    events=['transfer.completed', 'payout.completed', 'payin.received']
)

# Webhook verification in Flask
@app.route('/webhooks/finmo', methods=['POST'])
def handle_webhook():
    signature = request.headers.get('x-finmo-signature')
    is_valid = client.webhooks.verify(
        request.data,
        signature,
        webhook.secret
    )
    
    if not is_valid:
        return 'Invalid signature', 401
    
    event = request.json
    if event['type'] == 'transfer.completed':
        handle_transfer_completed(event['data'])
    
    return 'OK', 200`,
      php: `<?php
$webhook = $client->webhooks->create([
    'url' => 'https://yourapp.com/webhooks/finmo',
    'events' => ['transfer.completed', 'payout.completed', 'payin.received']
]);

// Webhook verification
$signature = $_SERVER['HTTP_X_FINMO_SIGNATURE'];
$payload = file_get_contents('php://input');
$isValid = $client->webhooks->verify($payload, $signature, $webhook->secret);

if (!$isValid) {
    http_response_code(401);
    exit('Invalid signature');
}`
    },
    escrow: {
      curl: `curl -X POST https://khqsseqrmanpcbeyvkdp.supabase.co/functions/v1/partner-escrow \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: YOUR_API_KEY" \\
  -d '{
    "buyer_wallet_id": "wallet_uuid",
    "seller_wallet_id": "seller_wallet_uuid",
    "amount": 500,
    "token": "USDC",
    "description": "Payment for services",
    "expires_in_hours": 72
  }'`,
      javascript: `const escrow = await finmo.escrow.create({
  buyerWalletId: 'wallet_uuid',
  sellerWalletId: 'seller_wallet_uuid',
  amount: 500,
  token: 'USDC',
  description: 'Payment for services',
  expiresInHours: 72
});

console.log('Escrow ID:', escrow.id);

// Fund the escrow
await finmo.escrow.fund(escrow.id);

// Release to seller when conditions met
await finmo.escrow.release(escrow.id);`,
      python: `escrow = client.escrow.create(
    buyer_wallet_id='wallet_uuid',
    seller_wallet_id='seller_wallet_uuid',
    amount=500,
    token='USDC',
    description='Payment for services',
    expires_in_hours=72
)

# Fund the escrow
client.escrow.fund(escrow.id)

# Release when conditions met
client.escrow.release(escrow.id)`,
      php: `<?php
$escrow = $client->escrow->create([
    'buyer_wallet_id' => 'wallet_uuid',
    'seller_wallet_id' => 'seller_wallet_uuid',
    'amount' => 500,
    'token' => 'USDC',
    'description' => 'Payment for services'
]);

// Fund and release
$client->escrow->fund($escrow->id);
$client->escrow->release($escrow->id);`
    },
    virtualCard: {
      curl: `curl -X POST https://khqsseqrmanpcbeyvkdp.supabase.co/functions/v1/partner-cards \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: YOUR_API_KEY" \\
  -d '{
    "wallet_id": "wallet_uuid",
    "external_customer_id": "customer_123",
    "card_holder_name": "John Doe",
    "spending_limit": 5000,
    "currency": "USD"
  }'`,
      javascript: `const card = await finmo.cards.issue({
  walletId: 'wallet_uuid',
  externalCustomerId: 'customer_123',
  cardHolderName: 'John Doe',
  spendingLimit: 5000,
  currency: 'USD'
});

console.log('Card last 4:', card.last_four);

// Fund the card
await finmo.cards.fund(card.id, {
  amount: 1000,
  token: 'USDC'
});

// Freeze if needed
await finmo.cards.freeze(card.id);`,
      python: `card = client.cards.issue(
    wallet_id='wallet_uuid',
    external_customer_id='customer_123',
    card_holder_name='John Doe',
    spending_limit=5000,
    currency='USD'
)

# Fund the card
client.cards.fund(card.id, amount=1000, token='USDC')`,
      php: `<?php
$card = $client->cards->issue([
    'wallet_id' => 'wallet_uuid',
    'external_customer_id' => 'customer_123',
    'card_holder_name' => 'John Doe',
    'spending_limit' => 5000
]);`
    },
    kyc: {
      curl: `curl -X POST https://khqsseqrmanpcbeyvkdp.supabase.co/functions/v1/partner-kyc \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: YOUR_API_KEY" \\
  -d '{
    "external_customer_id": "customer_123",
    "first_name": "John",
    "last_name": "Doe",
    "date_of_birth": "1990-01-15",
    "nationality": "KE",
    "verification_level": "standard"
  }'`,
      javascript: `const kyc = await finmo.kyc.initiate({
  externalCustomerId: 'customer_123',
  firstName: 'John',
  lastName: 'Doe',
  dateOfBirth: '1990-01-15',
  nationality: 'KE',
  verificationLevel: 'standard'
});

// Upload documents
await finmo.kyc.uploadDocuments(kyc.id, {
  documentType: 'passport',
  frontImage: frontImageFile,
  selfie: selfieFile
});

// Submit for review
await finmo.kyc.submit(kyc.id);`,
      python: `kyc = client.kyc.initiate(
    external_customer_id='customer_123',
    first_name='John',
    last_name='Doe',
    date_of_birth='1990-01-15',
    nationality='KE',
    verification_level='standard'
)

# Upload documents and submit
client.kyc.upload_documents(kyc.id, 
    document_type='passport',
    front_image=front_file
)
client.kyc.submit(kyc.id)`,
      php: `<?php
$kyc = $client->kyc->initiate([
    'external_customer_id' => 'customer_123',
    'first_name' => 'John',
    'last_name' => 'Doe',
    'date_of_birth' => '1990-01-15',
    'nationality' => 'KE'
]);`
    },
    quoteLocking: {
      curl: `# Lock a quote for 30 seconds
curl -X POST https://khqsseqrmanpcbeyvkdp.supabase.co/functions/v1/partner-fx-rates/quote \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: YOUR_API_KEY" \\
  -d '{
    "from": "USDC",
    "to": "KES",
    "amount": 1000,
    "lock_seconds": 30
  }'

# Use the quote in a transfer
curl -X POST .../partner-transfers \\
  -d '{ "quote_id": "quote_uuid", ... }'`,
      javascript: `// Lock a quote for guaranteed rate
const quote = await finmo.fx.lockQuote({
  from: 'USDC',
  to: 'KES',
  amount: 1000,
  lockSeconds: 30
});

console.log('Locked rate:', quote.rate);
console.log('Expires at:', quote.expires_at);

// Use the locked quote in transfer
const transfer = await finmo.transfers.create({
  quoteId: quote.id,
  sourceWalletId: 'wallet_uuid',
  // ... other params
});`,
      python: `# Lock a quote
quote = client.fx.lock_quote(
    from_currency='USDC',
    to_currency='KES',
    amount=1000,
    lock_seconds=30
)

print(f'Locked rate: {quote.rate}')
print(f'Valid until: {quote.expires_at}')`,
      php: `<?php
$quote = $client->fx->lockQuote([
    'from' => 'USDC',
    'to' => 'KES',
    'amount' => 1000,
    'lock_seconds' => 30
]);`
    }
  };

  const webhookEvents = [
    { event: "wallet.created", description: "A new wallet was created" },
    { event: "wallet.balance.updated", description: "Wallet balance changed" },
    { event: "transfer.initiated", description: "Transfer started processing" },
    { event: "transfer.completed", description: "Transfer successfully completed" },
    { event: "transfer.failed", description: "Transfer failed" },
    { event: "payout.initiated", description: "Payout started processing" },
    { event: "payout.completed", description: "Payout successfully completed" },
    { event: "payout.failed", description: "Payout failed" },
    { event: "payin.received", description: "Deposit received in wallet" },
    { event: "payin.confirmed", description: "Deposit confirmed on blockchain" },
    { event: "escrow.created", description: "Escrow transaction created" },
    { event: "escrow.funded", description: "Escrow funded by buyer" },
    { event: "escrow.released", description: "Escrow released to seller" },
    { event: "escrow.disputed", description: "Dispute raised on escrow" },
    { event: "escrow.refunded", description: "Escrow refunded to buyer" },
    { event: "card.issued", description: "Virtual card issued" },
    { event: "card.funded", description: "Card funded from wallet" },
    { event: "card.frozen", description: "Card frozen" },
    { event: "kyc.submitted", description: "KYC verification submitted" },
    { event: "kyc.approved", description: "KYC verification approved" },
    { event: "kyc.rejected", description: "KYC verification rejected" },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold">Finmo Partner API</h1>
                <p className="text-sm text-muted-foreground">Developer Documentation</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">v1.0</Badge>
              <Button variant="outline" size="sm" onClick={() => navigate("/admin/partners")}>
                Get API Keys
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-4 gap-8">
          {/* Sidebar Navigation */}
          <aside className="lg:col-span-1">
            <Card className="sticky top-24">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Book className="h-4 w-4" />
                  Quick Links
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <a href="#getting-started" className="block text-sm text-muted-foreground hover:text-primary py-1">
                  Getting Started
                </a>
                <a href="#authentication" className="block text-sm text-muted-foreground hover:text-primary py-1">
                  Authentication
                </a>
                <a href="#endpoints" className="block text-sm text-muted-foreground hover:text-primary py-1">
                  API Endpoints
                </a>
                <a href="#examples" className="block text-sm text-muted-foreground hover:text-primary py-1">
                  Code Examples
                </a>
                <a href="#webhooks" className="block text-sm text-muted-foreground hover:text-primary py-1">
                  Webhooks
                </a>
                <a href="#errors" className="block text-sm text-muted-foreground hover:text-primary py-1">
                  Error Handling
                </a>
              </CardContent>
            </Card>
          </aside>

          {/* Main Content */}
          <main className="lg:col-span-3 space-y-8">
            {/* Getting Started */}
            <section id="getting-started">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Terminal className="h-5 w-5" />
                    Getting Started
                  </CardTitle>
                  <CardDescription>
                    Everything you need to integrate Finmo payments into your application
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="p-4 border rounded-lg">
                      <div className="font-medium mb-1">1. Get API Keys</div>
                      <p className="text-sm text-muted-foreground">
                        Register as a partner and generate your API keys from the dashboard.
                      </p>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <div className="font-medium mb-1">2. Test in Sandbox</div>
                      <p className="text-sm text-muted-foreground">
                        Use sandbox keys to test your integration without real funds.
                      </p>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <div className="font-medium mb-1">3. Go Live</div>
                      <p className="text-sm text-muted-foreground">
                        Switch to production keys when you're ready to process real payments.
                      </p>
                    </div>
                  </div>

                  <div className="mt-6">
                    <h4 className="font-medium mb-2">Base URL</h4>
                    <CodeBlock 
                      code="https://khqsseqrmanpcbeyvkdp.supabase.co/functions/v1" 
                      id="base-url" 
                    />
                  </div>
                </CardContent>
              </Card>
            </section>

            {/* Authentication */}
            <section id="authentication">
              <Card>
                <CardHeader>
                  <CardTitle>Authentication</CardTitle>
                  <CardDescription>
                    All API requests require authentication via API key
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Include your API key in the <code className="bg-muted px-1 rounded">x-api-key</code> header:
                  </p>
                  <CodeBlock 
                    code={`curl -H "x-api-key: pk_live_abc123..." https://api.finmo.africa/v1/wallets`}
                    id="auth-example"
                  />
                  
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 mt-4">
                    <h4 className="font-medium text-amber-600 dark:text-amber-400">Security Best Practices</h4>
                    <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                      <li>• Never expose API keys in client-side code</li>
                      <li>• Use environment variables for key storage</li>
                      <li>• Rotate keys periodically</li>
                      <li>• Use separate keys for sandbox and production</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </section>

            {/* API Endpoints */}
            <section id="endpoints">
              <Card>
                <CardHeader>
                  <CardTitle>API Endpoints</CardTitle>
                  <CardDescription>
                    Complete reference of all available endpoints
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {endpoints.map((category) => (
                      <div key={category.category}>
                        <h4 className="font-medium flex items-center gap-2 mb-3">
                          <category.icon className="h-4 w-4" />
                          {category.category}
                        </h4>
                        <div className="space-y-2">
                          {category.endpoints.map((endpoint, idx) => (
                            <div 
                              key={idx}
                              className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg"
                            >
                              <Badge 
                                variant={endpoint.method === "GET" ? "secondary" : "default"}
                                className="font-mono text-xs w-16 justify-center"
                              >
                                {endpoint.method}
                              </Badge>
                              <code className="text-sm flex-1">{endpoint.path}</code>
                              <span className="text-sm text-muted-foreground hidden md:block">
                                {endpoint.description}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </section>

            {/* Code Examples */}
            <section id="examples">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Code className="h-5 w-5" />
                    Code Examples
                  </CardTitle>
                  <CardDescription>
                    Ready-to-use examples in multiple languages
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="createWallet" className="w-full">
                    <TabsList className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-9 w-full">
                      <TabsTrigger value="createWallet">Wallet</TabsTrigger>
                      <TabsTrigger value="cryptoPayout">Payout</TabsTrigger>
                      <TabsTrigger value="mobileMoneyPayout">Mobile</TabsTrigger>
                      <TabsTrigger value="paymentLink">Pay-in</TabsTrigger>
                      <TabsTrigger value="webhook">Webhooks</TabsTrigger>
                      <TabsTrigger value="escrow">Escrow</TabsTrigger>
                      <TabsTrigger value="virtualCard">Cards</TabsTrigger>
                      <TabsTrigger value="kyc">KYC</TabsTrigger>
                      <TabsTrigger value="quoteLocking">FX Quote</TabsTrigger>
                    </TabsList>

                    {Object.entries(codeExamples).map(([key, examples]) => (
                      <TabsContent key={key} value={key} className="mt-4">
                        <div className="flex gap-2 mb-4">
                          {(["curl", "javascript", "python", "php"] as const).map((lang) => (
                            <Button
                              key={lang}
                              variant={selectedLanguage === lang ? "default" : "outline"}
                              size="sm"
                              onClick={() => setSelectedLanguage(lang)}
                              className="capitalize"
                            >
                              {lang === "curl" ? "cURL" : lang}
                            </Button>
                          ))}
                        </div>
                        <ScrollArea className="h-[400px]">
                          <CodeBlock 
                            code={examples[selectedLanguage]} 
                            id={`${key}-${selectedLanguage}`}
                            language={selectedLanguage === "curl" ? "bash" : selectedLanguage}
                          />
                        </ScrollArea>
                      </TabsContent>
                    ))}
                  </Tabs>
                </CardContent>
              </Card>
            </section>

            {/* Webhooks */}
            <section id="webhooks">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Webhook className="h-5 w-5" />
                    Webhook Events
                  </CardTitle>
                  <CardDescription>
                    Real-time notifications for your application
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Subscribe to webhook events to receive real-time notifications about transactions, 
                      payouts, and other important events.
                    </p>
                    
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="text-left p-3 text-sm font-medium">Event</th>
                            <th className="text-left p-3 text-sm font-medium">Description</th>
                          </tr>
                        </thead>
                        <tbody>
                          {webhookEvents.map((event, idx) => (
                            <tr key={idx} className="border-t">
                              <td className="p-3">
                                <code className="text-sm bg-muted px-2 py-1 rounded">{event.event}</code>
                              </td>
                              <td className="p-3 text-sm text-muted-foreground">{event.description}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="mt-4">
                      <h4 className="font-medium mb-2">Webhook Payload Example</h4>
                      <CodeBlock 
                        code={`{
  "id": "evt_abc123",
  "type": "transfer.completed",
  "created_at": "2024-01-15T10:30:00Z",
  "data": {
    "transfer_id": "txn_xyz789",
    "amount": 100.50,
    "token": "USDC",
    "status": "completed",
    "blockchain_tx_hash": "0x..."
  }
}`}
                        id="webhook-payload"
                        language="json"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>

            {/* Error Handling */}
            <section id="errors">
              <Card>
                <CardHeader>
                  <CardTitle>Error Handling</CardTitle>
                  <CardDescription>
                    Standard error response format and common error codes
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <CodeBlock 
                    code={`{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_BALANCE",
    "message": "Wallet balance is insufficient for this transaction",
    "details": {
      "available": 50.00,
      "requested": 100.00
    }
  }
}`}
                    id="error-example"
                    language="json"
                  />

                  <div className="border rounded-lg overflow-hidden mt-4">
                    <table className="w-full">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left p-3 text-sm font-medium">HTTP Code</th>
                          <th className="text-left p-3 text-sm font-medium">Error Code</th>
                          <th className="text-left p-3 text-sm font-medium">Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-t">
                          <td className="p-3 text-sm">400</td>
                          <td className="p-3"><code className="text-sm">INVALID_REQUEST</code></td>
                          <td className="p-3 text-sm text-muted-foreground">Missing or invalid parameters</td>
                        </tr>
                        <tr className="border-t">
                          <td className="p-3 text-sm">401</td>
                          <td className="p-3"><code className="text-sm">INVALID_API_KEY</code></td>
                          <td className="p-3 text-sm text-muted-foreground">API key is invalid or expired</td>
                        </tr>
                        <tr className="border-t">
                          <td className="p-3 text-sm">403</td>
                          <td className="p-3"><code className="text-sm">INSUFFICIENT_PERMISSIONS</code></td>
                          <td className="p-3 text-sm text-muted-foreground">API key lacks required scope</td>
                        </tr>
                        <tr className="border-t">
                          <td className="p-3 text-sm">404</td>
                          <td className="p-3"><code className="text-sm">NOT_FOUND</code></td>
                          <td className="p-3 text-sm text-muted-foreground">Resource not found</td>
                        </tr>
                        <tr className="border-t">
                          <td className="p-3 text-sm">429</td>
                          <td className="p-3"><code className="text-sm">RATE_LIMITED</code></td>
                          <td className="p-3 text-sm text-muted-foreground">Too many requests</td>
                        </tr>
                        <tr className="border-t">
                          <td className="p-3 text-sm">500</td>
                          <td className="p-3"><code className="text-sm">INTERNAL_ERROR</code></td>
                          <td className="p-3 text-sm text-muted-foreground">Server error, please retry</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </section>

            {/* SDKs */}
            <section id="sdks">
              <Card>
                <CardHeader>
                  <CardTitle>Official SDKs</CardTitle>
                  <CardDescription>
                    Client libraries for popular programming languages
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="border rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge>JavaScript / TypeScript</Badge>
                      </div>
                      <CodeBlock code="npm install @finmo/sdk" id="sdk-js" />
                    </div>
                    <div className="border rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge>Python</Badge>
                      </div>
                      <CodeBlock code="pip install finmo" id="sdk-python" />
                    </div>
                    <div className="border rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge>PHP</Badge>
                      </div>
                      <CodeBlock code="composer require finmo/finmo-php" id="sdk-php" />
                    </div>
                    <div className="border rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge>Go</Badge>
                        <Badge variant="outline">Coming Soon</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">Go SDK is in development</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
};

export default ApiDocs;
