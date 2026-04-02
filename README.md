# Academic Assessment Quality Analyzer

## Local setup

### Server
1. `cd server`
2. Create `.env` with:
   - `MONGO_URI=...`
   - `JWT_SECRET=...`
   - `CLIENT_URL=http://localhost:5173`
   - Optional for Google login: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_ADMIN_EMAILS`
3. `npm install`
4. `npm run dev`

### Client
1. `cd client`
2. Optional `.env`:
   - `VITE_API_URL=http://localhost:5000`
3. `npm install`
4. `npm run dev`

## Deployment (recommended)

### API on Render
1. Fastest setup: create a new **Blueprint** from this repo and let Render read [render.yaml](/d:/mini%20project/render.yaml).
2. If you prefer manual setup, create a new **Web Service** from the `server` folder.
3. Set build command: `npm install`
4. Set start command: `npm start`
5. Add environment variables:
   - `MONGO_URI`
   - `JWT_SECRET`
   - `CLIENT_URL` (the Vercel URL below)
   - `LOG_LEVEL=info`
   - Optional for Google login: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_ADMIN_EMAILS`
6. Deploy and note the API URL.

### Client on Vercel
1. Import the `client` folder as a new Vercel project.
2. Vercel can use [vercel.json](/d:/mini%20project/client/vercel.json) automatically.
3. Set the environment variable:
   - `VITE_API_URL` = Render API URL
4. Deploy.

## Health check
- `GET /health`

## Notes
- Google OAuth is optional in production. If Google credentials are not set, email/password login still works and `/api/auth/google` returns `503`.
- Role-based access is enabled with three roles: `student`, `faculty`, `admin`.
- `student` and `faculty` are read-only in the dashboard.
- `faculty` can additionally view results of 4 students.
- `admin` can view all accounts and manage all assessment records.
- Reports filters affect charts and export output.

## Default credentials (seeded on server startup)
- Student 1: `student1@campus.local` | username `student1` | password `Student@123`
- Student 2: `student2@campus.local` | username `student2` | password `Student@123`
- Student 3: `student3@campus.local` | username `student3` | password `Student@123`
- Student 4: `student4@campus.local` | username `student4` | password `Student@123`
- Faculty: `faculty1@campus.local` | username `faculty1` | password `Faculty@123`
- Admin: `admin1@campus.local` | username `admin1` | password `Admin@123`
