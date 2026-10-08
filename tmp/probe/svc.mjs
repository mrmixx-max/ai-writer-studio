function hashString(input) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
function createSeededRandom(seed) {
  let state = seed >>> 0;
  return function() {
    state |= 0;
    state = state + 1831565813 | 0;
    let t = Math.imul(state ^ state >>> 15, 1 | state);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function pick(arr, rng) {
  if (arr.length === 0) {
    throw new Error("pick(): leeres Array");
  }
  return arr[Math.floor(rng() * arr.length)];
}
function generateOTPKey(plaintext) {
  const seed = hashString(plaintext);
  const rng = createSeededRandom(seed);
  const range = Array.from({ length: 256 }, (_, i) => i);
  const key = [];
  for (let i = 0; i < plaintext.length; i++) {
    key.push(pick(range, rng));
  }
  return key;
}
function encryptOneTimePad(plaintext, key) {
  const actualKey = key ?? generateOTPKey(plaintext);
  const blocks = [];
  for (let i = 0; i < plaintext.length; i++) {
    const charCode = plaintext.charCodeAt(i);
    const keyByte = actualKey[i % actualKey.length];
    const xorResult = charCode ^ keyByte;
    blocks.push(String(xorResult).padStart(5, "0"));
  }
  return {
    ciphertext: blocks.join(" "),
    key: actualKey,
    blocks
  };
}
function decryptOneTimePad(ciphertext, key) {
  const blocks = ciphertext.split(" ");
  let result = "";
  for (let i = 0; i < blocks.length; i++) {
    const xorResult = parseInt(blocks[i], 10);
    const keyByte = key[i % key.length];
    const charCode = xorResult ^ keyByte;
    result += String.fromCharCode(charCode);
  }
  return result;
}
function encryptBookCipher(plaintext, book, seed) {
  const references = [];
  for (let i = 0; i < plaintext.length; i++) {
    const charCode = plaintext.charCodeAt(i);
    const page = charCode % book.pages + 1;
    const line = Math.floor(charCode / book.pages) % book.linesPerPage + 1;
    const word = Math.floor(charCode / (book.pages * book.linesPerPage)) % book.wordsPerPage + 1;
    references.push({ page, line, word });
  }
  const ciphertext = `${book.pages}x${book.linesPerPage}x${book.wordsPerPage}`;
  const key = `book:${book.pages}x${book.linesPerPage}x${book.wordsPerPage}:seed:${seed}`;
  return { ciphertext, references, key };
}
function decryptBookCipher(ciphertext, references) {
  const [pages, linesPerPage] = ciphertext.split("x").map(Number);
  let result = "";
  for (const ref of references) {
    const charCode = ref.page - 1 + (ref.line - 1) * pages + (ref.word - 1) * pages * linesPerPage;
    result += String.fromCharCode(charCode);
  }
  return result;
}
function hideMessage(coverText, secretMessage, interval = 3) {
  const words = coverText.split(" ");
  const positions = [];
  let wordIndex = interval - 1;
  for (let i = 0; i < secretMessage.length; i++) {
    if (wordIndex >= words.length) {
      throw new Error("hideMessage(): Cover-Text hat nicht genug W\xF6rter");
    }
    words[wordIndex] = words[wordIndex] + secretMessage[i];
    positions.push(wordIndex);
    wordIndex += interval;
  }
  const steganogram = words.join(" ");
  const key = `interval:${interval}:positions:${positions.join(",")}`;
  return { steganogram, positions, key };
}
function extractMessage(steganogram, interval = 3, positions) {
  const words = steganogram.split(" ");
  let result = "";
  for (const pos of positions) {
    const word = words[pos];
    if (!word || word.length === 0) {
      throw new Error("extractMessage(): Ung\xFCltige Position");
    }
    result += word[word.length - 1];
  }
  return result;
}
function createSampleOTP() {
  return encryptOneTimePad("Hallo Welt");
}
function createSampleSteganogram() {
  const coverText = "Der schnelle braune Fuchs springt \xFCber den faulen Hund im Garten";
  const secretMessage = "Hallo";
  return hideMessage(coverText, secretMessage);
}
export {
  createSampleOTP,
  createSampleSteganogram,
  createSeededRandom,
  decryptBookCipher,
  decryptOneTimePad,
  encryptBookCipher,
  encryptOneTimePad,
  extractMessage,
  hashString,
  hideMessage
};
