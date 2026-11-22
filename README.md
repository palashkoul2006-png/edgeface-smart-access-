# Edgeface Smart Access

# MASTER PROMPT: Build EdgeFace – Complete AI-Powered Smart Access Control Web Application

Act as a **senior full-stack developer, AI/ML engineer, IoT architect, and UI/UX designer**. Your task is to design and develop a complete, fully functional, end-to-end college project named:

# EdgeFace – Smart Access Control System Using Edge AI and IoT

Do not divide the project into phases or provide a tutorial that gradually builds separate components. I want the **complete final product**, with all major features implemented and integrated. Deliver a working application, not just a prototype UI, static dashboard, or collection of disconnected code snippets.

The application should be visually impressive, modern, responsive, and suitable for a college project demonstration.

---

## 1. Project Overview

EdgeFace is an intelligent facial-recognition-based access control system that uses Edge AI and IoT.

The system should:

- Capture faces using **ONLY the laptop's built-in webcam**.

- Perform facial detection and recognition locally on the laptop.

- Identify registered users and unknown visitors.

- Make access-granted or access-denied decisions.

- Communicate with an ESP32 DevKit using MQTT.

- Operate a miniature door-lock mechanism using an SG90 servo motor.

- Indicate access status using red and green LEDs and a buzzer.

- Display real-time access events on a web dashboard.

- Maintain user records and access history in a local database.

- Provide a professional web interface for managing the entire system.

**Critical hardware constraint:** Do not use the ESP32-CAM or its attached camera for image capture, video streaming, or facial recognition. The ESP32-CAM is not part of the active system. The laptop webcam is the only camera.

---

## 2. Required Technology Stack

Use the following architecture unless a technical limitation requires a clearly explained alternative.

### Frontend

- React

- Vite

- Tailwind CSS

- Lucide icons

- Recharts for analytics and charts

- Responsive component-based architecture

### Backend

- Python

- FastAPI

- REST APIs

- WebSockets for real-time updates

### Edge AI

- OpenCV

- Face detection and facial recognition

- Local face registration and dataset management

- Recognition threshold and unknown-person handling

- Local processing without cloud AI APIs

Choose a practical recognition approach compatible with the installed OpenCV version. If using LBPH, use the appropriate OpenCV-contrib package and document its compatibility requirements.

### IoT communication

- MQTT

- Mosquitto MQTT broker running locally

- ESP32 DevKit subscribed to access-control commands

- Python backend publishing authorization commands

### Database

- SQLite

- Persistent storage for registered users, access events, system settings, and device status

### Hardware firmware

- Arduino IDE

- ESP32 DevKit firmware

- SG90 servo motor

- Red LED

- Green LED

- Buzzer

### Deployment

- Local Windows laptop

- Localhost-based application

- Local MQTT broker

- No cloud dependency for facial recognition or access decisions

---

## 3. Application Design and User Experience

Build a premium-looking, professional dashboard.

The interface should feel like a modern commercial security-management platform rather than a basic college HTML project.

### Visual direction

- Modern dark-themed security dashboard.

- Professional typography.

- Clean spacing and consistent alignment.

- Subtle gradients and glass-style surfaces where appropriate.

- Elegant cards with rounded corners.

- Smooth hover effects and transitions.

- Clear visual hierarchy.

- Consistent iconography.

- Attractive charts and data visualizations.

- Responsive layout for desktop, tablet, and mobile.

Do not overload the UI with unnecessary animations or decorative elements. Prioritize usability, clarity, and performance.

### Application layout

Create a responsive sidebar navigation with:

1. Overview

2. Live Monitoring

3. Face Management

4. Access History

5. Analytics

6. Device Management

7. System Settings

Include:

- Application logo and EdgeFace branding.

- System online/offline indicator.

- Current date and time.

- User profile or administrator section.

- Notifications.

- Responsive mobile navigation.

---

## 4. Dashboard – Overview

Create a comprehensive overview dashboard containing:

### Statistics cards

- Total registered users.

- Total access attempts today.

- Successful access attempts.

- Denied access attempts.

- System uptime or availability.

- Connected IoT device status.

### Charts

- Access attempts over time.

- Granted versus denied access.

- Daily or weekly access trends.

- Most frequent registered visitors.

### Recent activity

Display the latest access events with:

- User name or Unknown Visitor.

- Timestamp.

- Access status.

- Recognition score, if available.

- Event type.

### System status

Display:

- Webcam status.

- AI recognition engine status.

- Backend status.

- MQTT broker connection.

- ESP32 connection.

- Door-lock status.

Use actual backend data wherever possible. Do not fill the dashboard with hardcoded sample statistics and pretend that they are live.

---

## 5. Live Monitoring

Build a live monitoring page.

