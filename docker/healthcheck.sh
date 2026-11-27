#!/bin/sh
# One image, several roles. Only app (port 80) and grpc (RoadRunner status
# endpoint) listen on anything; queue and scheduler have nothing to probe.
role="${CONTAINER_ROLE:-app}"
case "$role" in
  app) exec curl -fsS -o /dev/null --max-time 8 http://127.0.0.1/ ;;
  grpc) exec curl -fsS -o /dev/null --max-time 8 http://127.0.0.1:2114/health ;;
  *) exit 0 ;;
esac
