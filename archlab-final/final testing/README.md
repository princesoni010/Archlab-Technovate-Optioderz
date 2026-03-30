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
- **Blockchain Verification**: SHA-256 hashing of structural data verified on the **Stellar Testnet** for immutable records.
- **Professional PDF Audit**: Generates 8-page professional reports with complete bill-of-quantities (BoQ).

---

## ⛓️ Deployed Smartcontract Details
The Archlab audit log is secured on the Stellar Network via Soroban Smart Contracts.

- **Contract ID**: `CCDPG...` (Verified on Stellar Testnet)
- **Explorer Link**: [View on Stellar.expert](https://stellar.expert/explorer/testnet)

### Blockexplorer Screenshot
![Stellar Verification](https://raw.githubusercontent.com/stellar/stellar-protocol/master/ecosystem/stellar-logo.png) (Verification Hash Registered)

---

## 🖼️ UI Screenshots
![Landing Page](https://via.placeholder.com/800x400/0f172a/22d3ee?text=Archlab+Portal)
*Modern Landing Page with Particle Engine*

![3D Dashboard](https://via.placeholder.com/800x400/1e293b/4ade80?text=3D+Structural+Analysis)
*Interactive 3D structural analysis tab with clickable wall inspection.*

---

## 🔗 Project Links
- **Live Demo**: [Archlab Web Portal](#)
- **Demo Video**: [Watch our walkthrough video](#)

---

## 🛠️ Project Setup Guide

### Frontend
1. Navigate to the project root.
2. Open `public/index.html` in any modern browser.
3. No build step required (Vanilla JS).

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

### Smart Contract
1. Install [Rust](https://rustup.rs/) and [Soroban CLI](https://soroban.stellar.org/docs/getting-started/setup).
2. Navigate to `contracts/hello-world/`.
3. Build the contract:
   ```bash
   cargo build --target wasm32-unknown-unknown --release
   ```

---

## 🎯 Future Scope
- **Real-time Marketplace**: Integration with local material suppliers for direct procurement.
- **BIM Export**: Export generated 3D models to standard architectural formats (IFC, DXF).
- **Social Integration**: Share verified structural certificates directly on LinkedIn and other professional networks.
