# Security policy

squadchat keeps organizations' model keys and connector credentials, and its agents act with real
permissions. We take reports seriously and appreciate coordinated disclosure.

## Reporting a vulnerability

**Please do not open a public issue.** Instead, use GitHub's private vulnerability reporting on this
repository:

- Go to **Security → Report a vulnerability** at
  [github.com/gabedsam01/squad-chat/security/advisories/new](https://github.com/gabedsam01/squad-chat/security/advisories/new).

Please include reproduction steps, the version (the image tag, commit SHA, or `version` from
`/api/health`) and your deployment setup.

## Scope

This repository (the server, the web app, the landing page, the runner, and the phone and desktop
apps). Most wanted: anything that crosses an organization's boundary, gets past a person's role, an
agent's scopes or an approval, or exposes a stored key. A prompt that only makes an agent misuse
access it was given is a known limit of agents; report it when our defaults make it easier than they
should.

For self-hosted instances, issues in third-party software (Postgres, Docker, your reverse proxy, a
model provider) go to those projects, but if our default configuration makes one unsafe, that's ours
and we want to know. Fixes ship in new releases: keep instances on the latest one
([SELF_HOSTING.md](SELF_HOSTING.md), Upgrades).
