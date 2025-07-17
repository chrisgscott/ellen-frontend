/**
 * Generate time-based greetings based on browser local time
 */
export function getTimeBasedGreeting(firstName?: string | null): string {
  // If no real name, just use simple greeting
  if (!firstName) {
    return 'Hello, there!';
  }

  const now = new Date();
  const hour = now.getHours();
  const name = firstName;

  // Late night (11 PM - 4 AM)
  if (hour >= 23 || hour < 4) {
    const lateNightGreetings = [
      `You're up late, ${name}!`,
      `Burning the midnight oil, ${name}?`,
      `Late night session, ${name}?`,
      `Still going strong, ${name}!`
    ];
    return lateNightGreetings[Math.floor(Math.random() * lateNightGreetings.length)];
  }

  // Early morning (4 AM - 6 AM)
  if (hour >= 4 && hour < 6) {
    const earlyGreetings = [
      `Early bird, ${name}!`,
      `Up with the sun, ${name}?`,
      `Starting early today, ${name}!`
    ];
    return earlyGreetings[Math.floor(Math.random() * earlyGreetings.length)];
  }

  // Morning (6 AM - 12 PM)
  if (hour >= 6 && hour < 12) {
    const morningGreetings = [
      `Good morning, ${name}!`,
      `Morning, ${name}!`,
      `Ready to tackle the day, ${name}?`,
      `What's on the agenda today, ${name}?`
    ];
    return morningGreetings[Math.floor(Math.random() * morningGreetings.length)];
  }

  // Afternoon (12 PM - 5 PM)
  if (hour >= 12 && hour < 17) {
    const afternoonGreetings = [
      `Good afternoon, ${name}!`,
      `What are we working on this afternoon, ${name}?`,
      `Hope your day is going well, ${name}!`,
      `Afternoon, ${name}!`,
      `How's the day treating you, ${name}?`
    ];
    return afternoonGreetings[Math.floor(Math.random() * afternoonGreetings.length)];
  }

  // Evening (5 PM - 11 PM)
  if (hour >= 17 && hour < 23) {
    const eveningGreetings = [
      `Good evening, ${name}!`,
      `Evening, ${name}!`,
      `Wrapping up the day, ${name}?`,
      `How did today go, ${name}?`,
      `Evening session, ${name}?`
    ];
    return eveningGreetings[Math.floor(Math.random() * eveningGreetings.length)];
  }

  // Fallback (shouldn't reach here)
  return `Hello, ${name}!`;
}
