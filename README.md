# Academic Assessment Quality Analyzer

## Local setup

### Server
1. `cd server`
2. Create `.env` with:
   - `MONGO_URI=...`
   - `JWT_SECRET=...`
   - `CLIENT_URL=http://localhost:5173`
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
1. Create a new **Web Service** from the `server` folder.
2. Set build command: `npm install`
3. Set start command: `npm start`
4. Add environment variables:
   - `MONGO_URI`
   - `JWT_SECRET`
   - `CLIENT_URL` (the Vercel URL below)
   - `LOG_LEVEL=info`
5. Deploy and note the API URL.

### Client on Vercel
1. Import the `client` folder as a new Vercel project.
2. Set the environment variable:
   - `VITE_API_URL` = Render API URL
3. Deploy.

## Health check
- `GET /health`

## Notes
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
