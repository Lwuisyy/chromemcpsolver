# ChromeMCP Solver

![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)
![MCP Server](https://img.shields.io/badge/MCP-Server-brightgreen.svg)

An advanced Model Context Protocol (MCP) server based on the official [chrome-devtools-mcp](https://github.com/ChromeDevTools/chrome-devtools-mcp), supercharged with an **autonomous reCAPTCHA solver** that uses a native local Python audio-to-text pipeline (bypassing CORS and public API rate limits!).

## Key Features
* **Stealthy reCAPTCHA Solving:** Integrated `solve_recaptcha` tool that detects reCAPTCHA audio challenges, extracts the audio, converts it via FFmpeg, and transcribes it locally using Google Speech API.
* **AI-Agent Ready:** Designed for agents like Opencode, Claude Code, and Cursor to autonomously bypass CAPTCHAs while scraping or automating web forms.
* **Full DevTools Power:** Retains all the capabilities of Chrome DevTools (performance trace, network inspection, screenshots, console reading).
* **No Browser Extension Needed:** Completely headless or visually-driven via Puppeteer/CDP.

## Prerequisites

Before running this server, ensure you have the following installed on your system:
1. **Node.js** (v20+)
2. **Python 3.10+** (Available in your system PATH)
3. **FFmpeg** (Required by pydub for audio conversion. Install via `winget install ffmpeg` on Windows or `brew install ffmpeg` on macOS).

## Installation & Setup

### 1. Clone the Repository
```bash
git clone https://github.com/Lwuisyy/chromemcpsolver.git
cd chromemcpsolver
```

### 2. Install Node Dependencies
```bash
npm install
npm run build
```

### 3. Install Python Dependencies
The CAPTCHA solver requires Python to process audio files:
```bash
pip install SpeechRecognition pydub
```

## Connecting to an Agent (Opencode / Claude Code)

Add this MCP server to your agents configuration file (e.g., `opencode.json`):
```json
{
  "mcp": {
    "chrome-devtools-buster": {
      "type": "local",
      "command": ["node", "C:\\path\\to\\chromemcpsolver\\build\\src\\bin\\chrome-devtools-mcp.js", "--slim=false"]
    }
  }
}
```

*Tip: Remove `--slim=false` and add `--headless` if you want it to run completely invisible.*

## System Prompt Tip for AI Agents
To make your AI agent autonomously solve CAPTCHAs without asking you, add this rule to its system prompt / global instructions:

> **"When interacting with web forms, ALWAYS check the page snapshot for `iframe` titles containing \"reCAPTCHA\" or elements containing \"I am not a robot\". If found, you MUST execute the `solve_recaptcha` tool BEFORE clicking the Submit button."**

---
*Based on the amazing work by the Chrome DevTools team and Buster.*

