import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

// Dynamic response interfaces
export interface ExecutionPayload {
  actionType: "email" | "summary" | "calendar" | "code" | "draft" | "general";
  thoughtProcess: string[];
  executionLogs: string[];
  payload: {
    title?: string;
    // Email payload
    to?: string;
    subject?: string;
    body?: string;
    // Summary payload
    summaryPoints?: string[];
    keyTakeaways?: string[];
    // Calendar payload
    start?: string;
    end?: string;
    description?: string;
    tags?: string[];
    // Code payload
    language?: string;
    code?: string;
    explanation?: string;
    // Draft / General payload
    content?: string;
    wordCount?: number;
  };
  recommendations: string[];
}

export async function POST(req: NextRequest) {
  let promptStr = "Auto execute task";
  let contextObj: any = null;

  try {
    // Gracefully parse body if present
    const body = await req.json().catch(() => ({}));
    promptStr = body.prompt || promptStr;
    contextObj = body.context || contextObj;

    if (!promptStr || typeof promptStr !== "string") {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    // If API Key is missing or default, run the highly intelligent deterministic simulation.
    if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey.trim() === "") {
      const simulatedResult = getSimulatedExecution(promptStr, contextObj);
      return NextResponse.json({
        ...simulatedResult,
        isSimulated: true,
      });
    }

    // Initialize the official Google GenAI SDK (server-side only) with telemetry user-agent
    const ai = new GoogleGenAI({ 
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    // Build the orchestration instructions
    const systemInstruction = `
You are the HyperDo Execution Engine, an autonomous agent that translates natural language requests into concrete actions.
Traditional apps just remind users; HyperDo actually executes for them.

Analyze the user's prompt: "${promptStr}".
Context provided: ${JSON.stringify(contextObj || {})}

Classify the command into one of these categories:
- 'email': Writing and sending emails, messages, or drafts.
- 'summary': Summarizing text, articles, or web links.
- 'calendar': Scheduling blocks of time, booking meetings, calendar optimization.
- 'code': Writing scripts, markup, components, formulas, or programming utilities.
- 'draft': Creating document templates, reports, marketing copy, or long-form posts.
- 'general': Any other active task execution.

You must respond with a strictly formatted JSON object matching the following structure. Do not output markdown other than the JSON object itself.
Structure:
{
  "actionType": "email" | "summary" | "calendar" | "code" | "draft" | "general",
  "thoughtProcess": [
    "Step 1 of thinking...",
    "Step 2 of thinking..."
  ],
  "executionLogs": [
    "Technical log line 1 (e.g., SMTP socket open)",
    "Technical log line 2"
  ],
  "payload": {
    "title": "A short descriptive name of what was executed",
    // IF email:
    "to": "Recipient email or default address",
    "subject": "Email subject",
    "body": "Full body content of the email",
    // IF summary:
    "summaryPoints": ["Bullet 1 summarizing...", "Bullet 2..."],
    "keyTakeaways": ["Key takeaway 1", "Key takeaway 2"],
    // IF calendar:
    "start": "HH:MM format for today/tomorrow",
    "end": "HH:MM format for today/tomorrow",
    "description": "Calendar event details",
    "tags": ["Focus", "Meeting", "Design", etc.],
    // IF code:
    "language": "python" | "javascript" | "html" | "css" | "typescript" | "sql",
    "code": "Actual compilable or renderable code block",
    "explanation": "Brief explanation of what the code does",
    // IF draft or general:
    "content": "Fully written document draft, template text, or executive summary",
    "wordCount": 120
  },
  "recommendations": [
    "Proactive next action recommendation 1",
    "Proactive next action recommendation 2"
  ]
}

Be realistic, professional, and thorough. Write high-quality, fully populated drafts instead of placeholders. No lazy code; write actual code.
`;

    // Robust execution wrapper with retry, model-shifting, and exponential backoff
    let response;
    let attempts = 0;
    const maxAttempts = 3;
    let lastError: any = null;
    let modelToUse = "gemini-3.5-flash";

    while (attempts < maxAttempts) {
      try {
        response = await ai.models.generateContent({
          model: modelToUse,
          contents: promptStr,
          config: {
            systemInstruction: systemInstruction,
            responseMimeType: "application/json",
          },
        });
        // Success, break out!
        break;
      } catch (err: any) {
        lastError = err;
        attempts++;
        console.warn(`[Gemini API Warning] Attempt ${attempts} with ${modelToUse} failed. Error:`, err);
        
        if (attempts < maxAttempts) {
          // Shift models progressively to maximize success rate during demand spikes
          if (attempts === 1) {
            modelToUse = "gemini-3.1-flash-lite";
            // Wait 800ms on first backoff
            await new Promise(resolve => setTimeout(resolve, 800));
          } else if (attempts === 2) {
            modelToUse = "gemini-flash-latest";
            // Wait 1500ms on second backoff
            await new Promise(resolve => setTimeout(resolve, 1500));
          }
        }
      }
    }

    if (!response) {
      throw lastError || new Error("Failed to generate content after retries");
    }

    const text = response.text;
    if (!text) {
      throw new Error("Empty response from Gemini API");
    }

    const parsedResult = JSON.parse(text) as ExecutionPayload;
    return NextResponse.json({
      ...parsedResult,
      isSimulated: false,
    });

  } catch (error: any) {
    console.error("HyperDo API Error:", error);
    // Gracefully fallback to simulation if Gemini fails or parses incorrectly (e.g., 503 high demand)
    const simulatedFallback = getSimulatedExecution(promptStr, contextObj);
    return NextResponse.json({
      ...simulatedFallback,
      isSimulated: true,
      errorDetails: error?.message || "Internal parsing/connection error",
    });
  }
}

/**
 * Intelligent deterministic simulation of task execution
 * Matches keywords to provide an ultra-realistic interactive feel
 */
function getSimulatedExecution(prompt: string, context?: any): ExecutionPayload {
  const cleanPrompt = prompt.toLowerCase().trim();

  // 1. EMAIL MATCHING
  if (
    cleanPrompt.includes("email") ||
    cleanPrompt.includes("message") ||
    cleanPrompt.includes("send") ||
    cleanPrompt.includes("mail") ||
    cleanPrompt.includes("write to") ||
    cleanPrompt.includes("contact")
  ) {
    let to = "investors@hyperdo.ai";
    let subject = "HyperDo Weekly Milestones & Autonomous Performance";
    let recipientName = "Investor Relations";

    if (cleanPrompt.includes("john")) {
      to = "john.doe@acme.com";
      subject = "Acme Project Deliverables Confirmation";
      recipientName = "John";
    } else if (cleanPrompt.includes("boss") || cleanPrompt.includes("manager") || cleanPrompt.includes("weekly update")) {
      to = "sarah.lead@corporation.com";
      subject = "HyperDo Executive Integration & Progress Summary";
      recipientName = "Sarah";
    }

    return {
      actionType: "email",
      thoughtProcess: [
        "Analyzing intent: Compile and execute formal communication outreach.",
        `Target recipient parsed as: ${recipientName} (${to})`,
        "Drafting responsive email utilizing a professional, persuasive, concise layout.",
        "Validating message structure, anti-spam heuristics, and action points.",
        "Preparing mock SMTP dispatch pipeline."
      ],
      executionLogs: [
        `[Agent] Initialized email compiler for recipient: ${to}`,
        "[Agent] Applying context constraints: 'Action-driven, no filler text'",
        "[System] SMTP Server: relay.hyperdo.internal:587",
        "[System] TLS handshake complete. Port authorized.",
        "[System] Draft formatted and staged successfully in Queue-A."
      ],
      payload: {
        title: `Drafted Email to ${recipientName}`,
        to: to,
        subject: subject,
        body: `Hi ${recipientName},\n\nI hope you are doing well.\n\nI'm writing to share our progress on the active deliverables. The HyperDo Execution Engine has completed its initial calibration, achieving a 94% task automation index this week. \n\nKey accomplishments:\n- Formulated dynamic Bento Grid system dashboard.\n- Automated the server-side API proxy utilizing Google GenAI SDK.\n- Implemented localized backup logic ensuring 100% operational uptime.\n\nPlease let me know your thoughts on scheduling a brief check-in tomorrow to review the live sandbox.\n\nBest regards,\nSamarth (HyperDo Executed)`,
      },
      recommendations: [
        "Track email read-receipts and flag for follow-up if unreplied in 24 hours.",
        "Automatically block out 15 minutes on calendar before the check-in."
      ]
    };
  }

  // 2. CALENDAR MATCHING
  if (
    cleanPrompt.includes("schedule") ||
    cleanPrompt.includes("calendar") ||
    cleanPrompt.includes("book") ||
    cleanPrompt.includes("time block") ||
    cleanPrompt.includes("meeting") ||
    cleanPrompt.includes("slot") ||
    cleanPrompt.includes("plan my day")
  ) {
    let title = "Focus Deep Work Session";
    let start = "10:00";
    let end = "12:30";
    let description = "Uninterrupted block for high-agency code execution and architecture design. Notifications silenced.";
    let tags = ["Deep Work", "Code"];

    if (cleanPrompt.includes("lunch")) {
      title = "Power Lunch & Network Sync";
      start = "12:30";
      end = "13:30";
      description = "Quick meal break combined with reading tech journals or catching up on notifications.";
      tags = ["Health", "Sync"];
    } else if (cleanPrompt.includes("standup") || cleanPrompt.includes("review")) {
      title = "Team Daily Standup";
      start = "09:00";
      end = "09:30";
      description = "Coordinate blocking issues, align on daily sprint targets, and synchronize code merges.";
      tags = ["Collaboration", "Sprint"];
    } else if (cleanPrompt.includes("workout") || cleanPrompt.includes("gym")) {
      title = "Gym - Cardio & Strength HIIT";
      start = "17:00";
      end = "18:00";
      description = "Daily physical recharge. Silent all business notifications.";
      tags = ["Habit", "Health"];
    }

    return {
      actionType: "calendar",
      thoughtProcess: [
        "Analyzing chronological constraints from input prompt.",
        `Identified event target: '${title}' (${start} - ${end})`,
        "Scanning current calendar database for slot conflicts...",
        "No conflicting bookings detected in that bracket.",
        "Applying pre-emptive deep-focus buffers before and after slot."
      ],
      executionLogs: [
        "[Agent] Retrieving local user calendar profile...",
        `[Agent] Inserting item: '${title}' starting at ${start}`,
        "[System] Scheduling API write-stream initiated.",
        "[System] Local calendar DB updated. Synchronization complete.",
        "[System] Silent-mode automation token generated for mobile client."
      ],
      payload: {
        title: title,
        start: start,
        end: end,
        description: description,
        tags: tags
      },
      recommendations: [
        "Silencing slack and email notifications during this 2.5-hour deep work window.",
        "Set a subtle browser desktop notification 5 minutes prior to start."
      ]
    };
  }

  // 3. CODE MATCHING
  if (
    cleanPrompt.includes("code") ||
    cleanPrompt.includes("script") ||
    cleanPrompt.includes("write a function") ||
    cleanPrompt.includes("react") ||
    cleanPrompt.includes("component") ||
    cleanPrompt.includes("python") ||
    cleanPrompt.includes("sql")
  ) {
    let language = "typescript";
    let code = `// HyperDo Automated Code Generation
export function calculateProductivityIndex(completed: number, delegated: number, total: number): number {
  if (total === 0) return 0;
  const rawScore = ((completed * 1.5) + (delegated * 0.8)) / total;
  return Math.min(Math.round(rawScore * 100), 100);
}`;
    let explanation = "An optimized scoring algorithm that weights fully automated completions heavier than delegated items, returning a percentage scale.";

    if (cleanPrompt.includes("python")) {
      language = "python";
      code = `# HyperDo Automated Script
import time

def auto_executor_agent(tasks):
    print("🚀 HyperDo Agent Initialized. Processing queue...")
    success_count = 0
    for task in tasks:
        print(f"Executing: {task['title']}...")
        time.sleep(0.5)
        task['status'] = 'Executed'
        success_count += 1
    return {
        "status": "Success", 
        "executed_tasks": success_count,
        "efficiency_gain_ratio": 1.45
    }`;
      explanation = "An automated tasks queue runner written in Python, simulating sequential block processing and status compilation.";
    } else if (cleanPrompt.includes("sql")) {
      language = "sql";
      code = `-- HyperDo DB Table Schema
CREATE TABLE IF NOT EXISTS tasks (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  priority VARCHAR(50) DEFAULT 'medium',
  status VARCHAR(50) DEFAULT 'pending',
  executed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for optimization
CREATE INDEX idx_task_status ON tasks(status);`;
      explanation = "PostgreSQL table schema with optimal indexing configured for high-performance task lookups by status.";
    } else if (cleanPrompt.includes("component") || cleanPrompt.includes("button") || cleanPrompt.includes("react")) {
      language = "javascript";
      code = `// Dynamic React Execute Button
import React, { useState } from 'react';

export default function AutonomousExecuteButton({ taskTitle, onStart }) {
  const [running, setRunning] = useState(false);
  
  return (
    <button
      onClick={() => {
        setRunning(true);
        onStart();
        setTimeout(() => setRunning(false), 2000);
      }}
      disabled={running}
      className={\`px-4 py-2 rounded-xl font-mono text-xs transition-all duration-300 \${
        running 
          ? 'bg-emerald-600 text-white animate-pulse' 
          : 'bg-zinc-900 border border-zinc-800 text-zinc-300 hover:border-zinc-700'
      }\`}
    >
      {running ? '⚡ Executing task...' : '🚀 Auto-Execute'}
    </button>
  );
}`;
      explanation = "An interactive, fully responsive React button that utilizes state transitions to show physical active agency loop status.";
    }

    return {
      actionType: "code",
      thoughtProcess: [
        "Analyzing request for clean, production-ready code blocks.",
        `Parsed targeted language: ${language}`,
        "Composing code structure conforming to industry safety guidelines.",
        "Refactoring variables to be semantic, self-documenting, and concise.",
        "Polishing execution log block."
      ],
      executionLogs: [
        `[Agent] Initializing virtual sandbox environment for: ${language}`,
        "[Agent] Synthesizing imports and core functional dependencies...",
        "[System] Running syntax linting checks... 0 issues found.",
        "[System] Code validation succeeded. Codeblock formatted."
      ],
      payload: {
        title: `Auto-Generated ${language.toUpperCase()} Asset`,
        language: language,
        code: code,
        explanation: explanation
      },
      recommendations: [
        "Export this module directly to your repository via the setting workspace panel.",
        "Run automated unit tests before merging into main master branch."
      ]
    };
  }

  // 4. SUMMARY MATCHING
  if (
    cleanPrompt.includes("summarize") ||
    cleanPrompt.includes("summary") ||
    cleanPrompt.includes("article") ||
    cleanPrompt.includes("url") ||
    cleanPrompt.includes("read") ||
    cleanPrompt.includes("review")
  ) {
    return {
      actionType: "summary",
      thoughtProcess: [
        "Parsing target web reference / raw text.",
        "Extracting high-density semantic keywords.",
        "Deconstructing source concepts into linear takeaways.",
        "Consolidating insights into hierarchical visual cards."
      ],
      executionLogs: [
        "[Agent] Establishing secure network requests container...",
        "[System] Parsing document DOM elements into markdown strings.",
        "[System] Running semantic summary algorithms with 88% token compression.",
        "[System] Extracted 3 critical action points."
      ],
      payload: {
        title: "HyperDo Strategic Executive Summary",
        summaryPoints: [
          "Traditional reminders cause mental fatigue, leading to a 34% drop-off in task completion rate because they rely purely on the user's manual effort.",
          "Active automated execution (HyperDo model) eliminates the cognitive friction of starting a task by presenting 80% finished drafts immediately.",
          "By automating email drafting, calendar logistics, and quick script writing, high-agency teams gain an average of 11.2 hours per week per member."
        ],
        keyTakeaways: [
          "reminders fail because they represent work; active execution succeeds because it represents progress.",
          "A bento grid layout provides high-density, context-rich focus that reduces task-switching overhead."
        ]
      },
      recommendations: [
        "Draft an investor email with these summary points immediately.",
        "Pin this summary to your team dashboard."
      ]
    };
  }

  // DEFAULT FALLBACK: DRAFT / GENERAL
  return {
    actionType: "draft",
    thoughtProcess: [
      "Analyzing general execution query: " + prompt,
      "Determining best active solution matching project mission statement.",
      "Composing detailed execution report to make the request immediately actionable.",
      "Formatting outputs to keep the dashboard uncluttered."
    ],
    executionLogs: [
      "[Agent] Categorized query: High-priority executive action",
      "[Agent] Starting semantic processing pipeline...",
      "[System] Draft compiler successfully resolved.",
      "[System] Staged active asset preview."
    ],
    payload: {
      title: "HyperDo Autonomous Task Draft",
      content: `### HyperDo Action Plan: "${prompt}"\n\nI have successfully received and analyzed your request. To help you take immediate action and avoid passive delays, here is the compiled execution plan:\n\n1. **Core Intent Identified**: The user requested assistance with "${prompt}".\n2. **Immediate Executed Outcome**: I have staged a custom workflow template for this task. The AI agent recommends scheduling a deep-focus session to carry out any manual parts and auto-dispatched the initial digital draft.\n3. **Proactive Optimization**: Silenced secondary background notifications during this execution step.\n\nReady for your confirmation to persist this configuration.`,
      wordCount: 94
    },
    recommendations: [
      "Mark this task as Executed on the Active Task Matrix.",
      "Run the Auto-Execute command to regenerate with alternative parameters."
    ]
  };
}
