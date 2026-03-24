# 🏃 Vital — Health Tracker

A clean, minimal personal health tracking web app that runs entirely in your browser. No server, no sign-up, no data leaves your device.

---

## 📁 File Structure

```
health-tracker/
├── index.html    — App structure and layout
├── styles.css    — All styling (design system, responsive)
├── app.js        — All logic (data, charts, BMI, localStorage)
└── README.md     — This file
```

---

## 🚀 Getting Started

**Option 1 — Just open it:**
1. Download all 4 files into the same folder
2. Double-click `index.html`
3. That's it — works in any modern browser

**Option 2 — Local dev server (recommended to avoid CORS quirks):**
```bash
# Using Python
python -m http.server 8080

# Using Node / npx
npx serve .
```
Then open `http://localhost:8080` in your browser.

> **No build step, no npm install, no dependencies to manage.** Chart.js is loaded from a CDN automatically.

---

## ✨ Features

### 📊 Today Dashboard
- At-a-glance metric tiles for all 7 health categories
- Live progress bars toward your daily goals
- Interactive water intake tracker (tap to log / remove glasses)
- Mini sparkline charts for steps and sleep
- Today's full activity log with timestamps and status badges

### 📈 Charts
- Weekly bar + line charts for steps, sleep, calories, water, workout
- 30-day weight trend line chart
- Mood chart with labeled y-axis (Stressed → Great)
- Weekly summary stats with deltas vs prior week

### ⚖️ BMI & Body
- BMI calculator with animated needle gauge
- Visual category guide (Underweight / Normal / Overweight / Obese)
- TDEE (daily calorie needs) calculator using the Harris–Benedict equation
- Four calorie targets: maintain, lose 0.5 kg/wk, lose 1 kg/wk, gain 0.5 kg/wk
- 30-day weight history chart
- Profile saved automatically between sessions

### 🗓️ History
- Full log of every entry ever recorded
- Filter by metric category and time period (7 / 30 / 90 days / all time)
- Delete individual entries
- Export entire dataset as a `.csv` file

### ⚙️ Settings
- Customise all 5 daily goals (steps, sleep, water, calories, workout)
- Export data to CSV
- Clear all data (with confirmation)

---

## 📊 Metrics Tracked

| Category | Unit | Notes |
|---|---|---|
| Steps / Activity | steps | Cumulative per day |
| Sleep | hours | Cumulative per day |
| Water intake | glasses | Also tracked via tap-dot widget |
| Calories | kcal | Cumulative per day |
| Weight | kg | Last entry of the day used |
| Mood | scale 1–5 | Great / Good / Okay / Tired / Stressed |
| Workout | minutes | Cumulative per day |

---

## 💾 Data Storage

All data is stored in **`localStorage`** under the key `vitalHealthData`. This means:

- ✅ Data persists between browser sessions
- ✅ Works completely offline after first load
- ✅ No account or login required
- ⚠️ Data is tied to this browser on this device
- ⚠️ Clearing browser data / site data will erase it — use **Export CSV** to back up

### Data schema
```json
{
  "entries": [
    {
      "id": "unique-id",
      "cat": "steps",
      "val": 5000,
      "note": "Morning walk",
      "date": "2026-03-24",
      "time": "2026-03-24T08:30:00.000Z"
    }
  ],
  "waterToday": 5,
  "waterDate": "2026-03-24",
  "goals": {
    "steps": 10000,
    "sleep": 8,
    "water": 8,
    "calories": 2200,
    "workout": 45
  },
  "profile": {
    "height": 175,
    "weight": 72,
    "age": 28,
    "sex": "male",
    "activity": 1.55
  }
}
```

---

## 🎨 Design System

The app uses a custom CSS variable design system defined in `styles.css`:

- **Font:** DM Sans (body) + DM Mono (numbers/data)
- **Palette:** Warm off-white background (`#f7f6f3`), white surfaces, semantic color ramps
- **Radius:** 12px cards, 8px inputs/buttons
- **Responsive:** Sidebar nav on desktop, bottom tab bar on mobile (≤860px)

---

## 🔧 Customisation

### Changing default goals
Edit the `DEFAULT_GOALS` object at the top of `app.js`:
```js
const DEFAULT_GOALS = {
  steps: 10000,
  sleep: 8,
  water: 8,
  calories: 2200,
  workout: 45
};
```

### Adding a new metric category
1. Add an entry to `CAT_META` in `app.js`
2. Add an `<option>` to the `#log-cat` select in `index.html`
3. Add a template case to `updateModalFields()` in `app.js`
4. Add a tile entry to the `renderMetricTiles()` loop (it's automatic via `CAT_META`)

### Changing the colour theme
All colours are CSS variables in the `:root` block of `styles.css`. Change `--accent` for the primary brand colour, or swap individual semantic colours.

---

## 🌐 Browser Support

Works in all modern browsers:
- Chrome / Edge 88+
- Firefox 78+
- Safari 14+

Requires JavaScript enabled and `localStorage` available (standard in all browsers).

---

## 📦 Dependencies

| Library | Version | How it's loaded |
|---|---|---|
| Chart.js | 4.4.1 | CDN (cdnjs.cloudflare.com) |
| DM Sans font | — | Google Fonts CDN |
| DM Mono font | — | Google Fonts CDN |

> No npm, no bundler, no framework. Pure HTML + CSS + JavaScript.

---

## 🗺️ Roadmap / Ideas

- [ ] Dark mode toggle
- [ ] Weekly email / notification reminders
- [ ] Import CSV to restore data
- [ ] Multiple user profiles
- [ ] Habit streaks per category
- [ ] Integration with Apple Health / Google Fit (via Web APIs)
- [ ] PWA support (install as app, offline-first)

---

## 📄 License

Free to use for personal projects. No warranty expressed or implied.
