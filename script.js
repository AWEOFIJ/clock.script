// Store previous values to detect changes
let previousHours = '';
let previousMinutes = '';
let previousSeconds = '';

// Track animation start times
let hoursFlipStart = null;
let minutesFlipStart = null;
let secondsFlipStart = null;

// Synchronized Web Clock
// Uses HTTP time APIs (no direct NTP in browsers). Attempts timeapi.io, falls back to WorldTimeAPI.

const SOURCES = {
    timeapi: {
        name: "timeapi.io (UTC)",
        url: "https://timeapi.io/api/Time/current/zone?timeZone=UTC",
        parse: (text) => {
            const json = JSON.parse(text);
            // returns: { dateTime: "2025-12-15T12:34:56.789Z", ... }
            return Date.parse(json.dateTime);
        },
    },
    worldtime: {
        name: "worldtimeapi.org (UTC)",
        url: "https://worldtimeapi.org/api/timezone/Etc/UTC",
        parse: (text) => {
            const json = JSON.parse(text);
            if (json.unixtime) return json.unixtime * 1000;
            return Date.parse(json.datetime);
        },
    },
    worldtime_ip: {
        name: "worldtimeapi.org (IP)",
        url: "https://worldtimeapi.org/api/ip",
        parse: (text) => {
            const json = JSON.parse(text);
            if (json.unixtime) return json.unixtime * 1000;
            return Date.parse(json.datetime);
        },
    },
};

let clockOffsetMs = 0; // serverTime - localTime
let lastSyncSource = null;
let tickTimer = null; // handle for per-second ticking
let statusToken = 0; // to manage transient status messages

// Lightweight helper: compute synced ms from a provided local ms
function syncedMsFromLocal(localMs) {
    return localMs + clockOffsetMs;
}

