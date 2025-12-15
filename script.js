// Store previous values to detect changes
let previousHours = '';
let previousMinutes = '';
let previousSeconds = '';

// Track animation start times
let hoursFlipStart = null;
let minutesFlipStart = null;
let secondsFlipStart = null;

// Synchronized Web Clock
// Attempts to sync time from NIST (time.gov). Falls back to WorldTimeAPI.

const SOURCES = {
    nist: {
        name: "time.nist.gov",
        // NIST time.gov endpoint returns XML like: <timestamp time="1734231234567"/>
        url: "https://time.gov/actualtime.cgi?lz=0&fmt=json",
        parse: (text) => {
            // time.gov returns something like: { "st": "1734228000000" }
            try {
                const json = JSON.parse(text);
                const ms = Number(json.st);
                if (!Number.isFinite(ms)) throw new Error("Invalid NIST time");
                return ms;
            } catch (e) {
                // Older format: <timestamp time="..."/>
                const match = text.match(/time\s*=\s*"(\d+)"/);
                if (match) return Number(match[1]);
                throw e;
            }
        },
    },
    windowsFallback: {
        name: "worldtimeapi.org (UTC)",
        url: "https://worldtimeapi.org/api/timezone/Etc/UTC",
        parse: (text) => {
            const json = JSON.parse(text);
            // datetime ISO string, also 'unixtime' seconds
            if (json.unixtime) return json.unixtime * 1000;
            return Date.parse(json.datetime);
        },
    },
};

let clockOffsetMs = 0; // serverTime - localTime
let lastSyncSource = null;

async function fetchWithRtt(source) {
    const start = performance.now();
    const res = await fetch(source.url, { cache: "no-store" });
    const text = await res.text();
    const end = performance.now();
    const rtt = end - start;
    // Approximate network delay half-RTT
    const serverMs = source.parse(text);
    const estimatedServerAtReceive = serverMs + rtt / 2;
    return { serverMs: estimatedServerAtReceive, rtt };
}

async function syncTime() {
    try {
        const nist = await fetchWithRtt(SOURCES.nist);
        const local = Date.now();
        clockOffsetMs = nist.serverMs - local;
        lastSyncSource = SOURCES.nist.name;
        updateStatus(`Synced with ${lastSyncSource} (RTT ${nist.rtt.toFixed(0)} ms)`);
    } catch (e1) {
        try {
            const win = await fetchWithRtt(SOURCES.windowsFallback);
            const local = Date.now();
            clockOffsetMs = win.serverMs - local;
            lastSyncSource = SOURCES.windowsFallback.name;
            updateStatus(`Synced with ${lastSyncSource} (RTT ${win.rtt.toFixed(0)} ms)`);
        } catch (e2) {
            updateStatus("Sync failed; using local system time");
            clockOffsetMs = 0;
            lastSyncSource = "local";
        }
    }
}

function getSyncedNow() {
    return Date.now() + clockOffsetMs;
}

function formatTime(ms) {
    const d = new Date(ms);
    const pad = (n) => String(n).padStart(2, "0");
    const y = d.getUTCFullYear();
    const mon = pad(d.getUTCMonth() + 1);
    const day = pad(d.getUTCDate());
    const h = pad(d.getUTCHours());
    const m = pad(d.getUTCMinutes());
    const s = pad(d.getUTCSeconds());
    const tz = "UTC";
    return `${y}-${mon}-${day} ${h}:${m}:${s} ${tz}`;
}

function updateStatus(msg) {
    const el = document.getElementById("sync-status");
    if (el) el.textContent = msg;
}

function renderClock() {
    const el = document.getElementById("clock");
    if (!el) return;
    const ms = getSyncedNow();
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

async function startClock() {
    await syncTime();
    renderClock();
    // Update display every 250ms for smoothness
    setInterval(renderClock, 250);
    // Resync every 1 hour to reduce drift
    setInterval(syncTime, 60 * 60 * 1000);
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
    try { localStorage.setItem("clock-theme", theme); } catch {}
}

function initTheme() {
    let saved = null;
    try { saved = localStorage.getItem("clock-theme"); } catch {}
    if (!saved) {
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        saved = prefersDark ? "dark" : "light";
    }
    applyTheme(saved);
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
    const now = new Date();
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
    
    // Update date
    document.getElementById('date').textContent = dateString;
    
    // Check and reset hours animation if needed
    const hoursCard = document.getElementById('hours-card');
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
    const minutesCard = document.getElementById('minutes-card');
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
    const secondsCard = document.getElementById('seconds-card');
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

// Update clock immediately
updateClock();

// Update clock every 200 milliseconds
setInterval(updateClock, 100);

