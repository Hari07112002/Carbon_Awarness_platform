// EcoLife - Firebase & Authentication Service (Dual Mode)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  sendEmailVerification
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Check if real Firebase is configured
const savedConfigStr = localStorage.getItem("ecolife_firebase_config");
let app = null;
let auth = null;
let db = null;
let isRealFirebase = false;

if (savedConfigStr) {
  try {
    const config = JSON.parse(savedConfigStr);
    if (config && config.apiKey && config.projectId) {
      app = initializeApp(config);
      auth = getAuth(app);
      db = getFirestore(app);
      isRealFirebase = true;
      console.log("EcoLife Auth: Real Firebase Initialized successfully.");
    }
  } catch (e) {
    console.error("EcoLife Auth: Failed to initialize real Firebase with stored config. Falling back to Mock.", e);
  }
}

// --- MOCK FIREBASE CONTROLLER (FALLBACK) ---
const MOCK_USERS_KEY = "ecolife_mock_users";
const MOCK_SESSION_KEY = "ecolife_mock_session";

function getMockUsers() {
  const users = localStorage.getItem(MOCK_USERS_KEY);
  return users ? JSON.parse(users) : {};
}

function saveMockUsers(users) {
  localStorage.setItem(MOCK_USERS_KEY, JSON.stringify(users));
}

