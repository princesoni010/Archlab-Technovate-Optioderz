# ⬡ Archlab | AI-Powered Structural Consultant

**Archlab** is an AI-driven structural engineering consultant designed to empower home builders and architects. By combining Computer Vision (OpenCV) with real-time structural analysis and Stellar blockchain verification, Archlab transforms 2D floor plans into interactive, cost-optimized 3D models.

---

## 👁️ Project Vision
Our vision is to democratize high-end structural auditing tools. We believe every individual home builder should have access to the same level of architectural intelligence as large-scale developers, ensuring safety, efficiency, and transparency through blockchain technology.

## 🚀 Key Features
- **AI Blueprint Scanner**: Instantly extract wall coordinates and room boundaries from manual floor plan photos using OpenCV.
- **Dynamic 3D Generation**: One-click conversion from 2D scans to interactive 3D models with Three.js.
- **8-Material Tradeoff Engine**: Proprietary logic that ranks materials (AAC, Red Brick, RCC, etc.) based on strength, durability, and cost.
- **4D Construction Timeline**: Visualize the building process phase-by-phase with adaptive scaling.
- **Blockchain Verification**: Real SHA-256 hashing of structural audit data submitted to the **Stellar Testnet** via Horizon API — every audit generates a live, verifiable on-chain transaction.
- **Professional PDF Audit**: Generates 8-page professional reports with complete bill-of-quantities (BoQ) including the audit's blockchain hash.

---

## ⛓️ Deployed Smart Contract Details

The Archlab audit log is secured on the Stellar Network via a Soroban Smart Contract deployed on Stellar Testnet.

- **Contract ID**: `CCDPGMFXENTALXB6LU7EPRGNZBOKVDSZFHSL62MPHQW5BXQPXRCRGDK`
- **Network**: Stellar Testnet
- **Explorer**: [View Contract on Stellar Expert](https://stellar.expert/explorer/testnet/contract/CCDPGMFXENTALXB6LU7EPRGNZBOKVDSZFHSL62MPHQW5BXQPXRCRGDK)

> **How integration works**: When a user clicks "⛓️ Blockchain Verify" in the app, the frontend uses `stellar-sdk` to:
> 1. Compute a SHA-256 hash of the structural audit data
> 2. Load the demo Stellar Testnet account via Horizon API
> 3. Build + sign a transaction with a `ManageData` operation storing the hash on-chain
> 4. Submit it to Stellar Testnet and return the **live transaction hash** with a direct explorer link

---

## 🖼️ UI Screenshots

> Screenshots will be added after final demo run. The portal includes:
> - Landing page with particle animation engine
> - Floor plan upload + OpenCV parsing panel
> - Interactive 3D structural model (Three.js)
> - Material tradeoff analysis dashboard
> - Blockchain verification modal with live tx hash
> - 8-page PDF audit report export

---

## 🔗 Project Links
- **Demo Video**: Coming at presentation

---

## 🛠️ Project Setup Guide

### Frontend
1. Navigate to the project root.
2. Open `public/index.html` in any modern browser.
3. No build step required (Vanilla JS + CDN imports).
4. Stellar SDK is loaded via CDN — no npm install needed for frontend.

### Backend (OpenCV Engine)
1. Install Python 3.8+
2. Install dependencies:
   ```bash
   pip install opencv-python numpy fastapi uvicorn
   ```
3. Run the server:
   ```bash
   python backend/main.py
   ```

### Smart Contract (Soroban / Stellar)
1. Install [Rust](https://rustup.rs/) and [Soroban CLI](https://soroban.stellar.org/docs/getting-started/setup).
2. Navigate to `contracts/hello-world/`
3. Build the contract:
   ```bash
   cargo build --target wasm32-unknown-unknown --release
   ```
4. Deploy to testnet:
   ```bash
   soroban contract deploy \
     --wasm target/wasm32-unknown-unknown/release/soroban_hello_world.wasm \
     --source <YOUR_SECRET_KEY> \
     --network testnet
   ```

### Stellar Testnet Account Setup
Fund the demo account via Stellar Friendbot:
```
https://friendbot.stellar.org/?addr=GBMB7FHFETLPXPIQXOV2VWBWK45UXPV62KAZK7JWINC3EV4BD6JUXZBZ
```

---

## 🎯 Future Scope
- **Real-time Marketplace**: Integration with local material suppliers for direct procurement.
- **BIM Export**: Export generated 3D models to standard architectural formats (IFC, DXF).
- **Soroban Full Integration**: Migrate from ManageData to full Soroban contract invocation with `invokeContractFunction` for richer on-chain audit records.
- **Multi-storey Support**: Stack floor plans with inter-floor structural dependency analysis.
