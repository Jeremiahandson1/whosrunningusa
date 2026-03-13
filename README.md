# WhosRunningUSA

**Democracy should be accessible to everyone.**

A civic engagement platform that empowers voters with transparency and enables anyone to run for office regardless of wealth.

## Features

### For Voters
- **Find Your Races** - Discover every race on your ballot from President to School Board
- **Compare Candidates** - Side-by-side position comparisons on key issues
- **Q&A System** - Ask candidates questions directly, upvote important ones
- **Town Halls** - Attend live video or text-based AMAs with candidates
- **Voting Guide Builder** - Create your personalized ballot to take to the polls
- **Promise Tracker** - Hold elected officials accountable to their campaign promises

### For Candidates
- **Free Platform** - No money required to reach voters
- **Identity Verification** - Verified candidate badges for credibility
- **Issue Positions** - Structured questionnaire to declare your stances
- **Direct Engagement** - Answer voter questions, host town halls
- **Endorsements** - Peer-to-peer candidate endorsements (no organizational endorsements)

## Tech Stack

**Backend**
- Node.js / Express 5
- PostgreSQL 16
- JWT Authentication
- bcryptjs for password hashing

**Frontend**
- React 19 + Vite 7
- React Router 7
- Lucide icons
- Custom CSS (Navy/White/Muted Red color scheme)

## Project Structure

```
whosrunningusa/
├── backend/
│   ├── routes/           # API endpoints
│   ├── middleware/        # Auth & validation middleware
│   ├── services/         # Email, notifications, data ingestion
│   ├── scripts/          # Sync & migration scripts
│   ├── migrations/       # Database migrations
│   ├── tests/            # Backend tests (Jest)
│   ├── schema.sql        # Database schema
│   ├── db.js             # Database connection
│   └── server.js         # Express server
├── src/
│   ├── components/       # Header, Footer, ErrorBoundary, etc.
│   ├── pages/            # Route pages
│   │   └── admin/        # Admin panel pages
│   ├── context/          # Auth context
│   ├── utils/            # API utilities
│   └── styles/           # CSS
├── public/               # Static assets (favicon)
├── .github/workflows/    # CI/CD pipeline
├── render.yaml           # Render deployment config
├── Dockerfile            # Docker support
└── index.html            # HTML entry point
```

## Setup

### Prerequisites
- Node.js 20+
- PostgreSQL 16+

### Database Setup

1. Create a PostgreSQL database:
```sql
CREATE DATABASE whosrunningusa;
```

2. Run the schema:
```bash
psql -d whosrunningusa -f backend/schema.sql
```

3. Run migrations:
```bash
cd backend && npm run migrate
```

### Backend Setup

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your database credentials and secrets
npm run dev
```

The API will run on `http://localhost:5000`

### Frontend Setup

```bash
# From project root
npm install
cp .env.example .env
# Edit .env if needed (defaults to localhost:5000)
npm run dev
```

The app will run on `http://localhost:3000` with API proxy to the backend.

## Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | Secret for signing JWT tokens |
| `PORT` | No | Server port (default: 5000) |
| `NODE_ENV` | No | `development`, `production`, or `test` |
| `FRONTEND_URL` | No | CORS origin (default: http://localhost:3000) |
| `SMTP_HOST` | No | SMTP server for emails |
| `SMTP_PORT` | No | SMTP port (default: 587) |
| `SMTP_USER` | No | SMTP username |
| `SMTP_PASS` | No | SMTP password |
| `FROM_EMAIL` | No | Sender email (default: noreply@whosrunningusa.com) |
| `AWS_ACCESS_KEY_ID` | No | AWS credentials for S3 uploads |
| `AWS_SECRET_ACCESS_KEY` | No | AWS credentials for S3 uploads |
| `AWS_REGION` | No | AWS region (default: us-east-1) |
| `S3_BUCKET` | No | S3 bucket for file uploads |
| `ADMIN_API_KEY` | No | API key for admin/sync endpoints |
| `FEC_API_KEY` | No | Federal Election Commission API |
| `OPEN_STATES_API_KEY` | No | Open States API for state legislators |
| `CONGRESS_GOV_API_KEY` | No | Congress.gov API |

### Frontend (`.env` in project root)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_URL` | No | Backend API URL (default: http://localhost:5000/api) |

## API Endpoints

### Authentication
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user
- `POST /api/auth/verify-email` - Verify email
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password

### Candidates
- `GET /api/candidates` - List candidates (with filters)
- `GET /api/candidates/:id` - Get candidate profile
- `PUT /api/candidates/profile` - Update own profile
- `POST /api/candidates/positions` - Set issue position
- `POST /api/candidates/endorse/:id` - Endorse another candidate
- `GET /api/candidates/:id/promises` - Get promises
- `POST /api/candidates/promises` - Create promise
- `POST /api/candidates/promises/:id/lock` - Lock promise
- `GET /api/candidates/:id/voting-record` - Voting record
- `GET /api/candidates/:id/transparency` - Transparency profile

### Elections & Races
- `GET /api/elections` - List elections
- `GET /api/elections/:id` - Get election with races
- `GET /api/races` - List races (with filters)
- `GET /api/races/:id` - Get race with candidates
- `GET /api/races/:id/compare` - Compare candidates

### Q&A
- `GET /api/questions/candidate/:id` - Get questions for candidate
- `POST /api/questions` - Ask a question
- `POST /api/questions/:id/upvote` - Upvote question
- `POST /api/questions/:id/answer` - Answer question (candidate only)

### Town Halls
- `GET /api/town-halls/upcoming` - Upcoming town halls
- `POST /api/town-halls` - Create town hall (candidate only)
- `POST /api/town-halls/:id/rsvp` - RSVP for town hall
- `POST /api/town-halls/:id/questions` - Submit question

### Search
- `GET /api/search` - Global search
- `GET /api/search/candidates/by-location` - Search by location
- `GET /api/search/candidates/by-position` - Search by issue position

### Bills
- `GET /api/bills` - List bills (with filters)
- `GET /api/bills/:id` - Get bill details
- `GET /api/bills/state/:state/recent` - Recent bills for state

### Admin
- `GET /api/admin/stats` - Platform statistics
- `POST /api/admin/ingestion/sync/*` - Trigger data syncs
- `GET /api/admin/moderation` - Moderation queue
- CRUD for elections, races, candidates, users

## Deployment

### Render (Recommended)

The project includes a `render.yaml` blueprint for one-click deployment:

1. Push your code to GitHub
2. In Render, create a new Blueprint and connect your repo
3. Render will auto-detect `render.yaml` and create:
   - PostgreSQL database
   - Backend API web service
   - Frontend static site
4. Set the manual env vars in the Render dashboard:
   - SMTP credentials (for email features)
   - AWS credentials (for file uploads)
   - API keys (for data sync features)

### Docker

```bash
docker build -t whosrunningusa .
docker run -p 5000:5000 \
  -e DATABASE_URL=postgresql://... \
  -e JWT_SECRET=your-secret \
  whosrunningusa
```

## Design Philosophy

- **No external links** - All content stays on verified profiles
- **No private messaging** - All candidate communication is public
- **No organizational endorsements** - Only candidate-to-candidate
- **Radical transparency** - Engagement metrics visible on all profiles
- **Non-political advertising only** - Platform remains independent

## Color Palette

Subtle American colors without being overtly patriotic:

- **Navy 800**: `#1e3a5f` (Primary)
- **Navy 600**: `#2d5a8a` (Accents)
- **White**: `#ffffff` (Backgrounds)
- **Muted Red 600**: `#a34545` (CTAs, highlights)

## License

MIT
