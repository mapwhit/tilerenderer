import assert from 'assert';
export default dictionaryCoder;

function dictionaryCoder(strings) {
  const numberToString = strings.sort();
  const stringToNumber = new Map(numberToString.map((s, i) => [s, i]));
  return {
    encode(string) {
      return stringToNumber.get(string);
    },
    decode(n) {
      assert(n < numberToString.length);
      return numberToString[n];
    }
  };
}
