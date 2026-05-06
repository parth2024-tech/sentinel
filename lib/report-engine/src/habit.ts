/**
 * HabitQuestion represents an individual survey question evaluating a device usage practice.
 */
export interface HabitQuestion {
  /** The unique identifier matching telemetry calculations. */
  id: string;
  /** The question text prompted in the user interface. */
  text: string;
  /** Selection choices containing the UI label and corresponding weight score (out of 10). */
  options: { label: string; value: number }[];
}

export const HABIT_QUESTIONS: HabitQuestion[] = [
  { id: "surface", text: "Where do you usually use your laptop?",
    options: [
      { label: "Hard, flat surface (desk, table)", value: 10 },
      { label: "Lap or soft surface (bed, sofa)", value: 3 },
      { label: "Mix of both", value: 6 },
    ] },
  { id: "charging", text: "How do you typically charge?",
    options: [
      { label: "Plug in when low, unplug when full", value: 10 },
      { label: "Leave plugged in most of the time", value: 5 },
      { label: "Let it drain to near-zero regularly", value: 2 },
    ] },
  { id: "shutdown", text: "How often do you restart or shut down?",
    options: [
      { label: "Daily or every few days", value: 10 },
      { label: "Weekly", value: 7 },
      { label: "Rarely — mostly sleep/hibernate", value: 4 },
    ] },
  { id: "cleaning", text: "How often do you clean vents / keyboard?",
    options: [
      { label: "Every few months", value: 10 },
      { label: "Once a year", value: 6 },
      { label: "Never", value: 2 },
    ] },
  { id: "storage_habit", text: "How do you manage storage?",
    options: [
      { label: "Keep at least 15–20% free", value: 10 },
      { label: "Clear it when I notice it's getting full", value: 5 },
      { label: "It's usually close to full", value: 1 },
    ] },
  { id: "updates", text: "How do you handle Windows / driver updates?",
    options: [
      { label: "Install promptly", value: 10 },
      { label: "Delay but eventually install", value: 6 },
      { label: "Dismiss or ignore", value: 2 },
    ] },
  { id: "heat", text: "Does your laptop feel hot during normal use?",
    options: [
      { label: "Rarely or never", value: 10 },
      { label: "Sometimes", value: 5 },
      { label: "Often or always", value: 1 },
    ] },
  { id: "backup", text: "How often do you back up important files?",
    options: [
      { label: "Automatic / continuous", value: 10 },
      { label: "Manually every month or so", value: 5 },
      { label: "Rarely or never", value: 1 },
    ] },
];

/**
 * HabitAnswers represents a dictionary key-value mapping of Question ID to user choice score value.
 */
export type HabitAnswers = Record<string, number>;

/**
 * Computes an aggregated normalized habit score (0-100) from user answers.
 * Sums the points assigned to chosen options and compares against maximum possible score.
 * 
 * @param answers The answered questionnaire mapped by Question ID.
 * @returns A rounded integer score out of 100.
 */
export function computeHabitScore(answers: HabitAnswers): number {
  const total = HABIT_QUESTIONS.reduce((sum, q) => {
    const val = answers[q.id];
    return sum + (typeof val === "number" ? val : 0);
  }, 0);
  const maxPossible = HABIT_QUESTIONS.length * 10;
  return Math.round((total / maxPossible) * 100);
}