async function fetchWithRtt(source) {
    const start = performance.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(source.url, { cache: "no-store", signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) {
        throw new Error(`HTTP ${res.status} from ${source.name}`);
    }
    const text = await res.text();
    const end = performance.now();
    const rtt = end - start;
    // Approximate network delay half-RTT
    const serverMs = source.parse(text);
    const estimatedServerAtReceive = serverMs + rtt / 2;
    return { serverMs: estimatedServerAtReceive, rtt, clientReceiveMs: Date.now() };
}

// Basic retry wrapper with exponential backoff
async function tryFetchWithRetry(source, retries = 2, delayMs = 400) {
    try {
        return await fetchWithRtt(source);
    } catch (err) {
        if (retries > 0) {
            await new Promise(r => setTimeout(r, delayMs));
            return tryFetchWithRetry(source, retries - 1, delayMs * 2);
        }
        throw err;
    }
}

// Measure offset with multiple samples and median to reduce jitter
async function measureOffset(source, attempts = 5) {
    const samples = [];
    let lastErr = null;
    for (let i = 0; i < attempts; i++) {
        try {
            const { serverMs, rtt, clientReceiveMs } = await tryFetchWithRetry(source, 2, 300);
            // Offset calculation: server time at our receive minus our local receive
            const offset = serverMs - clientReceiveMs;
            samples.push({ offset, rtt });
            console.log(offset, rtt);
        } catch (err) {
            lastErr = err;
            console.log(lastErr);
        }
        await new Promise(r => setTimeout(r, 50));
    }
    if (samples.length === 0) {
        throw lastErr || new Error(`No successful samples for ${source.name}`);
    }
    samples.sort((a, b) => a.offset - b.offset);
    const median = samples[Math.floor(samples.length / 2)];
    const avgRtt = samples.reduce((s, x) => s + x.rtt, 0) / samples.length;
    return { offset: median.offset, rtt: avgRtt };
}

async function syncTime() {
    updateStatus("Syncing…");
    try {
        const primary = await measureOffset(SOURCES.timeapi, 5);
        const previousOffset = clockOffsetMs;
        // Bound sudden offset changes to avoid visible jumps unless very large
        const maxStepMs = 500; // allow up to 500ms correction per sync
        const delta = primary.offset - previousOffset;
        if (Math.abs(delta) > maxStepMs) {
            clockOffsetMs = previousOffset + Math.sign(delta) * maxStepMs;
        } else {
            clockOffsetMs = primary.offset;
        }
        lastSyncSource = SOURCES.timeapi.name;
        const t = new Date(syncedMsFromLocal(Date.now()));
        const pad = (n) => String(n).padStart(2, "0");
        const ts = `${pad(t.getHours())}:${pad(t.getMinutes())}:${pad(t.getSeconds())}`;
        updateStatus(`Synced with ${lastSyncSource} at ${ts} (RTT ${primary.rtt.toFixed(0)} ms)`, 4000);
    } catch (e1) {
        try {
            console.log("Primary time sync failed, falling back to secondary source:", e1);
            const fallback = await measureOffset(SOURCES.worldtime, 5);
            // console.log("Fallback sync result:", fallback);
            const previousOffset = clockOffsetMs;
            const maxStepMs = 500;
            const delta = fallback.offset - previousOffset;
            if (Math.abs(delta) > maxStepMs) {
                clockOffsetMs = previousOffset + Math.sign(delta) * maxStepMs;
            } else {
                clockOffsetMs = fallback.offset;
            }
            lastSyncSource = SOURCES.worldtime.name;
            const t = new Date(syncedMsFromLocal(Date.now()));
            const pad = (n) => String(n).padStart(2, "0");
            const ts = `${pad(t.getHours())}:${pad(t.getMinutes())}:${pad(t.getSeconds())}`;
            updateStatus(`Synced with ${lastSyncSource} at ${ts} (RTT ${fallback.rtt.toFixed(0)} ms)`, 4000);
        } catch (e2) {
            try {
                console.log("Secondary source failed, trying IP-based endpoint:", e2);
                const fallback2 = await measureOffset(SOURCES.worldtime_ip, 5);
                // console.log("IP fallback sync result:", fallback2);
                const previousOffset = clockOffsetMs;
                const maxStepMs = 500;
                const delta = fallback2.offset - previousOffset;
                if (Math.abs(delta) > maxStepMs) {
                    clockOffsetMs = previousOffset + Math.sign(delta) * maxStepMs;
                } else {
                    clockOffsetMs = fallback2.offset;
                }
                lastSyncSource = SOURCES.worldtime_ip.name;
                const t = new Date(syncedMsFromLocal(Date.now()));
                const pad = (n) => String(n).padStart(2, "0");
                const ts = `${pad(t.getHours())}:${pad(t.getMinutes())}:${pad(t.getSeconds())}`;
                updateStatus(`Synced with ${lastSyncSource} at ${ts} (RTT ${fallback2.rtt.toFixed(0)} ms)`, 4000);
            } catch (e3) {
                console.log("All time sources failed:", e3);
                updateStatus("Sync failed; using local system time", 5000);
                clockOffsetMs = 0;
                lastSyncSource = "local";
            }
        }
    }
}

// getSyncedNow kept for infrequent use; avoid calling it in tight loops
function getSyncedNow() {
    return syncedMsFromLocal(Date.now());
}

function formatTime(ms) {
    const d = new Date(ms);
    const pad = (n) => String(n).padStart(2, "0");
    const y = d.getFullYear();
    const mon = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const h = pad(d.getHours());
    const m = pad(d.getMinutes());
    const s = pad(d.getSeconds());
    const tz = (Intl.DateTimeFormat().resolvedOptions().timeZone) || "Local";
    return `${y}-${mon}-${day} ${h}:${m}:${s} ${tz}`;
}

function updateStatus(msg, ttlMs) {
    const el = document.getElementById("sync-status");
    if (!el) return;
    el.textContent = msg;
}
function renderClock() {
    const el = document.getElementById("clock");
    if (!el) return;
    const ms = syncedMsFromLocal(Date.now());
    el.textContent = formatTime(ms);
    const localEl = document.getElementById("clock-local");
    if (localEl) {
        const d = new Date(ms);
        const pad = (n) => String(n).padStart(2, "0");
        const y = d.getFullYear();
        const mon = pad(d.getMonth() + 1);
        const day = pad(d.getDate());
        const h = pad(d.getHours());
        const m = pad(d.getMinutes());
        const s = pad(d.getSeconds());
        const tzName = Intl.DateTimeFormat().resolvedOptions().timeZone;
        localEl.textContent = `${y}-${mon}-${day} ${h}:${m}:${s} ${tzName}`;
    }
}

const HOUR_MS = 60 * 60 * 1000;

async function startClock() {
    await syncTime();
    renderClock();
    // Align resync to the top of each hour
    function scheduleHourlyResync() {
        const nowSynced = syncedMsFromLocal(Date.now());
        const d = new Date(nowSynced);
        d.setMinutes(0, 0, 0); // top of current hour
        const nextTopOfHour = d.getTime() + HOUR_MS;
        const delay = Math.max(1000, nextTopOfHour - nowSynced); // minimum 1s
        setTimeout(async () => {
            await syncTime();
            renderClock();
            scheduleHourlyResync();
        }, delay);
    }
    scheduleHourlyResync();
}

document.addEventListener("DOMContentLoaded", startClock);

// Theme toggle
function applyTheme(theme) {
    const root = document.documentElement;
    if (theme === "dark") {
        root.classList.add("theme-dark");
        root.classList.remove("theme-light");
    } else {
        root.classList.add("theme-light");
        root.classList.remove("theme-dark");
    }
}


function initTheme() {
    // No cached theme persistence; rely on current document classes or system preference
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    // Optionally set initial theme without storing it
    applyTheme(prefersDark ? "dark" : "light");
    const btn = document.getElementById("theme-toggle");
    if (btn) {
        btn.addEventListener("click", () => {
            const current = document.documentElement.classList.contains("theme-dark") ? "dark" : "light";
            applyTheme(current === "dark" ? "light" : "dark");
        });
    }
    const syncBtn = document.getElementById("sync-now");
    if (syncBtn) {
        syncBtn.addEventListener("click", async () => {
            await syncTime();
            renderClock();
        });
    }
}

document.addEventListener("DOMContentLoaded", initTheme);
const ANIMATION_DURATION = 600; // milliseconds

function updateClock() {
    const now = new Date(syncedMsFromLocal(Date.now()));
    const currentTime = now.getTime();

    // Get date components
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];

    const dayName = days[now.getDay()];
    const monthName = months[now.getMonth()];
    const day = now.getDate();
    const year = now.getFullYear();

    // Format date
    const dateString = `${dayName}, ${monthName} ${day}, ${year}`;

    // Get time components
    let hours = now.getHours();
    let minutes = now.getMinutes();
    let seconds = now.getSeconds();

    // Format with leading zeros
    hours = hours.toString().padStart(2, '0');
    minutes = minutes.toString().padStart(2, '0');
    seconds = seconds.toString().padStart(2, '0');

    // Update date if present
    const dateEl = document.getElementById('date');
    if (dateEl) dateEl.textContent = dateString;

    // Flip cards (guard when elements are not present)
    const hoursCard = document.getElementById('hours-card');
    const minutesCard = document.getElementById('minutes-card');
    const secondsCard = document.getElementById('seconds-card');
    if (!hoursCard || !minutesCard || !secondsCard) {
        return; // No flip UI available; text clock still updates elsewhere
    }
    const hoursFront = hoursCard.querySelector('.card-front');
    const hoursBack = hoursCard.querySelector('.card-back');

    if (hoursFlipStart !== null && currentTime - hoursFlipStart >= ANIMATION_DURATION) {
        hoursFront.textContent = hoursBack.textContent;
        // Reset without animation by temporarily disabling transition
        hoursCard.style.transition = 'none';
        hoursCard.classList.remove('flip');
        // Force reflow to apply the change
        void hoursCard.offsetWidth;
        // Re-enable transition
        hoursCard.style.transition = '';
        hoursFlipStart = null;
    }

    // Update hours with flip animation
    if (hours !== previousHours && hoursFlipStart === null) {
        // Only start new animation if previous one is complete
        // Update back face with new value
        hoursBack.textContent = hours;

        // Trigger flip animation
        hoursCard.classList.add('flip');
        hoursFlipStart = currentTime;

        previousHours = hours;
    } else if (hours !== previousHours) {
        // If animation is in progress, just update the back face value
        hoursBack.textContent = hours;
        previousHours = hours;
    }

    // Check and reset minutes animation if needed
    const minutesFront = minutesCard.querySelector('.card-front');
    const minutesBack = minutesCard.querySelector('.card-back');

    if (minutesFlipStart !== null && currentTime - minutesFlipStart >= ANIMATION_DURATION) {
        minutesFront.textContent = minutesBack.textContent;
        // Reset without animation by temporarily disabling transition
        minutesCard.style.transition = 'none';
        minutesCard.classList.remove('flip');
        // Force reflow to apply the change
        void minutesCard.offsetWidth;
        // Re-enable transition
        minutesCard.style.transition = '';
        minutesFlipStart = null;
    }

    // Update minutes with flip animation
    if (minutes !== previousMinutes && minutesFlipStart === null) {
        // Only start new animation if previous one is complete
        // Update back face with new value
        minutesBack.textContent = minutes;

        // Trigger flip animation
        minutesCard.classList.add('flip');
        minutesFlipStart = currentTime;

        previousMinutes = minutes;
    } else if (minutes !== previousMinutes) {
        // If animation is in progress, just update the back face value
        minutesBack.textContent = minutes;
        previousMinutes = minutes;
    }

    // Check and reset seconds animation if needed
    const secondsFront = secondsCard.querySelector('.card-front');
    const secondsBack = secondsCard.querySelector('.card-back');

    if (secondsFlipStart !== null && currentTime - secondsFlipStart >= ANIMATION_DURATION) {
        secondsFront.textContent = secondsBack.textContent;
        // Reset without animation by temporarily disabling transition
        secondsCard.style.transition = 'none';
        secondsCard.classList.remove('flip');
        // Force reflow to apply the change
        void secondsCard.offsetWidth;
        // Re-enable transition
        secondsCard.style.transition = '';
        secondsFlipStart = null;
    }

    // Update seconds with flip animation
    if (seconds !== previousSeconds && secondsFlipStart === null) {
        // Only start new animation if previous one is complete
        // Update back face with new value
        secondsBack.textContent = seconds;

        // Trigger flip animation
        secondsCard.classList.add('flip');
        secondsFlipStart = currentTime;

        previousSeconds = seconds;
    } else if (seconds !== previousSeconds) {
        // If animation is in progress, just update the back face value
        secondsBack.textContent = seconds;
        previousSeconds = seconds;
    }
}

// Update clock aligned to whole seconds to avoid drift
// Update display and flip clock aligned to whole seconds using synced time
function scheduleNextTick() {
    const nowLocal = Date.now();
    const nowSynced = syncedMsFromLocal(nowLocal);
    const remainder = Math.floor(nowSynced) % 1000;
    const msToNextSecond = remainder === 0 ? 1000 : 1000 - remainder;
    tickTimer = setTimeout(() => {
        updateClock();
        renderClock();
        scheduleNextTick();
    }, msToNextSecond);
}

function stopTicking() {
    if (tickTimer) {
        clearTimeout(tickTimer);
        tickTimer = null;
    }
}

function startTicking() {
    if (tickTimer == null) {
        scheduleNextTick();
    }
}

// Pause UI updates in background to save CPU, resume on focus
document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
        stopTicking();
    } else {
        updateClock();
        renderClock();
        startTicking();
    }
});

// Initial update and schedule
updateClock();
scheduleNextTick();