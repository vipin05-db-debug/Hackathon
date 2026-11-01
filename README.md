# Hackathon
# TRUSTLENS AI

### AI-Assisted Information Gap Detection Platform

**Hackathon:** Shinchan Online Hackathon 2026
**Challenge:** Digital Dark Spot
**Project Type:** AI-Powered Research & Information Investigation Platform

---

## 1. About the Project

TRUSTLENS AI is an AI-powered information investigation platform designed to help users explore information, analyze evidence, identify information gaps and understand conflicting or incomplete claims.

The platform combines conversational AI with research intelligence to make information investigation more accessible, transparent and useful.

Users can ask questions, investigate topics, submit URLs, upload PDF documents and images, and receive AI-assisted analysis.

## 2. Problem Statement

In today's digital world, information is available everywhere, but finding reliable, complete and meaningful information is still challenging.

Users often face:

* Incomplete information.
* Conflicting claims from different sources.
* Outdated information.
* Difficulty identifying missing evidence.
* Challenges understanding complex information.

## 3. Our Solution

TRUSTLENS AI aims to address these challenges through an AI-assisted investigation platform.

It helps users:

* Explore topics using AI.
* Investigate information.
* Analyze available evidence.
* Identify missing information.
* Highlight contradictions and uncertainty.
* Access relevant source references.

## 4. Key Features

* **AI Chat:** Ask questions and receive conversational AI responses.
* **Research Intelligence:** Investigate topics using available information sources.
* **Information Gap Detection:** Identify missing or unanswered information.
* **Evidence Analysis:** Examine supporting evidence and conflicting claims.
* **URL Investigation:** Submit web links for analysis.
* **PDF Analysis:** Upload PDF documents for investigation.
* **Image Analysis:** Submit supported images for AI-assisted analysis.
* **Multiple Domains:** Investigate topics across different subject areas.
* **Local Chat History:** Keep conversation history in the browser.

*Note: Feature availability depends on the current implementation and configured API services.*

## 5. Technology Stack

### Frontend

* React.js
* Vite
* JavaScript
* HTML5
* CSS3
* Tailwind CSS

### Backend

* Python 3.12
* FastAPI
* Uvicorn

### AI & Research Services

* Google Gemini API
* Tavily Search API

### Development Tools

* Visual Studio Code
* Git
* GitHub
* npm
* Python Virtual Environment

## 6. Project Folder Structure

```text
TRUSTLENS-AI/
│
├── backend/
│   ├── main.py
│   ├── prompts.py
│   ├── requirements.txt
│   └── .env.example
│
├── frontend/
│   ├── public/
│   │
│   ├── src/
│   │   ├── assets/
│   │   │   ├── shinchan.png
│   │   │   └── shinchan2.png
│   │   │
│   │   ├── components/
│   │   │   ├── Landing Page Components
│   │   │   └── Dashboard Components
│   │   │
│   │   ├── App.jsx
│   │   ├── App.css
│   │   ├── index.css
│   │   └── main.jsx
│   │
│   ├── index.html
│   ├── package.json
│   ├── package-lock.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── postcss.config.js
│
├── .gitignore
└── README.md
```

The `src/components/` directory contains the application's page components, including the landing page and dashboard. The `src/assets/` directory contains image assets used by the frontend.

*The structure above describes the main project files. Additional existing components and configuration files may also be present.*

## 7. Requirements

Before running the project, install:

* Python 3.12 or compatible version.
* Node.js (LTS recommended).
* npm.
* Git.
* A code editor such as Visual Studio Code.

Check your installations:

```bash
python --version
node --version
npm --version
git --version
```

## 8. Installation and Setup Guide

Follow these steps to run TRUSTLENS AI on your computer.

### Step 1: Clone the Repository

Open a terminal and execute:

```bash
git clone YOUR_GITHUB_REPOSITORY_URL
```

Enter the project directory:

```bash
cd TRUSTLENS-AI
```

Replace `YOUR_GITHUB_REPOSITORY_URL` with the actual GitHub repository URL.

### Step 2: Configure the Backend

Open a new terminal:

```bash
cd backend
```

Create a Python virtual environment:

```bash
python -m venv .venv
```

Activate it on Windows PowerShell:

```powershell
.venv\Scripts\Activate.ps1
```

On macOS/Linux:

```bash
source .venv/bin/activate
```

Install Python dependencies:

```bash
pip install -r requirements.txt
```

### Step 3: Configure Environment Variables

Create a file named `.env` inside the `backend/` directory.

Add your API credentials:

```env
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=your_available_gemini_model
TAVILY_API_KEY=your_tavily_api_key
```

Replace the placeholder values with your own API credentials.

**Important:** Never upload your actual `.env` file or API keys to GitHub.

### Step 4: Start the Backend Server

Make sure your terminal is inside the `backend/` directory and the virtual environment is activated.

Run:

```bash
uvicorn main:app --reload --port 8000
```

The backend should be available at:

```text
http://127.0.0.1:8000
```

API health check:

```text
http://127.0.0.1:8000/api/health
```

### Step 5: Configure the Frontend

Open a second terminal.

Navigate to the frontend:

```bash
cd frontend
```

Install frontend dependencies:

```bash
npm install
```

### Step 6: Start the Frontend

Run:

```bash
npm run dev
```

Vite will display the local development URL in your terminal. Open that URL in your browser.

The frontend communicates with the backend running on port 8000.

## 9. Running Both Servers

You must keep two terminals running.

| Terminal   | Directory   | Command                                 |
| ---------- | ----------- | --------------------------------------- |
| Terminal 1 | `backend/`  | `uvicorn main:app --reload --port 8000` |
| Terminal 2 | `frontend/` | `npm run dev`                           |

Do not close either terminal while using the local development application.

## 10. Environment Variables

The project uses API credentials for its AI and search services.

| Variable         | Purpose                             |
| ---------------- | ----------------------------------- |
| `GEMINI_API_KEY` | Google Gemini API authentication    |
| `GEMINI_MODEL`   | Selects the configured Gemini model |
| `TAVILY_API_KEY` | Tavily search API authentication    |

Each developer must configure their own API credentials.

## 11. Screenshots

Screenshots of the TRUSTLENS AI interface and application workflow will be added here.

<!-- Add screenshots below when available. -->

## 12. Future Improvements

* Enhanced evidence analysis.
* Improved information gap detection.
* Additional research integrations.
* Better source comparison.
* Expanded document investigation.
* Improved AI investigation workflows.

## 13. Hackathon Information

**Event:** Shinchan Online Hackathon 2026

**Challenge:** Digital Dark Spot – AI-Assisted Information Gap Detection Platform

**Project:** TRUSTLENS AI

**GitHub Repository:** Add your public repository URL here.

**Team Name:** Add your registered team name here.

**Team Members:** Add the registered participant details here.

## 14. License

Developed as a hackathon project for Shinchan Online Hackathon 2026.
