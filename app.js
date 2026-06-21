import { QUIZ_QUESTIONS, DAILY_ACTIONS, PERSONALIZED_INSIGHTS } from './data.js';

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
      resetToDemoState();
    }
  } else {
    // If no state exists (first load for demo), load the demo profile
    resetToDemoState();
  }
}

function resetToDemoState() {
  const todayStr = getTodayString();
  state = {
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
    streak: 5,
    lastLoggedDate: todayStr,
    points: 420,
    dailySaved: 6.6,
    totalSaved: 44.1,
    loggedActions: {
      [getPastDateString(0)]: ['plant_based_meal', 'unplug_unused', 'short_shower'],
      [getPastDateString(1)]: ['bike_walk', 'cold_wash', 'line_dry'],
      [getPastDateString(2)]: ['public_transit', 'plant_based_meal', 'reusable_bottles'],
      [getPastDateString(3)]: ['plant_based_meal', 'short_shower'],
      [getPastDateString(4)]: ['bike_walk', 'thermostat_tweak', 'unplug_unused'],
      [getPastDateString(5)]: ['plant_based_meal', 'reusable_bottles', 'cold_wash'],
      [getPastDateString(6)]: ['public_transit', 'short_shower', 'line_dry']
    },
    challenges: {
      foodActionsCount: 4,
      commuteActionsCount: 4
    },
    unlockedBadges: ["eco_pioneer", "plant_power", "green_rider"]
  };
  saveState();
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
  const emissions = calculateEmissions();
  const container = document.getElementById("recommendations-container");
  if (!container) return;
  container.innerHTML = "";

  // Identify highest category
  const categories = ["housing", "transport", "food", "consumption"];
  let maxCat = "housing";
  let maxVal = -1;
  categories.forEach(cat => {
    if (emissions[cat] > maxVal) {
      maxVal = emissions[cat];
      maxCat = cat;
    }
  });

  const catNames = {
    housing: "Housing Energy",
    transport: "Transport & Travel",
    food: "Diet & Waste",
    consumption: "Consumer Goods"
  };

  // Render AI coach container
  const aiCoachContainer = document.createElement("div");
  aiCoachContainer.id = "ai-coach-container";
  aiCoachContainer.style.marginBottom = "16px";
  container.appendChild(aiCoachContainer);

  renderAICoachTip(emissions, maxCat);

  // Featured recommendation header highlighting the highest impact area
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

  let totalInsightsAdded = 0;

  // Prioritize rendering recommendations for the highest category first
  const sortedCategories = [maxCat, ...categories.filter(c => c !== maxCat)];

  sortedCategories.forEach(cat => {
    const rules = PERSONALIZED_INSIGHTS[cat] || [];
    const catEmissions = emissions[cat] || 0;

    rules.forEach(rule => {
      // Show rules where emissions exceed threshold, or if it is the highest category, show all its tips
      if (catEmissions >= rule.minEmissions || cat === maxCat) {
        const card = document.createElement("div");
        const isHighest = (cat === maxCat);
        card.className = `insight-card insight-${cat}`;
        if (isHighest) {
          card.style.borderLeftWidth = "6px";
        }
        
        let emoji = "💡";
        if (cat === "housing") emoji = "🏠";
        else if (cat === "transport") emoji = "🚗";
        else if (cat === "food") emoji = "🥗";
        else if (cat === "consumption") emoji = "🛍️";

        card.innerHTML = `
          <div class="insight-icon">${emoji}</div>
          <div class="insight-body">
            <div style="display: flex; align-items: center; gap: 8px;">
              <h3 style="margin: 0; font-size: 15px;">${rule.title}</h3>
              ${isHighest ? `<span style="font-size: 9px; font-weight: 700; color: #ffffff; background: var(--color-primary); padding: 2px 6px; border-radius: 8px;">HIGH IMPACT</span>` : ''}
            </div>
            <p style="margin-top: 4px; font-size: 13px; color: var(--text-secondary);">${rule.recommendation}</p>
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

// --- ROUTER & CONTROL SYSTEM BOOTSTRAP ---
function initApp() {
  loadState();

  if (state.quizCompleted) {
    navigateTo("dashboard-view");
  } else {
    navigateTo("quiz-view");
    startQuiz();
  }
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
  if (state.quizCompleted) {
    navigateTo("dashboard-view");
  }
});

document.getElementById("view-all-actions-btn").addEventListener("click", () => {
  navigateTo("logger-view");
});

document.getElementById("quiz-prev-btn").addEventListener("click", retreatQuiz);
document.getElementById("quiz-next-btn").addEventListener("click", advanceQuiz);

document.getElementById("reset-data-btn").addEventListener("click", () => {
  if (confirm("Are you sure you want to reset your footprint profile, points, and logs history? This cannot be undone.")) {
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

settingsBtn.addEventListener("click", () => {
  geminiKeyInput.value = localStorage.getItem("ecolife_gemini_key") || "";
  settingsModal.style.display = "flex";
});

const hideSettingsModal = () => {
  settingsModal.style.display = "none";
};

closeSettingsBtn.addEventListener("click", hideSettingsModal);
cancelSettingsBtn.addEventListener("click", hideSettingsModal);

saveSettingsBtn.addEventListener("click", () => {
  const key = geminiKeyInput.value.trim();
  if (key) {
    localStorage.setItem("ecolife_gemini_key", key);
  } else {
    localStorage.removeItem("ecolife_gemini_key");
  }
  hideSettingsModal();
  const activeView = document.querySelector(".app-view.active")?.id;
  if (activeView === "insights-view") {
    renderInsights();
  }
});

// Share Card Modal Event Listeners
const generateShareCardBtn = document.getElementById("generate-share-card-btn");
const shareModal = document.getElementById("share-modal");
const closeShareBtn = document.getElementById("close-share-btn");
const closeShareModalBtn = document.getElementById("close-share-modal-btn");
const downloadShareCardBtn = document.getElementById("download-share-card-btn");
const shareCardImg = document.getElementById("share-card-img");

generateShareCardBtn.addEventListener("click", () => {
  const dataUrl = generateShareCard();
  shareCardImg.src = dataUrl;
  downloadShareCardBtn.href = dataUrl;
  shareModal.style.display = "flex";
});

const hideShareModal = () => {
  shareModal.style.display = "none";
};

closeShareBtn.addEventListener("click", hideShareModal);
closeShareModalBtn.addEventListener("click", hideShareModal);

// Run App Immediately
console.log("EcoLife app.js: Initializing app...");
initApp();
console.log("EcoLife app.js: App initialized successfully.");
setupMidnightReset();
