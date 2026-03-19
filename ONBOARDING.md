# 🚀 Welcome to LifeVault AI

Welcome to the team! **LifeVault AI** is a cutting-edge Personal AI Guardian designed for digital and financial safety. It combines AI-driven threat detection with Blockchain-based asset protection and emergency recovery.

This guide will help you get your local development environment up and running and provide an overview of our architecture.

---

## 🏗️ Architecture Overview

LifeVault AI is composed of four primary services that work together:

1.  **Frontend (Next.js)**: The user interface for managing the vault, viewing security alerts, and triggering emergency protocols.
2.  **Backend (Express.js/Node.js)**: The central API gateway that manages users, coordinates with the AI service, and interacts with the blockchain.
3.  **AI Service (FastAPI/Python)**: Handles heavy lifting like phishing detection (Transformers) and transaction anomaly detection (Scikit-learn).
4.  **Blockchain (Solidity/Hardhat)**: A decentralized layer for document anchoring, identity verification, and emergency release logic.

---

## 🛠️ Prerequisites

Ensure you have the following installed on your machine:

- **Node.js**: v18 or later
- **Python**: 3.10 or later
- **MongoDB**: Running locally on `mongodb://127.0.0.1:27017`
- **MetaMask**: Browser extension for blockchain interactions

---

## 📥 Setup Instructions

Follow these steps in order to start the entire ecosystem.

### 1. Blockchain (Hardhat)
```bash
cd blockchain
npm install
npx hardhat node          # Leave this terminal running
```
In a **new terminal**:
```bash
npx hardhat run scripts/deploy.js --network localhost
```
> [!IMPORTANT]
> Note the deployed contract addresses from the output. You will need them for the environment files below.

### 2. AI Service (Python)
```bash
cd ai-service
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 3. Backend (Node.js)
```bash
cd backend
npm install
# Create a .env file based on .env.example
npm run dev
```

### 4. Frontend (Next.js)
```bash
cd frontend
npm install
# Create a .env.local file based on .env.example
npm run dev
```

---

## 🔐 Environment Configuration

### Backend (`backend/.env`)
| Variable | Description | Default/Example |
| :--- | :--- | :--- |
| `PORT` | API Port | `5000` |
| `MONGO_URI` | MongoDB Connection String | `mongodb://127.0.0.1:27017/lifevault` |
| `AI_SERVICE_URL` | URL of the AI Service | `http://localhost:8000` |
| `RPC_URL` | Blockchain RPC URL | `http://127.0.0.1:8545` |
| `IDENTITY_CONTRACT` | Deployed IdentityNFT address | *From deployment step* |

### Frontend (`frontend/.env.local`)
| Variable | Description | Default/Example |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_BACKEND_URL` | Backend API URL | `http://localhost:5000` |
| `NEXT_PUBLIC_RPC_URL` | Blockchain RPC URL | `http://127.0.0.1:8545` |

---

## 🧪 Verification (Smoke Tests)

Once everything is running, verify your setup:

1.  **AI Health**: `GET http://localhost:8000/health` → Should return `{"status": "online"}`.
2.  **Backend Health**: `GET http://localhost:5000/api/health` → Should return `{"success": true}`.
3.  **MetaMask**: Open `http://localhost:3000` and connect MetaMask to the "Localhost 8545" network (Chain ID: `31337`).

---

## 📂 Project Structure

- `/frontend`: Next.js pages, components, and hooks.
- `/backend`: Express routes, controllers, and MongoDB models.
- `/ai-service`: Python logic for ML models and FastAPI endpoints.
- `/blockchain`: Hardhat environment, Solidity contracts, and deployment scripts.
- `/docs`: Detailed documentation on threat models and architecture.

---

## 🤝 How to Contribute

1.  **Branching**: Create a feature branch from `main`.
2.  **Linting**: Run `npm run lint` in the relevant directory before committing.
3.  **Testing**: Check `LOCAL_TESTING_GUIDE.md` for detailed testing scenarios.
4.  **Commits**: Use descriptive commit messages.

Happy coding! If you hit any roadblocks, reach out to the lead developers or check the `logs/` directory in each service.
