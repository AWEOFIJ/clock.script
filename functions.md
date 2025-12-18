# Functions

This document describes the main functions in this project and their responsibilities.

## Time Synchronization

- **syncedMsFromLocal(localMs):** Returns synchronized time in milliseconds by applying the current `clockOffsetMs` to a provided local timestamp.
- **fetchWithRtt(source):** Fetches time from a source URL, measures round-trip time (RTT), and estimates the server time at the moment the client receives the response.
- **tryFetchWithRetry(source, retries, delayMs):** Wrapper around `fetchWithRtt` that retries on failure with exponential backoff.
- **syncTime():** Performs synchronization using primary (timeapi.io) with fallback (worldtimeapi.org), updates `clockOffsetMs`, and reports status.
- **getSyncedNow():** Returns the current synchronized time (`Date.now()` + `clockOffsetMs`). Use sparingly; prefer `syncedMsFromLocal()` in tight loops.

## Rendering

- **formatTime(ms):** Formats a timestamp (ms) into local time string `YYYY-MM-DD HH:mm:ss <TimeZone>`.
- **updateStatus(msg, ttlMs?):** Updates the `#sync-status` element with a message. If `ttlMs` is provided, clears the message after the given milliseconds.
- **renderClock():** Updates the text clock display (`#clock`) and local clock (`#clock-local`) using the synchronized timestamp.

## Scheduling

- **startClock():** Kicks off initial synchronization, renders once, and schedules hourly resync aligned to the top of the hour.
- **scheduleNextTick():** Aligns to the next whole second using synchronized time and updates the UI every second.
- **stopTicking():** Stops the per-second ticking timer.
- **startTicking():** Starts (or restarts) per-second ticking if not already running.

## Theme

- **applyTheme(theme):** Applies `theme-dark` or `theme-light` CSS classes to the root element. No persistence.
- **initTheme():** Initializes the theme from system preference and binds the `#theme-toggle` button. No localStorage.

## Flip Clock

- **updateClock():** Drives the flip clock animations for hours, minutes, and seconds. It reads synchronized time and updates flip-card elements when present.

## Event Handlers

- Document events:
  - `DOMContentLoaded` → `startClock()` and `initTheme()`.
  - `visibilitychange` → Pauses ticking when hidden; resumes and refreshes when visible.

## Constants & State

- **HOUR_MS:** `60 * 60 * 1000`. Base unit for hourly scheduling.
- **clockOffsetMs:** Current offset applied to local time to get synchronized time.
- **lastSyncSource:** Name of the data source used in the last successful sync.
- **tickTimer:** Handle for the per-second UI update timer.
- **statusToken:** Internal token to manage clearing of transient status messages.

## Data Sources Structure

A source object has:
- **name:** Display name.
- **url:** Fetch URL.
- **parse(text):** Function to parse the response text and return server timestamp (ms).
