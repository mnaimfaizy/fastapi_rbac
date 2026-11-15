# Sandcastle builder image for fastapi_rbac.
#
# Build from the repository root (see .sandcastle/README.md):
#   docker build -f .sandcastle/Dockerfile -t sandcastle:fastapi-rbac .
# Dockerfile.dockerignore limits the context to the two dependency manifests.
#
# Dependencies are installed here, at build time, so a run needs no PyPI or
# npm access. The worktree is bind-mounted at runtime, so the Python venv
# lives outside it (/opt/venv) and the frontend gets an offline npm cache.
FROM node:22-bookworm

RUN apt-get update && apt-get install -y --no-install-recommends \
    git curl jq ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# uv, then a standalone CPython 3.10 venv with the backend requirements.
ENV UV_PYTHON_INSTALL_DIR=/opt/python
RUN curl -LsSf https://astral.sh/uv/0.9.5/install.sh | env UV_INSTALL_DIR=/usr/local/bin UV_NO_MODIFY_PATH=1 sh
COPY backend/requirements.txt /tmp/deps/requirements.txt
RUN uv venv --seed --python 3.10 /opt/venv \
  && uv pip install --python /opt/venv/bin/python -r /tmp/deps/requirements.txt
ENV PATH="/opt/venv/bin:$PATH"

# GitHub Copilot CLI installs globally, as root.
ARG COPILOT_CLI_VERSION=1.0.112
RUN npm install -g @github/copilot@${COPILOT_CLI_VERSION}

# Same UID/GID alignment as Sandcastle's own templates.
ARG AGENT_UID=1000
ARG AGENT_GID=1000
RUN groupmod -o -g $AGENT_GID node && usermod -o -u $AGENT_UID -g $AGENT_GID -d /home/agent -m -l agent node
USER ${AGENT_UID}:${AGENT_GID}

# Warm the npm cache so gates can run `npm ci --offline`.
COPY --chown=${AGENT_UID}:${AGENT_GID} react-frontend/package.json react-frontend/package-lock.json /tmp/frontend/
RUN cd /tmp/frontend \
  && npm ci --legacy-peer-deps --no-audit --no-fund --ignore-scripts \
  && rm -rf /tmp/frontend

# Cursor Agent CLI.
RUN curl https://cursor.com/install -fsS | bash

# Claude Code. Pass --build-arg CLAUDE_CODE_VERSION=<x.y.z> to pin; its own
# auto-updater is off so a run uses the version the image was built with.
ARG CLAUDE_CODE_VERSION=latest
ENV DISABLE_AUTOUPDATER=1
RUN curl -fsSL https://claude.ai/install.sh | bash -s "$CLAUDE_CODE_VERSION"
ENV PATH="/home/agent/.local/bin:$PATH"

# Pre-accept Claude Code's workspace trust for the fixed sandbox path, so it
# loads the repo's .claude/settings.json without prompting.
RUN node -e "const f='/home/agent/.claude.json',fs=require('fs');let j={};try{j=JSON.parse(fs.readFileSync(f,'utf8'))}catch{}j.hasCompletedOnboarding=true;j.projects=j.projects||{};j.projects['/home/agent/workspace']={...(j.projects['/home/agent/workspace']||{}),hasTrustDialogAccepted:true};fs.writeFileSync(f,JSON.stringify(j,null,2))"

WORKDIR /home/agent
ENTRYPOINT ["sleep", "infinity"]
