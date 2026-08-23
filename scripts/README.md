# scripts/

| File | Purpose |
|---|---|
| `deploy-to-loki.sh` | Deploys the app to the LOKI server: builds the web bundle, syncs files, restarts the API process. **Production-touching — never run without explicit approval** (HARD RULE 5). Read the script before use; verify with curl/health checks after. |
