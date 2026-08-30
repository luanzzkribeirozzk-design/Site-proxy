# Project TODO

- [x] Confirm Firebase Web configuration for project `proxy-5f82e`
- [x] Define a neutral catalog model for six initial authorized items
- [x] Add automatic initialization of the six catalog records without duplicates
- [x] Build the cyberpunk dashboard for catalog management
- [x] Support rename, ordering, status colors, availability and archive/restore states
- [x] Add immutable catalog publication versions and history
- [x] Add in-app notification messages delivered on next synchronization
- [x] Add read-only public manifest endpoint for the app client
- [x] Evaluate offline cache and last-valid-manifest fallback; IPA integration deferred because the current V2 contains unsafe components
- [x] Add SHA-256 manifest integrity checks for the neutral panel endpoint; native IPA integration deferred for safety
- [x] Keep Firestore rules closed until administrative write access is configured
- [x] Confirmed that remote binary uploads are not enabled; the zero-cost panel manages metadata only
- [x] Do not implement remote distribution or activation of game modifications
- [x] Add Vitest coverage for catalog initialization, status transitions and manifest validation
- [x] Run tests and visual verification before checkpoint

