#!/usr/bin/env bash
# Smoke-test a deployed build of Hookd.
#
# Checks the things that have actually broken on this project before, in a way that
# does not false-positive. See ../SKILL.md and ../references/failures.md.
#
#   bash verify-deploy.sh                        # check current live state
#   bash verify-deploy.sh --expect workers.dev   # poll until that string appears, then check
#   bash verify-deploy.sh --url https://... --timeout 240
#
# Exit codes: 0 all checks passed, 1 a check failed, 2 timed out waiting for --expect.

set -uo pipefail

URL=""
EXPECT=""
TIMEOUT=180
INTERVAL=15

while [ $# -gt 0 ]; do
  case "$1" in
    --url)      URL="$2";     shift 2 ;;
    --expect)   EXPECT="$2";  shift 2 ;;
    --timeout)  TIMEOUT="$2"; shift 2 ;;
    --interval) INTERVAL="$2"; shift 2 ;;
    -h|--help)  sed -n '2,12p' "$0"; exit 0 ;;
    *) echo "unknown argument: $1" >&2; exit 1 ;;
  esac
done

# Default to the `site` value in astro.config.mjs so this stays correct across domain changes.
if [ -z "$URL" ]; then
  ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
  if [ -f "$ROOT/astro.config.mjs" ]; then
    URL=$(grep -o "site:[[:space:]]*'[^']*'" "$ROOT/astro.config.mjs" | head -1 | sed "s/.*'\(.*\)'/\1/")
  fi
fi
[ -n "$URL" ] || { echo "could not determine site URL; pass --url" >&2; exit 1; }
URL="${URL%/}"
HOST="${URL#https://}"; HOST="${HOST#http://}"; HOST="${HOST%%/*}"

PASS=0; FAIL=0
ok()   { printf "  \033[32mPASS\033[0m  %s\n" "$1"; PASS=$((PASS+1)); }
bad()  { printf "  \033[31mFAIL\033[0m  %s\n" "$1"; FAIL=$((FAIL+1)); }
note() { printf "        %s\n" "$1"; }

code()  { curl -s -o /dev/null -w '%{http_code}' "$1"; }
ctype() { curl -s -o /dev/null -w '%{content_type}' "$1"; }

echo "Verifying $URL"

# ---- optionally wait for the deploy to land -------------------------------------
# Without a marker you cannot tell "deployed" from "build failed, old version still up".
if [ -n "$EXPECT" ]; then
  echo "Waiting for '$EXPECT' (timeout ${TIMEOUT}s)"
  START=$(date +%s)
  while :; do
    BODY=$(curl -s "$URL/")
    EL=$(( $(date +%s) - START ))
    case "$BODY" in
      *"$EXPECT"*) echo "  marker appeared after ${EL}s"; break ;;
    esac
    if [ "$EL" -ge "$TIMEOUT" ]; then
      echo
      echo "  TIMED OUT after ${EL}s. The build most likely FAILED."
      echo "  Cloudflare reports nothing to GitHub, so the old version is still serving."
      echo "  Get the Cloudflare build log - this cannot be diagnosed from outside."
      exit 2
    fi
    sleep "$INTERVAL"
  done
fi

HTML=$(curl -s "$URL/")
echo

# ---- homepage --------------------------------------------------------------------
C=$(code "$URL/")
[ "$C" = "200" ] && ok "homepage 200" || bad "homepage returned $C"

# ---- images ----------------------------------------------------------------------
# The big one. In server mode Astro emits /_image?href=... which 404s on static hosting,
# leaving every image broken while the HTML still looks fine.
#
# Match on src="/_image, NOT bare _image or _astro: the broken URL is
# /_image?href=%2F_astro%2F..., so a bare _astro grep matches the failure it is meant
# to catch and reports a false pass.
if printf '%s' "$HTML" | grep -q 'src="/_image'; then
  bad "images use the runtime /_image endpoint (404s on static hosting - every image is broken)"
  note "$(printf '%s' "$HTML" | grep -o 'src="/_image[^"]*"' | head -1)"
  note "output:'static' + the sharp image service in astro.config.mjs are not taking effect on the host"
else
  ok "no runtime /_image URLs"
fi

IMG_SRCS=$(printf '%s' "$HTML" | grep -o 'src="/_astro/[^"]*"' | sed 's/src="//; s/"$//' | sort -u)
SRCSETS=$(printf '%s' "$HTML" | grep -o 'srcset="[^"]*"' | sed 's/srcset="//; s/"$//' \
          | tr ',' '\n' | awk '{print $1}' | grep '^/_astro/' | sort -u)
ALL_IMGS=$(printf '%s\n%s\n' "$IMG_SRCS" "$SRCSETS" | grep -v '^$' | sort -u)

if [ -z "$ALL_IMGS" ]; then
  if printf '%s' "$HTML" | grep -q '<img'; then
    bad "page has <img> but no /_astro/ sources - images are not build-optimized"
  else
    note "no images on this page, skipping asset checks"
  fi
else
  BROKEN=0
  for src in $ALL_IMGS; do
    IC=$(code "$URL$src"); IT=$(ctype "$URL$src")
    case "$IC:$IT" in
      200:image/*) ;;
      *) bad "asset $src -> HTTP $IC ${IT:-no-content-type}"; BROKEN=$((BROKEN+1)) ;;
    esac
  done
  [ "$BROKEN" -eq 0 ] && ok "all $(printf '%s\n' "$ALL_IMGS" | wc -l | tr -d ' ') image assets serve as images"
fi

# ---- canonical host ---------------------------------------------------------------
# `site` in astro.config.mjs drives canonical + sitemap; robots.txt repeats it by hand.
CANON=$(printf '%s' "$HTML" | grep -o 'rel="canonical" href="[^"]*"' | sed 's/.*href="//; s/"$//')
if [ -z "$CANON" ]; then
  bad "no canonical link found"
elif case "$CANON" in *"$HOST"*) false ;; *) true ;; esac; then
  bad "canonical points at a different host than the one served"
  note "canonical: $CANON"
  note "served:    $URL"
  note "fix site in astro.config.mjs AND the Sitemap: line in public/robots.txt together"
else
  ok "canonical matches served host"
fi

# ---- sitemap + robots --------------------------------------------------------------
for p in /sitemap-index.xml /sitemap-0.xml /robots.txt; do
  C=$(code "$URL$p")
  [ "$C" = "200" ] && ok "$p 200" || bad "$p returned $C"
done

ROBOTS_HOST=$(curl -s "$URL/robots.txt" | grep -i '^Sitemap:' | sed 's/.*https\?:\/\///; s/\/.*//')
if [ -n "$ROBOTS_HOST" ] && [ "$ROBOTS_HOST" != "$HOST" ]; then
  bad "robots.txt Sitemap host ($ROBOTS_HOST) != served host ($HOST)"
else
  ok "robots.txt Sitemap host matches"
fi

if curl -s "$URL/sitemap-0.xml" | grep -q "$HOST"; then
  ok "sitemap entries use the served host"
else
  bad "sitemap entries do not use the served host"
fi

# ---- project rules -----------------------------------------------------------------
H1=$(printf '%s' "$HTML" | grep -o '<h1[^>]*>' | wc -l | tr -d ' ')
[ "$H1" = "1" ] && ok "exactly one <h1>" || bad "found $H1 <h1> tags (project rule: exactly one)"

SC=$(printf '%s' "$HTML" | grep -o '<script' | wc -l | tr -d ' ')
[ "$SC" = "0" ] && ok "no <script> tags (server-rendered HTML only)" \
                || bad "found $SC <script> tags - AI crawlers do not execute JS"

echo
echo "  $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
