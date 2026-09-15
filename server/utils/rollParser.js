// server/utils/rollParser.js
// Parses admission year and computes academic year from Thapar roll numbers
// Example: 1024160097 -> '24' denotes admission in 2024. In 2026-27 session, student is in 3rd Year.

export function parseRollNumber(rollNumber, currentSessionYear = 2026) {
  if (!rollNumber) return { valid: false, academicYear: 3, admissionYear: 2024 };

  const cleanRoll = rollNumber.toString().trim();
  let admissionYear = null;

  // Format 1: 10-digit roll number like 1024160097
  // Digits at index 2 and 3 represent admission year (e.g. '24' -> 2024)
  if (/^\d{10}$/.test(cleanRoll)) {
    const yearDigits = parseInt(cleanRoll.substring(2, 4), 10);
    admissionYear = 2000 + yearDigits;
  }
  // Format 2: Alphanumeric like 24CS001 or 23CS001
  else if (/^(\d{2})[A-Za-z]+/.test(cleanRoll)) {
    const match = cleanRoll.match(/^(\d{2})/);
    if (match) {
      admissionYear = 2000 + parseInt(match[1], 10);
    }
  }

  if (!admissionYear || isNaN(admissionYear)) {
    return { valid: false, academicYear: 3, admissionYear: 2024 };
  }

  // Academic Year calculation:
  // E.g. admitted in 2024, current year 2026 -> 2026 - 2024 + 1 = 3rd Year
  const academicYear = Math.max(1, Math.min(5, currentSessionYear - admissionYear + 1));

  return {
    valid: true,
    admissionYear,
    academicYear,
    isFirstYear: academicYear === 1
  };
}
