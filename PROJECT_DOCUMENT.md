# HyperDo — Project Description Document

> **Tagline**: *"Traditional apps just remind you; HyperDo actually executes for you."*

---

## 1. Problem Statement Selected

### The Gap Between Intention and Action
In our fast-paced digital lives, productivity tools have largely remained passive registries. Conventional to-do lists, reminder calendars, and note-taking applications act as static repositories of human intent. They require manual upkeep, constant reorganization, and crucial execution steps that are ultimately left entirely to the user. 

### Core Pain Points
1. **The Cognitive "Second Step" Friction**: When a task manager reminds you to *"Email Sarah about the quarterly budget,"* the user still has to stop what they are doing, open their email client, find Sarah's email address, recall the context, type the body, and click send. This second step is where procrastination thrives.
2. **Context-Switching Fatigue**: Moving between calendar apps, email clients, coding sandboxes, and chore planners fractures focus and drains mental energy.
3. **Accessibility and Speed Barriers**: Operating standard visual interfaces requires precise mouse control, heavy keyboard input, or multi-screen navigation, making rapid task capture slow and cumbersome. Traditional voice assistants are often unreliable, lack deep context, or fail to gracefully handle browser-specific restrictions (e.g., Firefox's lack of native speech APIs or iframe security limits).

HyperDo was created to solve this friction by shifting the paradigm from **reminding** to **executing**.

---

## 2. Solution Overview

### Defining HyperDo
**HyperDo** is a high-performance, intelligent execution engine that turns conversational voice commands and text instructions into concrete, fully realized digital actions. Instead of simply recording a task, HyperDo parses natural language, plans the execution pipeline, and either executes it directly or compiles pristine draft payloads ready for immediate deployment.

```
┌────────────────────────┐      ┌───────────────────────────┐      ┌─────────────────────────┐
│ Conversational Input   │ ───> │  HyperDo AI Brain (Gemini)│ ───> │ Actionable Execution   │
│ (Speech, Text, Assist) │      │  Parser, Planner, Router  │      │ (Email, Calendar, Code) │
└────────────────────────┘      └───────────────────────────┘      └─────────────────────────┘
```

### The Architectural Vision
HyperDo is designed around a single-screen, clutter-free **Bento Dashboard** containing an integrated command interface and high-fidelity output widgets. The system leverages state-of-the-art Generative AI to understand natural language intent, automatically categorizing commands, establishing scheduling patterns, drafting rich text, or constructing functional software code in real-time.

---

## 3. Key Features

### 🎙️ Multi-Channel Input & Voice Engine
*   **Adaptive Speech-to-Text**: Captures spoken instructions natively with Web Speech API support.
*   **Robust Fallback & Sandbox Resilience**: Gracefully detects browser-specific constraints (e.g., Firefox Web Speech limitations or iframe sandboxing) and seamlessly transitions to an **Adaptive Simulated Vocal Fallback** model, ensuring zero interruption in the user experience.
*   **Prompt-Free Natural Language Processing**: Accepts unstructured, organic conversational speech, identifying parameters like deadlines, categories, recipient emails, and task details without forcing rigid syntax.

### 📅 Smart Calendar & Micro-Scheduling
*   **Automatic Block Creation**: Schedules tasks into structured time-blocks in the interactive calendar grid.
*   **Dynamic Agenda Allocation**: Visualizes scheduled items with clean, high-contrast, color-coded categories.
*   **Real-Time Reminders**: Includes an active background scheduler that monitors current system time to trigger immediate screen alerts and alarms when scheduled block deadlines arrive.

### ✉️ Intelligent Email Execution
*   **Dynamic Link Synthesis**: Drafts high-fidelity, comprehensive emails based on conversational briefs.
*   **Device-Aware Email Routing**: Intelligently detects user devices (mobile touch vs. desktop) and preferences, choosing the optimal delivery path:
    *   *Desktop / Web Preferential*: Connects directly to pre-populated **Gmail link templates** to maintain workflow continuity in browser tabs.
    *   *Mobile Preferential*: Automatically switches to direct native **`mailto:` URI protocols** without opening blank browser pages, bringing up native mail clients instantly.

### 💻 Live Sandbox Code Generation
*   **AI Developer Engine**: Translates requests for scripts or code templates into fully articulated, syntactically correct software structures (HTML, CSS, JS, Python, Bash, etc.).
*   **Interactive Code Sandbox**: Features an inline preview component that lets users view, copy, and run sandbox simulations directly within the UI.

### 🔄 Habit Tracking & Persistent State
*   **Daily Progression Matrix**: Tracks continuous routines and streak patterns with an elegant checkbox interface.
*   **Local & Cloud Synchrony**: Syncs task lists, calendars, and streaks locally and integrates with persistent cloud storages to prevent loss of progress.

---

## 4. Technologies Used

HyperDo is engineered on a modern, robust, and highly optimized full-stack JavaScript/TypeScript framework:

*   **Frontend Framework**: **Next.js 15+ (App Router)** leveraging React Server Components (RSC) to maximize performance and ensure fast initial paint times.
*   **Styling Engine**: **Tailwind CSS v4** utilizing an elegant, minimalistic layout centered around deep charcoal grays, stark off-whites, and vivid accent indicators for high contrast and visual clarity.
*   **Animation Engine**: **Framer Motion** (via `motion/react`) for smooth, micro-animated route transitions, card entering states, and real-time voice waveform visualizations.
*   **Core Logic**: **TypeScript** with complete strict type safety, utilizing standard enum structures, explicit type declarations, and modular handler design.
*   **State Management**: Optimized React Hook synchronization (`useState`, `useEffect`, `useRef`) structured to prevent infinite re-renders and guarantee responsiveness.
*   **Icons**: **Lucide React** for clean, uniform vector visuals throughout the dashboard.

---

## 5. Google Technologies Utilized

HyperDo leans heavily into the Google Ecosystem to achieve high-performance intelligent orchestration and seamless cloud integration:

### 🧠 Gemini API & `@google/genai` SDK
At the core of HyperDo's intelligence is a custom server-side routing layer powered by the new official **Google GenAI SDK**:
*   **Intelligent Intent Parsing**: Resolves complex commands into structured JSON objects specifying action categories, recipient emails, drafted content, code snippets, priority, and dates.
*   **Adaptive Model-Shifting Architecture**: Utilizes an automated retry and failover system across models to guarantee service stability during API rate-limiting or high-demand spikes:
    *   *Primary*: **`gemini-3.5-flash`** for ultra-fast, high-reasoning, low-latency execution drafts.
    *   *Secondary Failover*: **`gemini-3.1-flash-lite`** to maintain execution continuity.
    *   *Tertiary Backup*: **`gemini-flash-latest`** with exponential backoff timers.

### 🗄️ Google Firestore DB
*   Provides durable cloud-hosted storage for tasks, agendas, streaks, and user logs.
*   Maintains consistent state so the application's timeline, task history, and logs survive browser cache wipes.

### 📧 Google Gmail & Workspace Deep Linking
*   Constructs pre-filled, securely formatted workspace actions that integrate directly with users' G Suite and personal Gmail portals.
*   Ensures that drafting tasks, project updates, and meeting summaries can be dispatched into production with a single click.
