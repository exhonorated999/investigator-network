@echo off
REM Local development launcher for Investigator Network LMS (Windows).
if "%APP_PORT%"=="" set APP_PORT=3000
echo Starting Next.js dev server on port %APP_PORT%...
npx next dev -p %APP_PORT%
