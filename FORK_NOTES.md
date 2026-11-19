# hoodtronik fork notes

Fork of `leancoderkavy/premiere-pro-mcp`. Branch `hoodtronik/sync-1.31` = upstream v1.31.0 plus the patches below.
The pre-sync state (v1.14.7 + 5 local commits) is kept on `backup/pre-sync-1.31-20261118` and `fix/rename-clip-gap-safe`.

## Local patches vs upstream 1.31.0 (2026-11-18)

| Old fork commit | Status in 1.31 |
| --- | --- |
| 8e58c361 QE `addTracks` positional signature | Covered upstream (positional call + readback). OPEN: upstream maps audio type 1 = stereo, 0 = mono (measured on 25.2); the fork measured the opposite on 26.x (0 accepted stereo, 1 rejected it). Kept upstream's mapping; check `add_tracks` live on 26.5.2. |
| adc09b46 `rename_clip` via `TrackItem.name` | Covered upstream (same fix, with readback). Not ported. |
| 7725d096 `apply_effect` matchName + `probe_effect` | Ported: `src/tools/effect-resolve.ts` (plugin-cache matchName lookup), spacing/case-insensitive catalog match, read-only `probe_effect`. Upstream already verifies the add by component readback. |
| 5364203a `'Section/Name'` effect property paths | Partly upstream (`property_index`, ambiguity refusal). Ported the `Section/Name` path resolution into `__resolveProperty` and `section`/`path` fields in `get_effect_properties`. |
| 2915ba5d `link_clips_by_start` | Ported, rewritten in upstream style: deselects the whole sequence before each `linkSelection()`, skips groups already linked, and verifies every group with `getLinkedItems()`. |

Also new in the fork: `get_clip_links` now reports Premiere's real link group (`getLinkedItems`) in `linkedClips`; upstream's same-source/same-start heuristic (which can never show a WAV from another file) moved to `sameSourceClips`.

## Bridge directory on this PC

Since ~1.2x the server and the CEP panel refuse a bridge folder that untrusted accounts can write to. On this PC `%LOCALAPPDATA%\Temp` grants `Everyone: Full control` (plus three foreign SIDs), so the default `%TEMP%\premiere-mcp-bridge` is refused and the server exits with "Fatal error". Use a private folder, e.g. `PREMIERE_TEMP_DIR=C:\Users\hoodt\AppData\Local\premiere-mcp-bridge`, set for BOTH the MCP server (client config env) and the panel (user environment variable before starting Premiere, or the panel's bridge-folder field).
- `docs/supported-actions.md` is left at upstream's published counts (453 core tools) so `tests/release-metadata.test.ts` passes; the fork registers 2 more (`link_clips_by_start`, `probe_effect`), so `npm run docs:supported-actions:check` reports it stale by design.

## 2026-11-18 live findings (Premiere 26.5.2, new bridge folder)
- Bridge folder: v1.31 refuses a bridge dir whose parent grants write to untrusted identities. This PC's %TEMP% grants Everyone Full control, so we run with `PREMIERE_TEMP_DIR=C:\Users\hoodt\AppData\Local\premiere-mcp-bridge` (user env var for the CEP panel + `.mcp.json` env for the server; folder ACL = owner, SYSTEM, Administrators only).
- `linkSelection()` silently does nothing when a selected clip already belongs to another link group (a video clip with its own linked audio). `link_clips_by_start` now pulls existing partners into the group, unlinks the union (needs every member selected), then links the union, and restores the original groups if the relink fails. Verified live: video + its audio + a separate WAV -> one read-back-verified group.
- After any failed mutation the CEP bridge sets HOST_RECOVERY_REQUIRED: `inspect_operation_recovery` then `acknowledge_operation_recovery` with the returned revisions.
- Live passes: ping, create_project, import_media, create_sequence_from_clips, add_tracks (stereo/mono mapping not yet checked), overwrite_clip on an audio track (no ripple), rename_track, unlink_selection, link_selection, link_clips_by_start, get_clip_links.
