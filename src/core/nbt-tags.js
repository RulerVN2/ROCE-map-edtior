// Kiểu dữ liệu NBT và hàm bọc giá trị. Không phụ thuộc Node nên Editor (trình duyệt) cũng dùng được.
export const TAG = {
  END: 0, BYTE: 1, SHORT: 2, INT: 3, LONG: 4, FLOAT: 5, DOUBLE: 6,
  BYTE_ARRAY: 7, STRING: 8, LIST: 9, COMPOUND: 10, INT_ARRAY: 11, LONG_ARRAY: 12,
};

export const byte = (v) => ({ t: TAG.BYTE, v: v === true ? 1 : v === false ? 0 : v });
export const short = (v) => ({ t: TAG.SHORT, v });
export const int = (v) => ({ t: TAG.INT, v });
export const long = (v) => ({ t: TAG.LONG, v: BigInt(v) });
export const float = (v) => ({ t: TAG.FLOAT, v });
export const double = (v) => ({ t: TAG.DOUBLE, v });
export const string = (v) => ({ t: TAG.STRING, v: String(v) });
export const byteArray = (v) => ({ t: TAG.BYTE_ARRAY, v });
export const intArray = (v) => ({ t: TAG.INT_ARRAY, v: Int32Array.from(v) });
/** v: Int32Array gồm các cặp (hi, lo) cho từng long. */
export const longArray = (v) => ({ t: TAG.LONG_ARRAY, v });
/** items: mảng giá trị thô (không bọc) cùng kiểu elemType; với COMPOUND là object các tag đã bọc. */
export const list = (elemType, items) => ({ t: TAG.LIST, v: { elemType, items } });
export const compound = (obj) => ({ t: TAG.COMPOUND, v: obj });
