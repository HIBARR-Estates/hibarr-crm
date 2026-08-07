#!/bin/bash

# Install dependencies for Puppeteer/Chrome on Ubuntu/Debian server
# Run this as root or with sudo

echo "Installing Chrome/Puppeteer system dependencies..."

apt-get update && apt-get install -y \
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libasound2t64 \
    libatk-bridge2.0-0t64 \
    libatk1.0-0t64 \
    libc6 \
    libcairo2 \
    libcups2t64 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc-s1 \
    libglib2.0-0t64 \
    libgtk-3-0t64 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    wget \
    xdg-utils

echo "System dependencies installed."
echo ""
echo "Now install Chrome for Puppeteer as the web user:"
echo "  sudo -u <your-web-user-used-to-run-app-on-your-vps> npx puppeteer browsers install chrome-headless-shell"