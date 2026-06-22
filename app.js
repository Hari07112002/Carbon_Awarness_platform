import { QUIZ_QUESTIONS, DAILY_ACTIONS, PERSONALIZED_INSIGHTS, REGIONAL_AVERAGES, findRegionalAverage } from './data.js';
import { firebaseService } from './firebase-service.js';

console.log("EcoLife app.js: Script loading started.");

// Chart.js instances
let categoryDonutChartInstance = null;
let savingsTrendChartInstance = null;
let reductionRoadmapChartInstance = null;

// Helper to get past dates for demo data
function getPastDateString(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// --- STATE DEFINITIONS ---
let state = {
  uid: "",
  email: "",
  displayName: "",
  username: "",
  location: "",
  memberSince: "",
  photoURL: "",
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
  unlockedBadges: [],     // array of badgeIds
  chatHistory: [],
  weeklySummary: null,
  personalizedTips: null,
  quizAnalysis: null,
  shareCaption: "",
  weeklyChallenge: null,
  createdAt: ""
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

// --- AUTH & STATE CONTROLLER ---
let currentUser = null;
let authListenerUnsubscribe = null;

function setupAuthListener() {
  if (authListenerUnsubscribe) {
    authListenerUnsubscribe();
  }
  authListenerUnsubscribe = firebaseService.onAuthStateChange(async (user) => {
    currentUser = user;
    if (!user) {
      // User is logged out
      document.getElementById("nav-bar").style.display = "none";
      document.getElementById("header-stats").style.display = "none";
      document.getElementById("chat-fab-btn").style.display = "none";
      
      // Clear forms
      document.getElementById("signin-form").reset();
      document.getElementById("signup-form").reset();
      
      // Show login tab
      switchAuthTab("signin");
      document.getElementById("auth-verification-pending").style.display = "none";
      document.getElementById("signin-form").style.display = "flex";
      document.getElementById("signup-form").style.display = "none";
      
      // Enable auth buttons just in case
      document.getElementById("auth-tab-signin").style.display = "block";
      document.getElementById("auth-tab-signup").style.display = "block";
      document.getElementById("google-signin-btn").style.display = "inline-flex";
      document.getElementById("demo-bypass-btn").style.display = "inline-flex";
      document.querySelector(".auth-divider").style.display = "flex";
      
      navigateTo("auth-view");
      return;
    }

    // Check if email is verified
    if (!user.emailVerified) {
      document.getElementById("nav-bar").style.display = "none";
      document.getElementById("header-stats").style.display = "none";
      document.getElementById("chat-fab-btn").style.display = "none";
      
      // Hide forms and show verification pending
      document.getElementById("signin-form").style.display = "none";
      document.getElementById("signup-form").style.display = "none";
      document.getElementById("auth-tab-signin").style.display = "none";
      document.getElementById("auth-tab-signup").style.display = "none";
      document.getElementById("auth-verification-pending").style.display = "block";
      
      // Hide Google & Demo bypass buttons in verification screen
      document.getElementById("google-signin-btn").style.display = "none";
      document.getElementById("demo-bypass-btn").style.display = "none";
      document.querySelector(".auth-divider").style.display = "none";

      // Show mock verify hint only if user is mock
      if (user.isMock) {
        document.getElementById("mock-verify-hint").style.display = "block";
      } else {
        document.getElementById("mock-verify-hint").style.display = "none";
      }
      
      navigateTo("auth-view");
      return;
    }

    // Email is verified, restore form elements
    document.getElementById("auth-tab-signin").style.display = "block";
    document.getElementById("auth-tab-signup").style.display = "block";
    document.getElementById("google-signin-btn").style.display = "inline-flex";
    document.getElementById("demo-bypass-btn").style.display = "inline-flex";
    document.querySelector(".auth-divider").style.display = "flex";
    document.getElementById("auth-verification-pending").style.display = "none";

    // Load profile from DB
    let profile = await firebaseService.getUserProfile(user.uid);
    if (!profile) {
      // Auto-create profile if missing
      const todayStr = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      profile = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || "Eco Friend",
        username: "@" + (user.email ? user.email.split("@")[0] : "eco_user"),
        location: "Global",
        memberSince: `Member since ${todayStr}`,
        photoURL: "",
        points: 0,
        streak: 0,
        quizCompleted: false,
        answers: {},
        loggedActions: {},
        challenges: { foodActionsCount: 0, commuteActionsCount: 0 },
        unlockedBadges: []
      };
      await firebaseService.saveUserProfile(user.uid, profile);
    }
    
    state = {
      chatHistory: [],
      weeklySummary: null,
      personalizedTips: null,
      quizAnalysis: null,
      shareCaption: "",
      weeklyChallenge: null,
      createdAt: new Date().toISOString(),
      ...profile
    };
    
    // Check day change
    checkDayChange();
    saveState(); // Sync local / update timestamp

    // Enable nav-bar and header stats
    document.getElementById("nav-bar").style.display = "flex";
    document.getElementById("header-stats").style.display = "flex";

    // Update header avatar thumbnail
    updateHeaderAvatar();

    if (state.quizCompleted) {
      document.getElementById("chat-fab-btn").style.display = "flex";
      initChatUI();
      checkWeeklyInsightSummary();
      checkWeeklyChallenge();
      navigateTo("dashboard-view");
    } else {
      document.getElementById("chat-fab-btn").style.display = "none";
      navigateTo("quiz-view");
      startQuiz();
    }
  });
}

function updateHeaderAvatar() {
  const avatarBtn = document.getElementById("header-avatar-btn");
  if (!avatarBtn) return;
  if (state.photoURL) {
    avatarBtn.innerHTML = `<img src="${state.photoURL}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
  } else {
    avatarBtn.innerHTML = "👤";
  }
}

function getEcoTier(points) {
  if (points >= 800) {
    return {
      title: "Forest Guardian",
      icon: "🛡️",
      class: "tier-guardian",
      desc: "Champion of planetary health. You lead by example!"
    };
  } else if (points >= 400) {
    return {
      title: "Tree",
      icon: "🌳",
      class: "tier-tree",
      desc: "Robust carbon offsetting strength. Deeply rooted habits."
    };
  } else if (points >= 150) {
    return {
      title: "Sapling",
      icon: "🌿",
      class: "tier-sapling",
      desc: "Growing green influence. Habits are taking structure."
    };
  } else {
    return {
      title: "Seedling",
      icon: "🌱",
      class: "tier-seedling",
      desc: "Just starting your climate journey. Nurture your habits."
    };
  }
}

function saveState() {
  if (currentUser) {
    firebaseService.saveUserProfile(currentUser.uid, state);
  }
}

async function resetState() {
  state = {
    uid: currentUser.uid,
    email: currentUser.email,
    displayName: state.displayName,
    username: state.username,
    location: state.location,
    memberSince: state.memberSince,
    photoURL: state.photoURL,
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
  await firebaseService.saveUserProfile(currentUser.uid, state);
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
    
    lastDate.setHours(0,0,0,0);
    currDate.setHours(0,0,0,0);
    const diffTime = currDate.getTime() - lastDate.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays > 1) {
      state.streak = 0; // Streak broken
    }
    
    state.dailySaved = 0;
    saveState();
  }
}

// --- NAVIGATION & ROUTER ---
const views = ["auth-view", "quiz-view", "dashboard-view", "logger-view", "insights-view", "profile-view"];

function navigateTo(viewId) {
  // If user is not logged in or email is not verified, they cannot navigate away from auth-view
  if (viewId !== "auth-view" && (!currentUser || !currentUser.emailVerified)) {
    viewId = "auth-view";
  }

  views.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      if (id === viewId) {
        el.classList.add("active");
      } else {
        el.classList.remove("active");
      }
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
  } else if (viewId === "profile-view") {
    renderProfile();
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

  const progressText = document.getElementById("quiz-progress-text");
  if (progressText) {
    progressText.textContent = `Question ${currentQuestionIndex + 1} of ${QUIZ_QUESTIONS.length}`;
  }

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

async function advanceQuiz() {
  if (state.answers[QUIZ_QUESTIONS[currentQuestionIndex].id] === undefined) {
    await showCustomAlert("Onboarding", "Please select an option before moving forward.");
    return;
  }

  if (currentQuestionIndex < QUIZ_QUESTIONS.length - 1) {
    currentQuestionIndex++;
    renderQuizQuestion();
  } else {
    // Quiz answers submitted, trigger Gemini analysis first
    await runQuizAnswerAnalysis();
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

// Level helper functions
function getFootprintLevel(value, category) {
  let greenLimit, amberLimit;
  if (category === "overall") {
    greenLimit = 4700; // 4.7t global avg
    amberLimit = 8000;
  } else if (category === "housing") {
    greenLimit = 1500;
    amberLimit = 3000;
  } else if (category === "transport") {
    greenLimit = 1800;
    amberLimit = 3500;
  } else if (category === "food") {
    greenLimit = 1000;
    amberLimit = 2000;
  } else if (category === "consumption") {
    greenLimit = 800;
    amberLimit = 1500;
  }
  
  if (value <= greenLimit) return "green";
  if (value <= amberLimit) return "amber";
  return "red";
}

function getFootprintLevelClass(level) {
  if (level === "green") return "level-green";
  if (level === "amber") return "level-amber";
  return "level-red";
}

function getFootprintLevelBgClass(level) {
  if (level === "green") return "level-bg-green";
  if (level === "amber") return "level-bg-amber";
  return "level-bg-red";
}

function getFootprintLevelText(level) {
  if (level === "green") return "Below Average";
  if (level === "amber") return "Average";
  return "Above Average";
}

function updateNeedleGauge(overallEmissions) {
  const needle = document.getElementById("gauge-needle");
  if (!needle) return;
  const overallTonnes = overallEmissions / 1000;
  const cappedTonnes = Math.max(0, Math.min(20, overallTonnes));
  const angle = (cappedTonnes / 20) * 180 - 90;
  needle.style.transform = `rotate(${angle}deg)`;
}

function renderCategoryDonutChart(emissions) {
  const ctx = document.getElementById("category-donut-chart");
  if (!ctx) return;
  
  if (categoryDonutChartInstance) {
    categoryDonutChartInstance.destroy();
  }
  
  const data = [
    (emissions.housing / 1000),
    (emissions.transport / 1000),
    (emissions.food / 1000),
    (emissions.consumption / 1000)
  ];
  
  categoryDonutChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ["Housing Energy", "Transport & Travel", "Diet & Waste", "Consumer Goods"],
      datasets: [{
        data: data,
        backgroundColor: [
          '#06b6d4', // Cyan (Housing)
          '#10b981', // Emerald (Transport)
          '#84cc16', // Lime (Food)
          '#f59e0b'  // Amber (Consumption)
        ],
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        hoverOffset: 12
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '70%',
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const label = context.label || '';
              const value = context.raw || 0;
              return ` ${label}: ${value.toFixed(1)} t CO₂e`;
            }
          },
          backgroundColor: '#0f172a',
          titleFont: { family: 'Outfit', size: 12 },
          bodyFont: { family: 'Inter', size: 12 },
          padding: 10,
          borderColor: 'rgba(255, 255, 255, 0.08)',
          borderWidth: 1
        }
      }
    }
  });
}

function renderSavingsTrendChart() {
  const ctx = document.getElementById("savings-trend-chart");
  if (!ctx) return;
  
  if (savingsTrendChartInstance) {
    savingsTrendChartInstance.destroy();
  }
  
  const labels = [];
  const data = [];
  let totalSavingsWeek = 0;
  
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const label = d.toLocaleDateString('en-US', { weekday: 'short' });
    labels.push(label);
    
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const loggedToday = state.loggedActions[dateStr] || [];
    let saved = 0;
    loggedToday.forEach(actionId => {
      const action = DAILY_ACTIONS.find(a => a.id === actionId);
      if (action) {
        saved += action.impact;
      }
    });
    
    data.push(Number(saved.toFixed(1)));
    totalSavingsWeek += saved;
  }
  
  const badge = document.getElementById("trend-total-saved-badge");
  if (badge) {
    badge.textContent = `Total saved: ${totalSavingsWeek.toFixed(1)} kg`;
  }
  
  const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 150);
  gradient.addColorStop(0, 'rgba(16, 185, 129, 0.35)');
  gradient.addColorStop(1, 'rgba(16, 185, 129, 0.0)');
  
  savingsTrendChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'CO₂ Saved (kg)',
        data: data,
        borderColor: '#10b981',
        borderWidth: 3,
        pointBackgroundColor: '#10b981',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 1.5,
        pointRadius: 4,
        pointHoverRadius: 6,
        fill: true,
        backgroundColor: gradient,
        tension: 0.4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: '#0f172a',
          titleFont: { family: 'Outfit', size: 12 },
          bodyFont: { family: 'Inter', size: 12 },
          padding: 10,
          borderColor: 'rgba(255, 255, 255, 0.08)',
          borderWidth: 1,
          callbacks: {
            label: function(context) {
              return ` ${context.raw} kg CO₂ saved`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            display: false
          },
          ticks: {
            color: '#94a3b8',
            font: { family: 'Inter', size: 10 }
          }
        },
        y: {
          grid: {
            color: 'rgba(255, 255, 255, 0.04)'
          },
          ticks: {
            color: '#94a3b8',
            font: { family: 'Inter', size: 10 }
          },
          suggestedMax: 10,
          beginAtZero: true
        }
      }
    }
  });
}

function renderReductionRoadmapChart(emissions) {
  const ctx = document.getElementById("reduction-roadmap-chart");
  if (!ctx) return;
  
  if (reductionRoadmapChartInstance) {
    reductionRoadmapChartInstance.destroy();
  }
  
  const currentFootprint = emissions.overall / 1000; // in tonnes
  const dailySaved = state.dailySaved || 6.6; // demo data default
  const monthlySavings = (dailySaved * 30.4) / 1000; // in tonnes
  
  const labels = ["Current (M0)", "M1", "M2", "M3", "M4", "M5", "M6", "M7", "M8", "M9", "M10", "M11", "Target (M12)"];
  const projectedData = [];
  const targetData = [];
  
  for (let m = 0; m <= 12; m++) {
    projectedData.push(Number(Math.max(0, currentFootprint - m * monthlySavings).toFixed(2)));
    targetData.push(Number(Math.max(2.5, currentFootprint - m * ((currentFootprint - 2.5) / 12)).toFixed(2)));
  }
  
  const pointStyles = ['rectRot', ...Array(12).fill('circle')];
  const pointRadii = [8, ...Array(12).fill(3)];
  const pointHoverRadii = [10, ...Array(12).fill(5)];
  const pointColors = ['#ef4444', ...Array(12).fill('#06b6d4')];
  
  reductionRoadmapChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Your Projection',
          data: projectedData,
          borderColor: '#06b6d4',
          borderWidth: 2.5,
          pointStyle: pointStyles,
          pointRadius: pointRadii,
          pointHoverRadius: pointHoverRadii,
          pointBackgroundColor: pointColors,
          pointBorderColor: '#ffffff',
          fill: false,
          tension: 0.2
        },
        {
          label: 'Sustainable Path',
          data: targetData,
          borderColor: 'rgba(16, 185, 129, 0.4)',
          borderWidth: 1.5,
          borderDash: [5, 5],
          pointRadius: 0,
          fill: false,
          tension: 0.1
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          labels: {
            color: '#94a3b8',
            font: { family: 'Inter', size: 10 }
          }
        },
        tooltip: {
          backgroundColor: '#0f172a',
          titleFont: { family: 'Outfit', size: 12 },
          bodyFont: { family: 'Inter', size: 12 },
          padding: 10,
          borderColor: 'rgba(255, 255, 255, 0.08)',
          borderWidth: 1,
          callbacks: {
            label: function(context) {
              const val = context.raw;
              if (context.dataIndex === 0 && context.datasetIndex === 0) {
                return ` You Are Here: ${val} tonnes`;
              }
              return ` ${context.dataset.label}: ${val} tonnes`;
            }
          }
        }
      },
      scales: {
        x: {
          ticks: {
            color: '#94a3b8',
            font: { family: 'Inter', size: 9 }
          },
          grid: {
            display: false
          }
        },
        y: {
          ticks: {
            color: '#94a3b8',
            font: { family: 'Inter', size: 9 }
          },
          grid: {
            color: 'rgba(255, 255, 255, 0.04)'
          },
          suggestedMin: 2,
          beginAtZero: false
        }
      }
    }
  });
}

function renderCategoryLegends(emissions) {
  const container = document.getElementById("breakdown-legends");
  if (!container) return;
  container.innerHTML = "";

  const categories = [
    { key: "housing", name: "Housing Energy", dotClass: "cat-housing" },
    { key: "transport", name: "Transport & Travel", dotClass: "cat-transport" },
    { key: "food", name: "Diet & Waste", dotClass: "cat-food" },
    { key: "consumption", name: "Consumer Goods", dotClass: "cat-consumption" }
  ];

  const total = emissions.overall || 1;

  categories.forEach(cat => {
    const val = emissions[cat.key];
    const valTonnes = (val / 1000).toFixed(1);
    const share = val / total;
    const level = getFootprintLevel(val, cat.key);
    const levelClass = getFootprintLevelClass(level);
    const levelBgClass = getFootprintLevelBgClass(level);
    const levelText = getFootprintLevelText(level);

    const item = document.createElement("div");
    item.className = "category-bar-item";
    item.innerHTML = `
      <div class="category-bar-header" style="display: flex; justify-content: space-between; align-items: center; font-size: 13px;">
        <span class="category-bar-label" style="display: flex; align-items: center; gap: 8px; font-weight: 500;">
          <span class="category-dot ${cat.dotClass}" style="width: 10px; height: 10px; border-radius: 50%;"></span>
          ${cat.name}
        </span>
        <span style="font-weight: 600;">
          ${valTonnes} t <span class="${levelClass}" style="font-size: 11px; margin-left: 6px; font-weight: 700;">(${levelText})</span>
        </span>
      </div>
      <div class="category-bar-track" style="width: 100%; height: 6px; background: rgba(255, 255, 255, 0.05); border-radius: 3px; overflow: hidden; margin-top: 4px;">
        <div class="category-bar-fill ${levelBgClass}" style="width: ${share * 100}%; height: 100%; border-radius: 3px; transition: width 1s ease;"></div>
      </div>
    `;
    container.appendChild(item);
  });
}

// --- DASHBOARD RENDERER ---
function renderDashboard() {
  const emissions = calculateEmissions();
  const overallTonnes = (emissions.overall / 1000).toFixed(1);
  
  // Update overall emission figures & color coding
  const overallValEl = document.getElementById("dash-co2-val");
  const overallLevel = getFootprintLevel(emissions.overall, "overall");
  overallValEl.className = "emissions-value " + getFootprintLevelClass(overallLevel);
  overallValEl.textContent = overallTonnes;

  // Comparison Badge (US Avg: 16 tonnes, Global Avg: 4.8 tonnes)
  const comparisonEl = document.getElementById("dash-co2-comparison");
  const percentDiff = Math.round((emissions.overall / 4700) * 100);
  
  if (emissions.overall <= 4700) {
    comparisonEl.className = "comparison-badge badge-better level-bg-green";
    comparisonEl.style.color = "#ffffff";
    comparisonEl.textContent = `🌱 Excellent! ${100 - percentDiff}% lower than the Global Average`;
  } else if (emissions.overall <= 8000) {
    comparisonEl.className = "comparison-badge level-bg-amber";
    comparisonEl.style.color = "#090d16";
    comparisonEl.textContent = `⚠️ Average: ${percentDiff}% of the Global Average`;
  } else {
    comparisonEl.className = "comparison-badge badge-worse level-bg-red";
    comparisonEl.style.color = "#ffffff";
    comparisonEl.textContent = `🚨 Alert: ${percentDiff - 100}% higher than the Global Average`;
  }

  // Update needle gauge
  updateNeedleGauge(emissions.overall);

  // Render Chart.js Donut chart
  renderCategoryDonutChart(emissions);

  // Render Category breakdown legends
  renderCategoryLegends(emissions);

  // Trees equivalence. (1 mature tree offsets roughly 22kg CO2 per year)
  const treesEquiv = Math.round(emissions.overall / 22);
  document.getElementById("stat-trees").textContent = treesEquiv;

  // Action Points
  document.getElementById("stat-points").textContent = state.points;

  // Render Streak
  document.getElementById("streak-count").textContent = state.streak;

  // Render savings line chart
  renderSavingsTrendChart();

  // Render 12-month reduction roadmap
  renderReductionRoadmapChart(emissions);

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
  if (!container) return;
  container.innerHTML = "";

  const today = getTodayString();
  const loggedToday = state.loggedActions[today] || [];

  const actionsToShow = DAILY_ACTIONS.slice(0, limit);

  actionsToShow.forEach(action => {
    const isLogged = loggedToday.includes(action.id);
    
    const row = document.createElement("div");
    row.className = `action-row ${isLogged ? 'logged' : ''}`;
    
    row.innerHTML = `
      <div class="action-info-block" style="flex: 1;">
        <span class="action-emoji">${action.icon}</span>
        <div class="action-details">
          <h4>${action.title}</h4>
          <p>
            <span class="badge-difficulty difficulty-${action.difficulty.toLowerCase()}">${action.difficulty}</span>
            <span>-${action.impact} kg CO₂</span>
            <span style="color: var(--color-accent); font-weight: 600;">+${action.points} pts</span>
          </p>
        </div>
      </div>
      <div class="custom-checkbox">
        <svg viewBox="0 0 24 24">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      </div>
    `;

    // Make the entire card row clickable to toggle the checklist state
    row.addEventListener("click", () => {
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
      triggerStreakFlameAnimation();
    }

    // Increment challenge tracking
    if (action.category === "food") {
      state.challenges.foodActionsCount += 1;
    } else if (action.category === "transport") {
      state.challenges.commuteActionsCount += 1;
    }

    // Increment weekly challenge progress
    if (state.weeklyChallenge && action.category === state.weeklyChallenge.category) {
      if (!state.weeklyChallenge.completed) {
        state.weeklyChallenge.progress += 1;
        if (state.weeklyChallenge.progress >= state.weeklyChallenge.goal) {
          state.weeklyChallenge.completed = true;
          state.points += state.weeklyChallenge.points;
          if (state.weeklyChallenge.badgeName) {
            unlockBadge(state.weeklyChallenge.badgeName);
          }
          setTimeout(() => {
            showCustomAlert(
              "Challenge Completed! 🎉",
              `Congratulations! You completed the weekly challenge: "${state.weeklyChallenge.title}" and earned ${state.weeklyChallenge.points} points!`
            );
          }, 100);
        }
      }
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

    // Decrement weekly challenge progress
    if (state.weeklyChallenge && action.category === state.weeklyChallenge.category) {
      state.weeklyChallenge.progress = Math.max(0, state.weeklyChallenge.progress - 1);
      if (state.weeklyChallenge.completed && state.weeklyChallenge.progress < state.weeklyChallenge.goal) {
        state.weeklyChallenge.completed = false;
        state.points = Math.max(0, state.points - state.weeklyChallenge.points);
      }
    }
  }

  // Evaluate badge eligibility
  checkBadgeMilestones();
  saveState();

  // Re-render current view context
  const activeView = document.querySelector(".app-view.active")?.id;
  if (activeView === "dashboard-view") {
    renderDashboard();
  } else if (activeView === "logger-view") {
    renderLogger();
  } else if (activeView === "insights-view") {
    renderInsights();
  }
}

function triggerStreakFlameAnimation() {
  const streakBadge = document.querySelector(".streak-badge");
  if (streakBadge) {
    streakBadge.classList.remove("flame-active");
    void streakBadge.offsetWidth; // Force CSS reflow to restart animation
    streakBadge.classList.add("flame-active");
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
  const container = document.getElementById("recommendations-container");
  if (!container) return;
  
  // Call Feature 3: Smart Personalised Tips
  checkPersonalisedTips();
  
  // Call Feature 6: Weekly Challenge checking/rendering
  checkWeeklyChallenge();
}

async function renderAICoachTip(emissions, maxCat) {
  const container = document.getElementById("ai-coach-container");
  if (!container) return;
  
  const key = localStorage.getItem("ecolife_gemini_key") || "";
  const today = getTodayString();
  const loggedTodayIds = state.loggedActions[today] || [];
  const loggedTodayTitles = loggedTodayIds.map(id => {
    const act = DAILY_ACTIONS.find(a => a.id === id);
    return act ? act.title : id;
  });

  if (key) {
    container.innerHTML = `
      <div style="background: linear-gradient(135deg, rgba(6, 182, 212, 0.08) 0%, rgba(22, 34, 57, 0.45) 100%); border: 1px solid rgba(6, 182, 212, 0.22); padding: 16px; border-radius: var(--border-radius-md); border-left: 6px solid var(--color-secondary); box-shadow: var(--shadow-cyan-glow);">
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <p style="font-size: 11px; text-transform: uppercase; color: var(--color-secondary); font-weight: 700; letter-spacing: 0.05em; margin-bottom: 0;">✨ Gemini AI Environmental Coach</p>
          <button class="btn btn-secondary" id="regen-ai-tip-btn" style="padding: 4px 8px; font-size: 10px; border-radius: 8px; cursor: pointer; border: 1px solid rgba(6, 182, 212, 0.2); background: rgba(6, 182, 212, 0.08);">🔄 Regenerate</button>
        </div>
        <p id="ai-tip-text" style="font-size: 14px; color: var(--text-primary); margin-top: 8px; line-height: 1.5; font-style: italic; margin-bottom: 0;">Thinking about your footprint profile...</p>
      </div>
    `;
    
    document.getElementById("regen-ai-tip-btn").addEventListener("click", () => renderAICoachTip(emissions, maxCat));
    
    // Call Gemini API
    const tip = await fetchGeminiTip(key, emissions, maxCat, loggedTodayTitles);
    const textEl = document.getElementById("ai-tip-text");
    if (textEl) {
      textEl.textContent = `"${tip}"`;
    }
  } else {
    // Local fallback tip
    const fallbacks = {
      housing: "Swapping standard lightbulbs for LED alternatives saves roughly 150kg of CO2 emissions annually per household while slashing utility bills.",
      transport: "Replacing just one solo commute a week with bicycling or public transit reduces travel emissions by up to 14% and helps decongest local roads.",
      food: "Going meatless twice a week cuts your dietary carbon footprint by 30%. Lentils and chickpeas have a footprint up to 20x lower than beef.",
      consumption: "Embracing a 'buy second-hand' rule for electronics and clothes diverts plastic and metal waste from landfills and cuts shipping footprints."
    };
    const localTip = fallbacks[maxCat] || fallbacks.transport;
    
    container.innerHTML = `
      <div style="background: rgba(255, 255, 255, 0.02); border: 1px solid var(--border-glass); padding: 16px; border-radius: var(--border-radius-md); border-left: 6px solid var(--text-muted);">
        <p style="font-size: 11px; text-transform: uppercase; color: var(--text-secondary); font-weight: 700; letter-spacing: 0.05em; margin-bottom: 4px;">✨ Gemini AI Environmental Coach</p>
        <p style="font-size: 13px; color: var(--text-primary); margin-top: 8px; line-height: 1.5; margin-bottom: 0;">"${localTip}"</p>
        <div style="margin-top: 12px; font-size: 10px; color: var(--text-muted); display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
          <span>Using local intelligence.</span>
          <button id="ai-key-link" style="background: none; border: none; color: var(--color-secondary); text-decoration: underline; cursor: pointer; padding: 0; font-size: 10px;">Add Gemini API Key</button>
          <span>for real-time custom Gemini coach insights.</span>
        </div>
      </div>
    `;
    
    document.getElementById("ai-key-link").addEventListener("click", () => {
      document.getElementById("settings-modal").style.display = "flex";
      document.getElementById("gemini-key-input").focus();
    });
  }
}

async function fetchGeminiTip(apiKey, emissions, highestCat, loggedToday) {
  const prompt = `You are EcoLife AI, a friendly, professional environmental sustainability coach.
The user has an annual carbon footprint of ${(emissions.overall / 1000).toFixed(1)} tonnes CO2e.
Their highest emission category is "${highestCat}" (Housing/Transport/Food/Consumption).
Today they logged the following environment-friendly habits: ${loggedToday.length > 0 ? loggedToday.join(", ") : "None yet"}.
Provide one short, punchy, actionable tip (max 3 sentences) to help them lower their footprint. Start directly with the advice. Do not use markdown headings.`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });
    const data = await response.json();
    if (data.candidates && data.candidates[0].content.parts[0].text) {
      return data.candidates[0].content.parts[0].text.trim();
    }
    throw new Error("Invalid response format");
  } catch (err) {
    console.error("Gemini API error:", err);
    return `Try bundling your local errands. Planning trips efficiently can reduce transportation emissions by up to 20% while saving fuel.`;
  }
}

function generateShareCard() {
  const canvas = document.createElement("canvas");
  canvas.width = 800;
  canvas.height = 450;
  const ctx = canvas.getContext("2d");
  
  // 1. Draw gradient background
  const grad = ctx.createLinearGradient(0, 0, 800, 450);
  grad.addColorStop(0, "#090d16");
  grad.addColorStop(0.5, "#0f172a");
  grad.addColorStop(1, "#022c22");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 800, 450);
  
  // 2. Decorative glowing circles
  ctx.fillStyle = "rgba(16, 185, 129, 0.15)";
  ctx.beginPath();
  ctx.arc(720, 80, 160, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.fillStyle = "rgba(6, 182, 212, 0.12)";
  ctx.beginPath();
  ctx.arc(80, 370, 200, 0, Math.PI * 2);
  ctx.fill();
  
  // 3. Draw outer glass border
  ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
  ctx.lineWidth = 12;
  ctx.strokeRect(6, 6, 788, 438);
  
  // 4. Header: EcoLife logo & subtitle
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 32px Outfit, sans-serif";
  ctx.fillText("EcoLife", 60, 75);
  
  ctx.fillStyle = "#10b981";
  ctx.font = "bold 11px Inter, sans-serif";
  ctx.fillText("CARBON ARCHITECT PORTFOLIO", 60, 105);
  
  // 5. Left column: user footprint details
  ctx.fillStyle = "#94a3b8";
  ctx.font = "500 14px Inter, sans-serif";
  ctx.fillText("ESTIMATED ANNUAL CO₂ FOOTPRINT", 60, 180);
  
  const emissions = calculateEmissions();
  const valTonnes = (emissions.overall / 1000).toFixed(1);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 64px Outfit, sans-serif";
  ctx.fillText(`${valTonnes} tonnes`, 60, 248);
  
  // Level badge rectangle
  const level = getFootprintLevel(emissions.overall, "overall");
  const levelText = getFootprintLevelText(level).toUpperCase();
  const levelColor = level === "green" ? "#10b981" : (level === "amber" ? "#f59e0b" : "#ef4444");
  
  ctx.fillStyle = levelColor;
  drawRoundedRect(ctx, 60, 275, 180, 32, 6);
  ctx.fill();
  
  ctx.fillStyle = level === "amber" ? "#090d16" : "#ffffff";
  ctx.font = "bold 13px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(levelText, 150, 296);
  ctx.textAlign = "left"; // restore alignment
  
  // 6. Divider line
  ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(430, 120);
  ctx.lineTo(430, 340);
  ctx.stroke();
  
  // 7. Right column: Achievements & Badges
  ctx.fillStyle = "#94a3b8";
  ctx.font = "500 14px Inter, sans-serif";
  ctx.fillText("TOP ACHIEVEMENT UNLOCKED", 470, 180);
  
  let topBadge = { title: "Eco Pioneer", icon: "🌱", desc: "Completed initial calculations" };
  if (state.unlockedBadges.length > 0) {
    const lastId = state.unlockedBadges[state.unlockedBadges.length - 1];
    const match = BADGES.find(b => b.id === lastId);
    if (match) topBadge = match;
  }
  
  // Badge Icon (large emoji)
  ctx.font = "72px serif";
  ctx.fillText(topBadge.icon, 470, 265);
  
  // Badge Title
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 24px Outfit, sans-serif";
  ctx.fillText(topBadge.title, 470, 310);
  
  // Badge description
  ctx.fillStyle = "#94a3b8";
  ctx.font = "14px Inter, sans-serif";
  ctx.fillText(topBadge.desc, 470, 335);
  
  // 7.5 Draw share caption
  if (state.shareCaption) {
    ctx.fillStyle = "#06b6d4"; // Secondary Cyan for caption
    ctx.font = "italic 500 14px Inter, sans-serif";
    ctx.fillText(`"${state.shareCaption}"`, 60, 365);
  }

  // 8. Footer metadata stats
  ctx.fillStyle = "#64748b";
  ctx.font = "12px Inter, sans-serif";
  ctx.fillText(`Eco Score: ${state.points} points | Streak: ${state.streak} Days`, 60, 395);
  ctx.fillText("ecolife-carbon-architect.com", 610, 395);
  
  return canvas.toDataURL("image/png");
}

function drawRoundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

// --- PROFILE RENDERER & ACTIONS ---
function renderProfile() {
  // Update Identity Card text
  document.getElementById("profile-display-name").textContent = state.displayName || "Eco Friend";
  document.getElementById("profile-username").textContent = state.username || "";
  document.getElementById("profile-location-text").textContent = state.location || "Global";
  document.getElementById("profile-member-since").textContent = state.memberSince || "";
  
  // Update Edit Form Inputs
  document.getElementById("edit-display-name").value = state.displayName || "";
  document.getElementById("edit-username").value = state.username || "";
  document.getElementById("edit-location").value = state.location || "";
  
  // Update Avatar Image
  const avatarImg = document.getElementById("profile-avatar-img");
  if (state.photoURL) {
    avatarImg.src = state.photoURL;
  } else {
    avatarImg.src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2364748b'><path d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/></svg>";
  }

  // Update Eco Tier Badge
  const tier = getEcoTier(state.points);
  const badgeContainer = document.getElementById("profile-tier-badge");
  const badgeIcon = document.getElementById("profile-badge-icon");
  const badgeTitle = document.getElementById("profile-badge-title");
  const badgeDesc = document.getElementById("profile-badge-desc");
  const tierGlow = document.getElementById("profile-tier-glow");

  // Remove existing tier classes
  badgeContainer.className = "eco-tier-badge-container";
  badgeContainer.classList.add(tier.class);
  
  tierGlow.className = "tier-accent-glow";
  tierGlow.classList.add(tier.class + "-glow");
  
  badgeIcon.textContent = tier.icon;
  badgeTitle.textContent = tier.title;
  badgeDesc.textContent = tier.desc;

  // Regional Comparison logic
  const emissions = calculateEmissions();
  const userTonnes = Number((emissions.overall / 1000).toFixed(1));
  document.getElementById("user-footprint-value").textContent = `${userTonnes} t CO₂e`;
  document.getElementById("user-comp-bar-val").textContent = `${userTonnes}t`;

  const region = findRegionalAverage(state.location);
  document.getElementById("region-comparison-label").textContent = `Regional Average (${region.name})`;
  document.getElementById("region-comparison-val").textContent = `${region.value}t`;

  // Update bars width
  const maxVal = Math.max(userTonnes, region.value, 1) * 1.2;
  const userPct = (userTonnes / maxVal) * 100;
  const regionPct = (region.value / maxVal) * 100;

  const userBar = document.getElementById("user-comparison-bar");
  userBar.style.width = `${userPct}%`;
  
  const overallLevel = getFootprintLevel(emissions.overall, "overall");
  userBar.className = "category-bar-fill " + getFootprintLevelBgClass(overallLevel);

  document.getElementById("region-comparison-bar").style.width = `${regionPct}%`;

  // Comparison description text
  const diffPct = Math.round(Math.abs((userTonnes - region.value) / (region.value || 1)) * 100);
  const summaryCard = document.getElementById("regional-summary-card");
  
  if (userTonnes < region.value) {
    summaryCard.style.borderColor = "var(--border-glass-highlight)";
    summaryCard.style.background = "rgba(16, 185, 129, 0.04)";
    summaryCard.innerHTML = `🌿 Excellent! Your carbon footprint is **${diffPct}% lower** than the regional average for **${region.name}** (${region.value}t). You are doing a fantastic job helping your community shrink its emissions!`;
  } else if (userTonnes === region.value) {
    summaryCard.style.borderColor = "var(--border-glass)";
    summaryCard.style.background = "rgba(255, 255, 255, 0.02)";
    summaryCard.innerHTML = `⚠️ Your carbon footprint is **identical** to the regional average for **${region.name}** (${region.value}t). Explore the recommendations and log more daily habits to become below-average.`;
  } else {
    summaryCard.style.borderColor = "rgba(239, 68, 68, 0.2)";
    summaryCard.style.background = "rgba(239, 68, 68, 0.04)";
    summaryCard.innerHTML = `🚨 Notice: Your carbon footprint is **${diffPct}% higher** than the regional average for **${region.name}** (${region.value}t). Focus on your highest impact category on the Recommendations screen to start driving this down.`;
  }
}

// --- PHOTO UPLOAD & CAPTURE BINDINGS ---
let cameraStream = null;

function setupPhotoHandlers() {
  const avatarFileInput = document.getElementById("avatar-file-input");
  const uploadPhotoBtn = document.getElementById("upload-photo-btn");
  const capturePhotoBtn = document.getElementById("capture-photo-btn");
  const avatarContainer = document.querySelector(".profile-avatar-container");
  
  const cameraModal = document.getElementById("camera-modal");
  const cameraVideo = document.getElementById("camera-video");
  const cameraCanvas = document.getElementById("camera-canvas");
  const closeCameraBtn = document.getElementById("close-camera-modal-btn");
  const cancelCameraBtn = document.getElementById("cancel-camera-btn");
  const snapCameraBtn = document.getElementById("snap-camera-btn");
  
  // Container click falls back to file selection
  avatarContainer.addEventListener("click", () => {
    avatarFileInput.click();
  });
  
  // Gallery upload
  uploadPhotoBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    avatarFileInput.click();
  });
  
  avatarFileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const compressedBase64 = await compressImage(event.target.result, 150, 150);
        state.photoURL = compressedBase64;
        saveState();
        updateHeaderAvatar();
        renderProfile();
      };
      reader.readAsDataURL(file);
    }
  });

  // Open camera modal
  capturePhotoBtn.addEventListener("click", async (e) => {
    e.stopPropagation();
    try {
      cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      cameraVideo.srcObject = cameraStream;
      cameraModal.style.display = "flex";
    } catch (err) {
      console.error("Camera access error:", err);
      await showCustomAlert("Camera Access Error", "Could not access camera. Please check permissions or upload from gallery instead.");
    }
  });

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      cameraStream = null;
    }
    cameraVideo.srcObject = null;
    cameraModal.style.display = "none";
  };

  closeCameraBtn.addEventListener("click", stopCamera);
  cancelCameraBtn.addEventListener("click", stopCamera);

  // Capture frame
  snapCameraBtn.addEventListener("click", async () => {
    if (!cameraStream) return;
    const ctx = cameraCanvas.getContext("2d");
    
    // Use correct aspect ratios
    const vw = cameraVideo.videoWidth;
    const vh = cameraVideo.videoHeight;
    cameraCanvas.width = 300;
    cameraCanvas.height = 300;
    
    // Mirror drawing
    ctx.translate(300, 0);
    ctx.scale(-1, 1);
    
    // Draw centered square crop from video
    const size = Math.min(vw, vh);
    const sx = (vw - size) / 2;
    const sy = (vh - size) / 2;
    
    ctx.drawImage(cameraVideo, sx, sy, size, size, 0, 0, 300, 300);
    ctx.setTransform(1, 0, 0, 1, 0, 0); // reset scale
    
    const base64 = cameraCanvas.toDataURL("image/jpeg", 0.85);
    state.photoURL = base64;
    
    saveState();
    updateHeaderAvatar();
    renderProfile();
    stopCamera();
  });
}

function compressImage(base64Str, maxWidth, maxHeight) {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let width = img.width;
      let height = img.height;
      
      const size = Math.min(width, height);
      canvas.width = maxWidth;
      canvas.height = maxHeight;
      
      const ctx = canvas.getContext("2d");
      const sx = (width - size) / 2;
      const sy = (height - size) / 2;
      
      ctx.drawImage(img, sx, sy, size, size, 0, 0, maxWidth, maxHeight);
      resolve(canvas.toDataURL("image/jpeg", 0.75));
    };
  });
}

// --- GEMINI POWERED FEATURES ---
async function callGemini(prompt, systemInstruction = "", responseFormatJson = false) {
  const apiKey = localStorage.getItem("ecolife_gemini_key") || "";
  if (!apiKey) {
    throw new Error("No Gemini API key configured.");
  }
  
  const payload = {
    contents: [{ parts: [{ text: prompt }] }]
  };
  
  if (systemInstruction) {
    payload.systemInstruction = {
      parts: [{ text: systemInstruction }]
    };
  }
  
  if (responseFormatJson) {
    payload.generationConfig = {
      responseMimeType: "application/json"
    };
  }
  
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  
  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  if (data.candidates && data.candidates[0].content.parts[0].text) {
    return data.candidates[0].content.parts[0].text.trim();
  }
  
  throw new Error("Invalid response structure from Gemini API.");
}

// --- FEATURE 1: ECO COACH CHAT ---
function initChatUI() {
  const chatFab = document.getElementById("chat-fab-btn");
  const chatModal = document.getElementById("chat-modal");
  const closeChatBtn = document.getElementById("close-chat-modal-btn");
  const chatSendBtn = document.getElementById("chat-send-btn");
  const chatUserInput = document.getElementById("chat-user-input");

  if (!chatFab || !chatModal || !closeChatBtn || !chatSendBtn || !chatUserInput) return;

  chatFab.addEventListener("click", () => {
    chatModal.style.display = "flex";
    renderChatMessages();
    const container = document.getElementById("chat-messages-container");
    container.scrollTop = container.scrollHeight;
  });

  closeChatBtn.addEventListener("click", () => {
    chatModal.style.display = "none";
  });

  chatSendBtn.addEventListener("click", sendChatMessage);
  chatUserInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendChatMessage();
  });
}

function renderChatMessages() {
  const container = document.getElementById("chat-messages-container");
  if (!container) return;
  container.innerHTML = "";

  if (!state.chatHistory || state.chatHistory.length === 0) {
    state.chatHistory = [
      { role: "model", parts: [{ text: "Hello! I am your EcoLife AI Coach. Ask me anything about how to reduce your carbon footprint, optimize your home energy, or improve your daily habits!" }] }
    ];
  }

  state.chatHistory.forEach((msg) => {
    const bubble = document.createElement("div");
    bubble.className = `chat-message ${msg.role}`;
    bubble.textContent = msg.parts[0].text;
    container.appendChild(bubble);
  });
  
  container.scrollTop = container.scrollHeight;
}

async function sendChatMessage() {
  const input = document.getElementById("chat-user-input");
  const text = input.value.trim();
  if (!text) return;

  input.value = "";
  
  state.chatHistory.push({ role: "user", parts: [{ text: text }] });
  renderChatMessages();
  
  const container = document.getElementById("chat-messages-container");
  const indicator = document.createElement("div");
  indicator.className = "chat-message model typing-indicator";
  indicator.id = "chat-typing-indicator";
  indicator.innerHTML = `
    <div class="typing-dot"></div>
    <div class="typing-dot"></div>
    <div class="typing-dot"></div>
  `;
  container.appendChild(indicator);
  container.scrollTop = container.scrollHeight;

  const systemInstruction = `You are EcoLife's personal carbon coach. User footprint data: ${JSON.stringify(state.answers)}. Answer questions with specific, actionable advice. Keep replies punchy, encouraging, and limited to 2-3 sentences.`;

  try {
    const apiKey = localStorage.getItem("ecolife_gemini_key") || "";
    if (!apiKey) {
      throw new Error("No Gemini key configured.");
    }

    const payload = {
      contents: state.chatHistory.map(h => ({ role: h.role, parts: h.parts })),
      systemInstruction: {
        parts: [{ text: systemInstruction }]
      }
    };

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    const ind = document.getElementById("chat-typing-indicator");
    if (ind) ind.remove();

    if (data.candidates && data.candidates[0].content.parts[0].text) {
      const reply = data.candidates[0].content.parts[0].text.trim();
      state.chatHistory.push({ role: "model", parts: [{ text: reply }] });
      saveState();
      renderChatMessages();
    } else {
      throw new Error("Invalid reply format.");
    }
  } catch (err) {
    console.warn("Gemini chat failed, using offline fallback:", err);
    const ind = document.getElementById("chat-typing-indicator");
    if (ind) ind.remove();

    const reply = getFallbackChatReply(text);
    state.chatHistory.push({ role: "model", parts: [{ text: reply }] });
    saveState();
    renderChatMessages();
  }
}

function getFallbackChatReply(userText) {
  const t = userText.toLowerCase();
  const emissions = calculateEmissions();
  const footprint = (emissions.overall / 1000).toFixed(1);
  
  if (t.includes("footprint") || t.includes("score") || t.includes("how much") || t.includes("tonnes")) {
    return `Your estimated carbon footprint is currently ${footprint} tonnes CO₂e per year. That is ${Math.round((emissions.overall / 4700) * 100)}% of the global average target. Let's work on home energy and transport to reduce it!`;
  }
  if (t.includes("food") || t.includes("diet") || t.includes("eat") || t.includes("waste")) {
    return `Diet accounts for ${(emissions.food / 1000).toFixed(1)} tonnes of your footprint. Try logging plant-based meals in the Daily Actions tab; meatless meals save about 4.5kg CO₂ each!`;
  }
  if (t.includes("transport") || t.includes("travel") || t.includes("car") || t.includes("flight")) {
    return `Transport contributes ${(emissions.transport / 1000).toFixed(1)} tonnes to your total. Swapping short solo drives for cycling or walking reduces emissions immediately by 3.2kg per trip.`;
  }
  if (t.includes("home") || t.includes("heating") || t.includes("energy") || t.includes("power")) {
    return `Your housing emissions are ${(emissions.housing / 1000).toFixed(1)} tonnes. Try reducing laundry wash temperature to 30°C or lowering your thermostat by 1°C.`;
  }
  return `To lower your ${footprint}-tonne carbon footprint, check out the Recommendations tab for specific tips, or log today's checklist actions to accumulate points and decrease your daily impact!`;
}

// --- FEATURE 2: WEEKLY INSIGHT SUMMARY ---
async function checkWeeklyInsightSummary(force = false) {
  const today = new Date();
  const dayOfWeek = today.getDay();
  
  const currentMonday = new Date();
  const distanceToMonday = (dayOfWeek + 6) % 7;
  currentMonday.setDate(today.getDate() - distanceToMonday);
  const mondayStr = `${currentMonday.getFullYear()}-${String(currentMonday.getMonth() + 1).padStart(2, '0')}-${String(currentMonday.getDate()).padStart(2, '0')}`;

  if (!force && state.weeklySummary && state.weeklySummary.mondayStr === mondayStr) {
    renderWeeklyInsightSummary();
    return;
  }

  const habitsList = [];
  let totalSavedLast7Days = 0;
  for (let i = 0; i < 7; i++) {
    const dStr = getPastDateString(i);
    const logged = state.loggedActions[dStr] || [];
    logged.forEach(actionId => {
      const action = DAILY_ACTIONS.find(a => a.id === actionId);
      if (action) {
        habitsList.push(action.title);
        totalSavedLast7Days += action.impact;
      }
    });
  }

  const prompt = `Based on this week's habits: ${JSON.stringify(habitsList)}. CO₂ saved: ${totalSavedLast7Days.toFixed(1)}kg. Write 3 sentences: highlight best habit, one area to improve, one challenge for next week. Keep it warm and motivating.`;

  const card = document.getElementById("weekly-summary-card");
  const textEl = document.getElementById("weekly-summary-text");
  if (card) {
    card.style.display = "block";
    textEl.innerHTML = `<em>AI Coach is writing your weekly insights...</em>`;
  }

  try {
    const summaryText = await callGemini(prompt);
    state.weeklySummary = { text: summaryText, mondayStr: mondayStr };
    saveState();
    renderWeeklyInsightSummary();
  } catch (err) {
    console.warn("Weekly Summary generation failed, using offline fallback:", err);
    const summaryText = getFallbackWeeklySummary(habitsList, totalSavedLast7Days);
    state.weeklySummary = { text: summaryText, mondayStr: mondayStr };
    saveState();
    renderWeeklyInsightSummary();
  }
}

function renderWeeklyInsightSummary() {
  const card = document.getElementById("weekly-summary-card");
  const textEl = document.getElementById("weekly-summary-text");
  if (card && state.weeklySummary) {
    card.style.display = "block";
    textEl.textContent = state.weeklySummary.text;
  }
}

function getFallbackWeeklySummary(habitsList, totalSaved) {
  if (habitsList.length === 0) {
    return `You haven't logged any daily habits in the last 7 days yet. Swapping to plant-based meals or active transit are easy ways to get started. Let's aim to log at least three actions this coming week!`;
  }
  const uniqueHabits = [...new Set(habitsList)];
  return `You did a wonderful job this week saving ${totalSaved.toFixed(1)}kg of CO₂ by practicing green habits like ${uniqueHabits.slice(0, 2).join(" and ")}! To improve further, consider looking into your home energy settings. Your challenge for next week is to complete a zero waste day.`;
}

// --- FEATURE 3: SMART PERSONALISED TIPS ---
async function checkPersonalisedTips(force = false) {
  const container = document.getElementById("recommendations-container");
  if (!container) return;

  if (!force && state.personalizedTips && state.personalizedTips.length > 0) {
    renderPersonalisedTips(state.personalizedTips);
    return;
  }

  container.innerHTML = `
    <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-glass); padding: 32px; border-radius: var(--border-radius-md); text-align: center; width: 100%;">
      <p style="font-size: 14px; color: var(--text-secondary);">✨ Gemini is crafting your personalized eco-tips...</p>
      <div style="margin: 16px auto 0; width: 30px; height: 30px; border: 3px solid rgba(255,255,255,0.1); border-top-color: var(--color-secondary); border-radius: 50%; animation: spin 1s linear infinite;"></div>
    </div>
  `;

  const emissions = calculateEmissions();
  const footprint = (emissions.overall / 1000).toFixed(1);
  const homeType = state.answers.housing_size ? state.answers.housing_size.value : "Standard";
  const diet = state.answers.diet_type ? state.answers.diet_type.value : "Standard";
  const transport = state.answers.transport_vehicle ? state.answers.transport_vehicle.value : "Standard";

  const prompt = `User profile: home=${homeType}, diet=${diet}, transport=${transport}, footprint=${footprint} tonnes. Give 3 specific carbon reduction tips as JSON: [{"title": "Tip Title", "description": "Tip Description", "estimatedSaving": 120}]. Return valid JSON array only.`;

  try {
    const jsonText = await callGemini(prompt, "Return a JSON array of 3 objects with keys 'title', 'description', and 'estimatedSaving'. Output nothing but valid JSON.", true);
    const tips = JSON.parse(jsonText);
    state.personalizedTips = tips;
    saveState();
    renderPersonalisedTips(tips);
  } catch (err) {
    console.warn("Personalised tips generation failed, using offline fallback:", err);
    const tips = getFallbackPersonalisedTips(emissions);
    state.personalizedTips = tips;
    saveState();
    renderPersonalisedTips(tips);
  }
}

function renderPersonalisedTips(tips) {
  const container = document.getElementById("recommendations-container");
  if (!container) return;
  container.innerHTML = "";

  const aiCoachContainer = document.createElement("div");
  aiCoachContainer.id = "ai-coach-container";
  aiCoachContainer.style.marginBottom = "16px";
  container.appendChild(aiCoachContainer);
  
  const emissions = calculateEmissions();
  const sortedCategories = ["housing", "transport", "food", "consumption"].sort((a,b) => emissions[b] - emissions[a]);
  const maxCat = sortedCategories[0];
  renderAICoachTip(emissions, maxCat);

  const catNames = { housing: "Housing Energy", transport: "Transport & Travel", food: "Diet & Waste", consumption: "Consumer Goods" };
  const focusHeader = document.createElement("div");
  focusHeader.style.marginBottom = "16px";
  focusHeader.innerHTML = `
    <div style="background: rgba(16, 185, 129, 0.04); border: 1px solid var(--border-glass-highlight); padding: 16px; border-radius: var(--border-radius-md); border-left: 6px solid var(--color-primary); box-shadow: var(--shadow-primary-glow);">
      <p style="font-size: 11px; text-transform: uppercase; color: var(--color-primary); font-weight: 700; letter-spacing: 0.05em; margin-bottom: 4px;">Primary Action Focus</p>
      <h2 style="font-size: 18px; color: var(--text-primary); margin-bottom: 6px;">Your Highest Impact Area is ${catNames[maxCat]}</h2>
      <p style="font-size: 13px; color: var(--text-secondary);">Focusing on reduction strategies in this category will yield the largest cut in your annual emissions. Check out your tailored recommendations below.</p>
    </div>
  `;
  container.appendChild(focusHeader);

  tips.forEach(tip => {
    const card = document.createElement("div");
    card.className = "insight-card insight-housing"; 
    card.style.borderLeft = "6px solid var(--color-secondary)";
    card.innerHTML = `
      <div class="insight-icon">💡</div>
      <div class="insight-body" style="width: 100%;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap;">
          <h3 style="margin: 0; font-size: 15px; flex: 1;">${tip.title}</h3>
          <span style="font-size: 10px; font-weight: 700; color: var(--color-accent); background: rgba(132, 204, 22, 0.1); padding: 3px 8px; border-radius: 8px;">-${tip.estimatedSaving} kg CO₂/yr</span>
        </div>
        <p style="margin-top: 6px; font-size: 13px; color: var(--text-secondary); line-height: 1.4;">${tip.description}</p>
      </div>
    `;
    container.appendChild(card);
  });
}

function getFallbackPersonalisedTips(emissions) {
  const sorted = [
    { key: "housing", name: "Housing Energy", staticTips: [
      { title: "Smart Heating Adjustments", description: "Lowering your smart thermostat by just 1°C saves approximately 140kg CO₂ annually per household while lowering bills.", estimatedSaving: 140 },
      { title: "LED Bulb Upgrades", description: "Replacing standard incandescent or halogen light bulbs with energy-efficient LED alternatives cuts home utility waste.", estimatedSaving: 80 }
    ] },
    { key: "transport", name: "Transport & Travel", staticTips: [
      { title: "Active Walking or Biking Commutes", description: "Replacing two solo weekly car trips under 5km with a walking or cycling commute cuts emissions substantially.", estimatedSaving: 160 },
      { title: "Transit Day Integration", description: "Choosing public transit instead of standard vehicle commutes cuts travel emissions by roughly 70% per passenger-kilometer.", estimatedSaving: 200 }
    ] },
    { key: "food", name: "Diet & Waste", staticTips: [
      { title: "Weekly Plant-Based Integration", description: "Committing to two meatless days weekly lowers diet-related carbon and agricultural waste inputs.", estimatedSaving: 110 },
      { title: "Zero Food Waste Initiative", description: "Planning meals, buying precisely, and freezing leftovers prevents direct compost methane emissions.", estimatedSaving: 90 }
    ] }
  ].sort((a, b) => emissions[b.key] - emissions[a.key]);

  const output = [];
  sorted.forEach(cat => {
    cat.staticTips.forEach(tip => {
      if (output.length < 3) output.push(tip);
    });
  });
  return output;
}

// --- FEATURE 4: QUIZ ANSWER ANALYSIS ---
async function runQuizAnswerAnalysis() {
  navigateTo("quiz-analysis-view");

  const loader = document.getElementById("analysis-loading-state");
  const results = document.getElementById("analysis-results-state");
  
  if (loader && results) {
    loader.style.display = "block";
    results.style.display = "none";
  }

  const prompt = `Analyse these quiz answers: ${JSON.stringify(state.answers)}. Return JSON: { "summary": "2-sentence overview", "biggestImpact": "largest emission source", "quickWin": "easiest change this week", "thirtyDayPlan": ["step1", "step2", "step3"] }. Output valid JSON objects only.`;

  try {
    const jsonText = await callGemini(prompt, "Analyze quiz answers and output a single JSON object. Do not include markdown wraps.", true);
    const analysis = JSON.parse(jsonText);
    state.quizAnalysis = analysis;
    saveState();
    renderQuizAnalysis(analysis);
  } catch (err) {
    console.warn("Quiz analysis failed, using offline fallback:", err);
    const analysis = getFallbackQuizAnalysis();
    state.quizAnalysis = analysis;
    saveState();
    renderQuizAnalysis(analysis);
  }
}

function renderQuizAnalysis(analysis) {
  const loader = document.getElementById("analysis-loading-state");
  const results = document.getElementById("analysis-results-state");
  
  if (loader && results) {
    loader.style.display = "none";
    results.style.display = "block";
  }

  document.getElementById("analysis-summary").textContent = analysis.summary;
  document.getElementById("analysis-biggest-impact").textContent = analysis.biggestImpact;
  document.getElementById("analysis-quick-win").textContent = analysis.quickWin;

  const planList = document.getElementById("analysis-thirty-day-plan");
  if (planList) {
    planList.innerHTML = "";
    analysis.thirtyDayPlan.forEach((step, idx) => {
      const li = document.createElement("li");
      li.style.display = "flex";
      li.style.gap = "12px";
      li.style.alignItems = "flex-start";
      li.style.background = "rgba(255,255,255,0.01)";
      li.style.border = "1px solid var(--border-glass)";
      li.style.padding = "10px 14px";
      li.style.borderRadius = "var(--border-radius-sm)";
      
      li.innerHTML = `
        <span style="display: flex; align-items: center; justify-content: center; width: 20px; height: 20px; border-radius: 50%; background: var(--color-secondary); color: #090d16; font-size: 11px; font-weight: bold; flex-shrink: 0; margin-top: 2px;">${idx + 1}</span>
        <span style="font-size: 13px; line-height: 1.4; color: var(--text-secondary);">${step}</span>
      `;
      planList.appendChild(li);
    });
  }

  const continueBtn = document.getElementById("analysis-continue-btn");
  if (continueBtn) {
    const newBtn = continueBtn.cloneNode(true);
    continueBtn.parentNode.replaceChild(newBtn, continueBtn);
    
    newBtn.addEventListener("click", () => {
      unlockBadge("eco_pioneer");
      state.quizCompleted = true;
      state.points += 50; 
      saveState();
      
      document.getElementById("nav-bar").style.display = "flex";
      document.getElementById("header-stats").style.display = "flex";
      document.getElementById("chat-fab-btn").style.display = "flex";
      initChatUI();
      checkWeeklyInsightSummary();
      checkWeeklyChallenge();
      navigateTo("dashboard-view");
    });
  }
}

function getFallbackQuizAnalysis() {
  const emissions = calculateEmissions();
  const sorted = [
    { key: "housing", name: "Housing Energy", quick: "lower thermostat by 1 degree" },
    { key: "transport", name: "Transport & Travel", quick: "swap one drive for transit or walk" },
    { key: "food", name: "Diet & Waste", quick: "practice meatless mondays" }
  ].sort((a, b) => emissions[b.key] - emissions[a.key]);

  return {
    summary: `Your yearly greenhouse emissions sum up to ${(emissions.overall/1000).toFixed(1)} tonnes, placing you in a moderate reduction range. By building deliberate everyday habits, you can rapidly align your lifestyle with eco-friendly targets.`,
    biggestImpact: `${sorted[0].name} (accounts for ${(emissions[sorted[0].key]/1000).toFixed(1)} tonnes)`,
    quickWin: `Try to ${sorted[0].quick} this week to get immediate points and carbon savings!`,
    thirtyDayPlan: [
      `Week 1: Focus on ${sorted[0].name} by reducing standby energy leakage or small driving trips.`,
      `Week 2: Adjust your diet structure by completing at least 3 plant-based meals.`,
      `Week 3: Dive into waste mitigation by tracking food leftovers and cutting consumer packaging.`
    ]
  };
}

// --- FEATURE 5: SHARE CARD CAPTION GENERATOR ---
async function fetchShareCaption(totalSaved, daysActive, streak) {
  const prompt = `Write a 1-line inspiring caption (max 12 words) for someone who saved ${totalSaved}kg CO₂ in ${daysActive} days with a ${streak}-day streak. Make it feel proud and shareable. Return text only.`;

  try {
    const text = await callGemini(prompt);
    return text.replace(/"/g, '').trim();
  } catch (err) {
    console.warn("Caption generation failed, using offline fallback:", err);
    return getFallbackShareCaption(totalSaved, streak);
  }
}

function getFallbackShareCaption(totalSaved, streak) {
  return `Proudly saved ${totalSaved}kg of CO₂! Building a greener lifestyle on a ${streak}-day streak.`;
}

// --- FEATURE 6: WEEKLY CHALLENGE GENERATOR ---
async function checkWeeklyChallenge(force = false) {
  const today = new Date();
  const dayOfWeek = today.getDay();
  
  const currentMonday = new Date();
  const distanceToMonday = (dayOfWeek + 6) % 7;
  currentMonday.setDate(today.getDate() - distanceToMonday);
  const mondayStr = `${currentMonday.getFullYear()}-${String(currentMonday.getMonth() + 1).padStart(2, '0')}-${String(currentMonday.getDate()).padStart(2, '0')}`;

  if (!force && state.weeklyChallenge && state.weeklyChallenge.mondayStr === mondayStr) {
    renderWeeklyChallenge();
    return;
  }

  const weakest = getWeakestCarbonAreas();
  const prompt = `User's weakest carbon areas: ${weakest}. Create 1 fun weekly eco challenge. Return JSON: { "title": "Challenge Title", "description": "Challenge Description", "category": "food/transport/housing/consumption", "goal": 5, "points": 100, "badgeName": "badge_id" }. Return valid JSON only. Choose category ONLY from 'food', 'transport', 'housing', or 'consumption'.`;

  try {
    const jsonText = await callGemini(prompt, "Output a single JSON object. Choose category from food, transport, housing, or consumption.", true);
    const challenge = JSON.parse(jsonText);
    
    state.weeklyChallenge = {
      ...challenge,
      progress: 0,
      completed: false,
      mondayStr: mondayStr
    };
    saveState();
    renderWeeklyChallenge();
  } catch (err) {
    console.warn("Weekly challenge generation failed, using offline fallback:", err);
    const challenge = getFallbackWeeklyChallenge(weakest);
    state.weeklyChallenge = {
      ...challenge,
      progress: 0,
      completed: false,
      mondayStr: mondayStr
    };
    saveState();
    renderWeeklyChallenge();
  }
}

function getWeakestCarbonAreas() {
  const emissions = calculateEmissions();
  const sorted = [
    { key: "housing", name: "Housing Energy", value: emissions.housing },
    { key: "transport", name: "Transport & Travel", value: emissions.transport },
    { key: "food", name: "Diet & Waste", value: emissions.food },
    { key: "consumption", name: "Consumer Goods", value: emissions.consumption }
  ].sort((a, b) => b.value - a.value);
  
  return `${sorted[0].name} and ${sorted[1].name}`;
}

function renderWeeklyChallenge() {
  const titleEl = document.getElementById("weekly-challenge-title");
  const descEl = document.getElementById("weekly-challenge-desc");
  const barEl = document.getElementById("weekly-challenge-bar");
  const textEl = document.getElementById("weekly-challenge-text");
  const ptsEl = document.getElementById("weekly-challenge-points");
  
  if (!state.weeklyChallenge || !titleEl) return;
  
  const challenge = state.weeklyChallenge;
  
  titleEl.textContent = challenge.title;
  descEl.textContent = challenge.description;
  ptsEl.textContent = `+${challenge.points} pts`;
  textEl.textContent = `${challenge.progress} / ${challenge.goal} logged`;
  
  const pct = Math.min(100, (challenge.progress / (challenge.goal || 1)) * 100);
  barEl.style.width = `${pct}%`;
  
  barEl.className = "category-bar-fill";
  if (challenge.category === "food") barEl.classList.add("cat-food");
  else if (challenge.category === "transport") barEl.classList.add("cat-transport");
  else if (challenge.category === "housing") barEl.classList.add("cat-housing");
  else if (challenge.category === "consumption") barEl.classList.add("cat-consumption");
  
  if (challenge.completed) {
    titleEl.textContent = `🎉 ${challenge.title} (Completed)`;
    barEl.style.width = "100%";
    textEl.textContent = "Goal reached!";
    textEl.style.color = "var(--color-primary)";
    ptsEl.style.textDecoration = "line-through";
  } else {
    textEl.style.color = "var(--text-secondary)";
    ptsEl.style.textDecoration = "none";
  }
}

function getFallbackWeeklyChallenge(weakest) {
  if (weakest.includes("Diet")) {
    return {
      title: "Veggie Fuel Chef",
      description: "Log 3 plant-based meals this week to counter agricultural greenhouse loads.",
      category: "food",
      goal: 3,
      points: 60,
      badgeName: "plant_power"
    };
  }
  return {
    title: "Green Transit Rider",
    description: "Practice active commutes and log 3 walking, cycling, or transit trips this week.",
    category: "transport",
    goal: 3,
    points: 80,
    badgeName: "green_rider"
  };
}

// --- CUSTOM ALERT / CONFIRM SYSTEM ---
function showCustomAlert(title, message, isConfirm = false) {
  return new Promise((resolve) => {
    const modal = document.getElementById("custom-alert-modal");
    const titleEl = document.getElementById("custom-alert-title");
    const messageEl = document.getElementById("custom-alert-message");
    const okBtn = document.getElementById("custom-alert-ok-btn");
    const cancelBtn = document.getElementById("custom-alert-cancel-btn");
    
    if (!modal || !titleEl || !messageEl || !okBtn || !cancelBtn) {
      console.warn("Custom alert modal elements not found in DOM, falling back to native popup.");
      if (isConfirm) {
        resolve(confirm(message));
      } else {
        alert(message);
        resolve(true);
      }
      return;
    }

    titleEl.textContent = title;
    messageEl.textContent = message;
    
    if (isConfirm) {
      cancelBtn.style.display = "inline-flex";
    } else {
      cancelBtn.style.display = "none";
    }
    
    modal.style.display = "flex";
    
    const handleOk = () => {
      cleanup();
      resolve(true);
    };
    
    const handleCancel = () => {
      cleanup();
      resolve(false);
    };
    
    const cleanup = () => {
      modal.style.display = "none";
      okBtn.removeEventListener("click", handleOk);
      cancelBtn.removeEventListener("click", handleCancel);
    };
    
    okBtn.addEventListener("click", handleOk);
    cancelBtn.addEventListener("click", handleCancel);
  });
}

// --- AUTH & CONFIG EVENT HANDLERS ---
function switchAuthTab(tab) {
  const signinForm = document.getElementById("signin-form");
  const signupForm = document.getElementById("signup-form");
  const signinTab = document.getElementById("auth-tab-signin");
  const signupTab = document.getElementById("auth-tab-signup");
  
  if (tab === "signin") {
    signinForm.classList.add("active");
    signupForm.classList.remove("active");
    signinTab.classList.add("active");
    signupTab.classList.remove("active");
  } else {
    signinForm.classList.remove("active");
    signupForm.classList.add("active");
    signinTab.classList.remove("active");
    signupTab.classList.add("active");
  }
}

function setupAuthHandlers() {
  const signinTab = document.getElementById("auth-tab-signin");
  const signupTab = document.getElementById("auth-tab-signup");
  const signinForm = document.getElementById("signin-form");
  const signupForm = document.getElementById("signup-form");
  const googleBtn = document.getElementById("google-signin-btn");
  const demoBtn = document.getElementById("demo-bypass-btn");
  
  const checkVerifyBtn = document.getElementById("check-verification-btn");
  const mockVerifyBtn = document.getElementById("mock-verify-btn");
  const logoutPendingBtn = document.getElementById("logout-pending-btn");
  
  signinTab.addEventListener("click", () => switchAuthTab("signin"));
  signupTab.addEventListener("click", () => switchAuthTab("signup"));
  
  // Sign In Form Submit
  signinForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("signin-email").value.trim();
    const password = document.getElementById("signin-password").value;
    
    try {
      await firebaseService.signIn(email, password);
    } catch (err) {
      console.error("Sign-in failed:", err);
      await showCustomAlert("Login Failed", err.message);
    }
  });
  
  // Sign Up Form Submit
  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("signup-name").value.trim();
    const username = document.getElementById("signup-username").value.trim();
    const location = document.getElementById("signup-location").value.trim();
    const email = document.getElementById("signup-email").value.trim();
    const password = document.getElementById("signup-password").value;
    const confirmPassword = document.getElementById("signup-confirm-password").value;
    
    if (password !== confirmPassword) {
      await showCustomAlert("Validation Error", "Passwords do not match!");
      return;
    }
    
    try {
      await firebaseService.signUp(email, password, name, username, location);
    } catch (err) {
      console.error("Registration failed:", err);
      await showCustomAlert("Registration Failed", err.message);
    }
  });

  // Google OAuth button
  googleBtn.addEventListener("click", async () => {
    try {
      await firebaseService.signInWithGoogle();
    } catch (err) {
      console.error("Google sign in failed:", err);
      await showCustomAlert("Google Sign-In Failed", err.message);
    }
  });

  // Demo bypass triggers
  demoBtn.addEventListener("click", () => {
    localStorage.setItem("ecolife_mock_session", "mock_demo_account");
    const todayStr = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    
    const mockUsers = JSON.parse(localStorage.getItem("ecolife_mock_users") || "{}");
    if (!mockUsers["mock_demo_account"]) {
      mockUsers["mock_demo_account"] = {
        uid: "mock_demo_account",
        email: "demo@ecolife.com",
        password: "password",
        displayName: "Eco Adventurer",
        emailVerified: true,
        profile: {
          uid: "mock_demo_account",
          email: "demo@ecolife.com",
          displayName: "Eco Adventurer",
          username: "@eco_pioneer",
          location: "London, UK",
          memberSince: `Member since ${todayStr}`,
          photoURL: "",
          points: 420,
          streak: 5,
          dailySaved: 6.6,
          totalSaved: 44.1,
          quizCompleted: true,
          answers: {
            housing_size: { value: 1200, index: 2, category: "housing" },
            housing_energy: { value: 1800, index: 1, category: "housing" },
            transport_vehicle: { value: 3500, index: 0, category: "transport" },
            transport_flights: { value: 1800, index: 2, category: "transport" },
            diet_type: { value: 1900, index: 1, category: "food" },
            food_waste: { value: 300, index: 1, category: "food" },
            consumption_habits: { value: 1200, index: 1, category: "consumption" }
          },
          loggedActions: {
            [getPastDateString(0)]: ['plant_based_meal', 'unplug_unused', 'short_shower'],
            [getPastDateString(1)]: ['bike_walk', 'cold_wash', 'line_dry'],
            [getPastDateString(2)]: ['public_transit', 'plant_based_meal', 'reusable_bottles'],
            [getPastDateString(3)]: ['plant_based_meal', 'short_shower'],
            [getPastDateString(4)]: ['bike_walk', 'thermostat_tweak', 'unplug_unused'],
            [getPastDateString(5)]: ['plant_based_meal', 'reusable_bottles', 'cold_wash'],
            [getPastDateString(6)]: ['public_transit', 'short_shower', 'line_dry']
          },
          challenges: { foodActionsCount: 4, commuteActionsCount: 4 },
          unlockedBadges: ["eco_pioneer", "plant_power", "green_rider"]
        }
      };
      localStorage.setItem("ecolife_mock_users", JSON.stringify(mockUsers));
    }
    window.dispatchEvent(new Event("mock-auth-changed"));
  });

  mockVerifyBtn.addEventListener("click", () => {
    if (currentUser) {
      firebaseService.simulateMockVerification(currentUser.uid);
    }
  });

  checkVerifyBtn.addEventListener("click", async () => {
    if (firebaseService.isReal()) {
      window.location.reload();
    } else {
      await showCustomAlert("Verification Pending", "Simulated verification link is still pending. Click 'Verify Instantly' to proceed in Demo Mode.");
    }
  });

  logoutPendingBtn.addEventListener("click", () => {
    firebaseService.signOut();
  });
}

