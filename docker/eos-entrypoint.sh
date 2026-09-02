#!/bin/sh
set -eu

if [ "${EOS_MALWARE_SCAN_MODE:-}" = "clamav" ]; then
  mkdir -p /run/clamav
  chown clamav:clamav /run/clamav /var/lib/clamav
  freshclam --config-file=/etc/clamav/freshclam.conf || echo "freshclam startup refresh failed; using the image-bundled signatures" >&2
  clamd --config-file=/etc/clamav/clamd.conf &
  freshclam --config-file=/etc/clamav/freshclam.conf --daemon &
fi

exec gosu node npm start
