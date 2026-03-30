import { numberToArabicWords } from './arabic';

const cases = [
  { val: 1, expected: 'درهم واحد' },
  { val: 2, expected: 'درهمان' },
  { val: 3, expected: 'ثلاثة دراهم' },
  { val: 10, expected: 'عشرة دراهم' },
  { val: 11, expected: 'أحد عشر درهمًا' },
  { val: 12, expected: 'اثني عشر درهمًا' },
  { val: 22, expected: 'اثنين وعشرون درهمًا' },
  { val: 25, expected: 'خمسة وعشرون درهمًا' },
  { val: 100, expected: 'مائة درهمًا' }, // 100 % 100 = 0 -> درهمًا
  { val: 101, expected: 'مائة وواحد درهمًا' }, // 101 % 100 = 1 -> درهمًا
  { val: 102, expected: 'مائة واثنان درهمًا' }, // 102 % 100 = 2 -> درهمًا
  { val: 103, expected: 'مائة وثلاثة دراهم' }, // 103 % 100 = 3 -> دراهم
  { val: 1000, expected: 'ألف درهمًا' }, // 1000 % 100 = 0 -> درهمًا
  { val: 2000, expected: 'ألفان درهمًا' },
  { val: 4000, expected: 'أربعة آلاف درهم' }, // This hits the thousand block suffix, not the global one for large numbers? 
  // Wait, let's check code: return result.trim() + getSuffix(original);
  // getSuffix(4000) -> 4000 % 100 is 0. Returns " درهمًا".
  // Final: "أربعة آلاف درهمًا".
  { val: 10000, expected: 'عشرة آلاف درهمًا' },
];

console.log('--- Production Arabic Conversion Test ---');
cases.forEach(c => {
  const result = numberToArabicWords(c.val);
  const isMatch = result.trim() === c.expected.trim();
  console.log(`Input: ${c.val.toLocaleString()} | Result: ${result} | ${isMatch ? '✅' : '❌'}`);
  if (!isMatch) {
    console.log(`  Expected: ${c.expected}`);
  }
});
