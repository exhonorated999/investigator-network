#!/usr/bin/env bash
# Local development launcher for Investigator Network LMS.
# Uses the port assigned by the environment ($APP_PORT), falling back to 3000.
set -e
PORT="${APP_PORT:-3000}"
echo "Starting Next.js dev server on port ${PORT}..."
exec npx next dev -p "${PORT}"
