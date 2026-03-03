# LifeVault AI – Personal AI Guardian for Digital & Financial Safety

A full-stack AI + Blockchain prototype demonstrating:
- **AI Phishing Detection** using HuggingFace Transformers + heuristics
- **Transaction Anomaly Detection** using Isolation Forest (scikit-learn)
- **Blockchain Document Vault** with Solidity smart contracts
- **Selective Verification Simulation** (ZK-like proofs)
- **Digital Emergency Release** via smart contracts

---

## Architecture Overview

```
User Browser (Next.js Frontend)
       │
       ├──► Express.js Backend (Node.js) ──► MongoDB
       │           │
       │           └──► FastAPI AI Service (Python)
       │
       └──► Hardhat Local Blockchain (Solidity Contracts)
```

---

## Prerequisites

- Node.js v18+
- Python 3.10+
- MongoDB (running locally on port 27017)
- MetaMask browser extension

---

## Setup Instructions

### 1. Blockchain (Hardhat)

```bash
cd blockchain
npm install
npx hardhat node          # Start local blockchain (keep running)
# In new terminal:
npx hardhat run scripts/deploy.js --network localhost
```

Copy the deployed contract addresses into `/backend/.env` and `/frontend/.env.local`.

### 2. AI Service (FastAPI)

```bash
cd ai-service
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 3. Backend (Express.js)

```bash
cd backend
npm install
# Edit .env with your values
npm run dev
```

### 4. Frontend (Next.js)

```bash
cd frontend
npm install
# Edit .env.local with contract addresses
npm run dev
```

Open `http://localhost:3000` in your browser with MetaMask installed.

---

## Sample Data

- `sample-data/bank_statement.csv` — Test CSV for anomaly detection
- `sample-data/phishing_examples.json` — Sample phishing messages/URLs

---

## Smart Contract Addresses (after deploy)

Fill these into your .env files after running the deploy script.

---

## Testing

See `LOCAL_TESTING_GUIDE.md` for step-by-step testing instructions.
