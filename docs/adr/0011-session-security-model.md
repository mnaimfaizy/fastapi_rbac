# ADR 0011: Session security model

## Status

Accepted

## Context

[ADR 0001](0001-pyjwt-sole-jwt-library.md) consolidated JWT handling onto PyJWT and deleted an unused `TokenManager` that had planned several session controls. Issue [#67](https://github.com/mnaimfaizy/fastapi_rbac/issues/67) collected what that deletion left behind, with [#68](https://github.com/mnaimfaizy/fastapi_rbac/issues/68) and [#69](https://github.com/mnaimfaizy/fastapi_rbac/issues/69) filed as its two named children.

Triage found the checklist was not five independent gaps but one condition with five symptoms. Six settings — `VALIDATE_TOKEN_IP`, `CONCURRENT_SESSION_LIMIT`, `TOKEN_BLACKLIST_ON_LOGOUT`, `TOKEN_BLACKLIST_EXPIRY`, `SESSION_MAX_AGE`, `SESSION_EXTEND_ON_ACTIVITY` — have no reference anywhere outside `config.py`. `VALIDATE_TOKEN_IP` defaults to `true`, so the configuration advertises an active control that does not exist. That was #69's complaint, and it is true of all six.

Meanwhile the mechanism nobody was discussing already worked. The Redis allowlist is checked against every access token on every authenticated request, and revocation is deleting the user's token set. Both logout and change-password already call it. So server-side session revocation was never missing — which reframes #68 entirely: `password_version` is incremented on every password change and never read, making it a second mechanism for a goal the first already meets.

Two facts about the deployment shaped the rest. The production topology is nginx proxying to `fastapi_rbac_prod:8000`, with nginx correctly setting `X-Real-IP` and `X-Forwarded-For`. The backend runs `gunicorn --worker-class uvicorn.workers.UvicornWorker` with no `--forwarded-allow-ips`, and uvicorn trusts forwarded headers only from `127.0.0.1` by default. nginx is a separate container, so those headers are discarded and `request.client.host` is the proxy's address. Every request currently appears to originate from one IP — which makes IP binding meaningless, HTTP rate limiting a single global bucket, and every security event's recorded address wrong.

The revocation primitive is also misnamed. `cleanup_expired_tokens` does not remove expired tokens; it deletes the entire allowlist set. A reader looking for revocation would not find it under that name, which is the most plausible explanation for how a second, half-wired mechanism came to be built alongside a working one.

## Decision

1. **The allowlist is the sole session revocation mechanism.** It is already enforced on every authenticated request. Nothing else may be introduced to invalidate sessions, because two mechanisms for one property is the condition this ADR exists to end.

2. **A session is one refresh token and the access tokens derived from it.** Access tokens are short-lived and several may exist per login, so counting them would bound activity rather than sessions.

3. **`password_version` is retired and its column dropped.** It is read nowhere, exposed in no API or client, and duplicates decision 1. Leaving the column while ceasing to increment it would preserve a name asserting a security property nothing provides.

4. **A setting earns its existence by being read somewhere.** `TOKEN_BLACKLIST_ON_LOGOUT`, `TOKEN_BLACKLIST_EXPIRY`, `SESSION_MAX_AGE`, and `SESSION_EXTEND_ON_ACTIVITY` are deleted. A blacklist is the logical inverse of the allowlist in decision 1 and can only disagree with it; session lifetime is already defined by access and refresh token expiry.

5. **`VALIDATE_TOKEN_IP` is implemented as origin-network anomaly detection, not as binding.** The origin network — the IPv4 /24 or IPv6 /64 a session was established from — is recorded with the session, and the full address is stored so the comparison can be tightened later without a data migration. A refresh presented from a different origin network revokes **that session only** and emits a security event. Access tokens are not checked against it, and no request is blocked outright.

6. **User-Agent binding is rejected.** Browsers change their User-Agent on auto-update, so a legitimate user trips it while doing nothing, and an attacker who stole a token from a request also has the header from that request.

7. **`CONCURRENT_SESSION_LIMIT` is implemented, evicting the oldest session rather than rejecting the new login.** Rejecting punishes the legitimate user for holding stale sessions and yields no security benefit. This requires the allowlist to gain per-member expiry awareness first: members currently never expire individually — the whole set expires on a clock set by the first token added — so a count over it includes sessions that no longer exist.

8. **Forwarded headers are trusted from the reverse proxy only, never by wildcard.** Trusting them from anywhere lets any client forge its own address for rate limiting, origin-network detection, and the audit log simultaneously. This is a prerequisite for decision 5 and has standalone value.

## Considered options

**Keep `password_version` as defence-in-depth**, on the argument that a version claim still works if Redis is unavailable. Rejected: when Redis is unreachable the allowlist check fails rather than silently admitting tokens, so the scenario the redundancy defends against does not end with tokens being accepted. The cost — a per-request comparison and a column that must be kept correct on every password path — buys nothing.

**Strict IP enforcement**, rejecting any request whose address differs from the session's. Rejected: it logs out every user moving between wifi and mobile data, while an attacker on the victim's NAT or behind the same proxy passes it unchanged. OWASP's guidance is explicit that these properties cannot be relied on to defend against session attacks and are worthwhile as detection signals rather than gates. It imposes real and frequent cost on legitimate users for defence the realistic attacker walks through.

**Keep the unenforced settings as documented aspiration**, with a comment noting they are not implemented. Rejected: a setting defaulting to `true` reads as an active control to anyone auditing the configuration, and comments are not read by the person scanning `.env`. This is precisely the state #69 objected to.

**Retain a token blacklist alongside the allowlist.** Rejected under decision 1: with an allowlist, a token's absence *is* its revocation, and a blacklist can only introduce a state where the two disagree.

**Split these decisions across five ADRs**, one per checklist item. Rejected: they justify each other — `password_version` is retired *because* the allowlist is canonical, and User-Agent binding is rejected by a weaker form of the reasoning that shapes decision 5. Read separately, each looks arbitrary.

## Consequences

- A user whose carrier rotates them outside their original /24 re-authenticates on that device at their next refresh. This is the accepted cost of decision 5, and the /24 and /64 units exist to make it uncommon rather than routine.
- An attacker who steals a token and replays it from the victim's own network is not detected. This is a known and accepted limit of the control, not an oversight.
- Dropping the `password_version` column is not reversible without a restore. It is read nowhere, so the risk is confined to the migration itself.
- Decision 8 changes what `get_remote_address` returns, which silently re-keys HTTP rate limiting from one global bucket to genuine per-client buckets. Issue [#100](https://github.com/mnaimfaizy/fastapi_rbac/issues/100) assumes an IP fallback that does not currently work; it depends on this decision landing first.
- Decision 7 requires reshaping the allowlist from a set of raw tokens to a structure carrying per-member metadata. Decision 5's origin network is stored there, so both depend on that restructure, and it touches every site that adds or reads a token.
- `cleanup_expired_tokens` is renamed to say that it revokes sessions. The old name describes garbage collection and hid an existing revocation mechanism from the people who then built a second one.
- A future reader will find a security setting that detects rather than blocks, and may try to make it "actually enforce". That reversal is what the considered options above exist to prevent.
