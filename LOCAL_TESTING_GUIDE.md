# Local Testing Guide - LifeVault AI

## Service Ports
- Frontend: `http://localhost:3000`
- Backend: `http://localhost:5000`
- AI Service: `http://localhost:8000`
- Hardhat RPC: `http://127.0.0.1:8545`

## Startup Sequence

### Terminal 1
```bash
cd blockchain
npx hardhat node
```

### Terminal 2
```bash
cd blockchain
npx hardhat run scripts/deploy.js --network localhost
```

### Terminal 3
```bash
cd ai-service
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Terminal 4
```bash
cd backend
npm install
npm run dev
```

### Terminal 5
```bash
cd frontend
npm install
npm run dev
```

## Required Environment Files
- `backend/.env` uses: `PORT`, `MONGO_URI`, `AI_SERVICE_URL`, `RPC_URL`, `PRIVATE_KEY`, `IDENTITY_CONTRACT`, `VAULT_CONTRACT`, `EMERGENCY_CONTRACT`, `VERIFIER_CONTRACT`, `JWT_SECRET`
- `frontend/.env.local` uses: `NEXT_PUBLIC_BACKEND_URL`, `NEXT_PUBLIC_RPC_URL`, `NEXT_PUBLIC_IDENTITY_CONTRACT`, `NEXT_PUBLIC_VAULT_CONTRACT`, `NEXT_PUBLIC_EMERGENCY_CONTRACT`, `NEXT_PUBLIC_VERIFIER_CONTRACT`

## Smoke Test Checklist
- `GET http://localhost:8000/health` returns `{ "success": true, ... }`
- `GET http://localhost:5000/api/health` returns `{ "success": true, ... }`
- Frontend can connect MetaMask on chainId `31337`
- Scam detector returns `fraud_probability` and `explanation`
- CSV upload returns `anomaly_scores` and `flagged_transactions`
- Document upload path stores hash on-chain and returns transaction hash
- Selective verifier submits and verifies proof on-chain
- Emergency trigger returns backend relay transaction hash (if backend signer is trusted address)
