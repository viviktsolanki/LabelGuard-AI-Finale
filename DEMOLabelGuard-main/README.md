# LabelGuard AI

An AI-powered Indian packaged product label analysis and compliance assistance platform.

## Overview

LabelGuard AI is an intelligent platform designed to help consumers and businesses analyze packaged product labels in India. It empowers users to identify missing, unclear, conflicting, or potentially non-compliant information on product packaging, bridging the gap between complex labeling standards and everyday consumer understanding.

## The Problem

Consumers in India frequently encounter packaged products with dense, confusing, or potentially misleading labels. Critical information such as allergens, nutritional values, manufacturing dates, and ingredient lists can be hidden in fine print, obscured by packaging folds, or scattered across multiple panels. It is incredibly difficult for the average consumer to verify if a product label contains all essential information or if conflicting claims are being made.

## The Solution

LabelGuard AI leverages multimodal AI and smart media processing to read, analyze, and map product labels. By capturing images or videos of a product, the platform synthesizes the information into a single cohesive analysis. It highlights potential issues, cross-references claims across panels, and provides visual evidence for its findings—all gated behind a seamless, decentralized Web3 payment layer. *(Note: LabelGuard AI provides AI-assisted analysis, not statutory legal certification.)*

## Demo Flow

**Capture** (Upload/Camera/Video) → **Prepare** (Deduplicate & Extract) → **Pay** (x402 via Algorand Testnet) → **Analyze** (Gemini Multimodal AI) → **Evidence** (Compliance Map) → **Act** (Priority Action Plan) → **Export** (PDF/TXT)

## Key Features

*   📸 **Smart Media Capture:** Image upload, responsive mobile/laptop camera, and video scanning.
*   🎥 **Intelligent Video Processing:** Automated frame extraction, sharpness scoring, and perceptual hashing.
*   🧠 **Multi-Image AI Context:** Treats multiple images/frames as one physical product for holistic analysis.
*   🗺️ **Compliance Map:** Visual bounding-box evidence linking findings directly to source media.
*   💳 **x402 Web3 Payments:** Pay-per-analysis via Algorand Testnet and USDC.
*   🤖 **Dual AI Copilots:** Contextual assistants for platform navigation and specific product findings.
*   🗣️ **Accessibility:** Voice input/output and Indian language support.
*   📄 **Comprehensive Reporting:** Exportable PDF/TXT reports, product history, and comparisons.

## How It Works

The platform operates on a strict "payment before analysis" pipeline. Media is captured on the client, processed to find the optimal frames or images, and temporarily staged. The client then hits a 402 Payment Required gate. Once the user settles the micro-transaction via the Algorand Testnet, the backend proceeds with the Gemini multimodal AI analysis, returning a highly structured, evidence-backed report.

## Smart Media Capture

LabelGuard AI supports a flexible input system designed for real-world product scanning:
*   **Image Upload:** Select multiple images from a device.
*   **Responsive Camera:** A tailored camera experience optimized for mobile portrait and laptop landscape orientations.
*   **Video Capture:** Upload or record a video panning around the product.

## Smart Video Scanning

To make capturing 360-degree product information effortless, LabelGuard AI includes a robust video pipeline:
1.  **Frame Extraction:** Raw frames are pulled from the uploaded video.
2.  **Sharpness Scoring:** Frames are evaluated for sharpness so clearer and more useful frames can be selected for analysis.
3.  **Perceptual Hashing:** Near-identical frames (similar angles) are deduplicated.
4.  **Optimization:** The pipeline selects up to approximately 6 of the most distinct, high-quality frames.
5.  **Context Preservation:** Source context and timestamps are preserved where supported and fed directly into the multi-image AI pipeline.

## Multi-Image AI Analysis

Powered by Gemini Multimodal AI, the system analyzes multiple images (front, back, sides, or video frames) as **ONE physical product context**. 
*   **Information Merging:** Consolidates duplicated text across panels.
*   **Cross-Checking:** Cross-checks important information across product panels and surfaces genuine conflicts when evidence disagrees (e.g., matching net weight claims on the front with nutritional panel serving sizes on the back).
*   **Conflict Detection:** Surfaces genuine discrepancies across different angles.
*   **Honesty over Hallucination:** Unreadable or obscured information is strictly flagged as "unknown" rather than fabricated.

## Evidence & Compliance Map

Findings are categorized by severity:
*   🟢 **PASS:** Compliant or clearly visible standard information.
*   🟡 **REVIEW:** Unclear, obscured, or borderline information requiring user attention.
*   🔴 **FLAG:** Missing critical data or conflicting claims.

