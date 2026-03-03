# LifeVault AI Threat Model (Local Deployment)

## Assets
- Encrypted documents (browser-side AES-256-GCM output, IndexedDB persisted)
- JWT token (`localStorage`)
- Wallet signatures (MetaMask signing prompts)
- Backend signer private key (server `.env`)
- Smart contract state (identity, vault hash registry, verifier, emergency release)

## Threat Actors
- Malicious frontend user
- Network attacker on local/shared network
- XSS attacker in browser context
- Replay attacker
- Compromised browser extension
- Malicious or tampered RPC node

## Attack Surfaces

### localStorage JWT
- Risk: Medium
- Current mitigation: short auth pathways, protected API middleware, manual logout/clear path.
- Non-breaking improvement: add token expiry pre-check in frontend and optional in-memory session mode for sensitive screens.

### Signature verification/login path
- Risk: Medium
- Current mitigation: optional signature flow with backend endpoint probing; existing JWT path remains stable.
- Non-breaking improvement: enforce nonce single-use + expiry server-side and include origin/domain statement in signed message.

### Document encryption flow
- Risk: Medium
- Current mitigation: AES key not persisted in plaintext; only hash sent backend; encrypted bytes stay client-side.
- Non-breaking improvement: per-file key wrapping with wallet-derived secret for future recovery without raw key storage.

### Emergency release logic
- Risk: Medium
- Current mitigation: contract rules enforce inactivity windows and trusted caller constraints.
- Non-breaking improvement: add frontend confirmations and preflight read checks before triggering write tx.

### CSV parsing endpoint
- Risk: Medium
- Current mitigation: backend route parsing + AI-service validation and error handling.
- Non-breaking improvement: stricter CSV size/row limits and standardized schema validation before AI forwarding.

### Backend signer key handling
- Risk: High (if host compromised)
- Current mitigation: local-only deployment scope.
- Non-breaking improvement: use dedicated local throwaway key and rotate regularly during development.

### RPC trust boundary
- Risk: Medium
- Current mitigation: chainId checks and contract code existence checks in frontend.
- Non-breaking improvement: assert expected contract bytecode hash at startup for local node integrity checks.

