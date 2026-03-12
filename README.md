# 🌍 OrbiTelligence

> An interactive 3D satellite tracking and orbital simulation platform.

## 📸 Interface Preview

<p align="center">
  <img src="./Screenshot/1.png.png" width="45%" alt="Main Earth View" />
  <img src="./Screenshot/2.png.png" width="45%" alt="Simulation Timeline" />
</p>
<p align="center">
  <img src="./Screenshot//3.png.png" width="45%" alt="Heatmap & Collision Data" />
  <img src="./Screenshot/4.png.png" width="45%" alt="Satellite Information Panel" />
</p>

*(Note: Replace the image filenames above with the exact names of the files in your `screenshots` folder!)*

## 🚀 Short Intro
**OrbiTelligence** is a full-stack web application designed to track, visualize, and simulate satellite orbits and space debris in real-time. By parsing complex TLE (Two-Line Element) data and leveraging SGP4 propagation, it renders highly accurate 3D trajectories around a photorealistic Earth. Beyond basic tracking, the platform features a predictive simulation engine to calculate future orbital positions, visualize error vectors, and generate risk heatmaps for potential re-entry or collision events.

## 🛠️ Technologies

**Frontend (3D Visualization & UI):**
* **React 19 & Vite:** For a blazing-fast, component-driven user interface.
* **Three.js & React Three Fiber (R3F):** Core engine for rendering the 3D space environment, Earth models, and satellite meshes.
* **React-Globe.gl:** Handling geospatial data mapping and globe interactions.
* **Satellite.js:** Performing the heavy mathematical lifting (SGP4) to convert TLE data into Cartesian coordinates.
* **GSAP:** For smooth, complex UI animations.

**Backend (Data Pipeline & API):**
* **Node.js & Express.js:** Robust server architecture handling API requests and data processing.
* **MongoDB (Mongoose):** Database utilized for efficient caching of orbital data.
* **Axios:** For server-to-server communication with external space databases.
* **External APIs:** Celestrak (for raw TLE data) and Open Notify (for live ISS telemetry).

## ✨ Features
* **Real-Time 3D Tracking:** Live visualization of active satellites (including the ISS) with smooth orbital trails.
* **Time-Travel Simulation Clock:** A custom timeline controller allowing users to scrub forward in time to predict future satellite positions.
* **Orbit Analysis & Correction:** Visual toggles to compare *Actual Orbits*, *Corrected Orbits*, and highlight *Error Vectors* in 3D space.
* **Risk Heatmap Generation:** Procedural generation of heatmaps over the globe (and oceans) to highlight predicted re-entry zones or high-density debris areas.
* **Automated Data Pipeline:** A backend system that fetches, calculates (Kepler's laws, semi-major axis, perigee), and caches LEO satellite data to minimize external API rate limits.

## 🧠 The Process: How I Built It
The development of OrbiTelligence required bridging the gap between raw astrophysical data and smooth web graphics. 

I started by setting up the Node.js/Express backend to act as a reliable data broker. Fetching raw TLE data directly on the client is inefficient, so I built a pipeline that queries Celestrak, extracts Keplerian elements (mean motion, eccentricity), and caches the results in MongoDB with a 4-hour expiration mechanism. 

On the frontend, the challenge was rendering this data performantly. I used React Three Fiber to build a custom 3D environment, importing specialized models and texturing a high-resolution Earth. By integrating `satellite.js`, the app continuously calculates the X, Y, Z coordinates of satellites based on the current system time. 

For the predictive features, I developed a custom React hook simulation loop. Instead of relying on the standard wall-clock time, the app uses a simulation clock that can be sped up or set to specific future dates. This required careful state management to ensure the React UI and the Three.js canvas remained perfectly synced without dropping frames during heavy simulation calculations.

## 💡 What I Learned
* **Orbital Mechanics & SGP4:** Gained a deep understanding of how to interpret Two-Line Element sets and propagate them mathematically to find accurate positions in space.
* **3D Performance Optimization:** Managing memory and draw calls in React Three Fiber, ensuring that rendering dozens of active satellite trails and a high-poly Earth doesn't tank the browser's framerate.
* **Backend Caching Strategies:** Designing a robust MongoDB schema to cache frequently requested, rapidly updating telemetry data to improve load times and reduce external API dependency.
* **Complex State Synchronization:** Keeping a custom animation loop (`requestAnimationFrame`) seamlessly tied to React's rendering lifecycle for the timeline feature.

## 📈 How It Can Be Improved
* **Cloud Infrastructure & Scale:** Migrating the backend to a more robust cloud architecture (like AWS) utilizing serverless functions to process massive catalogs of space debris simultaneously.
* **AI Integration:** Replacing algorithmic collision estimation with a trained machine learning model to predict trajectory anomalies and collision probabilities with higher accuracy.
* **WebSockets for Telemetry:** Transitioning from RESTful polling to WebSockets for truly instantaneous telemetry streaming for fast-moving objects.

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

# Create a .env file and add your MongoDB URI and Port
echo "MONGODB_URI=your_mongodb_connection_string" > .env
echo "PORT=5000" >> .env
echo "DB_NAME=orbitelligence" >> .env

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

## 🎥 Video Demonstration
Check out the full walkthrough and simulation capabilities of OrbiTelligence in action:

[![Watch the video](https://img.youtube.com/vi/CZGwOAFFNfY/maxresdefault.jpg)](https://youtu.be/CZGwOAFFNfY)

