# Phase 2: Playlist Management - Context

**Gathered:** 2026-02-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can view, modify, and sync a playback queue across all room members in real-time. Includes queue display, song search/add, playback advancement, and multi-device sync. Control modes (who can operate the queue) belong to Phase 4.

</domain>

<decisions>
## Implementation Decisions

### Queue Display & Interaction
- Queue lives in a bottom sheet panel inside the player screen (Spotify-style slide-up)
- Each queue item shows: cover art, song name, artist, duration, and who added it (avatar/nickname)
- Long-press to drag-and-drop for reordering
- Swipe left to reveal delete button for removing songs
- Queue panel has an "Add Song" button that navigates to the search page

### Song Search & Add
- Dedicated search page (reuse existing search and playback infrastructure)
- Search source: online music platform (already implemented)
- After tapping "Add to Queue": lightweight inline feedback (checkmark animation), user stays on search page
- Duplicate songs not allowed — if already in queue, button is disabled or shows "Already in queue"
- New songs insert as "play next" (after currently playing track), not appended to end
- Entry point: "Add Song" button inside the queue panel

### Playback Advancement & Empty Queue
- Auto-advance to next song when current track ends
- When all songs finish: stop playback by default; user can toggle loop mode to repeat the queue
- Empty queue state: show prompt text + "Add Song" button to guide user to search

### Auto-advance Sync Mechanism
- Claude's Discretion — choose the appropriate trigger mechanism (client-triggered vs server-triggered) for auto-advance that ensures all room members stay in sync

### Multi-Device Sync & Conflicts
- All queue operations go through server; server processes in arrival order (FIFO), no version-based conflict detection needed
- Queue operations (add/remove/reorder) wait for server confirmation before updating UI (not optimistic); show loading state during operation
- Other members' queue operations show lightweight toast notifications (e.g., "XX added a song", "XX removed a song")
- During disconnection: queue operations are disabled, show "Connecting..." state; on reconnect, sync latest queue state from server

</decisions>

<specifics>
## Specific Ideas

- Queue panel interaction similar to Spotify's "Up Next" bottom sheet
- Reuse existing song search and playback infrastructure — no new search UI needed, just add "Add to Queue" action to search results
- "Play next" insertion position matches user mental model of "I want to hear this soon"

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-playlist-management*
*Context gathered: 2026-02-14*
