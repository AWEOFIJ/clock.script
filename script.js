// Store previous values to detect changes
let previousHours = '';
let previousMinutes = '';
let previousSeconds = '';

// Track animation start times
let hoursFlipStart = null;
let minutesFlipStart = null;
let secondsFlipStart = null;

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