Requirements:

- Display the laptop webcam feed.

- Start and stop camera controls.

- Display detected faces with bounding boxes.

- Show recognized user name when available.

- Display Unknown Visitor for unrecognized faces.

- Show recognition status.

- Display the latest access decision.

- Show the door-lock status.

- Display a real-time event stream.

- Show meaningful error messages if the camera is unavailable.

The webcam must be accessed by the local Python backend using OpenCV. Provide the video stream to the frontend through an appropriate local streaming endpoint.

Do not use browser webcam access as a replacement for the required Python/OpenCV Edge AI pipeline.

---

## 6. Face Management

Build a complete face-registration and user-management module.

Administrators should be able to:

- Register a new person.

- Enter name, user ID, and optional details.

- Capture face samples through the laptop webcam.

- Preview the captured face.

- Save the person's face data locally.

- View all registered users.

- Search and filter users.

- Edit user details.

- Disable or enable access.

- Delete users and their associated face data.

Implement appropriate face-quality checks before registration.

Store only the information required for the project. Avoid unnecessary retention of raw images.

---

## 7. Facial Recognition and Access Logic

Implement the actual local facial recognition engine.

Expected behavior:

1. Capture frames using the laptop's built-in webcam.

2. Detect faces.

3. Extract the required facial features.

4. Compare detected faces with registered users.

5. Calculate a recognition distance or similarity score.

6. Apply a configurable recognition threshold.

7. Identify known and unknown visitors.

8. Make the access decision.

9. Record the result in SQLite.

10. Publish the authorization command to MQTT when appropriate.

Important requirements:

- Never treat an unrecognized face as authorized.

- Default to access denied when recognition is uncertain.

- Prevent repeated access commands for the same continuously detected face.

- Add a configurable cooldown between access events.

- Clearly distinguish a recognition score from a calibrated probability.

- Include a basic anti-spoofing limitation warning. Do not claim reliable liveness detection unless it is actually implemented.

---

## 8. ESP32 IoT Integration

The ESP32 DevKit is responsible for physical access-control actions.

### Hardware behavior

| Component | Function |

|---|---|

| SG90 Servo | Simulates door-lock and unlock mechanism |

| Green LED | Access granted |

| Red LED | Access denied |

| Buzzer | Audio indication |

| ESP32 DevKit | Receives MQTT commands and controls hardware |

### MQTT topics

Use a consistent topic structure:

- `edgeface/access`

- `edgeface/status`

- `edgeface/events`

Example authorization message:

```json

{

  "user": "User_01",

  "access": "GRANTED",

  "timestamp": "2026-11-22T10:30:00",

  "score": 85

}

```

Implement:

- MQTT connection and reconnection.

- Device heartbeat.

- Device status reporting.

- Authorization command handling.

- Door-lock state reporting.

- Safe behavior on disconnection.

- Proper JSON validation.

The ESP32 should only execute valid authorization commands from the local backend.

Include complete Arduino firmware and exact wiring instructions for the ESP32 DevKit.

Do not assume the exact DevKit pinout. Identify the board variant or provide a clearly stated, configurable pin mapping with instructions to verify it.

### Electrical safety

- Never power the servo from an ESP32 GPIO.

- Do not use the ESP32 3.3V output to power the servo.

- Use a suitable regulated 5V supply for the servo.

- Connect the external supply ground and ESP32 ground together.

- Avoid applying 5V UART logic directly to ESP32 GPIO pins.

- Do not require the FTDI adapter for normal operation if the DevKit has a working onboard USB interface.

---

## 9. Access History

Create a complete access-history page.

Display:

- Event ID.

- Person name or Unknown Visitor.

- Date and time.

- Granted or denied status.

- Recognition score.

- Reason for denial, when available.

Include:

- Search.

- Date-range filters.

- Status filters.

- User filters.

- Pagination.

- CSV export.

- Event details view.

Persist events in SQLite.

---

## 10. Analytics

Create an analytics page with real database-backed visualizations.

Include:

- Total access attempts.

- Access success rate.

- Denied access count.

- Hourly activity.

- Daily and weekly activity.

- User-wise access frequency.

- Unknown visitor activity.

Provide date filters and clear empty states when there is insufficient data.

---

## 11. Device Management

Build a device-management page showing:

- Webcam connection status.

- ESP32 connection status.

- MQTT broker status.

- Backend status.

- Last heartbeat.

- Current door-lock state.

- Last device event.

Provide useful connection diagnostics and a device refresh or reconnect action where supported.

Never show a device as online merely because it is configured. Use actual heartbeat or connection data.

---

## 12. System Settings

Provide configurable settings for:

- Facial-recognition threshold.

- Access-event cooldown.

- Camera index.

- Camera resolution.