// --- ROUTER & CONTROL SYSTEM BOOTSTRAP ---
function initApp() {
  setupAuthListener();
}

// Midnight reset timer setup
let midnightCheckInterval = null;
function setupMidnightReset() {
  if (midnightCheckInterval) {
    clearInterval(midnightCheckInterval);
  }
  midnightCheckInterval = setInterval(() => {
    const today = getTodayString();
    if (state.lastLoggedDate && state.lastLoggedDate !== today) {
      checkDayChange();
      saveState();
      const activeView = document.querySelector(".app-view.active")?.id;
      if (activeView === "dashboard-view") {
        renderDashboard();
      } else if (activeView === "logger-view") {
        renderLogger();
      }
    }
  }, 30000); // Check every 30 seconds
}

// Execute bindings and run immediately on script load
document.querySelectorAll(".nav-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    const target = tab.getAttribute("data-target");
    navigateTo(target);
  });
});

document.getElementById("logo-btn").addEventListener("click", () => {
  if (state.quizCompleted && currentUser && currentUser.emailVerified) {
    navigateTo("dashboard-view");
  }
});

document.getElementById("view-all-actions-btn").addEventListener("click", () => {
  if (currentUser && currentUser.emailVerified) {
    navigateTo("logger-view");
  }
});

document.getElementById("quiz-prev-btn").addEventListener("click", retreatQuiz);
document.getElementById("quiz-next-btn").addEventListener("click", advanceQuiz);

