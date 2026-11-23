#!/bin/sh
# The web, queue, and scheduler containers share this image. Only the web
# role listens on port 80. A curl there would mark workers unhealthy.
role="${CONTAINER_ROLE:-app}"
if [ "$role" != "app" ]; then
  exit 0
fi

curl -fsS -o /dev/null --max-time 8 http://127.0.0.1/