// --- CORE EXPORTED SERVICE ---
export const firebaseService = {
  isReal() {
    return isRealFirebase;
  },

  // Listen for auth state changes
  onAuthStateChange(callback) {
    if (isRealFirebase) {
      return onAuthStateChanged(auth, callback);
    } else {
      // Mock auth listener
      const checkSession = () => {
        const sessionUid = localStorage.getItem(MOCK_SESSION_KEY);
        if (sessionUid) {
          const users = getMockUsers();
          const user = users[sessionUid];
          if (user) {
            callback({
              uid: user.uid,
              email: user.email,
              displayName: user.displayName,
              emailVerified: user.emailVerified,
              isMock: true
            });
            return;
          }
        }
        callback(null);
      };
      
      checkSession();
      // Listen for local storage changes or custom events to trigger auth state updates
      const listener = () => checkSession();
      window.addEventListener("mock-auth-changed", listener);
      return () => {
        window.removeEventListener("mock-auth-changed", listener);
      };
    }
  },

  // Sign up with Email and Password
  async signUp(email, password, displayName, username, location) {
    const todayStr = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const formattedUsername = username.startsWith("@") ? username : "@" + username;

    if (isRealFirebase) {
      // 1. Create account in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // 2. Send verification email
      await sendEmailVerification(user);
      
      // 3. Create document in Firestore immediately
      const profileData = {
        uid: user.uid,
        email: user.email,
        displayName: displayName,
        username: formattedUsername,
        location: location,
        memberSince: `Member since ${todayStr}`,
        photoURL: "", // empty initially
        points: 0,
        streak: 0,
        quizCompleted: false,
        answers: {},
        loggedActions: {},
        challenges: { foodActionsCount: 0, commuteActionsCount: 0 },
        unlockedBadges: [],
        createdAt: new Date().toISOString()
      };
      
      await setDoc(doc(db, "users", user.uid), profileData);
      return { user, verificationSent: true };
    } else {
      // Mock SignUp logic
      const users = getMockUsers();
      
      // Check if email already exists
      const emailExists = Object.values(users).some(u => u.email.toLowerCase() === email.toLowerCase());
      if (emailExists) {
        throw new Error("auth/email-already-in-use");
      }

      const uid = "mock_" + Math.random().toString(36).substr(2, 9);
      const newMockUser = {
        uid: uid,
        email: email,
        password: password,
        displayName: displayName,
        emailVerified: false, // Must verify!
        profile: {
          uid: uid,
          email: email,
          displayName: displayName,
          username: formattedUsername,
          location: location,
          memberSince: `Member since ${todayStr}`,
          photoURL: "",
          points: 0,
          streak: 0,
          quizCompleted: false,
          answers: {},
          loggedActions: {},
          challenges: { foodActionsCount: 0, commuteActionsCount: 0 },
          unlockedBadges: []
        }
      };

      users[uid] = newMockUser;
      saveMockUsers(users);

      // Auto sign-in to the mock session (unverified state)
      localStorage.setItem(MOCK_SESSION_KEY, uid);
      window.dispatchEvent(new Event("mock-auth-changed"));

      return {
        user: {
          uid: uid,
          email: email,
          displayName: displayName,
          emailVerified: false,
          isMock: true
        },
        verificationSent: true
      };
    }
  },

  // Sign In with Email and Password
  async signIn(email, password) {
    if (isRealFirebase) {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      return userCredential.user;
    } else {
      const users = getMockUsers();
      const userRecord = Object.values(users).find(
        u => u.email.toLowerCase() === email.toLowerCase() && u.password === password
      );

      if (!userRecord) {
        throw new Error("auth/invalid-credential");
      }

      localStorage.setItem(MOCK_SESSION_KEY, userRecord.uid);
      window.dispatchEvent(new Event("mock-auth-changed"));
      
      return {
        uid: userRecord.uid,
        email: userRecord.email,
        displayName: userRecord.displayName,
        emailVerified: userRecord.emailVerified,
        isMock: true
      };
    }
  },

  // One-tap Google sign-in simulation/real
  async signInWithGoogle() {
    const todayStr = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    
    if (isRealFirebase) {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      // Auto-create profile in Firestore if it doesn't exist
      const userDocRef = doc(db, "users", user.uid);
      const docSnap = await getDoc(userDocRef);
      
      if (!docSnap.exists()) {
        const usernameBase = "@" + (user.email ? user.email.split('@')[0] : "user_" + Math.random().toString(36).substr(2, 5));
        const profileData = {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || "Eco Friend",
          username: usernameBase,
          location: "Global",
          memberSince: `Member since ${todayStr}`,
          photoURL: user.photoURL || "",
          points: 0,
          streak: 0,
          quizCompleted: false,
          answers: {},
          loggedActions: {},
          challenges: { foodActionsCount: 0, commuteActionsCount: 0 },
          unlockedBadges: [],
          createdAt: new Date().toISOString()
        };
        await setDoc(userDocRef, profileData);
      }
      return user;
    } else {
      // Mock Google sign-in: simulate a standard Google user log in
      const email = "hariom.eco@google.com";
      const name = "Hariom Google";
      const users = getMockUsers();
      
      let userRecord = Object.values(users).find(u => u.email.toLowerCase() === email.toLowerCase());
      
      if (!userRecord) {
        const uid = "mock_google_user";
        userRecord = {
          uid: uid,
          email: email,
          displayName: name,
          emailVerified: true, // Google accounts are pre-verified
          profile: {
            uid: uid,
            email: email,
            displayName: name,
            username: "@hari_eco",
            location: "Delhi, India",
            memberSince: `Member since ${todayStr}`,
            photoURL: "https://lh3.googleusercontent.com/a/default-user=s96-c",
            points: 0,
            streak: 0,
            quizCompleted: false,
            answers: {},
            loggedActions: {},
            challenges: { foodActionsCount: 0, commuteActionsCount: 0 },
            unlockedBadges: []
          }
        };
        users[uid] = userRecord;
        saveMockUsers(users);
      }
      
      localStorage.setItem(MOCK_SESSION_KEY, userRecord.uid);
      window.dispatchEvent(new Event("mock-auth-changed"));
      
      return {
        uid: userRecord.uid,
        email: userRecord.email,
        displayName: userRecord.displayName,
        emailVerified: true,
        isMock: true
      };
    }
  },

  // Sign out user
  async signOut() {
    if (isRealFirebase) {
      await signOut(auth);
    } else {
      localStorage.removeItem(MOCK_SESSION_KEY);
      window.dispatchEvent(new Event("mock-auth-changed"));
    }
  },

  // Fetch complete profile details (points, streak, answers, location)
  async getUserProfile(uid) {
    if (isRealFirebase) {
      const docSnap = await getDoc(doc(db, "users", uid));
      if (docSnap.exists()) {
        return docSnap.data();
      }
      return null;
    } else {
      const users = getMockUsers();
      const user = users[uid];
      return user ? user.profile : null;
    }
  },

  // Save complete profile updates
  async saveUserProfile(uid, profileData) {
    if (isRealFirebase) {
      await setDoc(doc(db, "users", uid), profileData, { merge: true });
    } else {
      const users = getMockUsers();
      if (users[uid]) {
        users[uid].profile = { ...users[uid].profile, ...profileData };
        saveMockUsers(users);
      }
    }
  },

  // Specifically trigger mock verification instantly
  simulateMockVerification(uid) {
    if (isRealFirebase) return;
    const users = getMockUsers();
    if (users[uid]) {
      users[uid].emailVerified = true;
      users[uid].profile.emailVerified = true;
      saveMockUsers(users);
      window.dispatchEvent(new Event("mock-auth-changed"));
    }
  }
};
