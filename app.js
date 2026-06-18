import { QUIZ_QUESTIONS, DAILY_ACTIONS, PERSONALIZED_INSIGHTS } from './data.js';

// --- STATE DEFINITIONS ---
let state = {
  quizCompleted: false,
  answers: {},            // questionId -> value
  streak: 0,
  lastLoggedDate: null,   // YYYY-MM-DD
  points: 0,
  dailySaved: 0,          // in kg CO2
  totalSaved: 0,          // in kg CO2
  loggedActions: {},      // dateString -> array of actionIds
  challenges: {
    foodActionsCount: 0,
    commuteActionsCount: 0
  },
  unlockedBadges: []      // array of badgeIds
};

// Badges list
const BADGES = [
  { id: "eco_pioneer", title: "Eco Pioneer", desc: "Completed the initial calculation", icon: "🌱" },
  { id: "plant_power", title: "Plant Power", desc: "Eat 3 plant-based meals", icon: "🥗" },
  { id: "green_rider", title: "Green Rider", desc: "Log 3 active commutes", icon: "🚲" },
  { id: "watt_saver", title: "Energy Saver", desc: "Complete 5 home energy tweaks", icon: "⚡" },
  { id: "zero_hero", title: "Zero Waste Hero", desc: "Complete a Zero Waste day", icon: "♻️" },
  { id: "climate_elite", title: "Climate Elite", desc: "Reach an Eco Score of 80+", icon: "🏆" }
];

// LocalStorage Persistence Keys
const STORAGE_KEY = "ecolife_user_state";

// --- STATE MANAGEMENT ---
function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      state = JSON.parse(saved);
      // Ensure daily saved resets if day changes
      checkDayChange();
    } catch (e) {
      console.error("Error reading saved state, resetting...", e);
      resetState();
    }
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function resetState() {
  state = {
    quizCompleted: false,
    answers: {},
    streak: 0,
    lastLoggedDate: null,
    points: 0,
    dailySaved: 0,
    totalSaved: 0,
    loggedActions: {},
    challenges: {
      foodActionsCount: 0,
      commuteActionsCount: 0
    },
    unlockedBadges: []
  };
  saveState();
  initApp();
}

function getTodayString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function checkDayChange() {
  const today = getTodayString();
  if (state.lastLoggedDate && state.lastLoggedDate !== today) {
    // Check if streak was broken (e.g. gap > 1 day)
    const lastDate = new Date(state.lastLoggedDate);
    const currDate = new Date(today);
    const diffTime = Math.abs(currDate - lastDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays > 1) {
      state.streak = 0; // Streak broken
    }
    
    state.dailySaved = 0;
    saveState();
  }
}

// --- NAVIGATION & ROUTER ---
const views = ["quiz-view", "dashboard-view", "logger-view", "insights-view"];

function navigateTo(viewId) {
  views.forEach(id => {
    const el = document.getElementById(id);
    if (id === viewId) {
      el.classList.add("active");
    } else {
      el.classList.remove("active");
    }
  });

  // Highlight navigation tab
  const tabs = document.querySelectorAll(".nav-tab");
  tabs.forEach(tab => {
    if (tab.getAttribute("data-target") === viewId) {
      tab.classList.add("active");
    } else {
      tab.classList.remove("active");
    }
  });
  
  // Refresh rendering data for specific screens
  if (viewId === "dashboard-view") {
    renderDashboard();
  } else if (viewId === "logger-view") {
    renderLogger();
  } else if (viewId === "insights-view") {
    renderInsights();
  }
}

// --- ONBOARDING QUIZ RUNTIME ---
let currentQuestionIndex = 0;

function startQuiz() {
  currentQuestionIndex = 0;
  state.answers = {};
  renderQuizQuestion();
}

function renderQuizQuestion() {
  const q = QUIZ_QUESTIONS[currentQuestionIndex];
  const qText = document.getElementById("quiz-question-text");
  const optionsContainer = document.getElementById("quiz-options-container");
  const progressFill = document.getElementById("quiz-progress");
  
  // Calculate progress
  const progressPercent = ((currentQuestionIndex) / QUIZ_QUESTIONS.length) * 100;
  progressFill.style.width = `${progressPercent}%`;

  qText.textContent = `${currentQuestionIndex + 1}. ${q.question}`;
  optionsContainer.innerHTML = "";

  q.options.forEach((opt, idx) => {
    const li = document.createElement("div");
    li.className = "quiz-option-item";
    
    // Check if previously selected
    if (state.answers[q.id] !== undefined && state.answers[q.id].index === idx) {
      li.classList.add("selected");
    }

    li.innerHTML = `
      <span class="quiz-option-title">${opt.text}</span>
      <span class="quiz-option-desc">${opt.desc}</span>
    `;

    li.addEventListener("click", () => {
      // Toggle select
      document.querySelectorAll(".quiz-option-item").forEach(item => item.classList.remove("selected"));
      li.classList.add("selected");
      
      // Save answer
      state.answers[q.id] = {
        value: opt.value,
        index: idx,
        category: q.category
      };
      
      // Auto advance with tiny delay for feedback
      setTimeout(() => {
        advanceQuiz();
      }, 300);
    });

    optionsContainer.appendChild(li);
  });

  // Enable/Disable Back button
  const prevBtn = document.getElementById("quiz-prev-btn");
  prevBtn.disabled = currentQuestionIndex === 0;
  
  // Hide main nav-bar and stats during onboarding
  document.getElementById("nav-bar").style.display = "none";
  document.getElementById("header-stats").style.display = "none";
}

