# FinMo Africa - Mobile Crypto Wallet

## Overview
FinMo is Africa's leading mobile-first cryptocurrency wallet enabling instant money transfers using phone numbers.

## Technology Stack
- **Frontend**: React, TypeScript, Vite, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Edge Functions, Authentication)
- **Mobile**: Capacitor (iOS/Android)
- **Blockchain**: Polygon, Base, Arbitrum, Ethereum (EVM-compatible)

## Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Git

### Installation
```bash
git clone <repository-url>
cd finmo-africa
npm install
npm run dev
```

### Environment Variables
Copy `.env.example` to `.env` and configure:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

## Project Structure
- `/src` - React frontend application
- `/supabase/functions` - Serverless backend functions
- `/android` - Android native app build
- `/public` - Static assets

## Deployment
- Frontend: Vercel/Netlify
- Backend: Supabase Cloud
- Mobile: App Store / Google Play

## Security
- Row-Level Security (RLS) on all database tables
- AES-256-GCM encryption for sensitive data
- Two-factor authentication support
- KYC/AML compliance

## License
Proprietary - FinMo Africa Ltd.
