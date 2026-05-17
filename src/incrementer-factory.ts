import type { Incrementer } from "./incrementer";

/**
 * Creates incrementers for numbers, characters, and fallback values.
 */
export default class IncrementerFactory {
  /**
   * Creates a numeric incrementer.
   * Supports patterns like `1`, `1_`, `[1]`, and `01`.
   */
  static createNumericIncrementer(source: string): Incrementer | undefined {
    const match = /^(.*?)(\d+)(.*)$/u.exec(source);
    if (!match) {
      return undefined;
    }

    const [, prefix, digits, suffix] = match;
    const start = Number.parseInt(digits, 10);
    const width = digits.length;
    const padded = digits.startsWith("0") && width > 1;

    return (index: number) => {
      const value = String(start + index);
      const formatted = padded ? value.padStart(width, "0") : value;
      return `${prefix}${formatted}${suffix}`;
    };
  }

  /**
   * Creates an incrementer for prefixed radix numbers.
   * Supports patterns like `0b01`, `0o07`, `0x0f`, and `0x0F`.
   */
  static createPrefixedRadixIncrementer(source: string): Incrementer | undefined {
    const match = /^(.*?)(0[bB][01]+|0[oO][0-7]+|0[xX][0-9a-fA-F]+)(.*)$/u.exec(source);
    if (!match) {
      return undefined;
    }

    const [, prefix, prefixedDigits, suffix] = match;
    const numberPrefix = prefixedDigits.slice(0, 2);
    const digits = prefixedDigits.slice(2);
    const lowerPrefix = numberPrefix.toLowerCase();
    let radix: number;
    if (lowerPrefix === "0b") {
      radix = 2;
    } else if (lowerPrefix === "0o") {
      radix = 8;
    } else if (lowerPrefix === "0x") {
      radix = 16;
    } else {
      return undefined;
    }
    const width = digits.length;
    const padded = digits.startsWith("0") && width > 1;
    const start = Number.parseInt(digits, radix);
    const isUpperCase = radix === 16 && (numberPrefix === "0X" || /[A-F]/u.test(digits));

    return (index: number) => {
      const rawValue = (start + index).toString(radix);
      const value = isUpperCase ? rawValue.toUpperCase() : rawValue;
      const formatted = padded ? value.padStart(width, "0") : value;
      return `${prefix}${numberPrefix}${formatted}${suffix}`;
    };
  }

  /**
   * Creates a space-padded numeric incrementer.
   * Supports patterns like ` 8` and `[ 8]`.
   */
  static createSpacePaddedNumericIncrementer(source: string): Incrementer | undefined {
    const match = /^(.*?)( +)(\d+)(.*)$/u.exec(source);
    if (!match) {
      return undefined;
    }

    const [, prefix, padding, digits, suffix] = match;
    if (/\d/u.test(prefix)) {
      return undefined;
    }

    const start = Number.parseInt(digits, 10);
    const width = padding.length + digits.length;

    return (index: number) => {
      const formatted = String(start + index).padStart(width, " ");
      return `${prefix}${formatted}${suffix}`;
    };
  }

  /**
   * Creates a non-ASCII decimal digit incrementer.
   * Supports Arabic-Indic, Extended Arabic-Indic, Devanagari, and Bengali digits.
   */
  static createNonAsciiDecimalIncrementer(source: string): Incrementer | undefined {
    const nonAsciiDigitCharSets = [
      "０１２３４５６７８９",
      "٠١٢٣٤٥٦٧٨٩",
      "۰۱۲۳۴۵۶۷۸۹",
      "०१२३४५६७८९",
      "০১২৩৪৫৬৭৮৯"
    ];

    let sourceOffset = 0;
    for (const char of [...source]) {

      for (const nonAsciiDigitCharSet of nonAsciiDigitCharSets) {
        if (!nonAsciiDigitCharSet.includes(char)) {
          continue;
        }

        let joinedNonAsciiDigitChars = "";
        for (const nonAsciiDigitChar of [...source.slice(sourceOffset)]) {
          if (!nonAsciiDigitCharSet.includes(nonAsciiDigitChar)) {
            break;
          }
          joinedNonAsciiDigitChars += nonAsciiDigitChar;
        }

        const prefix = source.slice(0, sourceOffset);
        const suffix = source.slice(sourceOffset + joinedNonAsciiDigitChars.length);
        const nonAsciiMembers = [...nonAsciiDigitCharSet];
        const rawDigits = [...joinedNonAsciiDigitChars].map(c => String(nonAsciiMembers.indexOf(c))).join("");
        const start = Number.parseInt(rawDigits, 10);
        const width = rawDigits.length;
        const padded = rawDigits.startsWith("0") && width > 1;

        return (index: number) => {
          const value = String(start + index);
          const formatted = padded ? value.padStart(width, "0") : value;
          const nonAscii = formatted.replace(/\d/g, digit => nonAsciiMembers[Number(digit)]);
          return `${prefix}${nonAscii}${suffix}`;
        };
      }

      sourceOffset += char.length;
    }

    return undefined;
  }