function advanceQuiz() {
  if (state.answers[QUIZ_QUESTIONS[currentQuestionIndex].id] === undefined) {
    alert("Please select an option before moving forward.");
    return;
  }

  if (currentQuestionIndex < QUIZ_QUESTIONS.length - 1) {
    currentQuestionIndex++;
    renderQuizQuestion();
  } else {
    // Quiz completed!
    state.quizCompleted = true;
    unlockBadge("eco_pioneer");
    
    // Increase points for completing quiz
    state.points += 50; 
    
    saveState();
    
    // Show navigation & stats
    document.getElementById("nav-bar").style.display = "flex";
    document.getElementById("header-stats").style.display = "flex";
    
    navigateTo("dashboard-view");
  }
}

function retreatQuiz() {
  if (currentQuestionIndex > 0) {
    currentQuestionIndex--;
    renderQuizQuestion();
  }
}

// --- FOOTPRINT CALCULATOR MATH ---
function calculateEmissions() {
  let totals = {
    housing: 0,
    transport: 0,
    food: 0,
    consumption: 0,
    overall: 0
  };

  Object.keys(state.answers).forEach(qId => {
    const ans = state.answers[qId];
    if (ans && ans.category) {
      totals[ans.category] += ans.value;
      totals.overall += ans.value;
    }
  });

  return totals;
}

// --- DASHBOARD RENDERER ---
function renderDashboard() {
  const emissions = calculateEmissions();
  const overallTonnes = (emissions.overall / 1000).toFixed(1);
  
  // Update overall emission figures
  document.getElementById("dash-co2-val").textContent = overallTonnes;

  // Comparison Badge (US Avg: 16 tonnes, Global Avg: 4.8 tonnes)
  const comparisonEl = document.getElementById("dash-co2-comparison");
  const percentDiff = Math.round((emissions.overall / 4800) * 100);
  
  if (emissions.overall <= 4800) {
    comparisonEl.className = "comparison-badge badge-better";
    comparisonEl.textContent = `🌱 Excellent! ${100 - percentDiff}% lower than the Global Average`;
  } else {
    comparisonEl.className = "comparison-badge badge-worse";
    comparisonEl.textContent = `⚠️ Warning: ${percentDiff - 100}% higher than the Global Average`;
  }

  // Calculate Eco Score (0 - 100)
  // Target is 2.5 tonnes (2500 kg). Capping score calculations
  const ecoScore = Math.max(5, Math.min(100, Math.round(100 - (emissions.overall / 200))));
  document.getElementById("donut-score").textContent = `${ecoScore}`;
  
  if (ecoScore >= 80) {
    unlockBadge("climate_elite");
  }

  // Draw Donut Segments
  // Total Circumference C = 2 * PI * r = 2 * 3.14159 * 50 = 314.16
  const C = 314.16;
  let accumulatedOffset = 0;
  
  const categories = ["housing", "transport", "food", "consumption"];
  categories.forEach(cat => {
    const segment = document.getElementById(`donut-seg-${cat}`);
    const share = emissions[cat] / (emissions.overall || 1);
    const strokeLength = share * C;
    
    segment.style.strokeDasharray = `${strokeLength} ${C - strokeLength}`;
    segment.style.strokeDashoffset = -accumulatedOffset;
    accumulatedOffset += strokeLength;

    // Set side panel values and bars
    const valText = document.getElementById(`breakdown-val-${cat}`);
    const fillBar = document.getElementById(`breakdown-bar-${cat}`);
    
    valText.textContent = `${(emissions[cat] / 1000).toFixed(1)} t`;
    fillBar.style.width = `${share * 100}%`;
  });

  // Trees equivalence. (1 mature tree offsets roughly 22kg CO2 per year)
  const treesEquiv = Math.round(emissions.overall / 22);
  document.getElementById("stat-trees").textContent = treesEquiv;

  // Action Points
  document.getElementById("stat-points").textContent = state.points;

  // Render Streak
  document.getElementById("streak-count").textContent = state.streak;

  // Header and Navigation visibility
  document.getElementById("nav-bar").style.display = "flex";
  document.getElementById("header-stats").style.display = "flex";

  // Render Daily habits quick view (top 4 actions)
  renderHabitsList("quick-actions-container", 4);
  renderBadges();
}

