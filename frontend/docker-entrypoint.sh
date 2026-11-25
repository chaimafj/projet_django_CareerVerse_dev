#!/bin/sh
set -eu

envsubst '${PORT} ${BACKEND_HOSTPORT}' \
  < /etc/nginx/careerverse/default.conf.template \
  > /etc/nginx/conf.d/default.conf