  /**
   * Creates a Chinese numeric incrementer.
   * Supports numbers from `一` to `九百九十九`, wrapping back to `一`.
   */
  static createChineseNumericIncrementer(source: string): Incrementer | undefined {
    const match = /^(.*?)([二三四五六七八九]?百(?:[二三四五六七八九]?十)?[一二三四五六七八九]?|[二三四五六七八九]?十[一二三四五六七八九]?|[一二三四五六七八九])(.*)$/u.exec(source);
    if (!match) {
      return undefined;
    }

    const [, prefix, chineseNumber, suffix] = match;
    if (/[一二三四五六七八九十百]$/u.test(prefix) || /^[一二三四五六七八九十百]/u.test(suffix)) {
      return undefined;
    }

    const numericMatch = /^((?:[二三四五六七八九]?百)?)((?:[二三四五六七八九]?十)?)((?:[一二三四五六七八九])?)$/u.exec(chineseNumber);
    if (!numericMatch) {
      return undefined;
    }

    const [, hyaku, juu, ichi] = numericMatch;
    const numericMap: Record<string, number> = {
      "百": 100, "二百": 200, "三百": 300, "四百": 400, "五百": 500, "六百": 600, "七百": 700, "八百": 800, "九百": 900,
      "十": 10, "二十": 20, "三十": 30, "四十": 40, "五十": 50, "六十": 60, "七十": 70, "八十": 80, "九十": 90,
      "一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9
    };

    const start = (numericMap[hyaku] ?? 0) + (numericMap[juu] ?? 0) + (numericMap[ichi] ?? 0);

    const format = (value: number) => {
      const hyakuMembers = ["", "百", "二百", "三百", "四百", "五百", "六百", "七百", "八百", "九百"];
      const juuMembers = ["", "十", "二十", "三十", "四十", "五十", "六十", "七十", "八十", "九十"];
      const ichiMembers = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九"];

      const hyakuValue = Math.floor(value / 100);
      const juuValue = Math.floor((value % 100) / 10);
      const ichiValue = value % 10;
      return `${hyakuMembers[hyakuValue]}${juuMembers[juuValue]}${ichiMembers[ichiValue]}`;
    };

    return (index: number) => {
      const value = ((start - 1 + index) % 999) + 1;
      return `${prefix}${format(value)}${suffix}`;
    };
  }

  /**
   * Creates a character incrementer.
   * Supports patterns like ①, Ⅰ, `(a)` and `ア`.
   * Returns `undefined` when `0-9` or `０-９` appears before a supported character.
   */
  static createCharacterIncrementer(source: string): Incrementer | undefined {
    const charMemberSets = [
      "①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳㉑㉒㉓㉔㉕㉖㉗㉘㉙㉚",
      "ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩⅪⅫ",
      "abcdefghijklmnopqrstuvwxyz",
      "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
      "αβγδεζηθικλμνξοπρστυφχψω",
      "ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩ",
      "абвгґдеєжзиіїйклмнопрстуфхцчшщьюя",
      "АБВГҐДЕЄЖЗИІЇЙКЛМНОПРСТУФХЦЧШЩЬЮЯ",
      "abcdefghijklmnopqrstuvwxyzåäö",
      "ABCDEFGHIJKLMNOPQRSTUVWXYZÅÄÖ",
      "ａｂｃｄｅｆｇｈｉｊｋｌｍｎｏｐｑｒｓｔｕｖｗｘｙｚ",
      "ＡＢＣＤＥＦＧＨＩＪＫＬＭＮＯＰＱＲＳＴＵＶＷＸＹＺ",
      "あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん",
      "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン",
      "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜｦﾝ",
      "子丑寅卯辰巳午未申酉戌亥",
      "가나다라마바사아자차카타파하"
    ];

    let sourceOffset = 0;
    for (const char of [...source]) {

      for (const charMemberSet of charMemberSets) {
        const charMembers = [...charMemberSet];
        const startIdx = charMembers.indexOf(char);
        if (startIdx >= 0) {
          const prefix = source.slice(0, sourceOffset);
          const suffix = source.slice(sourceOffset + char.length);
          return (index: number) => `${prefix}${charMembers[(startIdx + index) % charMembers.length]}${suffix}`;
        }
      }

      sourceOffset += char.length;
    }

    return undefined;
  }

  /**
   * Creates an incrementer that simply repeats the source text (fallback).
   */
  static createOnlyRepeatFormatter(source: string): Incrementer | undefined {
    if (source.length === 0) {
      return undefined;
    }

    return (_index: number) => source;
  }
}