- Door unlock duration.

- MQTT broker address.

- MQTT port.

- ESP32 configuration.

- Administrator settings.

Validate settings before saving and persist them locally.

---

## 13. Backend API and WebSocket

Create a clean, documented FastAPI backend.

Implement endpoints for:

- Application health.

- Webcam status.

- Webcam streaming.

- Starting and stopping monitoring.

- Face registration.

- Registered user listing.

- User update and deletion.

- Access history.

- Analytics.

- Device status.

- System settings.

- Manual device testing, restricted to the administrator.

Use WebSockets for:

- Live recognition events.

- Access notifications.

- Device status updates.

- Real-time dashboard refresh.

Add sensible validation, exception handling, logging, and safe shutdown behavior.

---

## 14. Database Structure

Create a persistent SQLite database with appropriate tables, such as:

- `users`

- `face_data`

- `access_events`

- `device_status`

- `system_settings`

Use appropriate relationships, timestamps, and indexes.

The application should automatically initialize the database on first launch.

---

## 15. Complete Project Structure

Deliver a clean, maintainable project directory containing:

- React frontend.

- FastAPI backend.

- AI recognition module.

- Webcam module.

- MQTT communication module.

- SQLite database initialization.

- ESP32 Arduino firmware.

- Configuration files.

- Requirements file.

- Environment example.

- README.

- Windows startup scripts.

Separate frontend, backend, AI, database, and hardware code logically.

Do not put the entire application into one Python file.

---

## 16. One-Click Local Startup

The final application should be easy to launch on Windows.

Provide:

- A complete installation guide.

- A dependency installation script.

- A Windows startup script.

- Instructions for starting Mosquitto.

- Instructions for uploading ESP32 firmware.

- A single clear procedure to start the integrated application.

Where possible, provide a `start.bat` file that starts the backend and frontend in separate terminals and checks required services.

The application should run locally, for example:

- Frontend: `http://localhost:5173`

- Backend API: `http://localhost:8000`

- API documentation: `http://localhost:8000/docs`

Use appropriate ports and avoid hardcoding environment-specific paths.

---

## 17. Reliability and Security

Implement:

- Input validation.

- Safe error handling.

- Access-control safeguards.

- Local-only default configuration.

- No hardcoded passwords or secrets.

- Proper MQTT message validation.

- Safe handling of camera disconnection.

- Safe handling of Wi-Fi and MQTT disconnection.

- Database persistence.

- Graceful application shutdown.

- Access-denied fallback when the recognition or communication system is unavailable.

The system should continue to perform local AI processing without Internet access, provided the laptop and required local network connections are operational.

Do not claim production-grade security. Clearly explain the limitations of a student demonstration system.

---

## 18. Budget and Hardware Constraints

Maximum project budget: **₹2,000**.

Already available:

- Windows laptop with built-in webcam.

- ESP32 DevKit.

- ESP32-CAM with camera (unused).

- FTDI-style USB-to-TTL adapter (not required for normal operation).

Do not recommend buying another camera, ESP32 board, or programmer.

Keep the physical door model simple and inexpensive.

Use components only when necessary. If a component is optional, identify it as optional.

---

## 19. Final Deliverables

Deliver the complete project, including:

1. Fully working React web application.

2. Fully working FastAPI backend.

3. Local webcam capture and streaming.

4. Actual face detection and recognition.

5. Face registration and management.

6. SQLite database.

7. MQTT integration.

8. ESP32 DevKit firmware.

9. Servo, LED, and buzzer control.

10. Real-time dashboard updates.

11. Access history and analytics.

12. Responsive professional UI.

13. Windows startup scripts.

14. Complete installation and configuration instructions.

15. Troubleshooting guide.

16. Project architecture diagram.

17. System flowchart.

18. College project documentation.

19. Testing checklist.

20. Viva questions with answers.

---

## 20. Development and Delivery Instructions

Follow these rules strictly:

- Build the final integrated product rather than dividing the work into phases.

- Do not stop after creating a frontend mockup.

- Do not provide placeholder functions for core functionality.

- Do not use hardcoded data to simulate working hardware or facial recognition.

- Do not claim successful device communication without implementing and verifying it.

- Generate all necessary source files.

- Provide complete code, not partial snippets.

- Ensure frontend API calls match the backend endpoints.

- Ensure MQTT topics and message formats match between Python and ESP32.

- Include realistic loading, error, empty, and disconnected states.

- Make the application responsive on desktop, tablet, and mobile.

- Prioritize a polished and professional visual design.

- Test the important application flows and fix integration errors.

- If hardware is unavailable, provide a clearly labeled simulation mode for UI and software testing. Never confuse simulation results with real hardware results.

- Explain any component that cannot be tested without the physical device.

