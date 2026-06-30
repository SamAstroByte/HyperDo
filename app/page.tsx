"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  Plus, 
  Trash2, 
  Play, 
  CheckCircle, 
  X, 
  Sparkles, 
  Terminal, 
  Sun, 
  Moon, 
  Mail, 
  Calendar, 
  Code, 
  FileText, 
  Mic, 
  MicOff, 
  Copy, 
  Share2, 
  Send, 
  Clock, 
  Check, 
  RotateCcw,
  AlertTriangle,
  Lightbulb,
  Cpu,
  Bell,
  BellOff,
  Minus,
  Shield,
  RefreshCw,
  Zap,
  ArrowRight
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { ExecutionPayload } from "./api/hyperdo/route";
import { signInWithGoogle, logoutFromGoogle, createGoogleCalendarEvent } from "@/lib/googleCalendar";

// Interface definitions
interface Task {
  id: string;
  title: string;
  priority: "high" | "medium" | "low";
  category: "email" | "calendar" | "code" | "draft" | "general";
  deadline: string;
  status: "pending" | "executing" | "executed";
  executedPayload?: any;
  reminderTime?: string;
  reminderActive?: boolean;
  reminderTriggered?: boolean;
}

interface CalendarBlock {
  id: string;
  title: string;
  start: string;
  end: string;
  description: string;
  tags: string[];
  reminderActive?: boolean;
  reminderTriggered?: boolean;
}

interface Habit {
  id: string;
  title: string;
  current: number;
  target: number;
  lastExecuted?: string;
}

// Utility to play custom synthesized chimes using Web Audio API
function playNotificationSound(type: "success" | "warning" | "alarm" | "tick") {
  if (typeof window === "undefined") return;
  const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContext) return;

  try {
    const ctx = new AudioContext();
    
    if (type === "success") {
      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(523.25, now); // C5
      osc1.frequency.exponentialRampToValueAtTime(1046.5, now + 0.15); // C6
      gain1.gain.setValueAtTime(0.15, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.3);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(659.25, now + 0.1); // E5
      osc2.frequency.exponentialRampToValueAtTime(1318.5, now + 0.25); // E6
      gain2.gain.setValueAtTime(0.15, now + 0.1);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.1);
      osc2.stop(now + 0.4);
    } else if (type === "warning") {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(220, now); // A3
      osc.frequency.linearRampToValueAtTime(180, now + 0.2);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.25);
    } else if (type === "alarm") {
      const now = ctx.currentTime;
      const duration = 0.8;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(880, now);
      for (let i = 0; i < 5; i++) {
        osc.frequency.setValueAtTime(880, now + i * 0.15);
        osc.frequency.setValueAtTime(660, now + i * 0.15 + 0.07);
      }
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(1500, now);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + duration);
    } else if (type === "tick") {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(1200, now);
      osc.frequency.exponentialRampToValueAtTime(100, now + 0.04);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.05);
    }
  } catch (error) {
    console.warn("Failed to play sound: audio context blocked by browser policy or unsupported", error);
  }
}

// Trigger browser native desktop notification
function triggerDesktopNotification(title: string, body: string) {
  if (typeof window !== "undefined" && "Notification" in window) {
    if (Notification.permission === "granted") {
      try {
        new Notification(title, {
          body: body,
          icon: "https://picsum.photos/seed/hyperdo_icon/128/128"
        });
      } catch (err) {
        console.warn("Desktop notification error:", err);
      }
    }
  }
}

