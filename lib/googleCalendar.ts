import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut } from "firebase/auth";
import firebaseConfig from "../firebase-applet-config.json";

// Initialize Firebase App gracefully (prevent double-initialization in Next.js HMR/fast-refresh)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

export const googleProvider = new GoogleAuthProvider();
// Add required Google Calendar scopes
googleProvider.addScope("https://www.googleapis.com/auth/calendar");
googleProvider.addScope("https://www.googleapis.com/auth/calendar.events");

export interface GoogleCalendarEvent {
  summary: string;
  description: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
}

/**
 * Sign in with Google using Firebase Popup
 */
export async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential || !credential.accessToken) {
      throw new Error("No OAuth access token was returned by Google Auth.");
    }
    return {
      user: result.user,
      accessToken: credential.accessToken,
    };
  } catch (error) {
    console.error("Firebase Sign In Error:", error);
    throw error;
  }
}

/**
 * Sign out of Firebase Auth
 */
export async function logoutFromGoogle() {
  await signOut(auth);
}

/**
 * Insert a single event into the Google Calendar API
 */
export async function createGoogleCalendarEvent(
  event: GoogleCalendarEvent,
  accessToken: string
): Promise<any> {
  const response = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(event),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Google Calendar API Error (${response.status}): ${errorBody}`);
  }

  return response.json();
}
