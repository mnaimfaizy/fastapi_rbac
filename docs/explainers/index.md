# Explainers

Explainers are interactive pages that show how a part of the system works by running it in front of you. Each one is a single self-contained HTML page. It opens on its own, outside this site's theme, and works offline.

Every fact on an explainer is cited to a source line. CI checks each page against the code on every pull request (see [Keeping explainer pages current](../development/explainer-pages.md)), so what you read here matches the code on `main`.

## Session lifecycle

**[Open the session lifecycle explainer →](session-lifecycle.html)**

What happens to a session from login to logout, across the browser, the HTTP edge, the API, Redis and Postgres.

- **The story:** 11 chapters, played on a diagram of the five parts: login, an authenticated request, refresh, the five-session cap, eviction, a revoked request, a refresh from a new network, logout, password change and logout everywhere.
- **Interaction:** step through it or press Play, guess what happens at three decision points, and click any request, Redis entry, cookie or audit row to see the real headers, Redis command and source lines.
- **Sandbox:** sign in on several devices and refresh, log out or change password to see the rules apply.
- **Reference:** the status codes, settings, cookie, origin-network rule and the five ways a session ends, collapsed below the story.

For the written account of the same flows, see [System Architecture](../reference/architecture.md) and the [Authentication API](../reference/api/auth.md).