document.getElementById("reset-data-btn").addEventListener("click", async () => {
  const confirmed = await showCustomAlert(
    "Reset Profile",
    "Are you sure you want to reset your footprint profile, points, and logs history? This cannot be undone.",
    true
  );
  if (confirmed) {
    resetState();
  }
});

// Settings Modal Event Listeners
const settingsBtn = document.getElementById("settings-btn");
const settingsModal = document.getElementById("settings-modal");
const closeSettingsBtn = document.getElementById("close-settings-btn");
const cancelSettingsBtn = document.getElementById("cancel-settings-btn");
const saveSettingsBtn = document.getElementById("save-settings-btn");
const geminiKeyInput = document.getElementById("gemini-key-input");
const firebaseConfigInput = document.getElementById("firebase-config-input");

settingsBtn.addEventListener("click", () => {
  geminiKeyInput.value = localStorage.getItem("ecolife_gemini_key") || "";
  firebaseConfigInput.value = localStorage.getItem("ecolife_firebase_config") || "";
  settingsModal.style.display = "flex";
});

const hideSettingsModal = () => {
  settingsModal.style.display = "none";
};

closeSettingsBtn.addEventListener("click", hideSettingsModal);
cancelSettingsBtn.addEventListener("click", hideSettingsModal);

saveSettingsBtn.addEventListener("click", async () => {
  const oldConfig = localStorage.getItem("ecolife_firebase_config") || "";
  const newConfig = firebaseConfigInput.value.trim();
  let configChanged = (oldConfig !== newConfig);
  
  if (newConfig) {
    try {
      JSON.parse(newConfig);
      localStorage.setItem("ecolife_firebase_config", newConfig);
    } catch (e) {
      await showCustomAlert("Invalid JSON", "Invalid JSON format for Firebase configuration.");
      return;
    }
  } else {
    localStorage.removeItem("ecolife_firebase_config");
  }

  const key = geminiKeyInput.value.trim();
  if (key) {
    localStorage.setItem("ecolife_gemini_key", key);
  } else {
    localStorage.removeItem("ecolife_gemini_key");
  }
  
  hideSettingsModal();
  
  if (configChanged) {
    await showCustomAlert("Settings Saved", "Configuration saved! Reloading the page to apply changes...");
    window.location.reload();
  } else {
    const activeView = document.querySelector(".app-view.active")?.id;
    if (activeView === "insights-view") {
      renderInsights();
    }
  }
});

