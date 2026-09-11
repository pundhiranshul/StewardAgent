<div align="center">
  <img src="frontend/public/logo.png" alt="Steward Icon" width="100" />
  <h1>STEWARD® Growth Signal Agent</h1>
  <p><strong>Autonomously uncover hidden revenue leaks and generate academic-grade growth reports.</strong></p>
  
  <p>
    <img src="https://img.shields.io/badge/Next.js-15+-black?style=for-the-badge&logo=next.js" alt="Next.js" />
    <img src="https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI" />
    <img src="https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python" />
    <img src="https://img.shields.io/badge/LangChain-121212?style=for-the-badge&logo=chainlink&logoColor=white" alt="Langchain" />
  </p>
</div>

<br/>

Steward Growth Signal Agent is a powerful, AI-driven application designed to analyze companies by processing web data, app reviews, and target URLs. Using an orchestrated LangChain agent, it autonomously scours the internet to generate deeply cited, beautifully formatted growth intelligence reports.

Built by **Steward Agency**, this tool represents a modern approach to competitive analysis and growth hacking.

---

## ✨ Features

- 🧠 **Autonomous Research Agent**: Provide a target URL, and the LangChain-powered Python backend will autonomously navigate, scrape, and synthesize findings using tools like Tavily.
- 🎨 **Beautiful Web Interface**: A premium Next.js 15+ interface with dynamic dark mode, real-time agent activity streaming, and markdown parsing.
- 💬 **Contextual Follow-up Chat**: Highlight any part of the generated report to instantly ask the agent follow-up questions about that specific text.
- 📄 **PDF Export**: Print-optimized CSS ensures that generated reports can be exported to stunning, professional-grade PDFs with a single click.
- 🛡️ **Rate Limit Resilience**: Built-in exponential backoff, intelligent chunking, and API key rotation to handle massive token limits effortlessly.

---

## 🏗️ Architecture

Steward is built as a modern monorepo separating the user interface and the AI orchestration:

* **Frontend (`/frontend`)**: Next.js (React 19), Tailwind CSS v4, Lucide Icons, and `next-themes` for intelligent dark mode.
* **Backend (`/backend`)**: FastAPI, LangChain, Tavily Search, ChromaDB, and Groq (LLM).

---

## 🚀 Getting Started

### Prerequisites
* Node.js v18+
* Python 3.10+
* API Keys for Groq and Tavily

### 1. Clone & Install
Clone the repository to your local machine:
```bash
git clone https://github.com/pundhiranshul/StewardAgent.git
cd StewardAgent
```

Install the root concurrent dependencies:
```bash
npm install
```

### 2. Backend Setup
Set up your Python virtual environment and configure your environment variables.
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Create a `.env` file in the `backend/` directory:
```env
GROQ_API_KEYS=your_groq_key_1,your_groq_key_2
TAVILY_API_KEY=your_tavily_key
```

### 3. Frontend Setup
Install the Next.js dependencies:
```bash
cd ../frontend
npm install
```

### 4. Run the Application
From the **root** of the repository (`StewardAgent/`), start both the frontend and backend servers simultaneously:
```bash
npm run dev
```
The application will be live at [http://localhost:3000](http://localhost:3000).

---

## ⚖️ License

This project is licensed under the **PolyForm Noncommercial License 1.0.0**. 

You are free to view, learn from, and modify this source code for personal, educational, or evaluation purposes. **However, you may not use, distribute, or modify this software for any commercial purposes (such as selling reports, hosting as a paid SaaS, or internal corporate use) without explicit permission.**

See the [LICENSE](LICENSE) file for the full legal terms.
