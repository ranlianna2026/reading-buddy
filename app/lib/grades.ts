export type Grade = { id: string; label: string; short: string; age: number; level: number; wcpm: number };

// Spring words-correct-per-minute at the 50th percentile (Hasbrouck & Tindal oral reading fluency norms).
export const GRADES: Grade[] = [
  { id: "prek", label: "Pre-K", short: "Pre-K", age: 4, level: 1, wcpm: 12 },
  { id: "k", label: "Kindergarten", short: "K", age: 5, level: 1, wcpm: 30 },
  { id: "1", label: "1st grade", short: "1st", age: 6, level: 1, wcpm: 60 },
  { id: "2", label: "2nd grade", short: "2nd", age: 7, level: 2, wcpm: 100 },
  { id: "3", label: "3rd grade", short: "3rd", age: 8, level: 3, wcpm: 112 },
  { id: "4", label: "4th grade", short: "4th", age: 9, level: 4, wcpm: 133 },
  { id: "5", label: "5th grade", short: "5th", age: 10, level: 5, wcpm: 146 },
  { id: "6", label: "6th grade", short: "6th", age: 11, level: 5, wcpm: 150 },
];

export const gradeOf = (id?: string | null) => GRADES.find((one) => one.id === id) ?? GRADES[3];

export const gradeForAge = (age?: number | null) =>
  age ? (GRADES.find((one) => one.age >= age) ?? GRADES[GRADES.length - 1]) : GRADES[3];

export const SPAN = "Pre-K to 6th grade";
