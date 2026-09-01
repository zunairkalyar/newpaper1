# E-Paper Master - Pakistan News PDF & Watermark Engine

An automated system and web dashboard for downloading, processing, watermarking, and packaging daily Pakistani newspaper e-papers into high-quality PDFs and zip bundles.

## 🌟 Features

- **Multi-Paper Support**:
  - The News International (Karachi, Lahore, Islamabad)
  - Pakistan Observer
  - Daily Lead Pakistan
  - Daily Jang (Lahore, Karachi, Rawalpindi)
  - Daily Express (Islamabad, Lahore)
  - Daily Ausaf (Islamabad)
  - Daily Aaj (Peshawar)
  - Daily Ibrat (Hyderabad)
- **High Resolution PDFs**: Downloads page images and combines them into standard PDF files.
- **Custom Watermarking**: Automatically applies custom header and footer branding with custom font styles and contact details.
- **Web UI & SSE Real-time Logs**: Visual dashboard with real-time download and processing status.
- **One-Click Batch Download**: Download all processed newspapers for any selected date in a single ZIP package.

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v16 or newer)

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/zunairkalyar/newpaperpk.git
   cd newpaperpk
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the application:
   - On Windows: Double-click `START_APP.bat` or run:
     ```bash
     node server.js
     ```
   - Open [http://localhost:3000](http://localhost:3000) in your web browser.

## 📁 Project Structure

```
├── public/                 # Web interface (HTML, CSS, JS)
├── scrapers/               # Newspaper scrapers and catalog
├── services/               # PDF assembly and watermarking engine
├── laravel_version/        # Laravel integration assets
├── server.js               # Express API and SSE stream server
├── START_APP.bat           # Quick launcher script
└── package.json            # Project dependencies and metadata
```
