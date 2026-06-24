const ID_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";
const GENERATED_ID_LENGTH = 8;

export function generateId() {
  const bytes = new Uint8Array(GENERATED_ID_LENGTH);

  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * ID_ALPHABET.length);
    }
  }

  return Array.from(bytes, (value) => ID_ALPHABET[value % ID_ALPHABET.length]).join("");
}
