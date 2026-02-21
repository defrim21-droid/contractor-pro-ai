# ContractorPro AI - Project Log

## 🏗️ Tech Stack
* **Frontend:** React (built with Vite)
* **Styling:** Tailwind CSS v4
* **Routing:** React Router DOM
* **Backend/Auth:** Supabase
* **AI Engine:** Replicate (SDXL) via Supabase Edge Functions

---

## 📂 Architecture & File Structure
```text
contractor-pro-ai/
├── src/                
│   ├── App.jsx            # The Router (Handles Auth vs Unauth redirects)
│   ├── Auth.jsx           # Sign-up/Login UI (Email & Google OAuth)
│   ├── Dashboard.jsx      # Main Workspace UI (Upload, Canvas, Slider)
│   ├── Landing.jsx        # Public-facing sales page
│   ├── aiService.js       # Handles Supabase storage uploads & Edge Function trigger
│   ├── index.css          # Tailwind v4 import
│   ├── main.jsx           # React DOM root
│   └── supabaseClient.js  # The single Supabase connection instance
├── .env                   # Local Environment Variables
├── package.json
└── vite.config.js         # Configured with React and Tailwind v4 plugins