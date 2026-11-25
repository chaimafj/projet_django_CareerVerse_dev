#!/bin/sh
set -eu

export RESOLVER="${RESOLVER:-$(awk '/^nameserver[[:space:]]/{print $2; exit}' /etc/resolv.conf)}"

envsubst '${PORT} ${BACKEND_SCHEME} ${BACKEND_HOSTPORT} ${RESOLVER}' \
  < /etc/nginx/careerverse/default.conf.template \
  > /etc/nginx/conf.d/default.conf
