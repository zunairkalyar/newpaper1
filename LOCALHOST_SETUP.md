# Localhost Setup & Installation Guide - Newspaper Master System

This guide provides full instructions to run the entire **Newspaper Master (E-Paper & PDF Engine)** locally on your PC (Windows, macOS, or Linux).

---

## 📋 System Prerequisites

| Tool | Version | Required For |
|---|---|---|
| **Node.js** | v18.x or v20.x+ (LTS) | Core backend, Express API, Scrapers, Web UI |
| **Python** | 3.10, 3.11, or 3.12 | Passport AI engine (`rembg`, `cv2`) and dynamic e-paper slot finders |
| **qpdf** *(Optional but recommended)* | Any recent | Fast background PDF linearization & stream repair |
| **poppler** *(Optional but recommended)* | Any recent | Instant PDF Page-1 thumbnail generation (`pdftoppm`, `pdfinfo`) |

---

## ⚡ Quick 1-Click Setup (Windows)

1. Clone or download your repository:
   ```cmd
   git clone https://github.com/zunairkalyar/newpaper1.git
   cd newpaper1
   ```
2. Double-click **`setup_localhost.bat`**.  
   *It will automatically install Node dependencies, create the Python `venv`, install Python requirements, and set up the folder structure.*
3. Double-click **`START_APP.bat`** (or run `npm start`).
4. The application will automatically open in your browser at:  
   👉 **`http://localhost:3012`**

---

## 🛠️ Manual Step-by-Step Installation

### Step 1: Install Node.js Dependencies
Open your terminal in the project directory:
```bash
npm install
```

### Step 2: Set up Python Virtual Environment (for AI & Scrapers)
#### Windows (PowerShell / Command Prompt):
```cmd
python -m venv venv
venv\Scripts\pip install -r requirements.txt
```

#### macOS / Linux:
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Step 3: Install Optional System Tools (qpdf & poppler)
These optimize PDFs and generate page-1 preview thumbnails:
- **Windows**:
  - Using Winget:
    ```cmd
    winget install qpdf
    ```
  - Or download Poppler for Windows (add its `bin/` folder to PATH).
- **macOS** (Homebrew):
  ```bash
  brew install qpdf poppler
  ```
- **Ubuntu / Debian Linux**:
  ```bash
  sudo apt-get update && sudo apt-get install -y qpdf poppler-utils
  ```

---

## 🔑 Keys & Configuration

### 1. Telegram Channel Sync (Optional)
If you use the Telegram newspaper downloader feature:
1. Copy `config/telegram.json.example` to `config/telegram.json`:
   ```bash
   cp config/telegram.json.example config/telegram.json
   ```
2. Configure your keys:
   ```json
   {
     "channelId": "1154495545",
     "chatId": "-1001154495545",
     "channelUsername": "@YourChannelName",
     "botToken": "YOUR_TELEGRAM_BOT_TOKEN_FROM_BOTFATHER",
     "lastSync": null,
     "autoSync": false,
     "lastUpdateId": 0
   }
   ```
*(You can also configure this directly inside the web UI under the Telegram Sync tab).*

### 2. Paid API Keys
- **None required!**  
  All scrapers, PDF compilers, and AI passport background removal models run **100% locally and free** on your machine.

---

## 🚀 Running the Application

```bash
npm start
```
Then visit **`http://localhost:3012`** in any web browser.

---

## 🎯 Features Included on Localhost
- **Newspaper Hub**: All Pakistani broadsheet newspapers (Dawn, The News, Express, Jang, Dunya, Ausaf, Nai Baat, etc.).
- **Khaliq Columns & Special Papers**: Column collections and regional editions.
- **Arab & Middle East Newspapers**: Full catalog from Qatar, UAE, Saudi Arabia, Oman, Bahrain, Kuwait.
- **Indian Newspapers**: Automated catalog and downloads.
- **Foreign Newspapers & Global Magazines**: International papers and magazines with catalog search.
- **Bulk Custom PDF Watermark Stamper**: High-speed branding, custom promo covers, and header/footer stampers.
- **Passport AI Photo Maker**: Local neural background removal and photo generation.
- **Telegram Downloader**: Channel sync and automated PDF collector.
