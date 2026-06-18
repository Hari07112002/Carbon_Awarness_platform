# EcoLife - Personal Carbon Footprint Tracker & Habit Architect

EcoLife is an interactive, premium client-side web application designed to help individuals understand, track, and reduce their carbon footprint through simple everyday actions and personalized insights. Built using **semantic HTML5, Vanilla CSS (with responsive glassmorphism styles), and ES6 Javascript**, this app runs completely on the client with zero heavy dependencies or external framework overhead.

## Core Features

1. **Carbon Footprint Calculator Onboarding**: 
   - A step-by-step interactive questionnaire covering housing size, utility sources, travel methods, flight hours, diet type, food waste, and purchasing patterns.
   - Calculates annual greenhouse gas emissions in metric tonnes of CO2 equivalent ($t$ CO2e).
2. **Interactive Dashboard & Custom Donut Chart**:
   - Compares the user's footprint against global and regional baselines (such as the 4.8-tonne global average target).
   - Dynamic custom donut visualization (built purely in JavaScript utilizing layered SVG dash arrays).
   - Eco Score calculation (0 to 100 rating based on footprint reduction metrics).
3. **Daily Climate Action Logger**:
   - Complete and log eco-friendly tasks (e.g. eating plant-based meals, walking or cycling commutes, cold-water laundry, smart thermostat adjustments).
   - Every logged item records immediate CO2 savings and increases action points.
4. **Gamification & Badge Milestones**:
   - Visual badges ("Eco Pioneer", "Plant Power", "Green Rider", "Energy Saver", "Zero Waste Hero", "Climate Elite") that dynamically light up once milestones are reached.
   - Hot-streak tracking encourages continuous usage.
5. **Personalized Recommendations**:
   - High-impact advice is automatically filtered and displayed matching the user's largest carbon emission categories.

---

## Technical Architecture

- **`index.html`**: Structured single-page view wrapper holding containers for routing views.
- **`styles.css`**: Visual engine using CSS custom properties, animated blurred radial background blobs, frosted-glass filters, and keyframe animations. Fully responsive for desktop and mobile devices.
- **`data.js`**: Central repository containing questions database, carbon weights, savings indices, and insights logic.
- **`app.js`**: Core state controller. Manages state serialization to `localStorage`, navigation, donut render formulas, habits updates, and streak algorithms.

---

## Getting Started

To run the application locally:

1. Clone or open the workspace folder `Carbon_Awarness_platform`.
2. Start any local development server from the folder. For example, using Python or NodeJS:
   ```bash
   # Python
   python -m http.server 8000
   
   # NodeJS
   npx http-server . -p 8000
   ```
3. Open `http://localhost:8000` in your web browser.
4. Answer the initial survey to access your ecological dashboard!