// Share Card Modal Event Listeners
const generateShareCardBtn = document.getElementById("generate-share-card-btn");
const shareModal = document.getElementById("share-modal");
const closeShareBtn = document.getElementById("close-share-btn");
const closeShareModalBtn = document.getElementById("close-share-modal-btn");
const downloadShareCardBtn = document.getElementById("download-share-card-btn");
const shareCardImg = document.getElementById("share-card-img");

generateShareCardBtn.addEventListener("click", async () => {
  let daysActive = 1;
  if (state.createdAt) {
    const diffTime = Math.abs(new Date() - new Date(state.createdAt));
    daysActive = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  }
  
  // Show a simple placeholder or alert context if it takes time
  const caption = await fetchShareCaption(state.totalSaved.toFixed(1), daysActive, state.streak);
  state.shareCaption = caption;
  saveState();

  const dataUrl = generateShareCard();
  shareCardImg.src = dataUrl;
  downloadShareCardBtn.href = dataUrl;
  shareModal.style.display = "flex";
});

// AI Feature Regenerate/Refresh Buttons
document.getElementById("regen-weekly-summary-btn").addEventListener("click", () => {
  checkWeeklyInsightSummary(true);
});

document.getElementById("refresh-tips-btn").addEventListener("click", () => {
  checkPersonalisedTips(true);
});

