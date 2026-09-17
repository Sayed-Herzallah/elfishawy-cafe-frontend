# ☕ El-Fishawy Cafe — Smart POS & Management System

> Modern, robust, and offline-first Point of Sale (POS), Inventory, and Order Management System designed specifically for **El-Fishawy Cafe**. Operates seamlessly across both web and desktop environments from a single unified codebase.

[![Version](https://img.shields.io/badge/version-1.1.0-blue.svg)](package.json)
[![React](https://img.shields.io/badge/React-19-61dafb.svg?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178c6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6-646cff.svg?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Electron](https://img.shields.io/badge/Electron-Desktop-47848f.svg?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4-38bdf8.svg?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)

---

## 🌟 Key Features

- **⚡ Single Source of Truth Architecture:**
  - One unified React codebase serving both the public web platform (hosted on Vercel) and the standalone desktop app (powered by Electron).
  - Instant live updates during development without manual copying, rebuilds, or dual-repository maintenance.

- **🛡️ True Offline-First Operation:**
  - Embedded local **SQLite database** encrypted at rest using hardware-protected **AES-256-GCM**.
  - Cashiers can create orders, register expenses, and record inventory restocking without an internet connection.
  - Cryptographically hash-chained background synchronization queue automatically reconciles all transactions with the cloud database (MongoDB) as soon as network connectivity is restored.

- **🔄 Silent Auto-Update System (Vercel-Tracked):**
  - Production desktop installations continuously track the latest live frontend build published on Vercel.
  - Downloads and applies frontend updates silently in the background with zero downtime and automatic atomic rollback on failure.

- **📅 Automated Daily Orders Lifecycle:**
  - Real-time cashier order tracker dedicated to the active business day.
  - Automatically rolls over to a clean, fresh slate every night at 12:00 AM (midnight).
  - All historical records remain permanently stored in the local SQLite database and cloud MongoDB, fully accessible and searchable anytime in the **Admin Sales Archive** with date filters, export options (PDF/CSV), and financial KPIs.

- **🖨️ Precision Thermal Printing (80mm):**
  - Self-contained zero-external-dependency receipt rendering engine with millimeter precision.
  - Prevents clipped footers, unwanted trailing blank pages, and driver margin inconsistencies.

- **📦 Dynamic Recipe Deduction Engine:**
  - Automatically calculates ingredient consumption and deducts from raw inventory in real time upon order checkout.

---

## 🛠 Tech Stack

| Domain | Technologies |
| :--- | :--- |
| **Frontend Framework** | React 19, TypeScript, Vite 6, React Router DOM |
| **Styling & Icons** | Tailwind CSS v4, Lucide React, Motion |
| **Desktop Shell** | Electron, Context Isolation, Node.js Crypto, Preload Bridge |
| **Local Database** | Encrypted SQLite (`sql.js`) with rolling backup mechanism |
| **Export & Reporting** | HTML2Canvas Pro, jsPDF |
| **Backend & Cloud** | Node.js, Express, MongoDB Atlas, Vercel |

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18.0.0 or higher)
- [npm](https://www.npmjs.com/) (v9.0.0 or higher)

### Installation
Clone the repository and install all dependencies:
```bash
git clone https://github.com/Sayed-Herzallah/elfishawy_Cafe_Front-End.git
cd elfishawy_Cafe_Front-End
npm install
```

---

## 💻 Development Workflow

### Web Platform Only
Run the Vite development server with local proxy:
```bash
npm run dev
```
Access the app in your browser at: `http://localhost:3000`

### Desktop Application with Live Hot Reload
Launch Electron directly connected to the Vite development server:
```bash
npm run desktop:dev
```
Any change made in `src/` immediately updates the desktop application UI without reloading or restarting.

---

## 📦 Building for Production

### 1. Build Web Assets
```bash
npm run build
```

### 2. Build Electron Bundle (Relative Path Assets)
```bash
npm run build:electron
```

### 3. Generate Windows Installer (`.exe`)
```bash
npm run dist:win
```
The setup package will be generated under the `release/` directory:
`release/ElFishawy Cafe Setup.exe`

---

## 📂 Project Structure

```text
├── desktop/                  # Electron main process & desktop integrations
│   ├── main/
│   │   ├── main.js           # Electron window lifecycle & entry point
│   │   ├── db.js             # Encrypted local SQLite engine
│   │   ├── sync.js           # Background sync queue & cloud reconciler
│   │   ├── ipc.js            # IPC handlers for offline operations
│   │   └── frontendUpdater.js# Silent frontend hot-updater
│   └── preload/
│       └── preload.cjs       # Secure context bridge API
├── src/                      # Unified React frontend application
│   ├── components/           # Reusable UI components & modals
│   ├── contexts/             # Auth and notification state providers
│   ├── pages/                # Application views (POS, Tracker, Admin, Inventory)
│   ├── routes/               # Role-based route definitions
│   ├── services/             # API client, offline store & sync triggers
│   └── utils/                # Date/number formatters, PDF/CSV exporters
└── scripts/                  # Build manifests & update generation scripts
```

---

## 📄 License & Attribution

All rights reserved © 2026 **El-Fishawy Cafe**. Developed by [Sayed Herzallah](https://github.com/Sayed-Herzallah).
