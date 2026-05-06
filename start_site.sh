#!/bin/bash
export PORT=3000
export BASE_PATH=/
export API_PORT=5000
pnpm --filter @workspace/sentinel-site run dev