### Final acceptance criteria

The project is complete only when:

1. The React frontend starts successfully.

2. The FastAPI backend starts successfully.

3. The laptop webcam works through OpenCV.

4. A user can register a face.

5. The system can recognize a registered face locally.

6. Unknown faces are denied.

7. Access events are stored in SQLite.

8. MQTT messages are published correctly.

9. The ESP32 receives valid commands.

10. The servo, LEDs, and buzzer respond correctly when connected.

11. The dashboard displays real events and device status.

12. Access history and analytics work.

13. The application works without an external cloud AI service.

14. The UI works properly on mobile and desktop.

**Your goal is to deliver EdgeFace as a complete, polished, demonstrable, locally running AIoT web application—not merely a project proposal or a visual dashboard.**
Build a modern, dynamic, and visually extraordinary web application for **[Insert Brand/Project Name]**, which is a **[Insert Purpose, e.g., SaaS platform / creative agency / developer portfolio]**.

### 1. Tech Stack & Architecture

- **Framework:** Next.js (App Router) or React with Vite, written in TypeScript.

- **Styling:** Tailwind CSS with custom utility classes for glassmorphism, mesh gradients, and subtle noise textures.

- **Animations:** Framer Motion (for layout transitions, scroll-linked parallax, and micro-interactions) and GSAP (if needed for complex timeline sequences).

- **Icons:** Lucide React or Phosphor Icons.

- **Structure:** Modular, clean component architecture. Ensure full responsiveness across mobile, tablet, and desktop.

### 2. Visual Direction & Theme

- **Aesthetic:** Sleek dark-mode-first aesthetic (`#09090B` background) with high-contrast typography, glowing radial mesh gradients, and subtle `1px` translucent borders (`border-white/10`).

- **Accent Colors:** **[Insert Primary Accent, e.g., Electric Indigo `#6366F1`]** and **[Insert Secondary Accent, e.g., Cyber Cyan `#06B6D4`]** used sparingly for CTAs, active states, and ambient backlighting.

- **Typography:** Pair a bold geometric sans-serif for display headings (e.g., `Plus Jakarta Sans` or `Space Grotesk`) with a clean sans-serif for body copy (`Inter`) and monospace for technical badges (`JetBrains Mono`).

### 3. Dynamic Animations & Interactive Elements

- **Hero Section:**

  - Staggered word-by-word or line-by-line text reveal on mount.

  - **Floating Ambient Icons/Badges:** Create 4–6 floating glassmorphic cards or tech icons positioned around the hero visual that gently bob on independent sine-wave loops (`y: [-8, 8]`, `rotate: [-2, 2]`) and react to mouse movement (subtle 3D tilt/parallax).

  - **Interactive Visual:** An interactive, glowing dashboard mockup, 3D-style geometric mesh, or live code/UI preview as the centerpiece.

- **Scroll-Triggered Effects:**

  - Smooth scroll-linked animations (`whileInView` with `once: true`) for all sections.

  - An infinite, seamless horizontal marquee showcasing partner logos, tech stack icons, or key metrics.

- **Bento Grid Showcase:**

  - Build an asymmetric Bento Grid for the features section.

  - Add a **mouse-tracking spotlight glow** effect on each card border and background when hovered.

- **Micro-Interactions:**

  - Magnetic hover effects on primary CTA buttons.

  - Tactile spring physics (`type: "spring", stiffness: 400, damping: 25`) on interactive tabs, toggles, and cards.

### 4. Page Sections to Include

1. **Floating Glass Navbar:** Sticky top navigation with backdrop blur, animated active-link pill indicator, and a glowing primary CTA button.

2. **Hero Section:** High-impact headline, concise subheadline, dual CTAs (Primary + Secondary), and the interactive floating-icon centerpiece.

3. **Logo/Tech Marquee:** Infinite scrolling ticker with fade-out masks on the left and right edges.

4. **Interactive Bento Grid:** 4–6 cards highlighting core features with live mini-animations inside the cards.

5. **Interactive Showcase / Workflow:** A tabbed or scroll-stepped section where clicking/scrolling transitions the visual preview smoothly using Framer Motion `AnimatePresence`.

6. **Social Proof / Testimonials:** Sleek cards with subtle gradient borders.

7. **High-Contrast Footer:** Clean multi-column layout with a large, subtle watermark brand name at the bottom.

### 5. Execution Rules

- Write complete, production-ready code without placeholder comments like `// TODO: add animation`.

- Ensure all animations run smoothly at 60fps (stick to GPU-accelerated properties like `transform` and `opacity`).

- Respect `prefers-reduced-motion` for accessibility.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://edgeface-smart-access.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/2a05f9d8-033a-41b9-a162-2163aa02bebf).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