// --- LOGGER SCREEN RENDERER ---
function renderLogger() {
  // Update Logger figures
  document.getElementById("logger-today-saved").textContent = `${state.dailySaved.toFixed(1)} kg`;
  document.getElementById("logger-total-saved").textContent = `${state.totalSaved.toFixed(1)} kg`;
  
  const today = getTodayString();
  const loggedTodayList = state.loggedActions[today] || [];
  document.getElementById("logger-habits-logged").textContent = loggedTodayList.length;

  renderHabitsList("full-actions-container", DAILY_ACTIONS.length);
}

function renderHabitsList(containerId, limit) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";

  const today = getTodayString();
  const loggedToday = state.loggedActions[today] || [];

  // Sort actions so unlogged are first, then logged, or stick to list
  const actionsToShow = DAILY_ACTIONS.slice(0, limit);

  actionsToShow.forEach(action => {
    const isLogged = loggedToday.includes(action.id);
    
    const row = document.createElement("div");
    row.className = `action-row ${isLogged ? 'logged' : ''}`;
    
    row.innerHTML = `
      <div class="action-info-block">
        <span class="action-emoji">${action.icon}</span>
        <div class="action-details">
          <h4>${action.title}</h4>
          <p>
            <span class="badge-difficulty difficulty-${action.difficulty.toLowerCase()}">${action.difficulty}</span>
            <span>-${action.impact} kg CO₂</span>
            <span style="color: var(--color-accent);">+${action.points} pts</span>
          </p>
        </div>
      </div>
      <button class="log-btn" aria-label="Log action">
        <svg viewBox="0 0 24 24">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      </button>
    `;

    // Trigger log action logic
    row.querySelector(".log-btn").addEventListener("click", () => {
      toggleActionLog(action.id);
    });

    container.appendChild(row);
  });
}

function toggleActionLog(actionId) {
  const today = getTodayString();
  if (!state.loggedActions[today]) {
    state.loggedActions[today] = [];
  }

  const index = state.loggedActions[today].indexOf(actionId);
  const action = DAILY_ACTIONS.find(a => a.id === actionId);
  
  if (index === -1) {
    // Log action
    state.loggedActions[today].push(actionId);
    state.points += action.points;
    state.dailySaved += action.impact;
    state.totalSaved += action.impact;
    
    // Update streak logic
    if (state.lastLoggedDate !== today) {
      state.streak += 1;
      state.lastLoggedDate = today;
    }

    // Increment challenge tracking
    if (action.category === "food") {
      state.challenges.foodActionsCount += 1;
    } else if (action.category === "transport") {
      state.challenges.commuteActionsCount += 1;
    }
  } else {
    // Unlog action
    state.loggedActions[today].splice(index, 1);
    state.points = Math.max(0, state.points - action.points);
    state.dailySaved = Math.max(0, state.dailySaved - action.impact);
    state.totalSaved = Math.max(0, state.totalSaved - action.impact);
    
    // Decrement challenge tracking
    if (action.category === "food") {
      state.challenges.foodActionsCount = Math.max(0, state.challenges.foodActionsCount - 1);
    } else if (action.category === "transport") {
      state.challenges.commuteActionsCount = Math.max(0, state.challenges.commuteActionsCount - 1);
    }

    // Check if that day has other activities, otherwise reset last logged
    if (state.loggedActions[today].length === 0) {
      // If we unlogged everything today, wait until they log again or do nothing
    }
  }

  // Evaluate badge eligibility
  checkBadgeMilestones();
  saveState();

  // Re-render current view context
  const activeView = document.querySelector(".app-view.active").id;
  if (activeView === "dashboard-view") {
    renderDashboard();
  } else if (activeView === "logger-view") {
    renderLogger();
  }
}

// --- BADGES LOGIC ---
function renderBadges() {
  const container = document.getElementById("badges-container");
  container.innerHTML = "";

  BADGES.forEach(badge => {
    const isUnlocked = state.unlockedBadges.includes(badge.id);
    const item = document.createElement("div");
    item.className = `badge-item ${isUnlocked ? 'unlocked' : ''}`;
    item.innerHTML = `
      <div class="badge-icon">${badge.icon}</div>
      <div class="badge-title">${badge.title}</div>
      <div class="badge-desc">${badge.desc}</div>
    `;
    container.appendChild(item);
  });
}

