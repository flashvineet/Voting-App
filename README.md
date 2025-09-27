# Real-Time Voting App

A full-stack voting app built with **React + Vite (frontend)** and **Node.js + Express + Socket.io (backend)**.  
Users can log in with just their name, cast **one vote per session**, and see live results update instantly with charts.

#Tech Stack
- **Frontend**: React, Vite, Recharts, Socket.io-client  
- **Backend**: Node.js, Express, Socket.io, express-session, CORS  
- **Styling**: Custom CSS (modern responsive design)  

# Important Note
For demo purposes, **results are visible while voting** so recruiters can instantly see live updates.  
In a real-world voting system, results would typically be hidden until the end of the voting period to avoid influencing voters.  


#Setup Instructions

#Clone the repo
git clone https://github.com/flashvineet/Voting-App.git
cd voting-app

#Backend
cd backend
npm install
node index.js

#Run Frontend
cd ../frontend
npm install
npm run dev