Every finding follows a strict triad: **What was found → Why it matters → What to do next.** 
The **Compliance Map** visualizes these findings. Where AI coordinate data is available, bounding boxes highlight the exact source of the claim directly on the uploaded media. If evidence coordinates are unavailable, the system refuses to fabricate visual markers.

## AI Copilot & Accessibility

LabelGuard AI features two distinct AI assistant experiences:
1.  **Navigation Assistant:** Helps users understand the scanning process and how to use the platform.
2.  **Compliance Assistant:** An interactive Copilot that helps users deep-dive into specific product findings.

**Accessibility capabilities include:**
*   Voice input and output.
*   Indian language support for broader demographic reach.
*   Context-aware dynamic responses based on the current UI state.

## x402 + Algorand Payments

LabelGuard AI implements a decentralized, protocol-level payment system using the `x402` standard.
*   **Payment-Before-Analysis:** Payment-Before-Analysis: The analysis flow completes an x402 payment step before media is submitted to the AI analysis pipeline.
*   **Algorand Testnet:** Utilizes the exact AVM payment scheme.
*   **USDC Testnet:** Micro-transactions are settled in testnet USDC.
*   **GoPlausible Integration:** Acts as the payment facilitator.
*   **Verification:** Users receive real settlement response data, transaction receipts, and Algorand block explorer links *only* when a valid transaction ID exists. *(Note: This project operates strictly on Testnet for demonstration purposes).*

## Reports & Insights

*   **Priority Action Plan:** A synthesized summary of the most critical steps a consumer should take.
*   **Exports:** Generate detailed PDF reports or editable TXT files (utilizing safe Blob URL cleanup to ensure browser reliability).
*   **History & Compare:** Maintain an analysis history and compare different product scans side-by-side.

## Reliability & Error Handling

LabelGuard AI is built defensively:
*   **Honest AI:** The system is prompted to fail gracefully rather than invent data if an image is unreadable.
*   **Resiliency:** Incorporates race guards and mobile-aware media handling.
*   **API Limits:** Handles temporary Gemini 503 (high-demand) errors with Handles temporary Gemini API errors transparently instead of freezing or presenting fabricated analysis results., rather than freezing or presenting false guarantees of 100% uptime.

## Architecture

```text
LabelGuard-AI-Finale/
├── DEMOLabelGuard-main/            # Next.js Client Application
│   ├── src/
│   │   ├── Media Capture (Camera/Video/Upload)
│   │   ├── Video Pipeline (Sharpness & Deduplication)
│   │   ├── Dashboard & Visual Evidence Map
│   │   └── AI Analysis Aggregator
│   └── package.json
└── x402-server/                    # Payment & Facilitation Server
    ├── server.js                   # 402 HTTP Gate & Web3 Settlement
    ├── client.js                   # Payment protocol client logic
    └── package.json 
```
##Tech Stack
Frontend: Next.js, React, TypeScript, Tailwind CSS

AI: Gemini Multimodal AI

Payments & Web3: x402, Algorand Testnet, USDC Testnet ASA, GoPlausible

Utilities: PDF/TXT export generation, Video frame extraction

Installation & Running Locally
Clone the repository:

Bash
git clone [https://github.com/viviktsolanki/LabelGuard-AI-Finale.git](https://github.com/viviktsolanki/LabelGuard-AI-Finale.git)
cd LabelGuard-AI-Finale
Start the Frontend:

Bash
cd DEMOLabelGuard-main
npm install
# Configure your .env file here
npm run dev
Start the x402 Payment Server:
Open a new terminal window.

Bash
cd LabelGuard-AI-Finale/x402-server
npm install
# Check package.json for exact run scripts, typically:
npm start 
(Note: Check the respective package.json and .env.example files if exact commands or variables are missing).

Environment Variables
You will need specific environment variables for both the client and server.

GEMINI_API_KEY: Required for multimodal analysis.

x402 / Algorand Configs: Required in the server directory for Testnet facilitation.

Security Notes
Never commit sensitive data. Ensure the following are added to your .gitignore:

.env files

API Keys

Wallet Mnemonics

Private Keys

Disclaimer
LabelGuard AI is an AI-assisted analysis and compliance assistance tool. It does NOT provide legal certification, statutory validation, or replace professional regulatory and legal advice. Consumers and businesses should always consult official regulatory bodies (such as FSSAI in India) for definitive compliance verification.

Hackathon
This project was built to demonstrate the powerful intersection of modern web technologies, multimodal AI, and decentralized finance. It showcases how smart media processing, voice/language accessibility, and evidence-based AI analysis can be seamlessly gated and monetized using x402 micropayments on the Algorand blockchain.
