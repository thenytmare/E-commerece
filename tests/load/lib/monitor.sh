#!/usr/bin/env bash
# Samples the app server and Postgres every 5 s while a test runs.
#   tests/load/lib/monitor.sh results/baseline-monitor.csv &
OUT=${1:-monitor.csv}
DB=${DATABASE_URL%%\?*}
echo "time,node_cpu_pct,node_rss_mb,pg_active,pg_total,pg_max" > "$OUT"
while true; do
  PID=$(pgrep -f next-server | head -1)
  read CPU RSS < <(ps -o %cpu=,rss= -p "$PID" 2>/dev/null || echo "0 0")
  read ACTIVE TOTAL MAX < <(psql -At -F' ' "$DB" -c "select count(*) filter (where state='active'), count(*), current_setting('max_connections') from pg_stat_activity where datname=current_database()" 2>/dev/null || echo "0 0 0")
  echo "$(date +%H:%M:%S),$CPU,$((RSS/1024)),$ACTIVE,$TOTAL,$MAX" >> "$OUT"
  sleep 5
done
