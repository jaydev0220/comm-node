#!/bin/sh
set -eu

echo "Generating Prisma client..."
./node_modules/.bin/prisma generate

echo "Applying Prisma migrations..."
./node_modules/.bin/prisma migrate deploy

exec node build/index.js
