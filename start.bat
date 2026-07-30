@echo off
REM Local development launcher for Investigator Network LMS (Windows).
if "%APP_PORT%"=="" set APP_PORT=3000

REM Auth.js builds its post-login redirect from AUTH_URL. If that disagrees
REM with the port we actually serve on, sign-in bounces the browser to a dead
REM port and the user appears to be logged out. Derive it here so the two can
REM never drift. Next.js does not override variables already in the
REM environment, so this wins over the value in .env for local dev only.
set AUTH_URL=http://localhost:%APP_PORT%

echo Starting Next.js dev server on port %APP_PORT%...
npx next dev -p %APP_PORT%