const hideShareModal = () => {
  shareModal.style.display = "none";
};

closeShareBtn.addEventListener("click", hideShareModal);
closeShareModalBtn.addEventListener("click", hideShareModal);

// Header Avatar Event Listener
document.getElementById("header-avatar-btn").addEventListener("click", () => {
  if (state.quizCompleted && currentUser && currentUser.emailVerified) {
    navigateTo("profile-view");
  }
});

// Log Out Button
document.getElementById("logout-btn").addEventListener("click", async () => {
  const confirmed = await showCustomAlert("Sign Out", "Are you sure you want to sign out?", true);
  if (confirmed) {
    firebaseService.signOut();
  }
});

// Profile Form Submit
document.getElementById("edit-profile-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const displayName = document.getElementById("edit-display-name").value.trim();
  const username = document.getElementById("edit-username").value.trim();
  const location = document.getElementById("edit-location").value.trim();
  
  const formattedUsername = username.startsWith("@") ? username : "@" + username;
  
  state.displayName = displayName;
  state.username = formattedUsername;
  state.location = location;
  
  saveState();
  updateHeaderAvatar();
  renderProfile();
  await showCustomAlert("Profile Updated", "Profile changes saved successfully!");
});

// Run App Immediately
console.log("EcoLife app.js: Initializing app...");
setupAuthHandlers();
setupPhotoHandlers();
initApp();
console.log("EcoLife app.js: App initialized successfully.");
setupMidnightReset();

