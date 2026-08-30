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
- [x] Prepare private GitHub repository and Vercel deployment guide
- [x] Push the panel snapshot to `luanzzkribeirozzk-design/Site-proxy` main branch

- [x] Fix Vercel static output so `/` serves the compiled frontend instead of the server bundle
- [ ] Redeploy the corrected Vercel configuration and verify the public manifest route
- [ ] Configure `FIREBASE_SERVICE_ACCOUNT_JSON` in Vercel and recheck the manifest route
- [ ] Fix Vercel function initialization crash and expose health/manifest routes safely
- [ ] Resolve Vercel auth gate so the personal panel does not show the Manus login screen
