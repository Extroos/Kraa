/**
 * STRICT GRAMMAR VERSION: Arabic Utility for Moroccan Dirhams (MAD)
 * Defaults to Nominative Case (المرفوع) for standalone reading.
 */

const units = ["", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة"];
const tens = ["", "عشرة", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"];
const teens = [
  "عشرة",
  "أحد عشر",
  "اثنا عشر", // Fixed to Nominative case
  "ثلاثة عشر",
  "أربعة عشر",
  "خمسة عشر",
  "ستة عشر",
  "سبعة عشر",
  "ثمانية عشر",
  "تسعة عشر"
];
const hundreds = ["", "مائة", "مائتان", "ثلاثمائة", "أربعمائة", "خمسمائة", "ستمائة", "سبعمائة", "ثمانمائة", "تسعمائة"];

export const numberToArabicWords = (num: number): string => {
  if (num === 0) return "صفر درهم";
  if (num === 1) return "درهم واحد";
  if (num === 2) return "درهمان";

  const parts: string[] = [];
  let remaining = num;

  // Millions
  if (remaining >= 1_000_000) {
    const m = Math.floor(remaining / 1_000_000);
    if (m === 1) parts.push("مليون");
    else if (m === 2) parts.push("مليونان");
    else {
      const mMod100 = m % 100;
      if (mMod100 >= 3 && mMod100 <= 10) parts.push(convertValue(m) + " ملايين");
      else if (mMod100 >= 11 && mMod100 <= 99) parts.push(convertValue(m) + " مليونًا"); // Accusative fix
      else parts.push(convertValue(m) + " مليونٍ");
    }
    remaining %= 1_000_000;
  }

  // Thousands
  if (remaining >= 1000) {
    const t = Math.floor(remaining / 1000);
    if (t === 1) parts.push("ألف");
    else if (t === 2) parts.push("ألفان");
    else {
      const tMod100 = t % 100;
      if (tMod100 >= 3 && tMod100 <= 10) parts.push(convertValue(t) + " آلاف");
      else if (tMod100 >= 11 && tMod100 <= 99) parts.push(convertValue(t) + " ألفًا"); // Accusative fix
      else parts.push(convertValue(t) + " ألفٍ");
    }
    remaining %= 1000;
  }

  // Exact Millions/Thousands ending (e.g., 1000, 1000000)
  if (remaining === 0) {
    return parts.join(" و") + " درهمٍ";
  }

  // Hundreds & Below
  const hundredsPart = Math.floor(remaining / 100) * 100;
  const lastTwo = remaining % 100;

  if (hundredsPart > 0) {
    parts.push(convertValue(hundredsPart));
  }

  // Handle compound 1 and 2 natively replacing the number with the noun
  if (lastTwo === 1) {
    parts.push("درهم واحد");
    return parts.join(" و"); // e.g., "مائة ودرهم واحد"
  } else if (lastTwo === 2) {
    parts.push("درهمان");
    return parts.join(" و"); // e.g., "ألف ودرهمان"
  } else if (lastTwo > 0) {
    parts.push(convertValue(lastTwo));
  }

  const resultStr = parts.join(" و");

  // Final Tamyeez (Suffix) Rules based ONLY on the last two digits
  if (lastTwo >= 3 && lastTwo <= 10) {
    return resultStr + " دراهم";
  } else if (lastTwo >= 11 && lastTwo <= 99) {
    return resultStr + " درهمًا";
  } else {
    // Ends in exactly 00 (e.g., 100, 300)
    return resultStr + " درهمٍ";
  }
};

const convertValue = (n: number): string => {
  let str = "";

  if (n >= 100) {
    str += hundreds[Math.floor(n / 100)];
    n %= 100;
    if (n > 0) str += " و";
  }

  if (n >= 20) {
    const u = n % 10;
    const t = Math.floor(n / 10);

    // Removed the unitsAcc logic to ensure nominative case consistency
    if (u > 0) {
      str += units[u] + " و" + tens[t];
    } else {
      str += tens[t];
    }
  } else if (n >= 10) {
    str += teens[n - 10];
  } else if (n > 0) {
    str += units[n];
  }

  return str;
};