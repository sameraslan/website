// The upstream catalog sometimes glues the canonical artist names onto the
// display credit with no separator, e.g. "Frank Zappa and The Mothers of
// InventionFrank ZappaThe Mothers of Invention". cleanArtist keeps just the
// credit: it splits at the first case or script boundary after a credit that
// joins several names (",", "&", "and", "with"), when the glued-on tail
// repeats a name from that credit.
const fold = (s) => s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** @param {string} s */
export function cleanArtist(s) {
  const isLatin = (c) => /[\p{Script=Latin}\d'’)\].]/u.test(c);
  for (let i = 1; i < s.length; i++) {
    const prev = s[i - 1];
    const cur = s[i];
    // Not inside a camel-cased name: "McLaughlin", "MacDonald", "DeAngelo".
    const fragment = s.slice(s.lastIndexOf(" ", i - 1) + 1, i);
    const caseBoundary =
      /[a-z\d'’)\]]/.test(prev) && /[A-Z]/.test(cur) && !/^[A-Z][a-z]{1,2}$/.test(fragment);
    const scriptBoundary = isLatin(prev) && /\p{L}/u.test(cur) && !isLatin(cur);
    if (!caseBoundary && !scriptBoundary) continue;
    const credit = s.slice(0, i);
    const rest = fold(s.slice(i));
    if (!/(,|&| and | with )/i.test(credit) || rest.length < 4) continue;
    const words = fold(credit)
      .split(/[^\p{L}\d]+/u)
      .filter((w) => w.length >= 3 && !["and", "with", "the"].includes(w));
    // The glued-on tail repeats a name from the credit: "...InventionFrank
    // Zappa...", "...Bandኃይሉ መርጊያ [Hailu Mergia]".
    if (words.some((w) => rest.includes(w))) return credit;
  }
  return s;
}