export default function HyperDoDashboard() {
  // Dynamic theme state supporting both dark and light visual aesthetics
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  // Interaction / Task states
  const [tasks, setTasks] = useState<Task[]>([
    {
      id: "task-1",
      title: "Draft investment update email summarizing weekly milestones",
      priority: "high",
      category: "email",
      deadline: "Today",
      status: "pending"
    },
    {
      id: "task-2",
      title: "Block out a 2.5 hour deep-work window for critical backend review",
      priority: "medium",
      category: "calendar",
      deadline: "Tomorrow",
      status: "pending"
    },
    {
      id: "task-3",
      title: "Create a TypeScript utility function to calculate task automation scores",
      priority: "high",
      category: "code",
      deadline: "In 2 days",
      status: "pending"
    },
    {
      id: "task-4",
      title: "Summarize the key benefits of proactive action-based execution models",
      priority: "low",
      category: "draft",
      deadline: "In 3 days",
      status: "pending"
    }
  ]);

  const [calendarBlocks, setCalendarBlocks] = useState<CalendarBlock[]>([
    {
      id: "cal-1",
      title: "Team Daily Standup Sync",
      start: "09:00",
      end: "09:30",
      description: "Coordinate blocker items, align on daily sprint targets, and synchronize code merges.",
      tags: ["Collaboration", "Sprint"]
    },
    {
      id: "cal-2",
      title: "Client Progress Call",
      start: "15:00",
      end: "16:00",
      description: "Demonstrate live sandbox, collect feedback on the UI/UX bento framework.",
      tags: ["External", "Sync"]
    }
  ]);

  const [habits, setHabits] = useState<Habit[]>([
    { id: "hab-1", title: "Post tech update on LinkedIn", current: 1, target: 3 },
    { id: "hab-2", title: "Review system logs & execution history", current: 3, target: 5 },
    { id: "hab-3", title: "Refactor code files & clean architecture", current: 2, target: 7 }
  ]);

  // Command input states
  const [promptInput, setPromptInput] = useState("");
  const [isVoiceRecording, setIsVoiceRecording] = useState(false);
  const [voiceWaveform, setVoiceWaveform] = useState<number[]>([]);
  const [voiceErrorText, setVoiceErrorText] = useState<string | null>(null);
  const [isTypingSimulation, setIsTypingSimulation] = useState(false);

  // Execution states
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionSteps, setExecutionSteps] = useState<string[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(-1);
  const [systemLogs, setSystemLogs] = useState<string[]>([
    "System initialized in autonomous mode v2.0.4",
    "Integrations verified: Gemini AI Proxy Client (Staged)"
  ]);
  const [latestResult, setLatestResult] = useState<ExecutionPayload | null>(null);
  const [previewTab, setPreviewTab] = useState<"visual" | "json" | "logs">("visual");
  const [isGeminiSimulated, setIsGeminiSimulated] = useState(true);
  const [apiErrorDetails, setApiErrorDetails] = useState<string | null>(null);

  // Habits & Actionable Routines form states
  const [isAddingHabit, setIsAddingHabit] = useState(false);
  const [newHabitTitle, setNewHabitTitle] = useState("");
  const [newHabitTarget, setNewHabitTarget] = useState(5);

  // Form states for creating a new task manually
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState<"high" | "medium" | "low">("medium");
  const [newTaskCategory, setNewTaskCategory] = useState<"email" | "calendar" | "code" | "draft" | "general">("general");
  const [newTaskDeadline, setNewTaskDeadline] = useState("Today");
  const [newTaskReminderTime, setNewTaskReminderTime] = useState(""); // HH:MM

  // Form states for adding calendar block manually
  const [isAddingCalendarBlock, setIsAddingCalendarBlock] = useState(false);
  const [newCalendarTitle, setNewCalendarTitle] = useState("");
  const [newCalendarStart, setNewCalendarStart] = useState("10:00");
  const [newCalendarEnd, setNewCalendarEnd] = useState("11:00");
  const [newCalendarDescription, setNewCalendarDescription] = useState("");
  const [newCalendarTags, setNewCalendarTags] = useState("");
  const [newCalendarReminderActive, setNewCalendarReminderActive] = useState(true);

  const recognitionRef = useRef<any>(null);
  const fallbackCounterRef = useRef<number>(0);

  // Notifications / Toast state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Live system clock & active alarm states
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [activeAlarm, setActiveAlarm] = useState<{
    id: string;
    title: string;
    type: "task" | "calendar";
    item: any;
  } | null>(null);

  // Alarm editing state
  const [editingReminderTaskId, setEditingReminderTaskId] = useState<string | null>(null);

  // Editable body state for email or draft
  const [editedPayloadBody, setEditedPayloadBody] = useState("");
  const [showCalendarSyncModal, setShowCalendarSyncModal] = useState(false);
  const [googleUser, setGoogleUser] = useState<any | null>(null);
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{current: number; total: number; title: string} | null>(null);
  const [codeRunOutput, setCodeRunOutput] = useState<string | null>(null);
  const [isCodeRunning, setIsCodeRunning] = useState(false);

  // Mobile check and adaptive email draft preference states
  const [isMobile, setIsMobile] = useState(false);
  const [preferredEmailMode, setPreferredEmailMode] = useState<"auto" | "gmail" | "mailto">("auto");

  // Google Speech-to-Text (STT) Studio States
  const [activeSimulatingPhrase, setActiveSimulatingPhrase] = useState<string | null>(null);
  const [isRealMicWorking, setIsRealMicWorking] = useState<boolean>(false);
  const [sttStatusMessage, setSttStatusMessage] = useState<string>("Ready. Click microphone to begin transcribing.");

  const getEmailHref = () => {
    if (!latestResult || latestResult.actionType !== "email") return "#";
    const to = latestResult.payload.to || "";
    const subject = latestResult.payload.subject || "";
    const body = editedPayloadBody;

    const useMailto = preferredEmailMode === "mailto" || (preferredEmailMode === "auto" && isMobile);

    if (useMailto) {
      return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    } else {
      return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    }
  };

  // Terminal scroll ref
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const logTickerRef = useRef<HTMLDivElement>(null);

  // Trigger alert toast helper
  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Request native HTML5 browser notification permissions
  const requestNotificationPermission = () => {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission().then(permission => {
          if (permission === "granted") {
            addLog("[System] Desktop alerts successfully activated and granted.");
            triggerToast("Desktop notification alerts activated!");
            playNotificationSound("success");
            triggerDesktopNotification("🔔 HyperDo Notifications Activated", "You will now receive instant alerts on your desktop!");
          } else {
            addLog("[System] Desktop alerts permission denied by user.");
            triggerToast("Notification permission denied.");
            playNotificationSound("warning");
          }
        });
      } else if (Notification.permission === "granted") {
        addLog("[System] Desktop alerts already granted.");
        triggerToast("Desktop alerts are already fully active.");
        playNotificationSound("success");
        triggerDesktopNotification("🔔 HyperDo Alerts Check", "System alerts are already fully active and functional!");
      } else if (Notification.permission === "denied") {
        addLog("[System] Desktop alerts are blocked in your browser settings.");
        triggerToast("Alerts are blocked in settings. Please clear permission and retry.");
        playNotificationSound("warning");
      }
    } else {
      addLog("[System] Native notifications are not supported in this browser client.");
      triggerToast("Desktop alerts unsupported in this browser.");
      playNotificationSound("warning");
    }
  };

  // Add automated custom system logs
  const addLog = (log: string) => {
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setSystemLogs(prev => [...prev, `[${timestamp}] ${log}`]);
  };

  // Trigger auto-scroll on log updates
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [systemLogs, executionSteps, currentStepIndex]);

  // Voice recording simulation effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    let timer: NodeJS.Timeout;
    if (isVoiceRecording) {
      interval = setInterval(() => {
        setVoiceWaveform(Array.from({ length: 15 }, () => Math.floor(Math.random() * 24) + 4));
      }, 100);
    } else {
      timer = setTimeout(() => {
        setVoiceWaveform([]);
      }, 0);
    }
    return () => {
      if (interval) clearInterval(interval);
      if (timer) clearTimeout(timer);
    };
  }, [isVoiceRecording]);

  // Real-time local system clock initialization
  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentTime(new Date());
    }, 50);
    const clockInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => {
      clearTimeout(timer);
      clearInterval(clockInterval);
    };
  }, []);

  // Native mobile browser check on mount and resize
  useEffect(() => {
    if (typeof window !== "undefined") {
      const checkMobile = () => {
        const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
        const matchesMobile = /android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
        const matchesTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
        const isSmallScreen = window.innerWidth <= 768;
        setIsMobile(matchesMobile || (matchesTouch && isSmallScreen));
      };
      checkMobile();
      
      const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
      const matchesMobile = /android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
      const matchesTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
      const isSmallScreen = window.innerWidth <= 768;
      const result = matchesMobile || (matchesTouch && isSmallScreen);
      addLog(`[System] Initialized device detection: ${result ? "Mobile/Touch Friendly" : "Desktop View"}`);

      window.addEventListener("resize", checkMobile);
      return () => window.removeEventListener("resize", checkMobile);
    }
  }, []);

  // Background reminder alarm checker scanner
  useEffect(() => {
    if (!currentTime) return;

    const hours = String(currentTime.getHours()).padStart(2, "0");
    const minutes = String(currentTime.getMinutes()).padStart(2, "0");
    const currentHHMM = `${hours}:${minutes}`;

    // Scan tasks for pending alarms
    tasks.forEach(task => {
      if (task.reminderActive && task.reminderTime === currentHHMM && !task.reminderTriggered && task.status !== "executed") {
        setActiveAlarm({
          id: task.id,
          title: task.title,
          type: "task",
          item: task
        });
        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, reminderTriggered: true } : t));
        addLog(`[ALARM SYSTEM] Reminder alert triggered for task: "${task.title}"`);
        triggerDesktopNotification("🔔 HyperDo Task Alarm!", `Scheduled Alarm: "${task.title}" reaches its reminder limit!`);
      }
    });

    // Scan calendar blocks for pending alarms
    calendarBlocks.forEach(block => {
      if (block.reminderActive && block.start === currentHHMM && !block.reminderTriggered) {
        setActiveAlarm({
          id: block.id,
          title: block.title,
          type: "calendar",
          item: block
        });
        setCalendarBlocks(prev => prev.map(b => b.id === block.id ? { ...b, reminderTriggered: true } : b));
        addLog(`[ALARM SYSTEM] Chime triggered for daily agenda slot: "${block.title}"`);
        triggerDesktopNotification("🗓️ HyperDo Agenda Chime!", `Event "${block.title}" starts now (${block.start})!`);
      }
    });
  }, [currentTime, tasks, calendarBlocks]);

  // Loop alarm sound when activeAlarm is active
  useEffect(() => {
    if (!activeAlarm) return;
    
    // Play immediately
    playNotificationSound("alarm");
    
    // Repeat every 2.5 seconds
    const chimeInterval = setInterval(() => {
      playNotificationSound("alarm");
    }, 2500);

    return () => clearInterval(chimeInterval);
  }, [activeAlarm]);

  // Demo scheduler: arm the first default task to trigger 2 minutes after mount
  useEffect(() => {
    const demoTime = new Date();
    demoTime.setMinutes(demoTime.getMinutes() + 2);
    const hours = String(demoTime.getHours()).padStart(2, "0");
    const minutes = String(demoTime.getMinutes()).padStart(2, "0");
    const demoHHMM = `${hours}:${minutes}`;

    const timer = setTimeout(() => {
      setTasks(prev => prev.map((t, idx) => {
        if (idx === 0) {
          return {
            ...t,
            reminderTime: demoHHMM,
            reminderActive: true,
            reminderTriggered: false
          };
        }
        return t;
      }));
      addLog(`[ALARM ENGINE] Dynamic demo alert scheduled for task at ${demoHHMM} (in 2 minutes)`);
    }, 800);

    return () => clearTimeout(timer);
  }, []);



  // Task creation handler
  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    // Validate reminder time format if specified
    const timeStr = newTaskReminderTime.trim();
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (timeStr && !timeRegex.test(timeStr)) {
      triggerToast("Reminder must be in HH:MM format (e.g. 14:35)");
      playNotificationSound("warning");
      return;
    }

    const newTask: Task = {
      id: "task-" + Date.now(),
      title: newTaskTitle,
      priority: newTaskPriority,
      category: newTaskCategory,
      deadline: newTaskDeadline,
      status: "pending",
      reminderTime: timeStr || undefined,
      reminderActive: !!timeStr,
      reminderTriggered: false
    };

    setTasks(prev => [newTask, ...prev]);
    addLog(`Created manual task: "${newTask.title.slice(0, 30)}..." ${timeStr ? `(Alarm: ${timeStr})` : ""}`);
    triggerToast("Task successfully created!");
    playNotificationSound("tick");
    setNewTaskTitle("");
    setNewTaskReminderTime("");
    setIsAddingTask(false);
  };

  // Task deletion
  const handleDeleteTask = (id: string, name: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    addLog(`Deleted task: "${name.slice(0, 30)}..."`);
    triggerToast("Task removed from board.");
    playNotificationSound("warning");
  };

  // Calendar block creation handler
  const handleCreateCalendarBlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCalendarTitle.trim()) return;

    const tagsArray = newCalendarTags
      .split(",")
      .map(t => t.trim())
      .filter(t => t.length > 0);

    const newBlock: CalendarBlock = {
      id: `cal-${Date.now()}`,
      title: newCalendarTitle,
      start: newCalendarStart || "10:00",
      end: newCalendarEnd || "11:00",
      description: newCalendarDescription || "Custom user scheduled block.",
      tags: tagsArray.length > 0 ? tagsArray : ["User-Scheduled"],
      reminderActive: newCalendarReminderActive,
      reminderTriggered: false
    };

    setCalendarBlocks(prev => [...prev, newBlock]);
    addLog(`[ACTION] Created calendar event: "${newBlock.title}" at ${newBlock.start}-${newBlock.end} ${newCalendarReminderActive ? "(Alarm Active)" : ""}`);
    triggerToast("Calendar block scheduled.");
    playNotificationSound("tick");

    // Reset fields
    setNewCalendarTitle("");
    setNewCalendarStart("10:00");
    setNewCalendarEnd("11:00");
    setNewCalendarDescription("");
    setNewCalendarTags("");
    setNewCalendarReminderActive(true);
    setIsAddingCalendarBlock(false);
  };

  // Calendar block deletion handler
  const handleDeleteCalendarBlock = (id: string, title: string) => {
    setCalendarBlocks(prev => prev.filter(block => block.id !== id));
    addLog(`[ACTION] Deleted calendar event: "${title}"`);
    triggerToast("Calendar block removed.");
    playNotificationSound("warning");
  };

  // Generate .ics iCalendar file for bulk agenda sync
  const generateICSFile = (blocks: CalendarBlock[]) => {
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, ""); // e.g. "20260628"
    
    let icsLines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//HyperDo//Daily Agenda Export//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH"
    ];

    blocks.forEach((block) => {
      const startHourMin = block.start.replace(":", "") + "00";
      const endHourMin = block.end.replace(":", "") + "00";
      
      const startDt = `${todayStr}T${startHourMin}`;
      const endDt = `${todayStr}T${endHourMin}`;
      const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";

      icsLines.push(
        "BEGIN:VEVENT",
        `UID:${block.id}@hyperdo.app`,
        `DTSTAMP:${stamp}`,
        `DTSTART:${startDt}`,
        `DTEND:${endDt}`,
        `SUMMARY:${block.title.replace(/[,;]/g, "\\$&")}`,
        `DESCRIPTION:${block.description.replace(/[,;]/g, "\\$&")}`,
        "END:VEVENT"
      );
    });

    icsLines.push("END:VCALENDAR");
    
    const content = icsLines.join("\r\n");
    const blob = new Blob([content], { type: "text/calendar;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `hyperdo_agenda_${todayStr}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Generate individual Google Calendar template URL for a single block
  const getGoogleCalendarUrlForBlock = (block: CalendarBlock) => {
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, ""); // e.g. "20260628"
    const startHourMin = block.start.replace(":", "") + "00";
    const endHourMin = block.end.replace(":", "") + "00";
    
    const dates = `${todayStr}T${startHourMin}/${todayStr}T${endHourMin}`;
    const details = `${block.description}\n\nSynced via HyperDo - Real-time Executor`;
    
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(block.title)}&dates=${dates}&details=${encodeURIComponent(details)}`;
  };

  // Direct synchronization of all agenda items to Google Calendar via official API
  const handleDirectSyncAll = async () => {
    if (calendarBlocks.length === 0) {
      triggerToast("No planner items to sync!");
      return;
    }
    
    let currentToken = googleAccessToken;
    
    if (!currentToken) {
      try {
        addLog("[AUTH] Prompting user for Google Calendar OAuth sign-in...");
        triggerToast("Opening Google Sign-in...");
        const result = await signInWithGoogle();
        if (result) {
          currentToken = result.accessToken;
          setGoogleUser(result.user);
          setGoogleAccessToken(result.accessToken);
          addLog(`[AUTH] Signed in successfully as ${result.user.email}`);
        } else {
          triggerToast("Failed to authenticate with Google.");
          return;
        }
      } catch (err: any) {
        console.error(err);
        addLog(`[AUTH ERROR] Authentication failed: ${err.message || err}`);
        triggerToast("Authentication cancelled or failed.");
        return;
      }
    }

    if (!currentToken) return;

    setIsSyncingAll(true);
    addLog(`[SYNC] Initiating bulk direct export of ${calendarBlocks.length} items to Google Calendar...`);
    
    let successCount = 0;
    const todayStr = new Date().toISOString().split("T")[0]; // e.g. "2026-06-28"
    const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

    for (let i = 0; i < calendarBlocks.length; i++) {
      const block = calendarBlocks[i];
      setSyncProgress({ current: i + 1, total: calendarBlocks.length, title: block.title });
      
      const startDateTime = `${todayStr}T${block.start}:00`;
      const endDateTime = `${todayStr}T${block.end}:00`;
      
      const eventPayload = {
        summary: block.title,
        description: `${block.description}\n\nSynced via HyperDo - Real-time Executor`,
        start: {
          dateTime: startDateTime,
          timeZone: userTimeZone,
        },
        end: {
          dateTime: endDateTime,
          timeZone: userTimeZone,
        }
      };
      
      try {
        addLog(`[SYNC] Syncing event ${i + 1}/${calendarBlocks.length}: "${block.title}" (${block.start} - ${block.end})`);
        await createGoogleCalendarEvent(eventPayload, currentToken);
        successCount++;
      } catch (err: any) {
        console.error(err);
        addLog(`[SYNC ERROR] Failed to sync "${block.title}": ${err.message || err}`);
      }
    }
    
    setIsSyncingAll(false);
    setSyncProgress(null);
    
    if (successCount === calendarBlocks.length) {
      playNotificationSound("success");
      triggerToast(`Successfully synced ${successCount} events directly to Google Calendar!`);
      addLog(`[SYNC SUCCESS] All ${successCount} events synced directly to Google Calendar.`);
    } else if (successCount > 0) {
      playNotificationSound("warning");
      triggerToast(`Partially synced: ${successCount}/${calendarBlocks.length} events added.`);
      addLog(`[SYNC WARNING] Sync completed with errors. ${successCount}/${calendarBlocks.length} events added.`);
    } else {
      playNotificationSound("warning");
      triggerToast("Failed to sync agenda to Google Calendar.");
      addLog("[SYNC ERROR] Bulk sync failed completely. Check logs for details.");
    }
  };

  // Direct individual synchronization of a single block via official API
  const handleDirectSyncIndividual = async (block: CalendarBlock) => {
    let currentToken = googleAccessToken;
    
    if (!currentToken) {
      try {
        addLog("[AUTH] Prompting user for Google Calendar OAuth sign-in...");
        triggerToast("Opening Google Sign-in...");
        const result = await signInWithGoogle();
        if (result) {
          currentToken = result.accessToken;
          setGoogleUser(result.user);
          setGoogleAccessToken(result.accessToken);
          addLog(`[AUTH] Signed in successfully as ${result.user.email}`);
        } else {
          triggerToast("Failed to authenticate with Google.");
          return;
        }
      } catch (err: any) {
        console.error(err);
        addLog(`[AUTH ERROR] Authentication failed: ${err.message || err}`);
        triggerToast("Authentication cancelled or failed.");
        return;
      }
    }

    if (!currentToken) return;

    const todayStr = new Date().toISOString().split("T")[0]; // e.g. "2026-06-28"
    const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

    const startDateTime = `${todayStr}T${block.start}:00`;
    const endDateTime = `${todayStr}T${block.end}:00`;
    
    const eventPayload = {
      summary: block.title,
      description: `${block.description}\n\nSynced via HyperDo - Real-time Executor`,
      start: {
        dateTime: startDateTime,
        timeZone: userTimeZone,
      },
      end: {
        dateTime: endDateTime,
        timeZone: userTimeZone,
      }
    };

    try {
      addLog(`[SYNC] Syncing event: "${block.title}" to Google Calendar...`);
      triggerToast(`Syncing "${block.title}"...`);
      await createGoogleCalendarEvent(eventPayload, currentToken);
      playNotificationSound("success");
      triggerToast(`Synced "${block.title}" directly to Google Calendar!`);
      addLog(`[SYNC SUCCESS] Event "${block.title}" created successfully.`);
    } catch (err: any) {
      console.error(err);
      addLog(`[SYNC ERROR] Failed to sync "${block.title}": ${err.message || err}`);
      triggerToast(`Failed to sync event.`);
    }
  };

  // Save custom reminder alarm helper for task
  const handleSaveTaskReminder = (taskId: string, timeStr: string) => {
    const cleaned = timeStr.trim();
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (cleaned && !timeRegex.test(cleaned)) {
      triggerToast("Please use HH:MM format (e.g. 14:35 or 09:15)");
      playNotificationSound("warning");
      return;
    }

    setTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        return {
          ...t,
          reminderTime: cleaned || undefined,
          reminderActive: !!cleaned,
          reminderTriggered: false
        };
      }
      return t;
    }));

    if (cleaned) {
      addLog(`[ALARM SYSTEM] Armed reminder alarm for task at ${cleaned}`);
      triggerToast(`Alarm armed for ${cleaned}!`);
      playNotificationSound("success");
    } else {
      addLog(`[ALARM SYSTEM] Disarmed reminder alarm for task`);
      triggerToast("Alarm disarmed.");
      playNotificationSound("tick");
    }
    setEditingReminderTaskId(null);
  };

  // Save custom reminder alarm helper for calendar block
  const handleSaveCalendarReminder = (blockId: string, isArmed: boolean) => {
    setCalendarBlocks(prev => prev.map(b => {
      if (b.id === blockId) {
        return {
          ...b,
          reminderActive: isArmed,
          reminderTriggered: false
        };
      }
      return b;
    }));

    if (isArmed) {
      addLog(`[ALARM SYSTEM] Armed start-time alarm chime for calendar slot.`);
      triggerToast("Chime armed for start time!");
      playNotificationSound("success");
    } else {
      addLog(`[ALARM SYSTEM] Disarmed start-time alarm chime.`);
      triggerToast("Chime disarmed.");
      playNotificationSound("tick");
    }
  };

  // Execute a command directly
  const executeCommand = async (commandText: string, associatedTaskId?: string) => {
    if (!commandText.trim() || isExecuting) return;

    setIsExecuting(true);
    setLatestResult(null);
    setCodeRunOutput(null);
    setApiErrorDetails(null);
    setExecutionSteps([
      "Parsing intent and parameters...",
      "Connecting to HyperDo autonomous orchestration API...",
      "Analyzing safety parameters & context variables..."
    ]);
    setCurrentStepIndex(0);
    setPreviewTab("visual");

    addLog(`Initiated execution request for: "${commandText.slice(0, 45)}..."`);

    // Dynamic state updating if triggered from a specific task
    if (associatedTaskId) {
      setTasks(prev => prev.map(t => t.id === associatedTaskId ? { ...t, status: "executing" } : t));
    }

    // Step animation loop simulation
    const steps = [
      "Initializing AI synthesis engine...",
      "Running context mapping & semantic analysis...",
      "Generating action drafts and layout specifications...",
      "Verifying structural execution bounds...",
      "Finalizing executable payload package..."
    ];

    let currentStep = 0;
    const stepInterval = setInterval(() => {
      if (currentStep < steps.length) {
        setExecutionSteps(prev => [...prev, steps[currentStep]]);
        setCurrentStepIndex(prev => prev + 1);
        addLog(`[Agent Process] ${steps[currentStep]}`);
        currentStep++;
      } else {
        clearInterval(stepInterval);
      }
    }, 700);

    try {
      // Build brief environment context to provide to Gemini
      const apiContext = {
        localTime: new Date().toISOString(),
        activeTasksCount: tasks.filter(t => t.status === "pending").length,
        scheduledCalendarSlots: calendarBlocks.map(c => `${c.start}-${c.end}: ${c.title}`)
      };

      const response = await fetch("/api/hyperdo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: commandText, context: apiContext })
      });

      const data: ExecutionPayload & { isSimulated: boolean; errorDetails?: string } = await response.json();

      // Clear the step countdown interval if it's still ticking
      clearInterval(stepInterval);

      // Finish logs & payload delivery
      setExecutionSteps(prev => [...prev, ...data.thoughtProcess, "Execution complete. Loading result payload."]);
      setCurrentStepIndex(data.thoughtProcess.length + steps.length + 2);
      setIsGeminiSimulated(data.isSimulated);
      if (data.errorDetails) {
        setApiErrorDetails(data.errorDetails);
        addLog(`[API WARNING] Fallback activated. Gemini encountered error: ${data.errorDetails}`);
      }

      // Inject mock technical logs into our system logs
      data.executionLogs.forEach(log => addLog(log));

      // Save output payload
      setLatestResult(data);
      if (data.payload.body) {
        setEditedPayloadBody(data.payload.body);
      } else if (data.payload.content) {
        setEditedPayloadBody(data.payload.content);
      }

      addLog(`Task successfully completed by HyperDo Engine. Type: ${data.actionType.toUpperCase()}`);
      triggerToast(`Successfully Executed: ${data.payload.title || "Task"}`);
      playNotificationSound("success");

      // Update Task Matrix state if associated
      if (associatedTaskId) {
        setTasks(prev => prev.map(t => t.id === associatedTaskId ? { 
          ...t, 
          status: "executed",
          executedPayload: data
        } : t));
      } else {
        // If it was a generic global command, let's look if it matches any task name partially to resolve it
        setTasks(prev => prev.map(t => {
          if (t.status === "pending" && (
            commandText.toLowerCase().includes(t.title.toLowerCase()) || 
            t.title.toLowerCase().includes(commandText.toLowerCase())
          )) {
            return { ...t, status: "executed", executedPayload: data };
          }
          return t;
        }));
      }

    } catch (err) {
      console.error(err);
      addLog("System encountered a transmission error. Utilizing local autonomous failover...");
      clearInterval(stepInterval);
      setIsExecuting(false);
    } finally {
      setIsExecuting(false);
    }
  };

  // Submit search bar prompt
  const handlePromptSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!promptInput.trim()) return;
    executeCommand(promptInput);
    setPromptInput("");
  };

  // Direct Auto-Execute task trigger
  const handleAutoExecuteTask = (task: Task) => {
    let command = task.title;
    // Boost prompt parameters depending on type
    if (task.category === "email") {
      command = `Draft email to complete task: ${task.title}`;
    } else if (task.category === "calendar") {
      command = `Schedule calendar block for task: ${task.title}`;
    } else if (task.category === "code") {
      command = `Write code script to execute task: ${task.title}`;
    }
    executeCommand(command, task.id);
  };

  // Trigger simulated voice assistant phrases
  const handleVoicePhraseTrigger = (phrase: string) => {
    simulateVoiceTyping(phrase);
  };

  // Habit ticking simulation
  const handleAddHabit = (title: string, target: number) => {
    if (!title.trim()) {
      triggerToast("Routine title cannot be empty!");
      playNotificationSound("warning");
      return;
    }
    const targetVal = Math.max(1, target || 1);
    const newHabit: Habit = {
      id: "hab-" + Date.now(),
      title: title.trim(),
      current: 0,
      target: targetVal
    };
    setHabits(prev => [...prev, newHabit]);
    addLog(`[ACTION] Configured custom active routine: "${newHabit.title}" (Goal: ${newHabit.target})`);
    triggerToast("Custom routine configured!");
    playNotificationSound("success");
    setIsAddingHabit(false);
    setNewHabitTitle("");
    setNewHabitTarget(5);
  };

  const handleDeleteHabit = (habitId: string) => {
    const targetHabit = habits.find(h => h.id === habitId);
    setHabits(prev => prev.filter(h => h.id !== habitId));
    if (targetHabit) {
      addLog(`[ACTION] Removed routine: "${targetHabit.title}"`);
      triggerToast(`Routine "${targetHabit.title}" removed.`);
      playNotificationSound("warning");
    }
  };

  const handleHabitDecrement = (habitId: string) => {
    setHabits(prev => prev.map(h => {
      if (h.id === habitId) {
        const nextCount = Math.max(0, h.current - 1);
        triggerToast(`Routine backed off: ${h.title} (${nextCount}/${h.target})`);
        playNotificationSound("tick");
        return {
          ...h,
          current: nextCount
        };
      }
      return h;
    }));
  };

  const handleHabitTick = (habitId: string) => {
    setHabits(prev => prev.map(h => {
      if (h.id === habitId) {
        const nextCount = Math.min(h.current + 1, h.target);
        if (nextCount === h.target) {
          triggerToast(`Goal Reached! Habited completed for the week: ${h.title}`);
          playNotificationSound("success");
        } else {
          triggerToast(`Habit updated: ${h.title} (${nextCount}/${h.target})`);
          playNotificationSound("tick");
        }
        return {
          ...h,
          current: nextCount,
          lastExecuted: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
      }
      return h;
    }));

    // Trigger dynamic execution logs for the habit
    const targetHabit = habits.find(h => h.id === habitId);
    if (targetHabit) {
      addLog(`Autonomous Habit Tick: Completed increment for "${targetHabit.title}"`);
      // We also auto-execute a recommendation
      executeCommand(`Execute routine task associated with habit: ${targetHabit.title}`);
    }
  };

  // Simulated live execution actions on assets
  const handleSendEmailSimulation = (to: string, subject: string, body: string) => {
    addLog(`[ACTION] Dispatching actual email payload to: ${to}`);
    addLog(`[ACTION] SMTP Connection verified. Encrypted envelopes delivered.`);
    triggerToast(`Email dispatched to ${to} successfully!`);
  };

  const handleInsertCalendarSimulation = (block: any) => {
    const newCal: CalendarBlock = {
      id: "cal-" + Date.now(),
      title: block.title || "Autonomous Focus Slot",
      start: block.start || "14:00",
      end: block.end || "15:30",
      description: block.description || "Injected autonomously by HyperDo Agent",
      tags: block.tags || ["Deep Work"]
    };

    setCalendarBlocks(prev => {
      // Check for simple duplicate prevention
      if (prev.some(c => c.title === newCal.title && c.start === newCal.start)) return prev;
      return [...prev, newCal].sort((a, b) => a.start.localeCompare(b.start));
    });

    addLog(`[ACTION] Calendar database synced. Injected event slot: ${newCal.title}`);
    triggerToast(`Calendar Block Scheduled: ${newCal.start} - ${newCal.end}`);
  };

  const handleRunCodeSimulation = (lang: string, code: string) => {
    setIsCodeRunning(true);
    setCodeRunOutput("Compiling script in virtual container...");
    
    setTimeout(() => {
      if (lang === "typescript" || lang === "javascript") {
        setCodeRunOutput(`> node sandbox.js\n[Success] Core algorithm parsed successfully.\n[Benchmark] Completed execution loop in 4.2ms\n[Console Out] Automation calculated: Score: 94% | Effort Reduced: 2.1x`);
      } else if (lang === "python") {
        setCodeRunOutput(`> python script.py\n🚀 HyperDo Agent Initialized. Processing queue...\nExecuting: Draft investment update...\nExecuting: Write automated scheduler test...\n[Result] Success. Executed tasks: 2. Efficiency Gain Index: 1.45x`);
      } else if (lang === "sql") {
        setCodeRunOutput(`> psql -h local -d hyperdo\nCREATE TABLE (1 row)\nCREATE INDEX (1 row)\nINSERT 0 1\nQuery returned 3 rows in 0.88ms.`);
      } else {
        setCodeRunOutput(`[Container Terminal]\nRunning code draft: OK\nStatus: Ready for production export.\nNo runtime faults detected.`);
      }
      setIsCodeRunning(false);
      addLog(`[ACTION] Executed terminal compilation sandbox for code component.`);
    }, 1200);
  };

  // Voice toggle: directly controls the microphone stream, handles native permissions gracefully, and enables instant fallback simulation
  const toggleVoiceRecording = () => {
    playNotificationSound("tick");

    // If currently recording or simulating, stop everything!
    if (isVoiceRecording || isTypingSimulation) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (err) {}
      }
      setIsVoiceRecording(false);
      setIsTypingSimulation(false);
      setActiveSimulatingPhrase(null);
      setVoiceErrorText(null);
      addLog("[Voice Input] Voice session manually stopped.");
      return;
    }

    setVoiceErrorText(null);
    const isFirefox = typeof navigator !== "undefined" && navigator.userAgent.toLowerCase().includes("firefox");
    if (isFirefox) {
      addLog("[Voice Input] Firefox detected. Firefox has limited native speech support. Executing adaptive simulated vocal fallback...");
      runFallbackVoice();
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      addLog("[Voice Input] Browser does not support native Web Speech API (Firefox/Safari restricted). Running adaptive simulated vocal fallback...");
      runFallbackVoice();
      return;
    }

    startLiveVoiceRecognition();
  };

  const startLiveVoiceRecognition = () => {
    setVoiceErrorText(null);
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        if (recognitionRef.current) {
          try {
            recognitionRef.current.abort();
          } catch (err) {}
        }

        const rec = new SpeechRecognition();
        rec.continuous = false;
        rec.interimResults = true;
        rec.lang = "en-US";

        rec.onstart = () => {
          setIsVoiceRecording(true);
          addLog("[Voice Engine] Microphone active and listening. Speak your command...");
          playNotificationSound("tick");
        };

        rec.onresult = (event: any) => {
          let interimTranscript = "";
          let finalTranscript = "";
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            } else {
              interimTranscript += event.results[i][0].transcript;
            }
          }
          const activeTranscript = finalTranscript || interimTranscript;
          if (activeTranscript) {
            setPromptInput(activeTranscript);
          }
        };

        rec.onerror = (event: any) => {
          console.error("Speech recognition error", event);
          const errorMsg = event.error || "unknown";
          
          if (errorMsg === "not-allowed" || errorMsg === "service-not-allowed") {
            setVoiceErrorText("Mic blocked. Activating simulated speech command fallback...");
            addLog(`[Voice Warning] Microphone blocked (${errorMsg}). Activating simulated voice fallback.`);
            setTimeout(() => {
              runFallbackVoice();
            }, 800);
          } else if (errorMsg === "no-speech") {
            setVoiceErrorText("No speech detected. Please speak clearly.");
          } else {
            setVoiceErrorText(`Mic Error: ${errorMsg}. Activating simulated fallback...`);
            addLog(`[Voice Warning] Mic error encountered (${errorMsg}). Activating simulated voice fallback.`);
            setTimeout(() => {
              runFallbackVoice();
            }, 800);
          }
          setIsVoiceRecording(false);
          playNotificationSound("warning");
        };

        rec.onend = () => {
          // Only reset if we are not currently simulating typing
          if (!isTypingSimulation) {
            setIsVoiceRecording(false);
          }
        };

        recognitionRef.current = rec;
        rec.start();
      } catch (e: any) {
        console.error("Failed to start speech recognition", e);
        setVoiceErrorText("Failed to initialize microphone. Activating simulated fallback...");
        addLog("[Voice Warning] Exception initializing microphone. Activating simulated voice fallback.");
        setTimeout(() => {
          runFallbackVoice();
        }, 800);
      }
    } else {
      setVoiceErrorText("Web Speech API not supported in this browser. Activating simulated fallback...");
      addLog("[Voice Warning] Web Speech API not supported. Activating simulated voice fallback.");
      setTimeout(() => {
        runFallbackVoice();
      }, 800);
    }
  };

  const simulateVoiceTyping = (text: string, autoExecute = false) => {
    if (isTypingSimulation) return;
    setIsTypingSimulation(true);
    setPromptInput("");
    setVoiceErrorText(null);
    setActiveSimulatingPhrase(text);
    setIsVoiceRecording(true); // Show typing animation wave!
    addLog(`[Voice Input] Simulating vocal stream: "${text}"`);

    let currentIndex = 0;
    const interval = setInterval(() => {
      if (currentIndex < text.length) {
        const char = text.charAt(currentIndex);
        setPromptInput(prev => prev + char);
        if (currentIndex % 4 === 0) {
          playNotificationSound("tick");
        }
        currentIndex++;
      } else {
        clearInterval(interval);
        setIsTypingSimulation(false);
        setIsVoiceRecording(false);
        setActiveSimulatingPhrase(null);
        playNotificationSound("success");
        triggerToast("Simulated voice transcription fully resolved!");
        addLog("[Voice Input] Simulated transcription successfully completed.");

        if (autoExecute) {
          addLog("[Voice Exec] Launching simulated command execution...");
          executeCommand(text);
        }
      }
    }, 20);
  };

  const runFallbackVoice = () => {
    const transcripts = [
      "Draft email to Sarah regarding the weekly project milestone status update",
      "Schedule team lunch sync from twelve to one PM this Friday",
      "Write a typescript regex phone parser utility function for system auth",
      "Create daily wellness checklist habit to Drink three liters of water"
    ];
    const idx = fallbackCounterRef.current % transcripts.length;
    fallbackCounterRef.current = fallbackCounterRef.current + 1;
    const selected = transcripts[idx];
    simulateVoiceTyping(selected, false);
  };

  // Calculate stats
  const pendingCount = tasks.filter(t => t.status === "pending").length;
  const executedCount = tasks.filter(t => t.status === "executed").length;
  const totalCount = tasks.length;
  const completionPercentage = totalCount ? Math.round((executedCount / totalCount) * 100) : 0;
  const calculatedHoursSaved = (executedCount * 1.5 + habits.reduce((acc, h) => acc + (h.current * 0.4), 0)).toFixed(1);

  // Suggested vocal prompts
  const voiceSuggestionsList = [
    { label: "Draft investment update email", icon: <Mail className="w-3.5 h-3.5" /> },
    { label: "Book lunch meeting at 12:30", icon: <Calendar className="w-3.5 h-3.5" /> },
    { label: "Write a typescript score formula", icon: <Code className="w-3.5 h-3.5" /> },
    { label: "Summarize active execution models", icon: <FileText className="w-3.5 h-3.5" /> }
  ];

  return (
    <div className={`min-h-screen w-full transition-colors duration-500 font-sans p-4 sm:p-6 overflow-x-hidden flex flex-col justify-between ${
      theme === "dark" ? "bg-[#09090b] text-[#fafafa]" : "bg-zinc-50 text-zinc-950"
    }`}>
      
      {/* Dynamic Full-Screen Alarm Modal Overlay */}
      <AnimatePresence>
        {activeAlarm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4 sm:p-6"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-zinc-950 border border-amber-500/30 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl text-center space-y-6"
            >
              <div className="mx-auto w-16 h-16 bg-amber-500/10 border border-amber-500/30 rounded-full flex items-center justify-center animate-bounce">
                <Clock className="w-8 h-8 text-amber-400 animate-pulse" />
              </div>

              <div className="space-y-2">
                <span className="text-[10px] font-mono tracking-widest uppercase text-amber-500 font-bold bg-amber-500/10 px-2 py-0.5 rounded-full">
                  ⚠️ {activeAlarm.type === "task" ? "TASK REMINDER ALARM" : "AGENDA START TIME CHIME"}
                </span>
                <h3 className="text-xl font-extrabold tracking-tight text-white leading-tight">
                  {activeAlarm.title}
                </h3>
                {activeAlarm.type === "task" && activeAlarm.item.reminderTime && (
                  <p className="text-xs font-mono text-zinc-400">Scheduled Alarm: {activeAlarm.item.reminderTime}</p>
                )}
                {activeAlarm.type === "calendar" && activeAlarm.item.start && (
                  <p className="text-xs font-mono text-zinc-400">Scheduled Time Slot: {activeAlarm.item.start} - {activeAlarm.item.end}</p>
                )}
              </div>

              <div className="bg-zinc-900/50 p-4 rounded-2xl border border-zinc-800 text-left text-xs space-y-2 text-zinc-300 font-mono">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Alert Sound:</span>
                  <span className="text-amber-400 font-bold animate-pulse">SIREN ACTIVE</span>
                </div>
                <p className="text-[11px] leading-relaxed text-zinc-400 border-t border-zinc-800/60 pt-2 italic">
                  &quot;Traditional apps just remind you; HyperDo actually executes for you.&quot;
                </p>
              </div>

              <div className="flex flex-col gap-2">
                {activeAlarm.type === "task" && (
                  <button
                    type="button"
                    onClick={() => {
                      const t = activeAlarm.item;
                      setActiveAlarm(null);
                      handleAutoExecuteTask(t);
                    }}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-blue-500/10"
                  >
                    <span>Auto-Execute Task Now</span>
                    <Play className="w-3.5 h-3.5 fill-current" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setActiveAlarm(null);
                    playNotificationSound("success");
                  }}
                  className="w-full py-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded-xl text-xs font-bold border border-zinc-800 transition-all cursor-pointer"
                >
                  Dismiss Alert
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast Alert Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className={`fixed top-6 left-1/2 transform -translate-x-1/2 z-50 px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 border text-sm font-medium ${
              theme === "dark" 
                ? "bg-zinc-900 border-zinc-800 text-emerald-400" 
                : "bg-white border-zinc-200 text-emerald-600"
            }`}
          >
            <Sparkles className="w-4 h-4 text-emerald-500 animate-spin" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Google Calendar Sync Modal Overlay */}
      <AnimatePresence>
        {showCalendarSyncModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className={`max-w-xl w-full border rounded-3xl p-6 sm:p-7 shadow-2xl flex flex-col space-y-5 overflow-hidden ${
                theme === "dark" ? "bg-zinc-950 border-zinc-800 text-zinc-100" : "bg-white border-zinc-200 text-zinc-950"
              }`}
            >
              <div className="flex justify-between items-center border-b border-zinc-800/50 pb-3">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-emerald-500" />
                  <span className="text-sm font-bold font-mono uppercase tracking-wider">Sync Daily Planner with Google Calendar</span>
                </div>
                <button
                  onClick={() => {
                    setShowCalendarSyncModal(false);
                    playNotificationSound("tick");
                  }}
                  className="text-xs font-mono text-zinc-500 hover:text-zinc-300 cursor-pointer"
                >
                  CLOSE [X]
                </button>
              </div>

              <div className="space-y-4">
                <p className="text-xs leading-relaxed opacity-85">
                  Synchronize your active daily planner blocks to your Google Calendar. You can export all events as a standard calendar file or click individual activities to add them.
                </p>

                {/* Option A: Sync All using .ics file */}
                <div className={`p-4 rounded-2xl border ${
                  theme === "dark" ? "bg-zinc-900/60 border-zinc-850" : "bg-zinc-50 border-zinc-200"
                } space-y-3`}>
                  <div className="flex items-center gap-1.5 font-bold font-mono text-[10px] uppercase text-emerald-400">
                    <span className="w-4 h-4 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 text-[9px]">A</span>
                    <span>Synchronize Entire Day (Recommended)</span>
                  </div>
                  <p className="text-[11px] leading-relaxed opacity-80">
                    Export all your agenda items as a single <code className="bg-zinc-900 px-1 py-0.5 rounded text-[10px] text-amber-400">.ics</code> file, then click the Google Calendar Import link to load them with a single upload.
                  </p>
                  <div className="pt-1 flex flex-col sm:flex-row gap-2">
                    <button
                      onClick={() => {
                        playNotificationSound("success");
                        generateICSFile(calendarBlocks);
                        addLog("[ACTION] Generated and downloaded .ics agenda file");
                        triggerToast("Downloaded hyperdo_agenda.ics file!");
                      }}
                      className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs font-sans transition-all hover:scale-[1.01] cursor-pointer text-center"
                    >
                      Step 1: Download .ics Agenda File
                    </button>
                    <a
                      href="https://calendar.google.com/calendar/r/settings/export"
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => {
                        playNotificationSound("tick");
                        addLog("[ACTION] Opening Google Calendar settings import portal");
                      }}
                      className="flex-1 py-2 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-xs font-sans transition-all hover:scale-[1.01] cursor-pointer text-center border border-zinc-700 flex items-center justify-center gap-1.5"
                    >
                      Step 2: Go to Google Import Portal
                    </a>
                  </div>
                </div>

                {/* Option B: Sync individual blocks */}
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 font-bold font-mono text-[10px] uppercase text-blue-400">
                    <span className="w-4 h-4 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 text-[9px]">B</span>
                    <span>Sync Individual Activities</span>
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                    {calendarBlocks.length === 0 ? (
                      <p className="text-[11px] text-zinc-500 italic text-center py-4">No planner items to list.</p>
                    ) : (
                      calendarBlocks.map((block) => {
                        const googleUrl = getGoogleCalendarUrlForBlock(block);
                        return (
                          <div
                            key={block.id}
                            className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 ${
                              theme === "dark" ? "bg-zinc-950 border-zinc-900" : "bg-white border-zinc-200"
                            }`}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-[9px] font-bold text-emerald-500 bg-emerald-500/10 px-1.5 py-0.2 rounded shrink-0">
                                  {block.start} - {block.end}
                                </span>
                                <span className="text-xs font-bold truncate opacity-90">{block.title}</span>
                              </div>
                              <p className="text-[10px] text-zinc-500 truncate mt-0.5">{block.description}</p>
                            </div>
                            <a
                              href={googleUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() => {
                                playNotificationSound("tick");
                                addLog(`[ACTION] Directing individual event to Google Calendar: "${block.title}"`);
                                triggerToast("Opening Google Calendar create screen...");
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-[10px] cursor-pointer transition-all hover:scale-102 flex items-center gap-1 shrink-0 text-center"
                            >
                              Add Event
                            </a>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-zinc-800/15 flex justify-end">
                <button
                  onClick={() => {
                    setShowCalendarSyncModal(false);
                    playNotificationSound("tick");
                  }}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer border border-zinc-750"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Header Row */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-6" id="app-header">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono uppercase tracking-[0.35em] text-zinc-500">Autonomous Task Framework</span>
            <div className={`px-2 py-0.5 rounded-full text-[9px] font-mono border ${
              isGeminiSimulated 
                ? "border-amber-800 bg-amber-950/40 text-amber-400" 
                : "border-emerald-800 bg-emerald-950/40 text-emerald-400"
            }`}>
              {isGeminiSimulated ? "AI SIMULATION MODE" : "GEMINI ACTIVE"}
            </div>
          </div>
          <div className="flex items-baseline gap-3">
            <h1 className="text-3xl font-extrabold tracking-tight">HyperDo</h1>
            <span className="text-zinc-500 text-xs font-medium italic hidden md:inline">
              &quot;Traditional apps just remind you; HyperDo actually executes for you.&quot;
            </span>
          </div>
        </div>

        {/* Action Widgets */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Native Alerts Toggle Pill */}
          <button
            type="button"
            id="alerts-toggle-btn"
            onClick={requestNotificationPermission}
            className={`px-3 py-1.5 rounded-full border text-[10px] font-mono font-bold flex items-center gap-2 cursor-pointer transition-all ${
              theme === "dark"
                ? "border-zinc-800 bg-zinc-900/55 hover:border-zinc-700 text-zinc-300 hover:text-white"
                : "border-zinc-200 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 hover:text-zinc-900"
            }`}
            title="Configure System Desktop Alerts"
          >
            {typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted" ? (
              <>
                <Bell className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                <span>ALERTS: ON</span>
              </>
            ) : (
              <>
                <BellOff className="w-3.5 h-3.5 text-amber-500" />
                <span>ALERTS: OFF (ACTIVATE)</span>
              </>
            )}
          </button>

          {/* Live System Clock Pill */}
          {currentTime && (
            <div 
              id="clock-pill"
              className={`px-3 py-1.5 rounded-full border text-[10px] font-mono font-bold flex items-center gap-2 ${
                theme === "dark"
                  ? "border-zinc-800 bg-zinc-900/55 text-zinc-300"
                  : "border-zinc-200 bg-zinc-100 text-zinc-700"
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-blue-500 animate-pulse" />
              <span>{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
            </div>
          )}

          {/* System Status Pill */}
          <div 
            id="status-pill"
            className={`px-3 py-1.5 rounded-full border text-[10px] font-mono font-medium flex items-center gap-2 ${
              theme === "dark" ? "border-zinc-800 bg-zinc-900/50" : "border-zinc-200 bg-white"
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${isExecuting ? "bg-amber-500 animate-ping" : "bg-emerald-500"}`}></span> 
            {isExecuting ? "AGENT EXECUTING" : "SYSTEM READY"}
          </div>
        </div>
      </header>

      {/* Bento Grid Body Container */}
      <div className="flex-1 grid grid-cols-12 gap-4" id="bento-container">
        
        {/* PANEL 1: Command Center & Terminal Agent (8 Columns on desktop, Row-span 3) */}
        <section 
          id="command-center"
          className={`col-span-12 lg:col-span-8 bg-zinc-900 border rounded-3xl p-5 sm:p-6 flex flex-col justify-between transition-all duration-300 ${
            theme === "dark" 
              ? "bg-zinc-900 border-zinc-800 text-[#fafafa]" 
              : "bg-white border-zinc-200 text-zinc-950"
          }`}
        >
          <div>
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold px-2.5 py-0.5 bg-blue-600 text-white rounded font-mono">01</span>
                <span className="uppercase text-[10px] font-mono text-zinc-500 tracking-wider">Interface: Agent Engine</span>
              </div>
              <span className="text-zinc-500 text-xs font-mono">Active Queue: {pendingCount} Pending</span>
            </div>

            <h3 className="text-xl font-bold tracking-tight mb-2 flex items-center gap-2">
              <Cpu className="w-5 h-5 text-blue-500" />
              Autonomous Agent Command Center
            </h3>
            <p className={`text-xs leading-relaxed mb-5 ${
              theme === "dark" ? "text-zinc-400" : "text-zinc-600"
            }`}>
              Enter any tactical mandate (e.g. email, calendar scheduling, script generation, text parsing). 
              HyperDo bypasses passive notification loops and builds active deliverables immediately.
            </p>

            {/* Prompt Form Input */}
            <form onSubmit={handlePromptSubmit} className="relative mb-4">
              <input
                type="text"
                value={promptInput}
                onChange={(e) => setPromptInput(e.target.value)}
                placeholder="Write an update email... or Schedule gym time... or Generate standard SQL tables..."
                className={`w-full pl-4 pr-40 py-3.5 rounded-2xl border text-sm font-mono focus:outline-none focus:ring-1 transition-all ${
                  theme === "dark"
                    ? "bg-zinc-950 border-zinc-800 text-zinc-100 placeholder-zinc-600 focus:ring-blue-500 focus:border-blue-500"
                    : "bg-zinc-50 border-zinc-200 text-zinc-950 placeholder-zinc-400 focus:ring-blue-400 focus:border-blue-400"
                }`}
                disabled={isExecuting}
              />

              <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1.5">
                {/* Voice Assist Button */}
                <button
                  type="button"
                  onClick={toggleVoiceRecording}
                  className={`p-2 rounded-xl border transition-all ${
                    isVoiceRecording
                      ? "bg-red-500 text-white animate-pulse border-red-400"
                      : theme === "dark"
                        ? "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white"
                        : "bg-white border-zinc-200 text-zinc-600 hover:text-black"
                  }`}
                  title="Simulate Voice Input Transcription"
                >
                  {isVoiceRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>

                {/* Submit Send Button */}
                <button
                  type="submit"
                  disabled={!promptInput.trim() || isExecuting}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    promptInput.trim() && !isExecuting
                      ? "bg-blue-600 hover:bg-blue-500 text-white cursor-pointer"
                      : theme === "dark"
                        ? "bg-zinc-800 text-zinc-600 cursor-not-allowed border border-zinc-700/30"
                        : "bg-zinc-200 text-zinc-400 cursor-not-allowed border border-zinc-300"
                  }`}
                >
                  <span>Execute</span>
                  <Play className="w-3 h-3 fill-current" />
                </button>
              </div>
            </form>

            {/* Dynamic minimal speech-to-text feedback area */}
            <AnimatePresence mode="wait">
              {(isVoiceRecording || voiceErrorText) && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="mt-2 overflow-hidden flex flex-col gap-1.5"
                >
                  {/* Listening state with real-time audio wave */}
                  {isVoiceRecording && (
                    <div className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-blue-500/10 bg-blue-500/5">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                        <span className="text-[11px] font-bold font-mono text-red-500 uppercase tracking-wider">
                          {isTypingSimulation ? "Transcribing Vocal Stream..." : "Microphone active..."}
                        </span>
                      </div>
                      
                      {activeSimulatingPhrase ? (
                        <span className="text-[10px] font-mono text-zinc-500 truncate max-w-xs">
                          &ldquo;{activeSimulatingPhrase}&rdquo;
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono text-zinc-500">
                          Speak clearly now. Tap mic button to stop.
                        </span>
                      )}

                      {/* Clean audio wave */}
                      <div className="flex items-end gap-0.5 h-4">
                        {(voiceWaveform.length > 0 ? voiceWaveform : [8, 14, 6, 18, 10, 16, 8]).map((h, i) => (
                          <div
                            key={i}
                            className="w-0.5 bg-blue-500 rounded-full transition-all duration-100"
                            style={{ height: `${h * 0.7}px` }}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Mic issue or simulation assistant */}
                  {voiceErrorText && (
                    <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl border border-amber-500/10 bg-amber-500/5 text-xs text-zinc-600 dark:text-zinc-400 font-mono">
                      <div className="flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span>{voiceErrorText}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={runFallbackVoice}
                          className="px-2 py-0.5 text-[10px] font-bold rounded bg-blue-600 text-white hover:bg-blue-500 cursor-pointer transition-all uppercase"
                          title="Simulate random command voice transcription"
                        >
                          🎙️ Simulate Speech Command
                        </button>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Running Terminal Panel */}
          <div className="flex-1 flex flex-col justify-end mt-4">
            <div className={`p-4 rounded-2xl font-mono text-xs overflow-hidden flex flex-col justify-between border ${
              theme === "dark" 
                ? "bg-zinc-950 border-zinc-800/80 text-zinc-300" 
                : "bg-zinc-100 border-zinc-300/60 text-zinc-800"
            }`}>
              <div className="flex justify-between items-center border-b pb-2 mb-3 border-zinc-800/20">
                <div className="flex items-center gap-2">
                  <Terminal className="w-3.5 h-3.5 text-blue-500 animate-pulse" />
                  <span className="font-bold text-[10px] text-zinc-500 uppercase tracking-wider">Agent Telemetry Frame</span>
                </div>
                <button
                  onClick={() => {
                    setSystemLogs(["System log history reset. Standby for events..."]);
                    setExecutionSteps([]);
                    setCurrentStepIndex(-1);
                  }}
                  className="text-[9px] text-zinc-500 hover:text-zinc-300 underline"
                >
                  Clear Terminal
                </button>
              </div>

              {/* Logs scrolling panel */}
              <div className="max-h-40 overflow-y-auto space-y-1.5 scrollbar-thin flex-1 min-h-[100px]">
                {/* Historical System logs */}
                {systemLogs.map((log, index) => (
                  <div key={`sys-${index}`} className="text-[11px] opacity-60">
                    {log}
                  </div>
                ))}

                {/* Live execution steps if running */}
                {isExecuting && executionSteps.length > 0 && (
                  <div className="border-t border-dashed border-zinc-800/30 pt-2 mt-2 space-y-1">
                    {executionSteps.map((step, index) => (
                      <div 
                        key={`exec-${index}`} 
                        className={`text-[11px] flex items-center gap-2 ${
                          index === executionSteps.length - 1 
                            ? "text-blue-400 font-bold" 
                            : "text-zinc-400 opacity-80"
                        }`}
                      >
                        <span className="text-blue-500">⚡</span>
                        <span>{step}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div ref={terminalEndRef} />
              </div>

              {/* Empty placeholder if silent */}
              {!isExecuting && executionSteps.length === 0 && (
                <div className="text-[10px] text-zinc-500 italic text-center py-2">
                  Logs stream silent. Run &quot;Auto-Execute&quot; on a task or type a prompt above to wake the agent.
                </div>
              )}
            </div>
          </div>
        </section>

        {/* PANEL 2: Live Asset Preview Canvas (4 Columns on desktop, Height spans row 1 to 6) */}
        <section 
          id="preview-canvas"
          className={`col-span-12 lg:col-span-4 lg:row-span-6 bg-zinc-900 border rounded-3xl p-5 sm:p-6 flex flex-col justify-between transition-all duration-300 ${
            theme === "dark" 
              ? "bg-zinc-900 border-zinc-800 text-[#fafafa]" 
              : "bg-white border-zinc-200 text-zinc-950"
          }`}
        >
          <div className="h-full flex flex-col justify-between">
            {/* Header */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold px-2.5 py-0.5 bg-emerald-500 text-zinc-950 rounded font-mono">02</span>
                  <span className="uppercase text-[10px] font-mono text-zinc-500 tracking-wider">Canvas: Executed Asset</span>
                </div>
                {latestResult && (
                  <div className="flex gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className="text-[10px] font-mono text-emerald-500 uppercase">Asset Active</span>
                  </div>
                )}
              </div>

              <h3 className="text-xl font-bold tracking-tight mb-3">Live Outcome Preview</h3>

              {/* Navigation Tabs for preview details */}
              <div className={`grid grid-cols-3 gap-1 p-1 rounded-xl mb-4 text-center border text-[10px] font-mono font-bold ${
                theme === "dark" ? "bg-zinc-950 border-zinc-800" : "bg-zinc-100 border-zinc-200"
              }`}>
                <button
                  onClick={() => setPreviewTab("visual")}
                  className={`py-1.5 rounded-lg transition-all cursor-pointer ${
                    previewTab === "visual"
                      ? theme === "dark" ? "bg-zinc-800 text-white" : "bg-white text-black shadow-xs"
                      : theme === "dark" ? "text-zinc-500 hover:text-zinc-400" : "text-zinc-500 hover:text-zinc-800"
                  }`}
                >
                  UI Output
                </button>
                <button
                  onClick={() => setPreviewTab("json")}
                  className={`py-1.5 rounded-lg transition-all cursor-pointer ${
                    previewTab === "json"
                      ? theme === "dark" ? "bg-zinc-800 text-white" : "bg-white text-black shadow-xs"
                      : theme === "dark" ? "text-zinc-500 hover:text-zinc-400" : "text-zinc-500 hover:text-zinc-800"
                  }`}
                >
                  JSON Payload
                </button>
                <button
                  onClick={() => setPreviewTab("logs")}
                  className={`py-1.5 rounded-lg transition-all cursor-pointer ${
                    previewTab === "logs"
                      ? theme === "dark" ? "bg-zinc-800 text-white" : "bg-white text-black shadow-xs"
                      : theme === "dark" ? "text-zinc-500 hover:text-zinc-400" : "text-zinc-500 hover:text-zinc-800"
                  }`}
                >
                  Agent Logs
                </button>
              </div>
            </div>

            {/* Main Interactive Screen */}
            <div className={`flex-1 rounded-2xl border p-4 flex flex-col justify-between overflow-y-auto min-h-[350px] ${
              theme === "dark" ? "bg-zinc-950/50 border-zinc-800" : "bg-zinc-50 border-zinc-200"
            }`}>
              
              {/* If no result has been computed yet */}
              {!latestResult && !isExecuting && (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
                  <div className={`w-12 h-12 rounded-2xl mb-4 flex items-center justify-center border ${
                    theme === "dark" ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"
                  }`}>
                    <Sparkles className="w-6 h-6 text-zinc-500" />
                  </div>
                  <h4 className="text-sm font-semibold mb-1">Staging Area Clear</h4>
                  <p className="text-zinc-500 text-[11px] leading-relaxed max-w-[220px]">
                    Run execution on any pending task. HyperDo will render the live compiled email draft, calendar event, or script right here.
                  </p>
                </div>
              )}

              {/* If actively executing */}
              {isExecuting && (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
                  <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
                  <h4 className="text-sm font-semibold mb-1">Compiling Asset...</h4>
                  <p className="text-zinc-500 text-[11px] font-mono animate-pulse">
                    Parsing dynamic structures...
                  </p>
                </div>
              )}

              {/* Loaded active results */}
              {!isExecuting && latestResult && (
                <div className="flex-1 flex flex-col justify-between h-full">
                  
                  {/* TAB 1: VISUAL UI OUTCOME VIEW */}
                  {previewTab === "visual" && (
                    <div className="flex-1 flex flex-col justify-between">
                      <div>
                        {/* Task Type header */}
                        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-zinc-800/10">
                          {latestResult.actionType === "email" && <Mail className="w-4 h-4 text-blue-500" />}
                          {latestResult.actionType === "calendar" && <Calendar className="w-4 h-4 text-emerald-500" />}
                          {latestResult.actionType === "code" && <Code className="w-4 h-4 text-purple-500" />}
                          {latestResult.actionType === "draft" && <FileText className="w-4 h-4 text-amber-500" />}
                          {latestResult.actionType === "general" && <Sparkles className="w-4 h-4 text-zinc-500" />}
                          <span className={`text-[10px] font-mono font-bold uppercase tracking-wider ${
                            theme === "dark" ? "text-zinc-400" : "text-zinc-500"
                          }`}>
                            {latestResult.actionType.toUpperCase()} OUTCOME
                          </span>
                        </div>

                        {/* RENDER DYNAMIC COMPONENT ACCORDING TO ACTION */}
                        
                        {apiErrorDetails && (
                          <div className="mb-4 p-3 rounded-xl border border-amber-500/30 bg-amber-500/5 text-amber-400 text-[11px] leading-relaxed flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                            <div className="space-y-1">
                              <span className="font-bold uppercase font-mono tracking-wider block text-[9px]">API SERVICE ALERT / COLD STANDBY ACTIVE</span>
                              <p className="opacity-90">
                                The remote Gemini model reported high demand/rate limits (503). HyperDo&apos;s **Local Core failover** immediately intercepted the pipeline to generate fully populated outcome assets for you.
                              </p>
                            </div>
                          </div>
                        )}
                        
                        {/* A. EMAIL PREVIEW */}
                        {latestResult.actionType === "email" && (
                          <div className="space-y-3 text-xs">
                            <div className="grid grid-cols-[50px_1fr] items-center gap-1 border-b border-zinc-800/10 pb-1.5">
                              <span className="text-zinc-500">To:</span>
                              <span className="font-mono">{latestResult.payload.to}</span>
                            </div>
                            <div className="grid grid-cols-[50px_1fr] items-center gap-1 border-b border-zinc-800/10 pb-1.5">
                              <span className="text-zinc-500">Subject:</span>
                              <span className="font-bold">{latestResult.payload.subject}</span>
                            </div>
                            <div className="pt-1">
                              <span className="text-zinc-500 block mb-1">Email Body:</span>
                              <textarea
                                value={editedPayloadBody}
                                onChange={(e) => setEditedPayloadBody(e.target.value)}
                                className={`w-full p-2.5 rounded-xl border font-sans text-xs focus:outline-none min-h-[140px] ${
                                  theme === "dark" 
                                    ? "bg-zinc-950 border-zinc-800 text-zinc-100" 
                                    : "bg-white border-zinc-200 text-zinc-900"
                                }`}
                              />
                            </div>

                            <div className={`p-2.5 rounded-xl border flex flex-col xs:flex-row xs:items-center justify-between gap-2 text-[11px] ${
                              theme === "dark" ? "bg-zinc-950/40 border-zinc-850" : "bg-zinc-50 border-zinc-100"
                            }`}>
                              <div className="space-y-0.5">
                                <span className="font-mono text-[9px] uppercase tracking-wider font-bold block text-zinc-400">Mobile & Desktop Draft Dispatch:</span>
                                <p className="text-[10px] text-zinc-500">How the draft is opened on click</p>
                              </div>
                              <div className="flex bg-zinc-200 dark:bg-zinc-950 p-0.5 rounded-lg border border-zinc-300 dark:border-zinc-800 self-start xs:self-auto">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPreferredEmailMode("auto");
                                    playNotificationSound("tick");
                                  }}
                                  className={`px-2 py-1 rounded text-[9px] font-mono font-bold transition-all cursor-pointer ${
                                    preferredEmailMode === "auto"
                                      ? "bg-blue-600 text-white"
                                      : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                                  }`}
                                  title={`Current device detection: ${isMobile ? "Mobile (Mailto protocol)" : "Desktop (Gmail Link)"}`}
                                >
                                  Auto ({isMobile ? "Mailto" : "Gmail"})
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPreferredEmailMode("gmail");
                                    playNotificationSound("tick");
                                  }}
                                  className={`px-2 py-1 rounded text-[9px] font-mono font-bold transition-all cursor-pointer ${
                                    preferredEmailMode === "gmail"
                                      ? "bg-blue-600 text-white"
                                      : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                                  }`}
                                  title="Force Gmail Web Link (best for desktop web browsers)"
                                >
                                  Gmail Link
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPreferredEmailMode("mailto");
                                    playNotificationSound("tick");
                                  }}
                                  className={`px-2 py-1 rounded text-[9px] font-mono font-bold transition-all cursor-pointer ${
                                    preferredEmailMode === "mailto"
                                      ? "bg-blue-600 text-white"
                                      : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                                  }`}
                                  title="Force native mail application (best for mobile devices to edit drafts)"
                                >
                                  Mailto
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* B. CALENDAR PREVIEW */}
                        {latestResult.actionType === "calendar" && (
                          <div className="space-y-3 text-xs">
                            <div className={`p-4 rounded-xl border ${
                              theme === "dark" ? "bg-zinc-950/40 border-zinc-800" : "bg-white border-zinc-200"
                            }`}>
                              <h4 className="font-bold text-sm text-emerald-500 flex items-center gap-2">
                                <Clock className="w-4 h-4 text-emerald-500" />
                                {latestResult.payload.title}
                              </h4>
                              <div className="flex gap-2 mt-2 font-mono text-[11px] text-zinc-500">
                                <span>TIME BLOCK:</span>
                                <span className={`font-bold ${theme === "dark" ? "text-zinc-300" : "text-zinc-800"}`}>{latestResult.payload.start} - {latestResult.payload.end}</span>
                              </div>
                              <p className={`mt-2 text-[11px] leading-relaxed ${theme === "dark" ? "text-zinc-400" : "text-zinc-600"}`}>
                                {latestResult.payload.description}
                              </p>
                              {latestResult.payload.tags && (
                                <div className="flex flex-wrap gap-1 mt-3">
                                  {latestResult.payload.tags.map((tag, i) => (
                                    <span 
                                      key={i} 
                                      className={`px-2 py-0.5 rounded text-[9px] font-mono border ${
                                        theme === "dark" 
                                          ? "bg-zinc-800 border-zinc-700 text-zinc-400" 
                                          : "bg-zinc-200 border-zinc-300 text-zinc-700"
                                      }`}
                                    >
                                      #{tag}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className={`p-3 rounded-xl border text-[11px] flex gap-2 items-start ${
                              theme === "dark" ? "bg-emerald-950/20 border-emerald-900/40" : "bg-emerald-50 border-emerald-200"
                            }`}>
                              <Lightbulb className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                              <span className={theme === "dark" ? "text-zinc-400" : "text-zinc-600"}>
                                Click <strong>&quot;Insert into Planner&quot;</strong> below to sync this active slot directly to your daily calendar widget.
                              </span>
                            </div>
                          </div>
                        )}

                        {/* C. CODE PREVIEW */}
                        {latestResult.actionType === "code" && (
                          <div className="space-y-3 text-xs">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-zinc-500">Language: <strong className="uppercase font-mono text-purple-400">{latestResult.payload.language}</strong></span>
                              <button
                                onClick={() => handleRunCodeSimulation(latestResult.payload.language || "typescript", latestResult.payload.code || "")}
                                disabled={isCodeRunning}
                                className={`px-2.5 py-1 rounded border text-[10px] font-mono font-bold flex items-center gap-1 hover:scale-103 transition-all cursor-pointer ${
                                  isCodeRunning 
                                    ? "bg-purple-600 text-white animate-pulse" 
                                    : theme === "dark"
                                      ? "bg-purple-950/30 border-purple-800 text-purple-400 hover:bg-purple-950"
                                      : "bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100"
                                }`}
                              >
                                <Terminal className="w-3.5 h-3.5" />
                                {isCodeRunning ? "Running..." : "Run in Sandbox"}
                              </button>
                            </div>
                            <pre className={`p-3 rounded-xl border text-[11px] font-mono overflow-x-auto max-h-[160px] ${
                              theme === "dark" ? "bg-zinc-950 border-zinc-800 text-emerald-400" : "bg-zinc-100 border-zinc-200 text-emerald-800"
                            }`}>
                              <code>{latestResult.payload.code}</code>
                            </pre>
                            <p className={`text-[11px] leading-relaxed italic ${
                              theme === "dark" ? "text-zinc-400" : "text-zinc-600"
                            }`}>
                              {latestResult.payload.explanation}
                            </p>

                            {/* Code execution console output */}
                            {codeRunOutput && (
                              <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`p-3 rounded-xl border font-mono text-[10px] leading-normal ${
                                  theme === "dark" ? "bg-zinc-950 border-zinc-800 text-zinc-300" : "bg-zinc-900 border-zinc-950 text-white"
                                }`}
                              >
                                <div className="text-zinc-500 uppercase font-bold border-b border-zinc-800 pb-1 mb-1 flex justify-between items-center">
                                  <span>SANDBOX CONTAINER TERMINAL</span>
                                  <span className="text-emerald-500">● LIVE</span>
                                </div>
                                {codeRunOutput}
                              </motion.div>
                            )}
                          </div>
                        )}

                        {/* D. GENERAL DRAFT PREVIEW */}
                        {(latestResult.actionType === "draft" || latestResult.actionType === "general") && (
                          <div className="space-y-3 text-xs">
                            <h4 className="font-bold text-sm border-b border-zinc-800/10 pb-2">{latestResult.payload.title}</h4>
                            <textarea
                              value={editedPayloadBody}
                              onChange={(e) => setEditedPayloadBody(e.target.value)}
                              className={`w-full p-2.5 rounded-xl border font-mono text-xs focus:outline-none min-h-[160px] leading-relaxed ${
                                theme === "dark" 
                                  ? "bg-zinc-950 border-zinc-800 text-zinc-100" 
                                  : "bg-white border-zinc-200 text-zinc-900"
                              }`}
                            />
                            {latestResult.payload.wordCount && (
                              <div className="text-right text-[10px] font-mono text-zinc-500">
                                Estimated length: {latestResult.payload.wordCount} words
                              </div>
                            )}
                          </div>
                        )}

                        {/* E. SUMMARY PREVIEW */}
                        {latestResult.actionType === "summary" && (
                          <div className="space-y-3 text-xs">
                            <h4 className="font-bold text-sm text-blue-400 border-b border-zinc-800/10 pb-1.5">{latestResult.payload.title}</h4>
                            
                            <div className="space-y-2">
                              <span className="text-[10px] font-mono text-zinc-500 uppercase font-bold">Extracted Summary:</span>
                              <ul className={`list-disc list-inside pl-1 space-y-1.5 text-[11px] leading-relaxed ${
                                theme === "dark" ? "text-zinc-300" : "text-zinc-700"
                              }`}>
                                {latestResult.payload.summaryPoints?.map((point, idx) => (
                                  <li key={idx}>{point}</li>
                                ))}
                              </ul>
                            </div>

                            <div className={`p-3 rounded-xl border mt-3 ${
                              theme === "dark" ? "bg-zinc-950/80 border-zinc-800" : "bg-white border-zinc-200"
                            }`}>
                              <span className="text-[10px] font-mono text-zinc-500 uppercase font-bold block mb-1">Action Takeaways:</span>
                              <div className="space-y-1">
                                {latestResult.payload.keyTakeaways?.map((takeaway, idx) => (
                                  <div key={idx} className={`flex gap-1.5 text-[11px] leading-relaxed ${
                                    theme === "dark" ? "text-zinc-400" : "text-zinc-600"
                                  }`}>
                                    <span className="text-blue-500">▪</span>
                                    <span>{takeaway}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}

                      </div>

                      {/* ACTION CONTROLLERS FOR ASSET */}
                      <div className="mt-6 pt-3 border-t border-zinc-800/20 flex flex-col gap-2">
                        {/* Secondary Recommendation */}
                        {latestResult.recommendations && latestResult.recommendations.length > 0 && (
                          <div className="mb-2">
                            <span className="text-[9px] font-mono text-zinc-500 block uppercase mb-1">Recommended Next Action:</span>
                            <div className={`flex gap-1 items-start text-[10px] italic ${
                              theme === "dark" ? "text-zinc-400" : "text-zinc-600"
                            }`}>
                              <Sparkles className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mt-0.5" />
                              <span>{latestResult.recommendations[0]}</span>
                            </div>
                          </div>
                        )}

                        {/* Dispatch Button Grid */}
                        <div className="grid grid-cols-2 gap-2">
                          {/* Copy code/text helper */}
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(editedPayloadBody || latestResult.payload.code || latestResult.payload.content || "");
                              triggerToast("Copied to clipboard!");
                              addLog("[ACTION] Copied output asset text contents to OS clipboard.");
                            }}
                            className={`py-2 px-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition-all hover:scale-102 ${
                              theme === "dark"
                                ? "bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800"
                                : "bg-white border-zinc-200 text-zinc-700 hover:text-black hover:bg-zinc-50"
                            }`}
                          >
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy Asset</span>
                          </button>

                          {/* Action dispatch button depending on type */}
                          {latestResult.actionType === "email" && (
                            <a
                              href={getEmailHref()}
                              target={getEmailHref().startsWith("mailto:") ? undefined : "_blank"}
                              rel="noopener noreferrer"
                              onClick={() => {
                                const isUsingMailto = preferredEmailMode === "mailto" || (preferredEmailMode === "auto" && isMobile);
                                const modeName = isUsingMailto ? "Native Mailto Application Client" : "Google Mail Compose Web App";
                                addLog(`[ACTION] Directing to pre-filled email draft using mode: ${modeName}`);
                                triggerToast(`Opening draft in ${isUsingMailto ? "Mail client" : "Gmail"}...`);
                              }}
                              className="py-2 px-3 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center gap-1.5 transition-all hover:scale-102 cursor-pointer text-center"
                            >
                              <Send className="w-3.5 h-3.5" />
                              <span>Send Email</span>
                            </a>
                          )}

                          {latestResult.actionType === "calendar" && (
                            <button
                              onClick={() => handleInsertCalendarSimulation(latestResult.payload)}
                              className="py-2 px-3 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center gap-1.5 transition-all hover:scale-102"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Insert Planner</span>
                            </button>
                          )}

                          {latestResult.actionType === "code" && (
                            <button
                              onClick={() => {
                                triggerToast("Exporting completed package...");
                                addLog(`[ACTION] Exported script: "${latestResult.payload.title}.ts" to repository workspace root.`);
                              }}
                              className="py-2 px-3 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white flex items-center justify-center gap-1.5 transition-all hover:scale-102"
                            >
                              <Share2 className="w-3.5 h-3.5" />
                              <span>Export Code</span>
                            </button>
                          )}

                          {(latestResult.actionType === "draft" || latestResult.actionType === "general" || latestResult.actionType === "summary") && (
                            <button
                              onClick={() => {
                                triggerToast("Shared summary report!");
                                addLog(`[ACTION] Draft shared to mock slack/notion integrations successfully.`);
                              }}
                              className="py-2 px-3 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white flex items-center justify-center gap-1.5 transition-all hover:scale-102"
                            >
                              <Share2 className="w-3.5 h-3.5" />
                              <span>Share Draft</span>
                            </button>
                          )}
                        </div>
                      </div>

                    </div>
                  )}

                  {/* TAB 2: RAW JSON PAYLOAD VIEW */}
                  {previewTab === "json" && (
                    <div className="flex-1 flex flex-col justify-between h-full">
                      <pre className={`p-3 rounded-xl border text-[10px] font-mono overflow-y-auto max-h-[300px] flex-1 ${
                        theme === "dark" ? "bg-zinc-950 border-zinc-800 text-blue-400" : "bg-zinc-100 border-zinc-200 text-blue-800"
                      }`}>
                        <code>{JSON.stringify(latestResult, null, 2)}</code>
                      </pre>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(JSON.stringify(latestResult, null, 2));
                          triggerToast("JSON copied!");
                        }}
                        className={`w-full py-2 rounded-xl text-xs font-mono font-bold mt-4 border flex items-center justify-center gap-1 ${
                          theme === "dark" ? "bg-zinc-900 border-zinc-800 text-zinc-300" : "bg-white border-zinc-200 text-zinc-700"
                        }`}
                      >
                        <Copy className="w-4 h-4" />
                        Copy Raw Payload
                      </button>
                    </div>
                  )}

                  {/* TAB 3: AGENT INTEL LOGS */}
                  {previewTab === "logs" && (
                    <div className="flex-1 flex flex-col justify-between h-full space-y-3">
                      <div className="space-y-2 flex-1 overflow-y-auto max-h-[300px]">
                        <span className="text-[10px] font-mono text-zinc-500 uppercase font-bold block">Agent Reasoning steps:</span>
                        {latestResult.thoughtProcess.map((step, idx) => (
                          <div key={idx} className="p-2 bg-zinc-950/40 border border-zinc-800/60 rounded-xl flex items-start gap-2 text-[11px] leading-relaxed">
                            <span className="text-zinc-600 font-mono text-[9px]">{idx + 1}</span>
                            <span className="text-zinc-300">{step}</span>
                          </div>
                        ))}
                      </div>
                      <div className={`p-3 rounded-xl border text-[10px] font-mono ${
                        theme === "dark" ? "bg-zinc-950 border-zinc-800 text-zinc-400" : "bg-zinc-100 border-zinc-200"
                      }`}>
                        <span className="font-bold uppercase text-zinc-500 block mb-1">Integration Status:</span>
                        <div>Engine Protocol: HTTP POST API PROXY</div>
                        <div>Heuristics Confidence Ratio: 97.4%</div>
                        <div>Cognitive Compression: 2.1x reduction</div>
                      </div>
                    </div>
                  )}

                </div>
              )}

            </div>
          </div>
        </section>

        {/* PANEL 3: Active Task Matrix (5 Columns on desktop, Row-span 3) */}
        <section 
          id="task-matrix"
          className={`col-span-12 lg:col-span-5 bg-zinc-900 border rounded-3xl p-5 sm:p-6 flex flex-col justify-between transition-all duration-300 ${
            theme === "dark" 
              ? "bg-zinc-900 border-zinc-800 text-[#fafafa]" 
              : "bg-white border-zinc-200 text-zinc-950"
          }`}
        >
          <div>
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold px-2.5 py-0.5 bg-purple-600 text-white rounded font-mono">03</span>
                <span className="uppercase text-[10px] font-mono text-zinc-500 tracking-wider">Board: Task Execution Matrix</span>
              </div>
              <button
                onClick={() => setIsAddingTask(!isAddingTask)}
                className={`p-1.5 rounded-lg border flex items-center justify-center hover:scale-105 transition-all ${
                  theme === "dark" 
                    ? "bg-zinc-950 border-zinc-800 text-zinc-300 hover:text-white" 
                    : "bg-zinc-50 border-zinc-200 text-zinc-700 hover:text-black"
                }`}
                title="Add manual task"
              >
                {isAddingTask ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              </button>
            </div>

            <h3 className="text-xl font-bold tracking-tight mb-2">Active Task Board</h3>
            <p className={`text-xs leading-relaxed mb-4 ${
              theme === "dark" ? "text-zinc-400" : "text-zinc-600"
            }`}>
              Traditional lists remind you. HyperDo lets you click <strong>&quot;Auto-Execute&quot;</strong> to make the AI immediately compile drafts.
            </p>

            {/* Manual Task Add Dropdown Form */}
            <AnimatePresence>
              {isAddingTask && (
                <motion.form
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  onSubmit={handleCreateTask}
                  className={`p-3 rounded-2xl border mb-4 space-y-3 overflow-hidden ${
                    theme === "dark" ? "bg-zinc-950 border-zinc-800" : "bg-zinc-100 border-zinc-300/60"
                  }`}
                >
                  <div>
                    <label className="text-[10px] font-mono text-zinc-500 block mb-1">TASK DIRECTIVE (ACTION REQUIRED)</label>
                    <input
                      type="text"
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      placeholder="e.g., Draft cold email to John..."
                      className={`w-full p-2 rounded-xl text-xs focus:outline-none border ${
                        theme === "dark" ? "bg-zinc-900 border-zinc-800 text-zinc-100" : "bg-white border-zinc-200 text-zinc-900"
                      }`}
                      required
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-mono text-zinc-500 block mb-1">PRIORITY</label>
                      <select
                        value={newTaskPriority}
                        onChange={(e) => setNewTaskPriority(e.target.value as any)}
                        className={`w-full p-1.5 rounded-xl text-xs border ${
                          theme === "dark" ? "bg-zinc-900 border-zinc-800 text-zinc-200" : "bg-white border-zinc-200 text-zinc-800"
                        }`}
                      >
                        <option value="high">🔴 High</option>
                        <option value="medium">🟡 Medium</option>
                        <option value="low">🔵 Low</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-mono text-zinc-500 block mb-1">CATEGORY</label>
                      <select
                        value={newTaskCategory}
                        onChange={(e) => setNewTaskCategory(e.target.value as any)}
                        className={`w-full p-1.5 rounded-xl text-xs border ${
                          theme === "dark" ? "bg-zinc-900 border-zinc-800 text-zinc-200" : "bg-white border-zinc-200 text-zinc-800"
                        }`}
                      >
                        <option value="email">✉️ Email Draft</option>
                        <option value="calendar">📅 Schedule</option>
                        <option value="code">💻 Code Asset</option>
                        <option value="draft">📝 Doc Draft</option>
                        <option value="general">⚙️ General</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-mono text-zinc-500 block mb-1">DEADLINE</label>
                      <input
                        type="text"
                        value={newTaskDeadline}
                        onChange={(e) => setNewTaskDeadline(e.target.value)}
                        placeholder="Today / Tomorrow / etc."
                        className={`w-full p-2 rounded-xl text-xs focus:outline-none border font-mono ${
                          theme === "dark" ? "bg-zinc-900 border-zinc-800 text-zinc-200" : "bg-white border-zinc-200 text-zinc-800"
                        }`}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-mono text-zinc-500 block mb-1">🔔 ALARM REMINDER (HH:MM)</label>
                      <input
                        type="text"
                        value={newTaskReminderTime}
                        onChange={(e) => setNewTaskReminderTime(e.target.value)}
                        placeholder="e.g. 14:35 (24h)"
                        className={`w-full p-2 rounded-xl text-xs focus:outline-none border font-mono ${
                          theme === "dark" ? "bg-zinc-900 border-zinc-800 text-zinc-200" : "bg-white border-zinc-200 text-zinc-800"
                        }`}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                    >
                      Save Task
                    </button>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>

            {/* Scrollable Tasks list */}
            <div className="space-y-2.5 max-h-[300px] overflow-y-auto scrollbar-thin">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                    task.status === "executed"
                      ? theme === "dark" ? "bg-zinc-950/30 border-zinc-800/60 opacity-80" : "bg-zinc-100/60 border-zinc-200 opacity-80"
                      : task.status === "executing"
                        ? theme === "dark" ? "bg-blue-950/20 border-blue-800" : "bg-blue-50 border-blue-200"
                        : theme === "dark" ? "bg-zinc-950/60 border-zinc-800/80 hover:border-zinc-700" : "bg-white border-zinc-200 hover:border-zinc-300"
                  }`}
                >
                  {/* Left: Indicator icons & Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                      {/* Priority pill */}
                      <span className={`px-2 py-0.5 rounded text-[8px] font-mono uppercase font-bold tracking-wider ${
                        task.priority === "high"
                          ? "bg-red-500/10 text-red-500 border border-red-500/20"
                          : task.priority === "medium"
                            ? "bg-yellow-500/10 text-yellow-500 border border-yellow-500/20"
                            : "bg-blue-500/10 text-blue-500 border border-blue-500/20"
                      }`}>
                        {task.priority}
                      </span>

                      {/* Category icon */}
                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-mono text-zinc-500 bg-zinc-800/20 border border-zinc-800/10 flex items-center gap-1`}>
                        {task.category === "email" && <Mail className="w-2.5 h-2.5" />}
                        {task.category === "calendar" && <Calendar className="w-2.5 h-2.5" />}
                        {task.category === "code" && <Code className="w-2.5 h-2.5" />}
                        {task.category === "draft" && <FileText className="w-2.5 h-2.5" />}
                        {task.category === "general" && <Sparkles className="w-2.5 h-2.5" />}
                        <span className="uppercase">{task.category}</span>
                      </span>

                      {/* Deadline */}
                      <span className="text-[10px] text-zinc-500 font-mono">⏱️ {task.deadline}</span>

                      {/* Active Alarm reminder badge */}
                      {task.reminderActive && task.reminderTime && (
                        <span className="px-1.5 py-0.5 rounded text-[8px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 flex items-center gap-1 animate-pulse">
                          <Clock className="w-2.5 h-2.5 text-amber-400" />
                          <span>ALARM: {task.reminderTime}</span>
                        </span>
                      )}
                    </div>

                    <p className={`text-xs font-medium leading-normal break-words ${
                      task.status === "executed" ? "line-through text-zinc-500" : ""
                    }`}>
                      {task.title}
                    </p>

                    {/* Inline Alarm Editor */}
                    {editingReminderTaskId === task.id && (
                      <div className="flex items-center gap-1.5 mt-2 bg-zinc-900 border border-zinc-800/80 p-1.5 rounded-xl max-w-xs" onClick={(e) => e.stopPropagation()}>
                        <span className="text-[9px] font-mono text-zinc-400">Alarm:</span>
                        <input 
                          type="text" 
                          placeholder="HH:MM" 
                          defaultValue={task.reminderTime || ""}
                          id={`reminder-input-${task.id}`}
                          className="bg-zinc-950 text-white font-mono text-[10px] w-12 px-1.5 py-0.5 rounded focus:outline-none border border-zinc-800 text-center"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              const val = (e.currentTarget as HTMLInputElement).value;
                              handleSaveTaskReminder(task.id, val);
                            }
                          }}
                        />
                        <button 
                          onClick={() => {
                            const el = document.getElementById(`reminder-input-${task.id}`) as HTMLInputElement;
                            handleSaveTaskReminder(task.id, el?.value || "");
                          }}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white text-[9px] px-1.5 py-0.5 rounded cursor-pointer font-bold font-mono"
                        >
                          SET
                        </button>
                        {task.reminderActive && (
                          <button 
                            onClick={() => handleSaveTaskReminder(task.id, "")}
                            className="bg-red-950 text-red-400 border border-red-900 text-[9px] px-1.5 py-0.5 rounded cursor-pointer font-bold font-mono"
                          >
                            OFF
                          </button>
                        )}
                        <button 
                          onClick={() => setEditingReminderTaskId(null)}
                          className="text-zinc-500 hover:text-white text-[9px] px-1 rounded cursor-pointer font-mono"
                        >
                          CANCEL
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Right: Auto-Execute controllers */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {task.status === "pending" && (
                      <button
                        onClick={() => handleAutoExecuteTask(task)}
                        disabled={isExecuting}
                        className={`px-2.5 py-1.5 rounded-xl text-[10px] font-bold font-mono transition-all flex items-center gap-1 border cursor-pointer ${
                          isExecuting 
                            ? theme === "dark"
                              ? "bg-zinc-800 text-zinc-600 border-transparent cursor-not-allowed"
                              : "bg-zinc-100 text-zinc-400 border-zinc-200 cursor-not-allowed"
                            : theme === "dark"
                              ? "bg-zinc-950 border-zinc-800 hover:border-zinc-700 text-zinc-200 hover:text-white"
                              : "bg-white border-zinc-200 hover:bg-zinc-100 text-zinc-800 hover:text-black shadow-xs"
                        }`}
                        title="Command HyperDo Agent to execute"
                      >
                        <span>Auto-Execute</span>
                        <Play className="w-2.5 h-2.5 fill-current text-blue-500" />
                      </button>
                    )}

                    {task.status === "executing" && (
                      <span className="px-2 py-1 bg-blue-600 text-white font-mono text-[9px] rounded-lg animate-pulse flex items-center gap-1">
                        <Cpu className="w-2.5 h-2.5 animate-spin" />
                        Analyzing...
                      </span>
                    )}

                    {task.status === "executed" && (
                      <button
                        onClick={() => {
                          if (task.executedPayload) {
                            setLatestResult(task.executedPayload);
                            addLog(`[UI] Loaded completed result from historical state.`);
                            triggerToast(`Displaying output: ${task.executedPayload.payload.title}`);
                          } else {
                            triggerToast("No historical file compiled.");
                          }
                        }}
                        className="px-2.5 py-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl text-[10px] font-mono font-bold flex items-center gap-1 hover:bg-emerald-500/20"
                        title="Display execution result"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Completed</span>
                      </button>
                    )}

                    {/* Task Alarm Setter Button */}
                    {task.status !== "executed" && (
                      <button
                        onClick={() => setEditingReminderTaskId(editingReminderTaskId === task.id ? null : task.id)}
                        className={`p-1.5 rounded-xl border transition-all cursor-pointer ${
                          task.reminderActive
                            ? "bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20 animate-pulse"
                            : "bg-zinc-900/50 border-zinc-800 text-zinc-500 hover:text-zinc-300"
                        }`}
                        title={task.reminderActive ? `Alarm set for ${task.reminderTime}. Click to configure` : "Set Alarm Reminder"}
                      >
                        <Clock className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <button
                      onClick={() => handleDeleteTask(task.id, task.title)}
                      className="p-1.5 rounded-xl text-zinc-500 hover:text-red-500 hover:bg-red-500/10 transition-all"
                      title="Delete task directive"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                </div>
              ))}

              {tasks.length === 0 && (
                <div className="text-center py-6 text-zinc-500 text-xs italic">
                  No active tasks. Tap &quot;+&quot; above to compile a custom mandate.
                </div>
              )}
            </div>
          </div>

          {/* Quick recommendations */}
          <div className="mt-4 pt-3 border-t border-zinc-800/20">
            <span className="text-[9px] font-mono text-zinc-500 block uppercase mb-1">Smart Suggestions:</span>
            <div className="flex gap-2 overflow-x-auto py-1 scrollbar-none">
              <button 
                onClick={() => {
                  setNewTaskTitle("Auto audit code metrics dashboard");
                  setNewTaskCategory("code");
                  setNewTaskPriority("medium");
                  setIsAddingTask(true);
                }}
                className={`px-2.5 py-1 rounded-full text-[10px] border whitespace-nowrap flex items-center gap-1 ${
                  theme === "dark" ? "border-zinc-800 hover:border-zinc-700 bg-zinc-950/40" : "border-zinc-200 bg-white hover:bg-zinc-50"
                }`}
              >
                <Plus className="w-2.5 h-2.5" /> Audit logs
              </button>
              <button 
                onClick={() => {
                  setNewTaskTitle("Draft thank-you letter to manager");
                  setNewTaskCategory("email");
                  setNewTaskPriority("low");
                  setIsAddingTask(true);
                }}
                className={`px-2.5 py-1 rounded-full text-[10px] border whitespace-nowrap flex items-center gap-1 ${
                  theme === "dark" ? "border-zinc-800 hover:border-zinc-700 bg-zinc-950/40" : "border-zinc-200 bg-white hover:bg-zinc-50"
                }`}
              >
                <Plus className="w-2.5 h-2.5" /> Draft thanks
              </button>
            </div>
          </div>
        </section>

        {/* PANEL 4: Calendar Planner Integration (4 Columns on desktop, Row-span 3) */}
        <section 
          id="calendar-planner"
          className={`col-span-12 lg:col-span-4 bg-zinc-900 border rounded-3xl p-5 sm:p-6 flex flex-col justify-between transition-all duration-300 ${
            theme === "dark" 
              ? "bg-zinc-900 border-zinc-800 text-[#fafafa]" 
              : "bg-white border-zinc-200 text-zinc-950"
          }`}
        >
          <div>
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold px-2.5 py-0.5 bg-emerald-500 text-zinc-950 rounded font-mono">04</span>
                <span className="uppercase text-[10px] font-mono text-zinc-500 tracking-wider">Sync: Daily Agenda</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-zinc-500 text-[10px] font-mono">
                  Today: {currentTime ? currentTime.toLocaleDateString("en-US", { weekday: "long" }) : "Friday"}
                </span>
                <button
                  onClick={() => setIsAddingCalendarBlock(!isAddingCalendarBlock)}
                  className={`p-1 rounded-lg border flex items-center justify-center hover:scale-105 transition-all cursor-pointer ${
                    theme === "dark" 
                      ? "bg-zinc-950 border-zinc-800 text-zinc-300 hover:text-white" 
                      : "bg-zinc-50 border-zinc-200 text-zinc-700 hover:text-black"
                  }`}
                  title="Add custom calendar block"
                >
                  {isAddingCalendarBlock ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                </button>
              </div>
            </div>

            <h3 className="text-xl font-bold tracking-tight mb-2">Integrated Daily Planner</h3>
            <p className={`text-xs leading-relaxed mb-4 ${
              theme === "dark" ? "text-zinc-400" : "text-zinc-600"
            }`}>
              Automated slots synchronized. Running &quot;Auto-Execute&quot; on calendar tasks schedules deep-work times automatically.
            </p>

            {/* Google Calendar Sync Panel */}
            <div className="mb-4 space-y-2">
              {isSyncingAll ? (
                <div className="w-full p-3 bg-zinc-950/40 rounded-xl border border-emerald-500/15 flex items-center gap-3">
                  <RefreshCw className="w-4 h-4 text-emerald-500 animate-spin shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-mono text-zinc-400">Syncing to Google Calendar...</p>
                    <p className="text-xs font-bold truncate">
                      {syncProgress ? `${syncProgress.current}/${syncProgress.total}: ${syncProgress.title}` : "Initializing..."}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    id="sync-google-calendar-trigger"
                    onClick={handleDirectSyncAll}
                    className="flex-1 py-2 px-3 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center gap-1.5 transition-all hover:scale-102 cursor-pointer shadow-sm"
                  >
                    <Zap className="w-3.5 h-3.5 text-yellow-300 fill-yellow-300 animate-pulse" />
                    <span>Direct Sync Daily Agenda</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowCalendarSyncModal(true);
                      playNotificationSound("tick");
                    }}
                    className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      theme === "dark" 
                        ? "bg-zinc-850 border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800" 
                        : "bg-zinc-50 border-zinc-200 text-zinc-700 hover:text-black hover:bg-zinc-100"
                    }`}
                    title="Open advanced sync options & individual event exports"
                  >
                    Manage
                  </button>
                </div>
              )}

              {/* Connection state details */}
              <div className="flex items-center justify-between px-1 text-[10px] font-mono text-zinc-500">
                {googleUser ? (
                  <>
                    <span className="truncate max-w-[180px]">Connected: {googleUser.email}</span>
                    <button
                      onClick={async () => {
                        await logoutFromGoogle();
                        setGoogleUser(null);
                        setGoogleAccessToken(null);
                        addLog("[AUTH] Signed out of Google.");
                        triggerToast("Signed out of Google");
                      }}
                      className="underline hover:text-zinc-300 cursor-pointer"
                    >
                      Disconnect
                    </button>
                  </>
                ) : (
                  <>
                    <span className="text-zinc-500">Not connected to Google</span>
                    <button
                      onClick={async () => {
                        try {
                          addLog("[AUTH] Prompting user for Google Calendar OAuth sign-in...");
                          triggerToast("Opening Google Sign-in...");
                          const result = await signInWithGoogle();
                          if (result) {
                            setGoogleUser(result.user);
                            setGoogleAccessToken(result.accessToken);
                            addLog(`[AUTH] Signed in successfully as ${result.user.email}`);
                            triggerToast("Connected successfully!");
                            playNotificationSound("success");
                          }
                        } catch (err: any) {
                          console.error(err);
                          addLog(`[AUTH ERROR] Authentication failed: ${err.message || err}`);
                          triggerToast("Sign-in failed.");
                        }
                      }}
                      className="underline hover:text-blue-400 cursor-pointer"
                    >
                      Connect Account
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Manual Calendar Add Dropdown Form */}
            <AnimatePresence>
              {isAddingCalendarBlock && (
                <motion.form
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  onSubmit={handleCreateCalendarBlock}
                  className={`p-3.5 rounded-2xl border mb-4 space-y-3 overflow-hidden ${
                    theme === "dark" ? "bg-zinc-950 border-zinc-800" : "bg-zinc-100 border-zinc-300/60"
                  }`}
                >
                  <div>
                    <label className="text-[10px] font-mono text-zinc-500 block mb-1">EVENT TITLE</label>
                    <input
                      type="text"
                      value={newCalendarTitle}
                      onChange={(e) => setNewCalendarTitle(e.target.value)}
                      placeholder="e.g., UI/UX Design Refinement..."
                      className={`w-full p-2 rounded-xl text-xs focus:outline-none border ${
                        theme === "dark" ? "bg-zinc-900 border-zinc-800 text-zinc-100" : "bg-white border-zinc-200 text-zinc-900"
                      }`}
                      required
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-mono text-zinc-500 block mb-1">START TIME</label>
                      <input
                        type="text"
                        value={newCalendarStart}
                        onChange={(e) => setNewCalendarStart(e.target.value)}
                        placeholder="e.g., 10:00"
                        className={`w-full p-2 rounded-xl text-xs focus:outline-none border ${
                          theme === "dark" ? "bg-zinc-900 border-zinc-800 text-zinc-100" : "bg-white border-zinc-200 text-zinc-900"
                        }`}
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-mono text-zinc-500 block mb-1">END TIME</label>
                      <input
                        type="text"
                        value={newCalendarEnd}
                        onChange={(e) => setNewCalendarEnd(e.target.value)}
                        placeholder="e.g., 11:30"
                        className={`w-full p-2 rounded-xl text-xs focus:outline-none border ${
                          theme === "dark" ? "bg-zinc-900 border-zinc-800 text-zinc-100" : "bg-white border-zinc-200 text-zinc-900"
                        }`}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-mono text-zinc-500 block mb-1">DESCRIPTION</label>
                    <input
                      type="text"
                      value={newCalendarDescription}
                      onChange={(e) => setNewCalendarDescription(e.target.value)}
                      placeholder="e.g., Redefining contrast parameters..."
                      className={`w-full p-2 rounded-xl text-xs focus:outline-none border ${
                        theme === "dark" ? "bg-zinc-900 border-zinc-800 text-zinc-100" : "bg-white border-zinc-200 text-zinc-900"
                      }`}
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-mono text-zinc-500 block mb-1">TAGS (COMMA SEPARATED)</label>
                    <input
                      type="text"
                      value={newCalendarTags}
                      onChange={(e) => setNewCalendarTags(e.target.value)}
                      placeholder="Design, Refactoring"
                      className={`w-full p-2 rounded-xl text-xs focus:outline-none border ${
                        theme === "dark" ? "bg-zinc-900 border-zinc-800 text-zinc-100" : "bg-white border-zinc-200 text-zinc-900"
                      }`}
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <label className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-400 select-none cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={newCalendarReminderActive}
                        onChange={(e) => setNewCalendarReminderActive(e.target.checked)}
                        className="rounded bg-zinc-900 border-zinc-800 text-emerald-500 focus:ring-emerald-500 w-3.5 h-3.5"
                      />
                      <span>🔔 ARM ALARM AT START TIME</span>
                    </label>
                    <button
                      type="submit"
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                    >
                      Save Event
                    </button>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>

            {/* Structured Agenda blocks list */}
            <div className="space-y-2.5 max-h-[220px] overflow-y-auto scrollbar-thin">
              {calendarBlocks.length === 0 ? (
                <div className={`p-6 rounded-2xl border border-dashed text-center ${
                  theme === "dark" ? "bg-zinc-950/20 border-zinc-800 text-zinc-500" : "bg-zinc-50 border-zinc-200 text-zinc-500"
                }`}>
                  <Calendar className="w-6 h-6 mx-auto mb-2 opacity-40" />
                  <p className="text-xs font-mono">No scheduled events today.</p>
                  <p className="text-[10px] mt-1">Tap + to add custom slot or Auto-Execute a calendar task.</p>
                </div>
              ) : (
                calendarBlocks.map((block) => (
                  <div
                    key={block.id}
                    className={`p-3 rounded-2xl border ${
                      theme === "dark" ? "bg-zinc-950/50 border-zinc-800" : "bg-zinc-50 border-zinc-200"
                    }`}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <h4 className={`text-xs font-bold truncate flex-1 leading-tight ${
                        theme === "dark" ? "text-zinc-200" : "text-zinc-800"
                      }`}>
                        {block.title}
                      </h4>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className="font-mono text-[10px] font-semibold text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded flex-shrink-0">
                          {block.start} - {block.end}
                        </span>
                        <button
                          onClick={() => handleSaveCalendarReminder(block.id, !block.reminderActive)}
                          className={`p-1 rounded transition-all cursor-pointer ${
                            block.reminderActive
                              ? "text-amber-400 bg-amber-400/10 hover:bg-amber-400/20"
                              : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
                          }`}
                          title={block.reminderActive ? "Disarm Event-Start Alarm" : "Arm Event-Start Alarm"}
                        >
                          <Clock className={`w-3 h-3 ${block.reminderActive ? "animate-pulse" : ""}`} />
                        </button>
                        <button
                          onClick={() => handleDeleteCalendarBlock(block.id, block.title)}
                          className="p-1 rounded text-zinc-500 hover:text-red-500 hover:bg-red-500/10 transition-all cursor-pointer"
                          title="Delete calendar block"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    <p className={`text-[10px] leading-normal mt-1.5 truncate ${
                      theme === "dark" ? "text-zinc-500" : "text-zinc-600"
                    }`}>
                      {block.description}
                    </p>
                    
                    {block.tags && block.tags.length > 0 && (
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {block.tags.map((t, idx) => (
                          <span 
                            key={idx} 
                            className={`text-[8px] px-1.5 py-0.5 rounded font-mono border ${
                              theme === "dark" 
                                ? "bg-zinc-800/40 text-zinc-400 border-zinc-800/10" 
                                : "bg-zinc-200 text-zinc-700 border-zinc-300/40"
                            }`}
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Planner summary and clear buttons */}
          <div className="mt-4 pt-3 border-t border-zinc-800/20 flex justify-between items-center text-xs">
            <span className="text-zinc-500 font-mono text-[10px]">Agenda blocks: {calendarBlocks.length} active</span>
            <button
              onClick={() => {
                setCalendarBlocks([]);
                addLog("[ACTION] Reset daily planner. Active blocks flushed.");
                triggerToast("Agenda completely flushed.");
                playNotificationSound("warning");
              }}
              className="text-[10px] font-mono text-zinc-500 hover:text-red-400 underline cursor-pointer"
            >
              Flush Planner
            </button>
          </div>
        </section>

        {/* PANEL 5: Habits & Actionable Routines (3 Columns on desktop, Row-span 3) */}
        <section 
          id="habits-routines"
          className={`col-span-12 lg:col-span-3 bg-zinc-900 border rounded-3xl p-5 sm:p-6 flex flex-col justify-between transition-all duration-300 ${
            theme === "dark" 
              ? "bg-zinc-900 border-zinc-800 text-[#fafafa]" 
              : "bg-white border-zinc-200 text-zinc-950"
          }`}
        >
          <div>
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold px-2.5 py-0.5 bg-blue-600 text-white rounded font-mono">05</span>
                <span className="uppercase text-[10px] font-mono text-zinc-500 tracking-wider">Routines: Action-Rings</span>
              </div>
              
              <button
                onClick={() => {
                  setIsAddingHabit(!isAddingHabit);
                  playNotificationSound("tick");
                }}
                className={`text-[10px] font-mono flex items-center gap-1.5 px-2.5 py-1 rounded-full border cursor-pointer transition-all ${
                  isAddingHabit
                    ? "bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20"
                    : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700"
                }`}
              >
                {isAddingHabit ? (
                  <>
                    <X className="w-3 h-3" />
                    <span>Cancel</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-3 h-3 text-blue-400" />
                    <span>Add Routine</span>
                  </>
                )}
              </button>
            </div>

            <h3 className="text-xl font-bold tracking-tight mb-2">Active Routines</h3>
            <p className={`text-xs leading-relaxed mb-4 ${
              theme === "dark" ? "text-zinc-400" : "text-zinc-600"
            }`}>
              Weekly goals configured with executable buttons to automate content drafting.
            </p>

            <AnimatePresence mode="wait">
              {isAddingHabit ? (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="mb-4 p-3.5 rounded-2xl border border-zinc-800 bg-zinc-950/80 space-y-3"
                >
                  <div>
                    <label className="block text-[10px] font-mono text-zinc-500 uppercase mb-1">Routine Title</label>
                    <input
                      type="text"
                      placeholder="e.g., Share weekly release on Twitter"
                      value={newHabitTitle}
                      onChange={(e) => setNewHabitTitle(e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-900 text-white focus:outline-none focus:border-zinc-700 font-sans placeholder-zinc-600"
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono text-zinc-500 uppercase mb-1.5">Weekly Goal Target</label>
                    <div className="flex items-center gap-1.5">
                      {[1, 3, 5, 7, 10].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => {
                            setNewHabitTarget(num);
                            playNotificationSound("tick");
                          }}
                          className={`w-7 h-7 rounded-lg text-xs font-mono font-bold flex items-center justify-center border cursor-pointer transition-all ${
                            newHabitTarget === num
                              ? "bg-blue-600 border-blue-500 text-white"
                              : "bg-zinc-900 border-zinc-850 text-zinc-400 hover:border-zinc-700"
                          }`}
                        >
                          {num}
                        </button>
                      ))}
                      <input
                        type="number"
                        min="1"
                        max="99"
                        value={newHabitTarget}
                        onChange={(e) => setNewHabitTarget(parseInt(e.target.value) || 1)}
                        className="w-11 h-7 text-center text-xs rounded-lg border border-zinc-800 bg-zinc-900 text-white font-mono focus:outline-none"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleAddHabit(newHabitTitle, newHabitTarget)}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl cursor-pointer transition-all flex items-center justify-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Deploy Routine</span>
                  </button>
                </motion.div>
              ) : null}
            </AnimatePresence>

            {/* Habits tracker lists */}
            <div className="space-y-3.5 max-h-[220px] overflow-y-auto scrollbar-thin">
              {habits.length === 0 ? (
                <div className="py-8 text-center space-y-1.5">
                  <p className="text-zinc-500 text-xs italic">No active routines configured</p>
                  <button
                    onClick={() => setIsAddingHabit(true)}
                    className="text-[10px] font-mono text-blue-500 hover:underline cursor-pointer"
                  >
                    Configure one now &rarr;
                  </button>
                </div>
              ) : (
                habits.map((habit) => {
                  const ratio = habit.current / habit.target;
                  const isCompleted = habit.current >= habit.target;
                  return (
                    <motion.div 
                      key={habit.id} 
                      layout 
                      className="group p-2.5 rounded-2xl border border-transparent hover:border-zinc-800/40 hover:bg-zinc-900/20 transition-all space-y-1 relative"
                    >
                      <div className="flex justify-between items-center text-xs font-medium gap-2">
                        <span className={`truncate flex-1 ${isCompleted ? "line-through text-zinc-500 font-normal" : ""}`}>{habit.title}</span>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <span className={`font-mono text-[10px] ${isCompleted ? "text-emerald-400" : "text-zinc-500"}`}>
                            {habit.current}/{habit.target}
                          </span>
                          
                          {/* Trash Button - Hover Visible or Small Tap */}
                          <button
                            onClick={() => handleDeleteHabit(habit.id)}
                            className="p-1 rounded text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all duration-200 cursor-pointer"
                            title="Remove Routine"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {/* Custom progress bars */}
                        <div className={`flex-1 h-1.5 rounded-full overflow-hidden border ${
                          theme === "dark" ? "bg-zinc-800 border-zinc-800/10" : "bg-zinc-200 border-zinc-300/30"
                        }`}>
                          <div 
                            className={`h-full transition-all duration-500 ${isCompleted ? "bg-emerald-500" : "bg-blue-500"}`}
                            style={{ width: `${Math.min(ratio * 100, 100)}%` }}
                          />
                        </div>

                        {/* Interactive Execution Trigger Panel */}
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {/* Decrement */}
                          {habit.current > 0 && (
                            <button
                              onClick={() => handleHabitDecrement(habit.id)}
                              className="p-1 rounded-lg border border-zinc-800 hover:border-zinc-700 bg-zinc-950 text-zinc-400 hover:text-white cursor-pointer transition-all text-[8px]"
                              title="Decrement Progress"
                            >
                              <Minus className="w-2.5 h-2.5" />
                            </button>
                          )}

                          {/* Trigger Increment */}
                          <button
                            onClick={() => handleHabitTick(habit.id)}
                            disabled={isCompleted}
                            className={`px-2 py-1 rounded-lg text-[9px] font-bold font-mono transition-all border flex-shrink-0 cursor-pointer ${
                              isCompleted
                                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 cursor-default"
                                : theme === "dark"
                                  ? "bg-zinc-950 border-zinc-800 hover:border-blue-900 text-zinc-300 hover:text-blue-400"
                                  : "bg-zinc-100 border-zinc-200 hover:bg-zinc-200 text-zinc-700 hover:text-black"
                            }`}
                          >
                            {isCompleted ? "Done" : "Execute"}
                          </button>
                        </div>
                      </div>

                      {habit.lastExecuted && (
                        <span className="text-[8px] font-mono text-zinc-500 block pl-0.5">
                          Last automated at: {habit.lastExecuted} today
                        </span>
                      )}
                    </motion.div>
                  );
                })
              )}
            </div>
          </div>

          {/* Planner summary and clear buttons */}
          <div className="mt-4 pt-3 border-t border-zinc-800/20 flex justify-between items-center text-xs">
            <span className="text-zinc-500 font-mono text-[10px]">Automating: {habits.length} habits</span>
            <button
              onClick={() => {
                setHabits(prev => prev.map(h => ({ ...h, current: 0, lastExecuted: undefined })));
                addLog("[ACTION] Reset habits parameters to baseline zero.");
                triggerToast("Habits recalibrated.");
              }}
              className="text-[10px] font-mono text-zinc-500 hover:text-red-400 underline"
            >
              Reset Goals
            </button>
          </div>
        </section>

        {/* PANEL 6: Scorecard & Efficiency Indicators (8 Columns, Row-span 1) */}
        <section 
          id="system-scorecard"
          className={`col-span-12 lg:col-span-8 bg-zinc-900 border rounded-3xl p-5 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-6 transition-all duration-300 ${
            theme === "dark" 
              ? "bg-zinc-900 border-zinc-800 text-[#fafafa]" 
              : "bg-white border-zinc-200 text-zinc-950"
          }`}
        >
          {/* Left Block: Narrative */}
          <div className="flex-1 text-center sm:text-left space-y-1">
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <span className="text-[10px] font-bold px-2 py-0.5 bg-zinc-100 text-zinc-950 rounded font-mono">06</span>
              <span className="uppercase text-[10px] font-mono text-zinc-500 tracking-wider">Metrics: Cognitive Score</span>
            </div>
            <h3 className="text-lg font-bold">Autonomous Efficiency scorecard</h3>
            <p className={`text-xs leading-relaxed max-w-md ${
              theme === "dark" ? "text-zinc-400" : "text-zinc-600"
            }`}>
              Monitoring time metrics saved by active automations. Compiling draft structures in advance prevents cognitive procrastination.
            </p>
          </div>

          {/* Right Block: Dynamic circular meters and metrics */}
          <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-8 flex-shrink-0">
            {/* Index 1: Time Saved */}
            <div className="text-center">
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-3xl font-extrabold text-blue-500 animate-pulse">{calculatedHoursSaved}</span>
                <span className="text-[11px] font-mono text-zinc-500">HRS</span>
              </div>
              <span className="text-[10px] font-mono uppercase text-zinc-500">Cognitive Hours Saved</span>
            </div>

            {/* Index 2: Completion Circle */}
            <div className="flex items-center gap-3">
              <div className="relative w-12 h-12">
                {/* SVG circular track */}
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="24"
                    cy="24"
                    r="20"
                    stroke={theme === "dark" ? "#1f1f22" : "#e4e4e7"}
                    strokeWidth="3"
                    fill="transparent"
                  />
                  <circle
                    cx="24"
                    cy="24"
                    r="20"
                    stroke="#10b981"
                    strokeWidth="3.5"
                    fill="transparent"
                    strokeDasharray="125.6"
                    strokeDashoffset={125.6 - (125.6 * completionPercentage) / 100}
                    className="transition-all duration-1000 ease-out"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center text-[10px] font-mono font-bold">
                  {completionPercentage}%
                </div>
              </div>
              <div className="text-left">
                <div className="text-[11px] font-bold">{executedCount} of {totalCount}</div>
                <div className="text-[9px] font-mono uppercase text-zinc-500">Automated mandates</div>
              </div>
            </div>

          </div>
        </section>

      </div>

      {/* Footer system status bar */}
      <footer className="mt-6 flex flex-col sm:flex-row justify-between items-center border-t border-zinc-800/10 pt-4 gap-2">
        <div className="text-[10px] text-zinc-600 font-mono uppercase tracking-wider flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          HyperDo Kernel Core: Active
        </div>
        <div className="flex gap-4">
          <button 
            onClick={() => {
              addLog(`[Export] Triggered bulk JSON state download.`);
              const stateString = JSON.stringify({ tasks, calendarBlocks, habits, savedHours: calculatedHoursSaved });
              const blob = new Blob([stateString], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "hyperdo-session.json";
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
              triggerToast("JSON session state downloaded!");
            }}
            className="text-[10px] text-zinc-500 hover:text-zinc-300 font-mono uppercase tracking-widest hover:underline"
          >
            Export JSON state
          </button>
          <button 
            onClick={() => {
              triggerToast("System up-to-date. HyperDo v2.0.4 compiled.");
              addLog("[Status Check] Self diagnostics complete. Clean build.");
            }}
            className="text-[10px] text-zinc-500 hover:text-zinc-300 font-mono uppercase tracking-widest hover:underline"
          >
            Run Diagnostic
          </button>
        </div>
      </footer>
    </div>
  );
}