function checkBadgeMilestones() {
  // Food badge
  if (state.challenges.foodActionsCount >= 3) {
    unlockBadge("plant_power");
  }
  // Transport badge
  if (state.challenges.commuteActionsCount >= 3) {
    unlockBadge("green_rider");
  }
  // Home Energy badge
  const energyLogsCount = countCategoryLogs("housing");
  if (energyLogsCount >= 5) {
    unlockBadge("watt_saver");
  }
  // Zero Waste day
  const loggedToday = state.loggedActions[getTodayString()] || [];
  if (loggedToday.includes("zero_waste_day")) {
    unlockBadge("zero_hero");
  }
}

function countCategoryLogs(category) {
  let count = 0;
  Object.values(state.loggedActions).forEach(dayList => {
    dayList.forEach(actionId => {
      const action = DAILY_ACTIONS.find(a => a.id === actionId);
      if (action && action.category === category) {
        count++;
      }
    });
  });
  return count;
}

function unlockBadge(badgeId) {
  if (!state.unlockedBadges.includes(badgeId)) {
    state.unlockedBadges.push(badgeId);
    state.points += 100; // Bonus points for unlocking badge!
  }
}

// --- INSIGHTS & RECOMMENDATIONS ---
function renderInsights() {
  const emissions = calculateEmissions();
  const container = document.getElementById("recommendations-container");
  container.innerHTML = "";

  let totalInsightsAdded = 0;

  // Loop through categories to match footprint rules
  Object.keys(PERSONALIZED_INSIGHTS).forEach(cat => {
    const rules = PERSONALIZED_INSIGHTS[cat];
    const catEmissions = emissions[cat] || 0;

    rules.forEach(rule => {
      if (catEmissions >= rule.minEmissions) {
        const card = document.createElement("div");
        card.className = `insight-card insight-${cat}`;
        
        let emoji = "💡";
        if (cat === "housing") emoji = "🏠";
        else if (cat === "transport") emoji = "🚗";
        else if (cat === "food") emoji = "🥗";
        else if (cat === "consumption") emoji = "🛍️";

        card.innerHTML = `
          <div class="insight-icon">${emoji}</div>
          <div class="insight-body">
            <h3>${rule.title}</h3>
            <p>${rule.recommendation}</p>
          </div>
        `;
        container.appendChild(card);
        totalInsightsAdded++;
      }
    });
  });

  // Default fallback if emissions are extremely clean
  if (totalInsightsAdded === 0) {
    const card = document.createElement("div");
    card.className = "insight-card";
    card.innerHTML = `
      <div class="insight-icon">🌟</div>
      <div class="insight-body">
        <h3>Outstanding Footprint Profile!</h3>
        <p>Your lifestyle emissions are remarkably low and close to sustainable planetary targets. Continue logging daily actions to reinforce your habits and inspire others in the community!</p>
      </div>
    `;
    container.appendChild(card);
  }

  // Update Challenges UI Progress bars
  const foodPct = Math.min(100, (state.challenges.foodActionsCount / 10) * 100);
  document.getElementById("challenge-food-bar").style.width = `${foodPct}%`;
  document.getElementById("challenge-food-text").textContent = `${state.challenges.foodActionsCount} / 10 logged`;

  const commutePct = Math.min(100, (state.challenges.commuteActionsCount / 5) * 100);
  document.getElementById("challenge-commute-bar").style.width = `${commutePct}%`;
  document.getElementById("challenge-commute-text").textContent = `${state.challenges.commuteActionsCount} / 5 logged`;
}

// --- ROUTER & CONTROL SYSTEM BOOTSTRAP ---
function initApp() {
  loadState();

  if (state.quizCompleted) {
    // Go directly to Dashboard
    navigateTo("dashboard-view");
  } else {
    // Load onboarding quiz
    navigateTo("quiz-view");
    startQuiz();
  }
}

// Event Bindings
document.addEventListener("DOMContentLoaded", () => {
  // Navigation Tabs handler
  document.querySelectorAll(".nav-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      const target = tab.getAttribute("data-target");
      navigateTo(target);
    });
  });

  // Logo button acts as home
  document.getElementById("logo-btn").addEventListener("click", () => {
    if (state.quizCompleted) {
      navigateTo("dashboard-view");
    }
  });

  // Action page redirection
  document.getElementById("view-all-actions-btn").addEventListener("click", () => {
    navigateTo("logger-view");
  });

  // Quiz buttons
  document.getElementById("quiz-prev-btn").addEventListener("click", retreatQuiz);
  document.getElementById("quiz-next-btn").addEventListener("click", advanceQuiz);

  // Global reset profile
  document.getElementById("reset-data-btn").addEventListener("click", () => {
    if (confirm("Are you sure you want to reset your footprint profile, points, and logs history? This cannot be undone.")) {
      resetState();
    }
  });

  // Run app
  initApp();
});
