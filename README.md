# 🌍 OrbiTelligence

> An interactive 3D satellite tracking and orbital simulation platform.

## 📸 Interface Preview

<p align="center">
  <img src="./screenshots/1.png" width="45%" alt="Main Earth View" />
  <img src="./screenshots/2.png" width="45%" alt="Simulation Timeline" />
</p>
<p align="center">
  <img src="./screenshots/3.png" width="45%" alt="Heatmap & Collision Data" />
  <img src="./screenshots/4.png" width="45%" alt="Satellite Information Panel" />
</p>

## 🚀 Short Intro
**OrbiTelligence** is a full-stack web application designed to track, visualize, and simulate satellite orbits and space debris in real-time. By parsing complex TLE (Two-Line Element) data and leveraging SGP4 propagation, it renders highly accurate 3D trajectories around a photorealistic Earth. Beyond basic tracking, the platform features a predictive simulation engine to calculate future orbital positions, visualize error vectors, and generate risk heatmaps for potential re-entry or collision events.

## 🛠️ Technologies

**Frontend (3D Visualization & UI):**
* **React 19 & Vite:** For a fast, component-driven user interface.
* **Three.js & React Three Fiber (R3F):** Core engine for rendering the 3D space environment and satellite meshes.
* **React-Globe.gl:** Handling geospatial data mapping and globe interactions.
* **Satellite.js:** Performing SGP4 calculations to convert TLE data into Cartesian coordinates.
* **GSAP:** Used for smooth UI animations.

**Backend (Data Pipeline & API):**
* **Node.js & Express.js:** Server architecture handling API requests and data processing.
* **MongoDB (Mongoose):** Database utilized for efficient caching of orbital data.
* **Axios:** For server-to-server communication with external space databases.
* **External APIs:** Celestrak (for raw TLE data) and Open Notify (for live ISS telemetry).

## ✨ Features
* **Real-Time 3D Tracking:** Live visualization of active satellites with smooth orbital trails.
* **Time-Travel Simulation Clock:** A custom timeline controller allowing users to scrub forward in time to predict future satellite positions.
* **Orbit Analysis & Correction:** Visual toggles to compare Actual Orbits, Corrected Orbits, and highlight Error Vectors in 3D space.
* **Risk Heatmap Generation:** Procedural generation of heatmaps over the globe to highlight predicted re-entry zones.
* **Automated Data Pipeline:** A backend system that fetches, calculates, and caches LEO satellite data.

## 🧠 The Process: How I Built It
I started by setting up the Node.js/Express backend to act as a data broker. The pipeline queries Celestrak, extracts Keplerian elements, and caches them in MongoDB to improve performance. 

On the frontend, I used React Three Fiber to build the 3D environment. By integrating `satellite.js`, the app continuously calculates satellite positions based on current or simulated time. I developed a custom simulation loop using a `simNowRef` that can be sped up or set to future dates without dropping frames.

## 💡 What I Learned
* **Orbital Mechanics:** Gained a deep understanding of interpreting TLE sets and propagating them mathematically.
* **3D Performance:** Managing memory and draw calls in React Three Fiber to render multiple active trails smoothly.
* **Backend Caching:** Designing MongoDB schemas to store telemetry data and reduce external API dependency.
* **State Synchronization:** Keeping a custom `requestAnimationFrame` loop synced with React’s rendering lifecycle.

## 📈 How It Can Be Improved
* **Cloud Infrastructure:** Migrating to AWS utilizing serverless functions to process massive catalogs of space debris.
* **AI Integration:** Implementing machine learning models to predict trajectory anomalies with higher accuracy.
* **WebSockets:** Transitioning from RESTful polling to WebSockets for instantaneous telemetry streaming.

## 💻 Running the Project

### Prerequisites
* Node.js (v18+ recommended)
* MongoDB (Local instance or Atlas URI)

### Setup Instructions

```bash
# 1. Clone the repository
git clone [https://github.com/YOUR_USERNAME/orbitelligence.git](https://github.com/YOUR_USERNAME/orbitelligence.git)
cd orbitelligence

# ----------------------------------------------------
# 2. Backend Setup
# ----------------------------------------------------
cd src

# Install dependencies
npm install

# Create a .env file with your MongoDB URI
echo "MONGODB_URI=your_mongodb_connection_string" > .env
echo "PORT=5000" >> .env

# Start the backend server
npm start

# ----------------------------------------------------
# 3. Frontend Setup
# ----------------------------------------------------
# Open a new terminal and navigate to the frontend directory
cd orbitelligence_frontend

# Install dependencies
npm install

# Create a .env file and connect it to your local backend
echo "VITE_API_BASE_URL=http://localhost:5000/api" > .env

# Start the Vite development server
npm run dev
