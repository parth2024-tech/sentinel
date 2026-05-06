#!/bin/bash
export PORT=5000
export DATABASE_URL=postgres://postgres@localhost:5432/sentinel
pnpm --filter @workspace/api-server run dev
