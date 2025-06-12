#!/bin/sh -e
set -x

# Sort imports one per line, so autoflake can remove unused imports
# isort --force-single-line-imports app # Removed: Rely on format.sh's isort call
sh ./scripts/format.sh
