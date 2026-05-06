#!/bin/bash
export DATABASE_URL=postgres://postgres@localhost:5432/sentinel
pnpm --filter @workspace/db run push
