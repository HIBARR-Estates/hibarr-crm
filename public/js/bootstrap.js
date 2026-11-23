"use strict";
(() => {
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };

  // node_modules/lodash/lodash.js
  var require_lodash = __commonJS({
    "node_modules/lodash/lodash.js"(exports, module) {
      (function() {
        var undefined2;
        var VERSION = "4.17.21";
        var LARGE_ARRAY_SIZE = 200;
        var CORE_ERROR_TEXT = "Unsupported core-js use. Try https://npms.io/search?q=ponyfill.", FUNC_ERROR_TEXT = "Expected a function", INVALID_TEMPL_VAR_ERROR_TEXT = "Invalid `variable` option passed into `_.template`";
        var HASH_UNDEFINED = "__lodash_hash_undefined__";
        var MAX_MEMOIZE_SIZE = 500;
        var PLACEHOLDER = "__lodash_placeholder__";
        var CLONE_DEEP_FLAG = 1, CLONE_FLAT_FLAG = 2, CLONE_SYMBOLS_FLAG = 4;
        var COMPARE_PARTIAL_FLAG = 1, COMPARE_UNORDERED_FLAG = 2;
        var WRAP_BIND_FLAG = 1, WRAP_BIND_KEY_FLAG = 2, WRAP_CURRY_BOUND_FLAG = 4, WRAP_CURRY_FLAG = 8, WRAP_CURRY_RIGHT_FLAG = 16, WRAP_PARTIAL_FLAG = 32, WRAP_PARTIAL_RIGHT_FLAG = 64, WRAP_ARY_FLAG = 128, WRAP_REARG_FLAG = 256, WRAP_FLIP_FLAG = 512;
        var DEFAULT_TRUNC_LENGTH = 30, DEFAULT_TRUNC_OMISSION = "...";
        var HOT_COUNT = 800, HOT_SPAN = 16;
        var LAZY_FILTER_FLAG = 1, LAZY_MAP_FLAG = 2, LAZY_WHILE_FLAG = 3;
        var INFINITY = 1 / 0, MAX_SAFE_INTEGER = 9007199254740991, MAX_INTEGER = 17976931348623157e292, NAN = 0 / 0;
        var MAX_ARRAY_LENGTH = 4294967295, MAX_ARRAY_INDEX = MAX_ARRAY_LENGTH - 1, HALF_MAX_ARRAY_LENGTH = MAX_ARRAY_LENGTH >>> 1;
        var wrapFlags = [
          ["ary", WRAP_ARY_FLAG],
          ["bind", WRAP_BIND_FLAG],
          ["bindKey", WRAP_BIND_KEY_FLAG],
          ["curry", WRAP_CURRY_FLAG],
          ["curryRight", WRAP_CURRY_RIGHT_FLAG],
          ["flip", WRAP_FLIP_FLAG],
          ["partial", WRAP_PARTIAL_FLAG],
          ["partialRight", WRAP_PARTIAL_RIGHT_FLAG],
          ["rearg", WRAP_REARG_FLAG]
        ];
        var argsTag = "[object Arguments]", arrayTag = "[object Array]", asyncTag = "[object AsyncFunction]", boolTag = "[object Boolean]", dateTag = "[object Date]", domExcTag = "[object DOMException]", errorTag = "[object Error]", funcTag = "[object Function]", genTag = "[object GeneratorFunction]", mapTag = "[object Map]", numberTag = "[object Number]", nullTag = "[object Null]", objectTag = "[object Object]", promiseTag = "[object Promise]", proxyTag = "[object Proxy]", regexpTag = "[object RegExp]", setTag = "[object Set]", stringTag = "[object String]", symbolTag = "[object Symbol]", undefinedTag = "[object Undefined]", weakMapTag = "[object WeakMap]", weakSetTag = "[object WeakSet]";
        var arrayBufferTag = "[object ArrayBuffer]", dataViewTag = "[object DataView]", float32Tag = "[object Float32Array]", float64Tag = "[object Float64Array]", int8Tag = "[object Int8Array]", int16Tag = "[object Int16Array]", int32Tag = "[object Int32Array]", uint8Tag = "[object Uint8Array]", uint8ClampedTag = "[object Uint8ClampedArray]", uint16Tag = "[object Uint16Array]", uint32Tag = "[object Uint32Array]";
        var reEmptyStringLeading = /\b__p \+= '';/g, reEmptyStringMiddle = /\b(__p \+=) '' \+/g, reEmptyStringTrailing = /(__e\(.*?\)|\b__t\)) \+\n'';/g;
        var reEscapedHtml = /&(?:amp|lt|gt|quot|#39);/g, reUnescapedHtml = /[&<>"']/g, reHasEscapedHtml = RegExp(reEscapedHtml.source), reHasUnescapedHtml = RegExp(reUnescapedHtml.source);
        var reEscape = /<%-([\s\S]+?)%>/g, reEvaluate = /<%([\s\S]+?)%>/g, reInterpolate = /<%=([\s\S]+?)%>/g;
        var reIsDeepProp = /\.|\[(?:[^[\]]*|(["'])(?:(?!\1)[^\\]|\\.)*?\1)\]/, reIsPlainProp = /^\w*$/, rePropName = /[^.[\]]+|\[(?:(-?\d+(?:\.\d+)?)|(["'])((?:(?!\2)[^\\]|\\.)*?)\2)\]|(?=(?:\.|\[\])(?:\.|\[\]|$))/g;
        var reRegExpChar = /[\\^$.*+?()[\]{}|]/g, reHasRegExpChar = RegExp(reRegExpChar.source);
        var reTrimStart = /^\s+/;
        var reWhitespace = /\s/;
        var reWrapComment = /\{(?:\n\/\* \[wrapped with .+\] \*\/)?\n?/, reWrapDetails = /\{\n\/\* \[wrapped with (.+)\] \*/, reSplitDetails = /,? & /;
        var reAsciiWord = /[^\x00-\x2f\x3a-\x40\x5b-\x60\x7b-\x7f]+/g;
        var reForbiddenIdentifierChars = /[()=,{}\[\]\/\s]/;
        var reEscapeChar = /\\(\\)?/g;
        var reEsTemplate = /\$\{([^\\}]*(?:\\.[^\\}]*)*)\}/g;
        var reFlags = /\w*$/;
        var reIsBadHex = /^[-+]0x[0-9a-f]+$/i;
        var reIsBinary = /^0b[01]+$/i;
        var reIsHostCtor = /^\[object .+?Constructor\]$/;
        var reIsOctal = /^0o[0-7]+$/i;
        var reIsUint = /^(?:0|[1-9]\d*)$/;
        var reLatin = /[\xc0-\xd6\xd8-\xf6\xf8-\xff\u0100-\u017f]/g;
        var reNoMatch = /($^)/;
        var reUnescapedString = /['\n\r\u2028\u2029\\]/g;
        var rsAstralRange = "\\ud800-\\udfff", rsComboMarksRange = "\\u0300-\\u036f", reComboHalfMarksRange = "\\ufe20-\\ufe2f", rsComboSymbolsRange = "\\u20d0-\\u20ff", rsComboRange = rsComboMarksRange + reComboHalfMarksRange + rsComboSymbolsRange, rsDingbatRange = "\\u2700-\\u27bf", rsLowerRange = "a-z\\xdf-\\xf6\\xf8-\\xff", rsMathOpRange = "\\xac\\xb1\\xd7\\xf7", rsNonCharRange = "\\x00-\\x2f\\x3a-\\x40\\x5b-\\x60\\x7b-\\xbf", rsPunctuationRange = "\\u2000-\\u206f", rsSpaceRange = " \\t\\x0b\\f\\xa0\\ufeff\\n\\r\\u2028\\u2029\\u1680\\u180e\\u2000\\u2001\\u2002\\u2003\\u2004\\u2005\\u2006\\u2007\\u2008\\u2009\\u200a\\u202f\\u205f\\u3000", rsUpperRange = "A-Z\\xc0-\\xd6\\xd8-\\xde", rsVarRange = "\\ufe0e\\ufe0f", rsBreakRange = rsMathOpRange + rsNonCharRange + rsPunctuationRange + rsSpaceRange;
        var rsApos = "['\u2019]", rsAstral = "[" + rsAstralRange + "]", rsBreak = "[" + rsBreakRange + "]", rsCombo = "[" + rsComboRange + "]", rsDigits = "\\d+", rsDingbat = "[" + rsDingbatRange + "]", rsLower = "[" + rsLowerRange + "]", rsMisc = "[^" + rsAstralRange + rsBreakRange + rsDigits + rsDingbatRange + rsLowerRange + rsUpperRange + "]", rsFitz = "\\ud83c[\\udffb-\\udfff]", rsModifier = "(?:" + rsCombo + "|" + rsFitz + ")", rsNonAstral = "[^" + rsAstralRange + "]", rsRegional = "(?:\\ud83c[\\udde6-\\uddff]){2}", rsSurrPair = "[\\ud800-\\udbff][\\udc00-\\udfff]", rsUpper = "[" + rsUpperRange + "]", rsZWJ = "\\u200d";
        var rsMiscLower = "(?:" + rsLower + "|" + rsMisc + ")", rsMiscUpper = "(?:" + rsUpper + "|" + rsMisc + ")", rsOptContrLower = "(?:" + rsApos + "(?:d|ll|m|re|s|t|ve))?", rsOptContrUpper = "(?:" + rsApos + "(?:D|LL|M|RE|S|T|VE))?", reOptMod = rsModifier + "?", rsOptVar = "[" + rsVarRange + "]?", rsOptJoin = "(?:" + rsZWJ + "(?:" + [rsNonAstral, rsRegional, rsSurrPair].join("|") + ")" + rsOptVar + reOptMod + ")*", rsOrdLower = "\\d*(?:1st|2nd|3rd|(?![123])\\dth)(?=\\b|[A-Z_])", rsOrdUpper = "\\d*(?:1ST|2ND|3RD|(?![123])\\dTH)(?=\\b|[a-z_])", rsSeq = rsOptVar + reOptMod + rsOptJoin, rsEmoji = "(?:" + [rsDingbat, rsRegional, rsSurrPair].join("|") + ")" + rsSeq, rsSymbol = "(?:" + [rsNonAstral + rsCombo + "?", rsCombo, rsRegional, rsSurrPair, rsAstral].join("|") + ")";
        var reApos = RegExp(rsApos, "g");
        var reComboMark = RegExp(rsCombo, "g");
        var reUnicode = RegExp(rsFitz + "(?=" + rsFitz + ")|" + rsSymbol + rsSeq, "g");
        var reUnicodeWord = RegExp([
          rsUpper + "?" + rsLower + "+" + rsOptContrLower + "(?=" + [rsBreak, rsUpper, "$"].join("|") + ")",
          rsMiscUpper + "+" + rsOptContrUpper + "(?=" + [rsBreak, rsUpper + rsMiscLower, "$"].join("|") + ")",
          rsUpper + "?" + rsMiscLower + "+" + rsOptContrLower,
          rsUpper + "+" + rsOptContrUpper,
          rsOrdUpper,
          rsOrdLower,
          rsDigits,
          rsEmoji
        ].join("|"), "g");
        var reHasUnicode = RegExp("[" + rsZWJ + rsAstralRange + rsComboRange + rsVarRange + "]");
        var reHasUnicodeWord = /[a-z][A-Z]|[A-Z]{2}[a-z]|[0-9][a-zA-Z]|[a-zA-Z][0-9]|[^a-zA-Z0-9 ]/;
        var contextProps = [
          "Array",
          "Buffer",
          "DataView",
          "Date",
          "Error",
          "Float32Array",
          "Float64Array",
          "Function",
          "Int8Array",
          "Int16Array",
          "Int32Array",
          "Map",
          "Math",
          "Object",
          "Promise",
          "RegExp",
          "Set",
          "String",
          "Symbol",
          "TypeError",
          "Uint8Array",
          "Uint8ClampedArray",
          "Uint16Array",
          "Uint32Array",
          "WeakMap",
          "_",
          "clearTimeout",
          "isFinite",
          "parseInt",
          "setTimeout"
        ];
        var templateCounter = -1;
        var typedArrayTags = {};
        typedArrayTags[float32Tag] = typedArrayTags[float64Tag] = typedArrayTags[int8Tag] = typedArrayTags[int16Tag] = typedArrayTags[int32Tag] = typedArrayTags[uint8Tag] = typedArrayTags[uint8ClampedTag] = typedArrayTags[uint16Tag] = typedArrayTags[uint32Tag] = true;
        typedArrayTags[argsTag] = typedArrayTags[arrayTag] = typedArrayTags[arrayBufferTag] = typedArrayTags[boolTag] = typedArrayTags[dataViewTag] = typedArrayTags[dateTag] = typedArrayTags[errorTag] = typedArrayTags[funcTag] = typedArrayTags[mapTag] = typedArrayTags[numberTag] = typedArrayTags[objectTag] = typedArrayTags[regexpTag] = typedArrayTags[setTag] = typedArrayTags[stringTag] = typedArrayTags[weakMapTag] = false;
        var cloneableTags = {};
        cloneableTags[argsTag] = cloneableTags[arrayTag] = cloneableTags[arrayBufferTag] = cloneableTags[dataViewTag] = cloneableTags[boolTag] = cloneableTags[dateTag] = cloneableTags[float32Tag] = cloneableTags[float64Tag] = cloneableTags[int8Tag] = cloneableTags[int16Tag] = cloneableTags[int32Tag] = cloneableTags[mapTag] = cloneableTags[numberTag] = cloneableTags[objectTag] = cloneableTags[regexpTag] = cloneableTags[setTag] = cloneableTags[stringTag] = cloneableTags[symbolTag] = cloneableTags[uint8Tag] = cloneableTags[uint8ClampedTag] = cloneableTags[uint16Tag] = cloneableTags[uint32Tag] = true;
        cloneableTags[errorTag] = cloneableTags[funcTag] = cloneableTags[weakMapTag] = false;
        var deburredLetters = {
          // Latin-1 Supplement block.
          "\xC0": "A",
          "\xC1": "A",
          "\xC2": "A",
          "\xC3": "A",
          "\xC4": "A",
          "\xC5": "A",
          "\xE0": "a",
          "\xE1": "a",
          "\xE2": "a",
          "\xE3": "a",
          "\xE4": "a",
          "\xE5": "a",
          "\xC7": "C",
          "\xE7": "c",
          "\xD0": "D",
          "\xF0": "d",
          "\xC8": "E",
          "\xC9": "E",
          "\xCA": "E",
          "\xCB": "E",
          "\xE8": "e",
          "\xE9": "e",
          "\xEA": "e",
          "\xEB": "e",
          "\xCC": "I",
          "\xCD": "I",
          "\xCE": "I",
          "\xCF": "I",
          "\xEC": "i",
          "\xED": "i",
          "\xEE": "i",
          "\xEF": "i",
          "\xD1": "N",
          "\xF1": "n",
          "\xD2": "O",
          "\xD3": "O",
          "\xD4": "O",
          "\xD5": "O",
          "\xD6": "O",
          "\xD8": "O",
          "\xF2": "o",
          "\xF3": "o",
          "\xF4": "o",
          "\xF5": "o",
          "\xF6": "o",
          "\xF8": "o",
          "\xD9": "U",
          "\xDA": "U",
          "\xDB": "U",
          "\xDC": "U",
          "\xF9": "u",
          "\xFA": "u",
          "\xFB": "u",
          "\xFC": "u",
          "\xDD": "Y",
          "\xFD": "y",
          "\xFF": "y",
          "\xC6": "Ae",
          "\xE6": "ae",
          "\xDE": "Th",
          "\xFE": "th",
          "\xDF": "ss",
          // Latin Extended-A block.
          "\u0100": "A",
          "\u0102": "A",
          "\u0104": "A",
          "\u0101": "a",
          "\u0103": "a",
          "\u0105": "a",
          "\u0106": "C",
          "\u0108": "C",
          "\u010A": "C",
          "\u010C": "C",
          "\u0107": "c",
          "\u0109": "c",
          "\u010B": "c",
          "\u010D": "c",
          "\u010E": "D",
          "\u0110": "D",
          "\u010F": "d",
          "\u0111": "d",
          "\u0112": "E",
          "\u0114": "E",
          "\u0116": "E",
          "\u0118": "E",
          "\u011A": "E",
          "\u0113": "e",
          "\u0115": "e",
          "\u0117": "e",
          "\u0119": "e",
          "\u011B": "e",
          "\u011C": "G",
          "\u011E": "G",
          "\u0120": "G",
          "\u0122": "G",
          "\u011D": "g",
          "\u011F": "g",
          "\u0121": "g",
          "\u0123": "g",
          "\u0124": "H",
          "\u0126": "H",
          "\u0125": "h",
          "\u0127": "h",
          "\u0128": "I",
          "\u012A": "I",
          "\u012C": "I",
          "\u012E": "I",
          "\u0130": "I",
          "\u0129": "i",
          "\u012B": "i",
          "\u012D": "i",
          "\u012F": "i",
          "\u0131": "i",
          "\u0134": "J",
          "\u0135": "j",
          "\u0136": "K",
          "\u0137": "k",
          "\u0138": "k",
          "\u0139": "L",
          "\u013B": "L",
          "\u013D": "L",
          "\u013F": "L",
          "\u0141": "L",
          "\u013A": "l",
          "\u013C": "l",
          "\u013E": "l",
          "\u0140": "l",
          "\u0142": "l",
          "\u0143": "N",
          "\u0145": "N",
          "\u0147": "N",
          "\u014A": "N",
          "\u0144": "n",
          "\u0146": "n",
          "\u0148": "n",
          "\u014B": "n",
          "\u014C": "O",
          "\u014E": "O",
          "\u0150": "O",
          "\u014D": "o",
          "\u014F": "o",
          "\u0151": "o",
          "\u0154": "R",
          "\u0156": "R",
          "\u0158": "R",
          "\u0155": "r",
          "\u0157": "r",
          "\u0159": "r",
          "\u015A": "S",
          "\u015C": "S",
          "\u015E": "S",
          "\u0160": "S",
          "\u015B": "s",
          "\u015D": "s",
          "\u015F": "s",
          "\u0161": "s",
          "\u0162": "T",
          "\u0164": "T",
          "\u0166": "T",
          "\u0163": "t",
          "\u0165": "t",
          "\u0167": "t",
          "\u0168": "U",
          "\u016A": "U",
          "\u016C": "U",
          "\u016E": "U",
          "\u0170": "U",
          "\u0172": "U",
          "\u0169": "u",
          "\u016B": "u",
          "\u016D": "u",
          "\u016F": "u",
          "\u0171": "u",
          "\u0173": "u",
          "\u0174": "W",
          "\u0175": "w",
          "\u0176": "Y",
          "\u0177": "y",
          "\u0178": "Y",
          "\u0179": "Z",
          "\u017B": "Z",
          "\u017D": "Z",
          "\u017A": "z",
          "\u017C": "z",
          "\u017E": "z",
          "\u0132": "IJ",
          "\u0133": "ij",
          "\u0152": "Oe",
          "\u0153": "oe",
          "\u0149": "'n",
          "\u017F": "s"
        };
        var htmlEscapes = {
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;"
        };
        var htmlUnescapes = {
          "&amp;": "&",
          "&lt;": "<",
          "&gt;": ">",
          "&quot;": '"',
          "&#39;": "'"
        };
        var stringEscapes = {
          "\\": "\\",
          "'": "'",
          "\n": "n",
          "\r": "r",
          "\u2028": "u2028",
          "\u2029": "u2029"
        };
        var freeParseFloat = parseFloat, freeParseInt = parseInt;
        var freeGlobal = typeof global == "object" && global && global.Object === Object && global;
        var freeSelf = typeof self == "object" && self && self.Object === Object && self;
        var root = freeGlobal || freeSelf || Function("return this")();
        var freeExports = typeof exports == "object" && exports && !exports.nodeType && exports;
        var freeModule = freeExports && typeof module == "object" && module && !module.nodeType && module;
        var moduleExports = freeModule && freeModule.exports === freeExports;
        var freeProcess = moduleExports && freeGlobal.process;
        var nodeUtil = (function() {
          try {
            var types = freeModule && freeModule.require && freeModule.require("util").types;
            if (types) {
              return types;
            }
            return freeProcess && freeProcess.binding && freeProcess.binding("util");
          } catch (e) {
          }
        })();
        var nodeIsArrayBuffer = nodeUtil && nodeUtil.isArrayBuffer, nodeIsDate = nodeUtil && nodeUtil.isDate, nodeIsMap = nodeUtil && nodeUtil.isMap, nodeIsRegExp = nodeUtil && nodeUtil.isRegExp, nodeIsSet = nodeUtil && nodeUtil.isSet, nodeIsTypedArray = nodeUtil && nodeUtil.isTypedArray;
        function apply(func, thisArg, args) {
          switch (args.length) {
            case 0:
              return func.call(thisArg);
            case 1:
              return func.call(thisArg, args[0]);
            case 2:
              return func.call(thisArg, args[0], args[1]);
            case 3:
              return func.call(thisArg, args[0], args[1], args[2]);
          }
          return func.apply(thisArg, args);
        }
        function arrayAggregator(array, setter, iteratee, accumulator) {
          var index = -1, length = array == null ? 0 : array.length;
          while (++index < length) {
            var value = array[index];
            setter(accumulator, value, iteratee(value), array);
          }
          return accumulator;
        }
        function arrayEach(array, iteratee) {
          var index = -1, length = array == null ? 0 : array.length;
          while (++index < length) {
            if (iteratee(array[index], index, array) === false) {
              break;
            }
          }
          return array;
        }
        function arrayEachRight(array, iteratee) {
          var length = array == null ? 0 : array.length;
          while (length--) {
            if (iteratee(array[length], length, array) === false) {
              break;
            }
          }
          return array;
        }
        function arrayEvery(array, predicate) {
          var index = -1, length = array == null ? 0 : array.length;
          while (++index < length) {
            if (!predicate(array[index], index, array)) {
              return false;
            }
          }
          return true;
        }
        function arrayFilter(array, predicate) {
          var index = -1, length = array == null ? 0 : array.length, resIndex = 0, result = [];
          while (++index < length) {
            var value = array[index];
            if (predicate(value, index, array)) {
              result[resIndex++] = value;
            }
          }
          return result;
        }
        function arrayIncludes(array, value) {
          var length = array == null ? 0 : array.length;
          return !!length && baseIndexOf(array, value, 0) > -1;
        }
        function arrayIncludesWith(array, value, comparator) {
          var index = -1, length = array == null ? 0 : array.length;
          while (++index < length) {
            if (comparator(value, array[index])) {
              return true;
            }
          }
          return false;
        }
        function arrayMap(array, iteratee) {
          var index = -1, length = array == null ? 0 : array.length, result = Array(length);
          while (++index < length) {
            result[index] = iteratee(array[index], index, array);
          }
          return result;
        }
        function arrayPush(array, values) {
          var index = -1, length = values.length, offset = array.length;
          while (++index < length) {
            array[offset + index] = values[index];
          }
          return array;
        }
        function arrayReduce(array, iteratee, accumulator, initAccum) {
          var index = -1, length = array == null ? 0 : array.length;
          if (initAccum && length) {
            accumulator = array[++index];
          }
          while (++index < length) {
            accumulator = iteratee(accumulator, array[index], index, array);
          }
          return accumulator;
        }
        function arrayReduceRight(array, iteratee, accumulator, initAccum) {
          var length = array == null ? 0 : array.length;
          if (initAccum && length) {
            accumulator = array[--length];
          }
          while (length--) {
            accumulator = iteratee(accumulator, array[length], length, array);
          }
          return accumulator;
        }
        function arraySome(array, predicate) {
          var index = -1, length = array == null ? 0 : array.length;
          while (++index < length) {
            if (predicate(array[index], index, array)) {
              return true;
            }
          }
          return false;
        }
        var asciiSize = baseProperty("length");
        function asciiToArray(string) {
          return string.split("");
        }
        function asciiWords(string) {
          return string.match(reAsciiWord) || [];
        }
        function baseFindKey(collection, predicate, eachFunc) {
          var result;
          eachFunc(collection, function(value, key, collection2) {
            if (predicate(value, key, collection2)) {
              result = key;
              return false;
            }
          });
          return result;
        }
        function baseFindIndex(array, predicate, fromIndex, fromRight) {
          var length = array.length, index = fromIndex + (fromRight ? 1 : -1);
          while (fromRight ? index-- : ++index < length) {
            if (predicate(array[index], index, array)) {
              return index;
            }
          }
          return -1;
        }
        function baseIndexOf(array, value, fromIndex) {
          return value === value ? strictIndexOf(array, value, fromIndex) : baseFindIndex(array, baseIsNaN, fromIndex);
        }
        function baseIndexOfWith(array, value, fromIndex, comparator) {
          var index = fromIndex - 1, length = array.length;
          while (++index < length) {
            if (comparator(array[index], value)) {
              return index;
            }
          }
          return -1;
        }
        function baseIsNaN(value) {
          return value !== value;
        }
        function baseMean(array, iteratee) {
          var length = array == null ? 0 : array.length;
          return length ? baseSum(array, iteratee) / length : NAN;
        }
        function baseProperty(key) {
          return function(object) {
            return object == null ? undefined2 : object[key];
          };
        }
        function basePropertyOf(object) {
          return function(key) {
            return object == null ? undefined2 : object[key];
          };
        }
        function baseReduce(collection, iteratee, accumulator, initAccum, eachFunc) {
          eachFunc(collection, function(value, index, collection2) {
            accumulator = initAccum ? (initAccum = false, value) : iteratee(accumulator, value, index, collection2);
          });
          return accumulator;
        }
        function baseSortBy(array, comparer) {
          var length = array.length;
          array.sort(comparer);
          while (length--) {
            array[length] = array[length].value;
          }
          return array;
        }
        function baseSum(array, iteratee) {
          var result, index = -1, length = array.length;
          while (++index < length) {
            var current = iteratee(array[index]);
            if (current !== undefined2) {
              result = result === undefined2 ? current : result + current;
            }
          }
          return result;
        }
        function baseTimes(n, iteratee) {
          var index = -1, result = Array(n);
          while (++index < n) {
            result[index] = iteratee(index);
          }
          return result;
        }
        function baseToPairs(object, props) {
          return arrayMap(props, function(key) {
            return [key, object[key]];
          });
        }
        function baseTrim(string) {
          return string ? string.slice(0, trimmedEndIndex(string) + 1).replace(reTrimStart, "") : string;
        }
        function baseUnary(func) {
          return function(value) {
            return func(value);
          };
        }
        function baseValues(object, props) {
          return arrayMap(props, function(key) {
            return object[key];
          });
        }
        function cacheHas(cache, key) {
          return cache.has(key);
        }
        function charsStartIndex(strSymbols, chrSymbols) {
          var index = -1, length = strSymbols.length;
          while (++index < length && baseIndexOf(chrSymbols, strSymbols[index], 0) > -1) {
          }
          return index;
        }
        function charsEndIndex(strSymbols, chrSymbols) {
          var index = strSymbols.length;
          while (index-- && baseIndexOf(chrSymbols, strSymbols[index], 0) > -1) {
          }
          return index;
        }
        function countHolders(array, placeholder) {
          var length = array.length, result = 0;
          while (length--) {
            if (array[length] === placeholder) {
              ++result;
            }
          }
          return result;
        }
        var deburrLetter = basePropertyOf(deburredLetters);
        var escapeHtmlChar = basePropertyOf(htmlEscapes);
        function escapeStringChar(chr) {
          return "\\" + stringEscapes[chr];
        }
        function getValue(object, key) {
          return object == null ? undefined2 : object[key];
        }
        function hasUnicode(string) {
          return reHasUnicode.test(string);
        }
        function hasUnicodeWord(string) {
          return reHasUnicodeWord.test(string);
        }
        function iteratorToArray(iterator) {
          var data, result = [];
          while (!(data = iterator.next()).done) {
            result.push(data.value);
          }
          return result;
        }
        function mapToArray(map) {
          var index = -1, result = Array(map.size);
          map.forEach(function(value, key) {
            result[++index] = [key, value];
          });
          return result;
        }
        function overArg(func, transform) {
          return function(arg) {
            return func(transform(arg));
          };
        }
        function replaceHolders(array, placeholder) {
          var index = -1, length = array.length, resIndex = 0, result = [];
          while (++index < length) {
            var value = array[index];
            if (value === placeholder || value === PLACEHOLDER) {
              array[index] = PLACEHOLDER;
              result[resIndex++] = index;
            }
          }
          return result;
        }
        function setToArray(set) {
          var index = -1, result = Array(set.size);
          set.forEach(function(value) {
            result[++index] = value;
          });
          return result;
        }
        function setToPairs(set) {
          var index = -1, result = Array(set.size);
          set.forEach(function(value) {
            result[++index] = [value, value];
          });
          return result;
        }
        function strictIndexOf(array, value, fromIndex) {
          var index = fromIndex - 1, length = array.length;
          while (++index < length) {
            if (array[index] === value) {
              return index;
            }
          }
          return -1;
        }
        function strictLastIndexOf(array, value, fromIndex) {
          var index = fromIndex + 1;
          while (index--) {
            if (array[index] === value) {
              return index;
            }
          }
          return index;
        }
        function stringSize(string) {
          return hasUnicode(string) ? unicodeSize(string) : asciiSize(string);
        }
        function stringToArray(string) {
          return hasUnicode(string) ? unicodeToArray(string) : asciiToArray(string);
        }
        function trimmedEndIndex(string) {
          var index = string.length;
          while (index-- && reWhitespace.test(string.charAt(index))) {
          }
          return index;
        }
        var unescapeHtmlChar = basePropertyOf(htmlUnescapes);
        function unicodeSize(string) {
          var result = reUnicode.lastIndex = 0;
          while (reUnicode.test(string)) {
            ++result;
          }
          return result;
        }
        function unicodeToArray(string) {
          return string.match(reUnicode) || [];
        }
        function unicodeWords(string) {
          return string.match(reUnicodeWord) || [];
        }
        var runInContext = (function runInContext2(context) {
          context = context == null ? root : _.defaults(root.Object(), context, _.pick(root, contextProps));
          var Array2 = context.Array, Date2 = context.Date, Error2 = context.Error, Function2 = context.Function, Math2 = context.Math, Object2 = context.Object, RegExp2 = context.RegExp, String2 = context.String, TypeError2 = context.TypeError;
          var arrayProto = Array2.prototype, funcProto = Function2.prototype, objectProto = Object2.prototype;
          var coreJsData = context["__core-js_shared__"];
          var funcToString = funcProto.toString;
          var hasOwnProperty = objectProto.hasOwnProperty;
          var idCounter = 0;
          var maskSrcKey = (function() {
            var uid = /[^.]+$/.exec(coreJsData && coreJsData.keys && coreJsData.keys.IE_PROTO || "");
            return uid ? "Symbol(src)_1." + uid : "";
          })();
          var nativeObjectToString = objectProto.toString;
          var objectCtorString = funcToString.call(Object2);
          var oldDash = root._;
          var reIsNative = RegExp2(
            "^" + funcToString.call(hasOwnProperty).replace(reRegExpChar, "\\$&").replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, "$1.*?") + "$"
          );
          var Buffer2 = moduleExports ? context.Buffer : undefined2, Symbol2 = context.Symbol, Uint8Array2 = context.Uint8Array, allocUnsafe = Buffer2 ? Buffer2.allocUnsafe : undefined2, getPrototype = overArg(Object2.getPrototypeOf, Object2), objectCreate = Object2.create, propertyIsEnumerable = objectProto.propertyIsEnumerable, splice = arrayProto.splice, spreadableSymbol = Symbol2 ? Symbol2.isConcatSpreadable : undefined2, symIterator = Symbol2 ? Symbol2.iterator : undefined2, symToStringTag = Symbol2 ? Symbol2.toStringTag : undefined2;
          var defineProperty = (function() {
            try {
              var func = getNative(Object2, "defineProperty");
              func({}, "", {});
              return func;
            } catch (e) {
            }
          })();
          var ctxClearTimeout = context.clearTimeout !== root.clearTimeout && context.clearTimeout, ctxNow = Date2 && Date2.now !== root.Date.now && Date2.now, ctxSetTimeout = context.setTimeout !== root.setTimeout && context.setTimeout;
          var nativeCeil = Math2.ceil, nativeFloor = Math2.floor, nativeGetSymbols = Object2.getOwnPropertySymbols, nativeIsBuffer = Buffer2 ? Buffer2.isBuffer : undefined2, nativeIsFinite = context.isFinite, nativeJoin = arrayProto.join, nativeKeys = overArg(Object2.keys, Object2), nativeMax = Math2.max, nativeMin = Math2.min, nativeNow = Date2.now, nativeParseInt = context.parseInt, nativeRandom = Math2.random, nativeReverse = arrayProto.reverse;
          var DataView = getNative(context, "DataView"), Map2 = getNative(context, "Map"), Promise2 = getNative(context, "Promise"), Set = getNative(context, "Set"), WeakMap = getNative(context, "WeakMap"), nativeCreate = getNative(Object2, "create");
          var metaMap = WeakMap && new WeakMap();
          var realNames = {};
          var dataViewCtorString = toSource(DataView), mapCtorString = toSource(Map2), promiseCtorString = toSource(Promise2), setCtorString = toSource(Set), weakMapCtorString = toSource(WeakMap);
          var symbolProto = Symbol2 ? Symbol2.prototype : undefined2, symbolValueOf = symbolProto ? symbolProto.valueOf : undefined2, symbolToString = symbolProto ? symbolProto.toString : undefined2;
          function lodash(value) {
            if (isObjectLike(value) && !isArray(value) && !(value instanceof LazyWrapper)) {
              if (value instanceof LodashWrapper) {
                return value;
              }
              if (hasOwnProperty.call(value, "__wrapped__")) {
                return wrapperClone(value);
              }
            }
            return new LodashWrapper(value);
          }
          var baseCreate = /* @__PURE__ */ (function() {
            function object() {
            }
            return function(proto) {
              if (!isObject(proto)) {
                return {};
              }
              if (objectCreate) {
                return objectCreate(proto);
              }
              object.prototype = proto;
              var result2 = new object();
              object.prototype = undefined2;
              return result2;
            };
          })();
          function baseLodash() {
          }
          function LodashWrapper(value, chainAll) {
            this.__wrapped__ = value;
            this.__actions__ = [];
            this.__chain__ = !!chainAll;
            this.__index__ = 0;
            this.__values__ = undefined2;
          }
          lodash.templateSettings = {
            /**
             * Used to detect `data` property values to be HTML-escaped.
             *
             * @memberOf _.templateSettings
             * @type {RegExp}
             */
            "escape": reEscape,
            /**
             * Used to detect code to be evaluated.
             *
             * @memberOf _.templateSettings
             * @type {RegExp}
             */
            "evaluate": reEvaluate,
            /**
             * Used to detect `data` property values to inject.
             *
             * @memberOf _.templateSettings
             * @type {RegExp}
             */
            "interpolate": reInterpolate,
            /**
             * Used to reference the data object in the template text.
             *
             * @memberOf _.templateSettings
             * @type {string}
             */
            "variable": "",
            /**
             * Used to import variables into the compiled template.
             *
             * @memberOf _.templateSettings
             * @type {Object}
             */
            "imports": {
              /**
               * A reference to the `lodash` function.
               *
               * @memberOf _.templateSettings.imports
               * @type {Function}
               */
              "_": lodash
            }
          };
          lodash.prototype = baseLodash.prototype;
          lodash.prototype.constructor = lodash;
          LodashWrapper.prototype = baseCreate(baseLodash.prototype);
          LodashWrapper.prototype.constructor = LodashWrapper;
          function LazyWrapper(value) {
            this.__wrapped__ = value;
            this.__actions__ = [];
            this.__dir__ = 1;
            this.__filtered__ = false;
            this.__iteratees__ = [];
            this.__takeCount__ = MAX_ARRAY_LENGTH;
            this.__views__ = [];
          }
          function lazyClone() {
            var result2 = new LazyWrapper(this.__wrapped__);
            result2.__actions__ = copyArray(this.__actions__);
            result2.__dir__ = this.__dir__;
            result2.__filtered__ = this.__filtered__;
            result2.__iteratees__ = copyArray(this.__iteratees__);
            result2.__takeCount__ = this.__takeCount__;
            result2.__views__ = copyArray(this.__views__);
            return result2;
          }
          function lazyReverse() {
            if (this.__filtered__) {
              var result2 = new LazyWrapper(this);
              result2.__dir__ = -1;
              result2.__filtered__ = true;
            } else {
              result2 = this.clone();
              result2.__dir__ *= -1;
            }
            return result2;
          }
          function lazyValue() {
            var array = this.__wrapped__.value(), dir = this.__dir__, isArr = isArray(array), isRight = dir < 0, arrLength = isArr ? array.length : 0, view = getView(0, arrLength, this.__views__), start = view.start, end = view.end, length = end - start, index = isRight ? end : start - 1, iteratees = this.__iteratees__, iterLength = iteratees.length, resIndex = 0, takeCount = nativeMin(length, this.__takeCount__);
            if (!isArr || !isRight && arrLength == length && takeCount == length) {
              return baseWrapperValue(array, this.__actions__);
            }
            var result2 = [];
            outer:
              while (length-- && resIndex < takeCount) {
                index += dir;
                var iterIndex = -1, value = array[index];
                while (++iterIndex < iterLength) {
                  var data = iteratees[iterIndex], iteratee2 = data.iteratee, type = data.type, computed = iteratee2(value);
                  if (type == LAZY_MAP_FLAG) {
                    value = computed;
                  } else if (!computed) {
                    if (type == LAZY_FILTER_FLAG) {
                      continue outer;
                    } else {
                      break outer;
                    }
                  }
                }
                result2[resIndex++] = value;
              }
            return result2;
          }
          LazyWrapper.prototype = baseCreate(baseLodash.prototype);
          LazyWrapper.prototype.constructor = LazyWrapper;
          function Hash(entries) {
            var index = -1, length = entries == null ? 0 : entries.length;
            this.clear();
            while (++index < length) {
              var entry = entries[index];
              this.set(entry[0], entry[1]);
            }
          }
          function hashClear() {
            this.__data__ = nativeCreate ? nativeCreate(null) : {};
            this.size = 0;
          }
          function hashDelete(key) {
            var result2 = this.has(key) && delete this.__data__[key];
            this.size -= result2 ? 1 : 0;
            return result2;
          }
          function hashGet(key) {
            var data = this.__data__;
            if (nativeCreate) {
              var result2 = data[key];
              return result2 === HASH_UNDEFINED ? undefined2 : result2;
            }
            return hasOwnProperty.call(data, key) ? data[key] : undefined2;
          }
          function hashHas(key) {
            var data = this.__data__;
            return nativeCreate ? data[key] !== undefined2 : hasOwnProperty.call(data, key);
          }
          function hashSet(key, value) {
            var data = this.__data__;
            this.size += this.has(key) ? 0 : 1;
            data[key] = nativeCreate && value === undefined2 ? HASH_UNDEFINED : value;
            return this;
          }
          Hash.prototype.clear = hashClear;
          Hash.prototype["delete"] = hashDelete;
          Hash.prototype.get = hashGet;
          Hash.prototype.has = hashHas;
          Hash.prototype.set = hashSet;
          function ListCache(entries) {
            var index = -1, length = entries == null ? 0 : entries.length;
            this.clear();
            while (++index < length) {
              var entry = entries[index];
              this.set(entry[0], entry[1]);
            }
          }
          function listCacheClear() {
            this.__data__ = [];
            this.size = 0;
          }
          function listCacheDelete(key) {
            var data = this.__data__, index = assocIndexOf(data, key);
            if (index < 0) {
              return false;
            }
            var lastIndex = data.length - 1;
            if (index == lastIndex) {
              data.pop();
            } else {
              splice.call(data, index, 1);
            }
            --this.size;
            return true;
          }
          function listCacheGet(key) {
            var data = this.__data__, index = assocIndexOf(data, key);
            return index < 0 ? undefined2 : data[index][1];
          }
          function listCacheHas(key) {
            return assocIndexOf(this.__data__, key) > -1;
          }
          function listCacheSet(key, value) {
            var data = this.__data__, index = assocIndexOf(data, key);
            if (index < 0) {
              ++this.size;
              data.push([key, value]);
            } else {
              data[index][1] = value;
            }
            return this;
          }
          ListCache.prototype.clear = listCacheClear;
          ListCache.prototype["delete"] = listCacheDelete;
          ListCache.prototype.get = listCacheGet;
          ListCache.prototype.has = listCacheHas;
          ListCache.prototype.set = listCacheSet;
          function MapCache(entries) {
            var index = -1, length = entries == null ? 0 : entries.length;
            this.clear();
            while (++index < length) {
              var entry = entries[index];
              this.set(entry[0], entry[1]);
            }
          }
          function mapCacheClear() {
            this.size = 0;
            this.__data__ = {
              "hash": new Hash(),
              "map": new (Map2 || ListCache)(),
              "string": new Hash()
            };
          }
          function mapCacheDelete(key) {
            var result2 = getMapData(this, key)["delete"](key);
            this.size -= result2 ? 1 : 0;
            return result2;
          }
          function mapCacheGet(key) {
            return getMapData(this, key).get(key);
          }
          function mapCacheHas(key) {
            return getMapData(this, key).has(key);
          }
          function mapCacheSet(key, value) {
            var data = getMapData(this, key), size2 = data.size;
            data.set(key, value);
            this.size += data.size == size2 ? 0 : 1;
            return this;
          }
          MapCache.prototype.clear = mapCacheClear;
          MapCache.prototype["delete"] = mapCacheDelete;
          MapCache.prototype.get = mapCacheGet;
          MapCache.prototype.has = mapCacheHas;
          MapCache.prototype.set = mapCacheSet;
          function SetCache(values2) {
            var index = -1, length = values2 == null ? 0 : values2.length;
            this.__data__ = new MapCache();
            while (++index < length) {
              this.add(values2[index]);
            }
          }
          function setCacheAdd(value) {
            this.__data__.set(value, HASH_UNDEFINED);
            return this;
          }
          function setCacheHas(value) {
            return this.__data__.has(value);
          }
          SetCache.prototype.add = SetCache.prototype.push = setCacheAdd;
          SetCache.prototype.has = setCacheHas;
          function Stack(entries) {
            var data = this.__data__ = new ListCache(entries);
            this.size = data.size;
          }
          function stackClear() {
            this.__data__ = new ListCache();
            this.size = 0;
          }
          function stackDelete(key) {
            var data = this.__data__, result2 = data["delete"](key);
            this.size = data.size;
            return result2;
          }
          function stackGet(key) {
            return this.__data__.get(key);
          }
          function stackHas(key) {
            return this.__data__.has(key);
          }
          function stackSet(key, value) {
            var data = this.__data__;
            if (data instanceof ListCache) {
              var pairs = data.__data__;
              if (!Map2 || pairs.length < LARGE_ARRAY_SIZE - 1) {
                pairs.push([key, value]);
                this.size = ++data.size;
                return this;
              }
              data = this.__data__ = new MapCache(pairs);
            }
            data.set(key, value);
            this.size = data.size;
            return this;
          }
          Stack.prototype.clear = stackClear;
          Stack.prototype["delete"] = stackDelete;
          Stack.prototype.get = stackGet;
          Stack.prototype.has = stackHas;
          Stack.prototype.set = stackSet;
          function arrayLikeKeys(value, inherited) {
            var isArr = isArray(value), isArg = !isArr && isArguments(value), isBuff = !isArr && !isArg && isBuffer(value), isType = !isArr && !isArg && !isBuff && isTypedArray(value), skipIndexes = isArr || isArg || isBuff || isType, result2 = skipIndexes ? baseTimes(value.length, String2) : [], length = result2.length;
            for (var key in value) {
              if ((inherited || hasOwnProperty.call(value, key)) && !(skipIndexes && // Safari 9 has enumerable `arguments.length` in strict mode.
              (key == "length" || // Node.js 0.10 has enumerable non-index properties on buffers.
              isBuff && (key == "offset" || key == "parent") || // PhantomJS 2 has enumerable non-index properties on typed arrays.
              isType && (key == "buffer" || key == "byteLength" || key == "byteOffset") || // Skip index properties.
              isIndex(key, length)))) {
                result2.push(key);
              }
            }
            return result2;
          }
          function arraySample(array) {
            var length = array.length;
            return length ? array[baseRandom(0, length - 1)] : undefined2;
          }
          function arraySampleSize(array, n) {
            return shuffleSelf(copyArray(array), baseClamp(n, 0, array.length));
          }
          function arrayShuffle(array) {
            return shuffleSelf(copyArray(array));
          }
          function assignMergeValue(object, key, value) {
            if (value !== undefined2 && !eq(object[key], value) || value === undefined2 && !(key in object)) {
              baseAssignValue(object, key, value);
            }
          }
          function assignValue(object, key, value) {
            var objValue = object[key];
            if (!(hasOwnProperty.call(object, key) && eq(objValue, value)) || value === undefined2 && !(key in object)) {
              baseAssignValue(object, key, value);
            }
          }
          function assocIndexOf(array, key) {
            var length = array.length;
            while (length--) {
              if (eq(array[length][0], key)) {
                return length;
              }
            }
            return -1;
          }
          function baseAggregator(collection, setter, iteratee2, accumulator) {
            baseEach(collection, function(value, key, collection2) {
              setter(accumulator, value, iteratee2(value), collection2);
            });
            return accumulator;
          }
          function baseAssign(object, source) {
            return object && copyObject(source, keys(source), object);
          }
          function baseAssignIn(object, source) {
            return object && copyObject(source, keysIn(source), object);
          }
          function baseAssignValue(object, key, value) {
            if (key == "__proto__" && defineProperty) {
              defineProperty(object, key, {
                "configurable": true,
                "enumerable": true,
                "value": value,
                "writable": true
              });
            } else {
              object[key] = value;
            }
          }
          function baseAt(object, paths) {
            var index = -1, length = paths.length, result2 = Array2(length), skip = object == null;
            while (++index < length) {
              result2[index] = skip ? undefined2 : get(object, paths[index]);
            }
            return result2;
          }
          function baseClamp(number, lower, upper) {
            if (number === number) {
              if (upper !== undefined2) {
                number = number <= upper ? number : upper;
              }
              if (lower !== undefined2) {
                number = number >= lower ? number : lower;
              }
            }
            return number;
          }
          function baseClone(value, bitmask, customizer, key, object, stack) {
            var result2, isDeep = bitmask & CLONE_DEEP_FLAG, isFlat = bitmask & CLONE_FLAT_FLAG, isFull = bitmask & CLONE_SYMBOLS_FLAG;
            if (customizer) {
              result2 = object ? customizer(value, key, object, stack) : customizer(value);
            }
            if (result2 !== undefined2) {
              return result2;
            }
            if (!isObject(value)) {
              return value;
            }
            var isArr = isArray(value);
            if (isArr) {
              result2 = initCloneArray(value);
              if (!isDeep) {
                return copyArray(value, result2);
              }
            } else {
              var tag = getTag(value), isFunc = tag == funcTag || tag == genTag;
              if (isBuffer(value)) {
                return cloneBuffer(value, isDeep);
              }
              if (tag == objectTag || tag == argsTag || isFunc && !object) {
                result2 = isFlat || isFunc ? {} : initCloneObject(value);
                if (!isDeep) {
                  return isFlat ? copySymbolsIn(value, baseAssignIn(result2, value)) : copySymbols(value, baseAssign(result2, value));
                }
              } else {
                if (!cloneableTags[tag]) {
                  return object ? value : {};
                }
                result2 = initCloneByTag(value, tag, isDeep);
              }
            }
            stack || (stack = new Stack());
            var stacked = stack.get(value);
            if (stacked) {
              return stacked;
            }
            stack.set(value, result2);
            if (isSet(value)) {
              value.forEach(function(subValue) {
                result2.add(baseClone(subValue, bitmask, customizer, subValue, value, stack));
              });
            } else if (isMap(value)) {
              value.forEach(function(subValue, key2) {
                result2.set(key2, baseClone(subValue, bitmask, customizer, key2, value, stack));
              });
            }
            var keysFunc = isFull ? isFlat ? getAllKeysIn : getAllKeys : isFlat ? keysIn : keys;
            var props = isArr ? undefined2 : keysFunc(value);
            arrayEach(props || value, function(subValue, key2) {
              if (props) {
                key2 = subValue;
                subValue = value[key2];
              }
              assignValue(result2, key2, baseClone(subValue, bitmask, customizer, key2, value, stack));
            });
            return result2;
          }
          function baseConforms(source) {
            var props = keys(source);
            return function(object) {
              return baseConformsTo(object, source, props);
            };
          }
          function baseConformsTo(object, source, props) {
            var length = props.length;
            if (object == null) {
              return !length;
            }
            object = Object2(object);
            while (length--) {
              var key = props[length], predicate = source[key], value = object[key];
              if (value === undefined2 && !(key in object) || !predicate(value)) {
                return false;
              }
            }
            return true;
          }
          function baseDelay(func, wait, args) {
            if (typeof func != "function") {
              throw new TypeError2(FUNC_ERROR_TEXT);
            }
            return setTimeout2(function() {
              func.apply(undefined2, args);
            }, wait);
          }
          function baseDifference(array, values2, iteratee2, comparator) {
            var index = -1, includes2 = arrayIncludes, isCommon = true, length = array.length, result2 = [], valuesLength = values2.length;
            if (!length) {
              return result2;
            }
            if (iteratee2) {
              values2 = arrayMap(values2, baseUnary(iteratee2));
            }
            if (comparator) {
              includes2 = arrayIncludesWith;
              isCommon = false;
            } else if (values2.length >= LARGE_ARRAY_SIZE) {
              includes2 = cacheHas;
              isCommon = false;
              values2 = new SetCache(values2);
            }
            outer:
              while (++index < length) {
                var value = array[index], computed = iteratee2 == null ? value : iteratee2(value);
                value = comparator || value !== 0 ? value : 0;
                if (isCommon && computed === computed) {
                  var valuesIndex = valuesLength;
                  while (valuesIndex--) {
                    if (values2[valuesIndex] === computed) {
                      continue outer;
                    }
                  }
                  result2.push(value);
                } else if (!includes2(values2, computed, comparator)) {
                  result2.push(value);
                }
              }
            return result2;
          }
          var baseEach = createBaseEach(baseForOwn);
          var baseEachRight = createBaseEach(baseForOwnRight, true);
          function baseEvery(collection, predicate) {
            var result2 = true;
            baseEach(collection, function(value, index, collection2) {
              result2 = !!predicate(value, index, collection2);
              return result2;
            });
            return result2;
          }
          function baseExtremum(array, iteratee2, comparator) {
            var index = -1, length = array.length;
            while (++index < length) {
              var value = array[index], current = iteratee2(value);
              if (current != null && (computed === undefined2 ? current === current && !isSymbol(current) : comparator(current, computed))) {
                var computed = current, result2 = value;
              }
            }
            return result2;
          }
          function baseFill(array, value, start, end) {
            var length = array.length;
            start = toInteger(start);
            if (start < 0) {
              start = -start > length ? 0 : length + start;
            }
            end = end === undefined2 || end > length ? length : toInteger(end);
            if (end < 0) {
              end += length;
            }
            end = start > end ? 0 : toLength(end);
            while (start < end) {
              array[start++] = value;
            }
            return array;
          }
          function baseFilter(collection, predicate) {
            var result2 = [];
            baseEach(collection, function(value, index, collection2) {
              if (predicate(value, index, collection2)) {
                result2.push(value);
              }
            });
            return result2;
          }
          function baseFlatten(array, depth, predicate, isStrict, result2) {
            var index = -1, length = array.length;
            predicate || (predicate = isFlattenable);
            result2 || (result2 = []);
            while (++index < length) {
              var value = array[index];
              if (depth > 0 && predicate(value)) {
                if (depth > 1) {
                  baseFlatten(value, depth - 1, predicate, isStrict, result2);
                } else {
                  arrayPush(result2, value);
                }
              } else if (!isStrict) {
                result2[result2.length] = value;
              }
            }
            return result2;
          }
          var baseFor = createBaseFor();
          var baseForRight = createBaseFor(true);
          function baseForOwn(object, iteratee2) {
            return object && baseFor(object, iteratee2, keys);
          }
          function baseForOwnRight(object, iteratee2) {
            return object && baseForRight(object, iteratee2, keys);
          }
          function baseFunctions(object, props) {
            return arrayFilter(props, function(key) {
              return isFunction(object[key]);
            });
          }
          function baseGet(object, path) {
            path = castPath(path, object);
            var index = 0, length = path.length;
            while (object != null && index < length) {
              object = object[toKey(path[index++])];
            }
            return index && index == length ? object : undefined2;
          }
          function baseGetAllKeys(object, keysFunc, symbolsFunc) {
            var result2 = keysFunc(object);
            return isArray(object) ? result2 : arrayPush(result2, symbolsFunc(object));
          }
          function baseGetTag(value) {
            if (value == null) {
              return value === undefined2 ? undefinedTag : nullTag;
            }
            return symToStringTag && symToStringTag in Object2(value) ? getRawTag(value) : objectToString(value);
          }
          function baseGt(value, other) {
            return value > other;
          }
          function baseHas(object, key) {
            return object != null && hasOwnProperty.call(object, key);
          }
          function baseHasIn(object, key) {
            return object != null && key in Object2(object);
          }
          function baseInRange(number, start, end) {
            return number >= nativeMin(start, end) && number < nativeMax(start, end);
          }
          function baseIntersection(arrays, iteratee2, comparator) {
            var includes2 = comparator ? arrayIncludesWith : arrayIncludes, length = arrays[0].length, othLength = arrays.length, othIndex = othLength, caches = Array2(othLength), maxLength = Infinity, result2 = [];
            while (othIndex--) {
              var array = arrays[othIndex];
              if (othIndex && iteratee2) {
                array = arrayMap(array, baseUnary(iteratee2));
              }
              maxLength = nativeMin(array.length, maxLength);
              caches[othIndex] = !comparator && (iteratee2 || length >= 120 && array.length >= 120) ? new SetCache(othIndex && array) : undefined2;
            }
            array = arrays[0];
            var index = -1, seen = caches[0];
            outer:
              while (++index < length && result2.length < maxLength) {
                var value = array[index], computed = iteratee2 ? iteratee2(value) : value;
                value = comparator || value !== 0 ? value : 0;
                if (!(seen ? cacheHas(seen, computed) : includes2(result2, computed, comparator))) {
                  othIndex = othLength;
                  while (--othIndex) {
                    var cache = caches[othIndex];
                    if (!(cache ? cacheHas(cache, computed) : includes2(arrays[othIndex], computed, comparator))) {
                      continue outer;
                    }
                  }
                  if (seen) {
                    seen.push(computed);
                  }
                  result2.push(value);
                }
              }
            return result2;
          }
          function baseInverter(object, setter, iteratee2, accumulator) {
            baseForOwn(object, function(value, key, object2) {
              setter(accumulator, iteratee2(value), key, object2);
            });
            return accumulator;
          }
          function baseInvoke(object, path, args) {
            path = castPath(path, object);
            object = parent(object, path);
            var func = object == null ? object : object[toKey(last(path))];
            return func == null ? undefined2 : apply(func, object, args);
          }
          function baseIsArguments(value) {
            return isObjectLike(value) && baseGetTag(value) == argsTag;
          }
          function baseIsArrayBuffer(value) {
            return isObjectLike(value) && baseGetTag(value) == arrayBufferTag;
          }
          function baseIsDate(value) {
            return isObjectLike(value) && baseGetTag(value) == dateTag;
          }
          function baseIsEqual(value, other, bitmask, customizer, stack) {
            if (value === other) {
              return true;
            }
            if (value == null || other == null || !isObjectLike(value) && !isObjectLike(other)) {
              return value !== value && other !== other;
            }
            return baseIsEqualDeep(value, other, bitmask, customizer, baseIsEqual, stack);
          }
          function baseIsEqualDeep(object, other, bitmask, customizer, equalFunc, stack) {
            var objIsArr = isArray(object), othIsArr = isArray(other), objTag = objIsArr ? arrayTag : getTag(object), othTag = othIsArr ? arrayTag : getTag(other);
            objTag = objTag == argsTag ? objectTag : objTag;
            othTag = othTag == argsTag ? objectTag : othTag;
            var objIsObj = objTag == objectTag, othIsObj = othTag == objectTag, isSameTag = objTag == othTag;
            if (isSameTag && isBuffer(object)) {
              if (!isBuffer(other)) {
                return false;
              }
              objIsArr = true;
              objIsObj = false;
            }
            if (isSameTag && !objIsObj) {
              stack || (stack = new Stack());
              return objIsArr || isTypedArray(object) ? equalArrays(object, other, bitmask, customizer, equalFunc, stack) : equalByTag(object, other, objTag, bitmask, customizer, equalFunc, stack);
            }
            if (!(bitmask & COMPARE_PARTIAL_FLAG)) {
              var objIsWrapped = objIsObj && hasOwnProperty.call(object, "__wrapped__"), othIsWrapped = othIsObj && hasOwnProperty.call(other, "__wrapped__");
              if (objIsWrapped || othIsWrapped) {
                var objUnwrapped = objIsWrapped ? object.value() : object, othUnwrapped = othIsWrapped ? other.value() : other;
                stack || (stack = new Stack());
                return equalFunc(objUnwrapped, othUnwrapped, bitmask, customizer, stack);
              }
            }
            if (!isSameTag) {
              return false;
            }
            stack || (stack = new Stack());
            return equalObjects(object, other, bitmask, customizer, equalFunc, stack);
          }
          function baseIsMap(value) {
            return isObjectLike(value) && getTag(value) == mapTag;
          }
          function baseIsMatch(object, source, matchData, customizer) {
            var index = matchData.length, length = index, noCustomizer = !customizer;
            if (object == null) {
              return !length;
            }
            object = Object2(object);
            while (index--) {
              var data = matchData[index];
              if (noCustomizer && data[2] ? data[1] !== object[data[0]] : !(data[0] in object)) {
                return false;
              }
            }
            while (++index < length) {
              data = matchData[index];
              var key = data[0], objValue = object[key], srcValue = data[1];
              if (noCustomizer && data[2]) {
                if (objValue === undefined2 && !(key in object)) {
                  return false;
                }
              } else {
                var stack = new Stack();
                if (customizer) {
                  var result2 = customizer(objValue, srcValue, key, object, source, stack);
                }
                if (!(result2 === undefined2 ? baseIsEqual(srcValue, objValue, COMPARE_PARTIAL_FLAG | COMPARE_UNORDERED_FLAG, customizer, stack) : result2)) {
                  return false;
                }
              }
            }
            return true;
          }
          function baseIsNative(value) {
            if (!isObject(value) || isMasked(value)) {
              return false;
            }
            var pattern = isFunction(value) ? reIsNative : reIsHostCtor;
            return pattern.test(toSource(value));
          }
          function baseIsRegExp(value) {
            return isObjectLike(value) && baseGetTag(value) == regexpTag;
          }
          function baseIsSet(value) {
            return isObjectLike(value) && getTag(value) == setTag;
          }
          function baseIsTypedArray(value) {
            return isObjectLike(value) && isLength(value.length) && !!typedArrayTags[baseGetTag(value)];
          }
          function baseIteratee(value) {
            if (typeof value == "function") {
              return value;
            }
            if (value == null) {
              return identity;
            }
            if (typeof value == "object") {
              return isArray(value) ? baseMatchesProperty(value[0], value[1]) : baseMatches(value);
            }
            return property(value);
          }
          function baseKeys(object) {
            if (!isPrototype(object)) {
              return nativeKeys(object);
            }
            var result2 = [];
            for (var key in Object2(object)) {
              if (hasOwnProperty.call(object, key) && key != "constructor") {
                result2.push(key);
              }
            }
            return result2;
          }
          function baseKeysIn(object) {
            if (!isObject(object)) {
              return nativeKeysIn(object);
            }
            var isProto = isPrototype(object), result2 = [];
            for (var key in object) {
              if (!(key == "constructor" && (isProto || !hasOwnProperty.call(object, key)))) {
                result2.push(key);
              }
            }
            return result2;
          }
          function baseLt(value, other) {
            return value < other;
          }
          function baseMap(collection, iteratee2) {
            var index = -1, result2 = isArrayLike(collection) ? Array2(collection.length) : [];
            baseEach(collection, function(value, key, collection2) {
              result2[++index] = iteratee2(value, key, collection2);
            });
            return result2;
          }
          function baseMatches(source) {
            var matchData = getMatchData(source);
            if (matchData.length == 1 && matchData[0][2]) {
              return matchesStrictComparable(matchData[0][0], matchData[0][1]);
            }
            return function(object) {
              return object === source || baseIsMatch(object, source, matchData);
            };
          }
          function baseMatchesProperty(path, srcValue) {
            if (isKey(path) && isStrictComparable(srcValue)) {
              return matchesStrictComparable(toKey(path), srcValue);
            }
            return function(object) {
              var objValue = get(object, path);
              return objValue === undefined2 && objValue === srcValue ? hasIn(object, path) : baseIsEqual(srcValue, objValue, COMPARE_PARTIAL_FLAG | COMPARE_UNORDERED_FLAG);
            };
          }
          function baseMerge(object, source, srcIndex, customizer, stack) {
            if (object === source) {
              return;
            }
            baseFor(source, function(srcValue, key) {
              stack || (stack = new Stack());
              if (isObject(srcValue)) {
                baseMergeDeep(object, source, key, srcIndex, baseMerge, customizer, stack);
              } else {
                var newValue = customizer ? customizer(safeGet(object, key), srcValue, key + "", object, source, stack) : undefined2;
                if (newValue === undefined2) {
                  newValue = srcValue;
                }
                assignMergeValue(object, key, newValue);
              }
            }, keysIn);
          }
          function baseMergeDeep(object, source, key, srcIndex, mergeFunc, customizer, stack) {
            var objValue = safeGet(object, key), srcValue = safeGet(source, key), stacked = stack.get(srcValue);
            if (stacked) {
              assignMergeValue(object, key, stacked);
              return;
            }
            var newValue = customizer ? customizer(objValue, srcValue, key + "", object, source, stack) : undefined2;
            var isCommon = newValue === undefined2;
            if (isCommon) {
              var isArr = isArray(srcValue), isBuff = !isArr && isBuffer(srcValue), isTyped = !isArr && !isBuff && isTypedArray(srcValue);
              newValue = srcValue;
              if (isArr || isBuff || isTyped) {
                if (isArray(objValue)) {
                  newValue = objValue;
                } else if (isArrayLikeObject(objValue)) {
                  newValue = copyArray(objValue);
                } else if (isBuff) {
                  isCommon = false;
                  newValue = cloneBuffer(srcValue, true);
                } else if (isTyped) {
                  isCommon = false;
                  newValue = cloneTypedArray(srcValue, true);
                } else {
                  newValue = [];
                }
              } else if (isPlainObject(srcValue) || isArguments(srcValue)) {
                newValue = objValue;
                if (isArguments(objValue)) {
                  newValue = toPlainObject(objValue);
                } else if (!isObject(objValue) || isFunction(objValue)) {
                  newValue = initCloneObject(srcValue);
                }
              } else {
                isCommon = false;
              }
            }
            if (isCommon) {
              stack.set(srcValue, newValue);
              mergeFunc(newValue, srcValue, srcIndex, customizer, stack);
              stack["delete"](srcValue);
            }
            assignMergeValue(object, key, newValue);
          }
          function baseNth(array, n) {
            var length = array.length;
            if (!length) {
              return;
            }
            n += n < 0 ? length : 0;
            return isIndex(n, length) ? array[n] : undefined2;
          }
          function baseOrderBy(collection, iteratees, orders) {
            if (iteratees.length) {
              iteratees = arrayMap(iteratees, function(iteratee2) {
                if (isArray(iteratee2)) {
                  return function(value) {
                    return baseGet(value, iteratee2.length === 1 ? iteratee2[0] : iteratee2);
                  };
                }
                return iteratee2;
              });
            } else {
              iteratees = [identity];
            }
            var index = -1;
            iteratees = arrayMap(iteratees, baseUnary(getIteratee()));
            var result2 = baseMap(collection, function(value, key, collection2) {
              var criteria = arrayMap(iteratees, function(iteratee2) {
                return iteratee2(value);
              });
              return { "criteria": criteria, "index": ++index, "value": value };
            });
            return baseSortBy(result2, function(object, other) {
              return compareMultiple(object, other, orders);
            });
          }
          function basePick(object, paths) {
            return basePickBy(object, paths, function(value, path) {
              return hasIn(object, path);
            });
          }
          function basePickBy(object, paths, predicate) {
            var index = -1, length = paths.length, result2 = {};
            while (++index < length) {
              var path = paths[index], value = baseGet(object, path);
              if (predicate(value, path)) {
                baseSet(result2, castPath(path, object), value);
              }
            }
            return result2;
          }
          function basePropertyDeep(path) {
            return function(object) {
              return baseGet(object, path);
            };
          }
          function basePullAll(array, values2, iteratee2, comparator) {
            var indexOf2 = comparator ? baseIndexOfWith : baseIndexOf, index = -1, length = values2.length, seen = array;
            if (array === values2) {
              values2 = copyArray(values2);
            }
            if (iteratee2) {
              seen = arrayMap(array, baseUnary(iteratee2));
            }
            while (++index < length) {
              var fromIndex = 0, value = values2[index], computed = iteratee2 ? iteratee2(value) : value;
              while ((fromIndex = indexOf2(seen, computed, fromIndex, comparator)) > -1) {
                if (seen !== array) {
                  splice.call(seen, fromIndex, 1);
                }
                splice.call(array, fromIndex, 1);
              }
            }
            return array;
          }
          function basePullAt(array, indexes) {
            var length = array ? indexes.length : 0, lastIndex = length - 1;
            while (length--) {
              var index = indexes[length];
              if (length == lastIndex || index !== previous) {
                var previous = index;
                if (isIndex(index)) {
                  splice.call(array, index, 1);
                } else {
                  baseUnset(array, index);
                }
              }
            }
            return array;
          }
          function baseRandom(lower, upper) {
            return lower + nativeFloor(nativeRandom() * (upper - lower + 1));
          }
          function baseRange(start, end, step, fromRight) {
            var index = -1, length = nativeMax(nativeCeil((end - start) / (step || 1)), 0), result2 = Array2(length);
            while (length--) {
              result2[fromRight ? length : ++index] = start;
              start += step;
            }
            return result2;
          }
          function baseRepeat(string, n) {
            var result2 = "";
            if (!string || n < 1 || n > MAX_SAFE_INTEGER) {
              return result2;
            }
            do {
              if (n % 2) {
                result2 += string;
              }
              n = nativeFloor(n / 2);
              if (n) {
                string += string;
              }
            } while (n);
            return result2;
          }
          function baseRest(func, start) {
            return setToString(overRest(func, start, identity), func + "");
          }
          function baseSample(collection) {
            return arraySample(values(collection));
          }
          function baseSampleSize(collection, n) {
            var array = values(collection);
            return shuffleSelf(array, baseClamp(n, 0, array.length));
          }
          function baseSet(object, path, value, customizer) {
            if (!isObject(object)) {
              return object;
            }
            path = castPath(path, object);
            var index = -1, length = path.length, lastIndex = length - 1, nested = object;
            while (nested != null && ++index < length) {
              var key = toKey(path[index]), newValue = value;
              if (key === "__proto__" || key === "constructor" || key === "prototype") {
                return object;
              }
              if (index != lastIndex) {
                var objValue = nested[key];
                newValue = customizer ? customizer(objValue, key, nested) : undefined2;
                if (newValue === undefined2) {
                  newValue = isObject(objValue) ? objValue : isIndex(path[index + 1]) ? [] : {};
                }
              }
              assignValue(nested, key, newValue);
              nested = nested[key];
            }
            return object;
          }
          var baseSetData = !metaMap ? identity : function(func, data) {
            metaMap.set(func, data);
            return func;
          };
          var baseSetToString = !defineProperty ? identity : function(func, string) {
            return defineProperty(func, "toString", {
              "configurable": true,
              "enumerable": false,
              "value": constant(string),
              "writable": true
            });
          };
          function baseShuffle(collection) {
            return shuffleSelf(values(collection));
          }
          function baseSlice(array, start, end) {
            var index = -1, length = array.length;
            if (start < 0) {
              start = -start > length ? 0 : length + start;
            }
            end = end > length ? length : end;
            if (end < 0) {
              end += length;
            }
            length = start > end ? 0 : end - start >>> 0;
            start >>>= 0;
            var result2 = Array2(length);
            while (++index < length) {
              result2[index] = array[index + start];
            }
            return result2;
          }
          function baseSome(collection, predicate) {
            var result2;
            baseEach(collection, function(value, index, collection2) {
              result2 = predicate(value, index, collection2);
              return !result2;
            });
            return !!result2;
          }
          function baseSortedIndex(array, value, retHighest) {
            var low = 0, high = array == null ? low : array.length;
            if (typeof value == "number" && value === value && high <= HALF_MAX_ARRAY_LENGTH) {
              while (low < high) {
                var mid = low + high >>> 1, computed = array[mid];
                if (computed !== null && !isSymbol(computed) && (retHighest ? computed <= value : computed < value)) {
                  low = mid + 1;
                } else {
                  high = mid;
                }
              }
              return high;
            }
            return baseSortedIndexBy(array, value, identity, retHighest);
          }
          function baseSortedIndexBy(array, value, iteratee2, retHighest) {
            var low = 0, high = array == null ? 0 : array.length;
            if (high === 0) {
              return 0;
            }
            value = iteratee2(value);
            var valIsNaN = value !== value, valIsNull = value === null, valIsSymbol = isSymbol(value), valIsUndefined = value === undefined2;
            while (low < high) {
              var mid = nativeFloor((low + high) / 2), computed = iteratee2(array[mid]), othIsDefined = computed !== undefined2, othIsNull = computed === null, othIsReflexive = computed === computed, othIsSymbol = isSymbol(computed);
              if (valIsNaN) {
                var setLow = retHighest || othIsReflexive;
              } else if (valIsUndefined) {
                setLow = othIsReflexive && (retHighest || othIsDefined);
              } else if (valIsNull) {
                setLow = othIsReflexive && othIsDefined && (retHighest || !othIsNull);
              } else if (valIsSymbol) {
                setLow = othIsReflexive && othIsDefined && !othIsNull && (retHighest || !othIsSymbol);
              } else if (othIsNull || othIsSymbol) {
                setLow = false;
              } else {
                setLow = retHighest ? computed <= value : computed < value;
              }
              if (setLow) {
                low = mid + 1;
              } else {
                high = mid;
              }
            }
            return nativeMin(high, MAX_ARRAY_INDEX);
          }
          function baseSortedUniq(array, iteratee2) {
            var index = -1, length = array.length, resIndex = 0, result2 = [];
            while (++index < length) {
              var value = array[index], computed = iteratee2 ? iteratee2(value) : value;
              if (!index || !eq(computed, seen)) {
                var seen = computed;
                result2[resIndex++] = value === 0 ? 0 : value;
              }
            }
            return result2;
          }
          function baseToNumber(value) {
            if (typeof value == "number") {
              return value;
            }
            if (isSymbol(value)) {
              return NAN;
            }
            return +value;
          }
          function baseToString(value) {
            if (typeof value == "string") {
              return value;
            }
            if (isArray(value)) {
              return arrayMap(value, baseToString) + "";
            }
            if (isSymbol(value)) {
              return symbolToString ? symbolToString.call(value) : "";
            }
            var result2 = value + "";
            return result2 == "0" && 1 / value == -INFINITY ? "-0" : result2;
          }
          function baseUniq(array, iteratee2, comparator) {
            var index = -1, includes2 = arrayIncludes, length = array.length, isCommon = true, result2 = [], seen = result2;
            if (comparator) {
              isCommon = false;
              includes2 = arrayIncludesWith;
            } else if (length >= LARGE_ARRAY_SIZE) {
              var set2 = iteratee2 ? null : createSet(array);
              if (set2) {
                return setToArray(set2);
              }
              isCommon = false;
              includes2 = cacheHas;
              seen = new SetCache();
            } else {
              seen = iteratee2 ? [] : result2;
            }
            outer:
              while (++index < length) {
                var value = array[index], computed = iteratee2 ? iteratee2(value) : value;
                value = comparator || value !== 0 ? value : 0;
                if (isCommon && computed === computed) {
                  var seenIndex = seen.length;
                  while (seenIndex--) {
                    if (seen[seenIndex] === computed) {
                      continue outer;
                    }
                  }
                  if (iteratee2) {
                    seen.push(computed);
                  }
                  result2.push(value);
                } else if (!includes2(seen, computed, comparator)) {
                  if (seen !== result2) {
                    seen.push(computed);
                  }
                  result2.push(value);
                }
              }
            return result2;
          }
          function baseUnset(object, path) {
            path = castPath(path, object);
            object = parent(object, path);
            return object == null || delete object[toKey(last(path))];
          }
          function baseUpdate(object, path, updater, customizer) {
            return baseSet(object, path, updater(baseGet(object, path)), customizer);
          }
          function baseWhile(array, predicate, isDrop, fromRight) {
            var length = array.length, index = fromRight ? length : -1;
            while ((fromRight ? index-- : ++index < length) && predicate(array[index], index, array)) {
            }
            return isDrop ? baseSlice(array, fromRight ? 0 : index, fromRight ? index + 1 : length) : baseSlice(array, fromRight ? index + 1 : 0, fromRight ? length : index);
          }
          function baseWrapperValue(value, actions) {
            var result2 = value;
            if (result2 instanceof LazyWrapper) {
              result2 = result2.value();
            }
            return arrayReduce(actions, function(result3, action) {
              return action.func.apply(action.thisArg, arrayPush([result3], action.args));
            }, result2);
          }
          function baseXor(arrays, iteratee2, comparator) {
            var length = arrays.length;
            if (length < 2) {
              return length ? baseUniq(arrays[0]) : [];
            }
            var index = -1, result2 = Array2(length);
            while (++index < length) {
              var array = arrays[index], othIndex = -1;
              while (++othIndex < length) {
                if (othIndex != index) {
                  result2[index] = baseDifference(result2[index] || array, arrays[othIndex], iteratee2, comparator);
                }
              }
            }
            return baseUniq(baseFlatten(result2, 1), iteratee2, comparator);
          }
          function baseZipObject(props, values2, assignFunc) {
            var index = -1, length = props.length, valsLength = values2.length, result2 = {};
            while (++index < length) {
              var value = index < valsLength ? values2[index] : undefined2;
              assignFunc(result2, props[index], value);
            }
            return result2;
          }
          function castArrayLikeObject(value) {
            return isArrayLikeObject(value) ? value : [];
          }
          function castFunction(value) {
            return typeof value == "function" ? value : identity;
          }
          function castPath(value, object) {
            if (isArray(value)) {
              return value;
            }
            return isKey(value, object) ? [value] : stringToPath(toString(value));
          }
          var castRest = baseRest;
          function castSlice(array, start, end) {
            var length = array.length;
            end = end === undefined2 ? length : end;
            return !start && end >= length ? array : baseSlice(array, start, end);
          }
          var clearTimeout2 = ctxClearTimeout || function(id) {
            return root.clearTimeout(id);
          };
          function cloneBuffer(buffer, isDeep) {
            if (isDeep) {
              return buffer.slice();
            }
            var length = buffer.length, result2 = allocUnsafe ? allocUnsafe(length) : new buffer.constructor(length);
            buffer.copy(result2);
            return result2;
          }
          function cloneArrayBuffer(arrayBuffer) {
            var result2 = new arrayBuffer.constructor(arrayBuffer.byteLength);
            new Uint8Array2(result2).set(new Uint8Array2(arrayBuffer));
            return result2;
          }
          function cloneDataView(dataView, isDeep) {
            var buffer = isDeep ? cloneArrayBuffer(dataView.buffer) : dataView.buffer;
            return new dataView.constructor(buffer, dataView.byteOffset, dataView.byteLength);
          }
          function cloneRegExp(regexp) {
            var result2 = new regexp.constructor(regexp.source, reFlags.exec(regexp));
            result2.lastIndex = regexp.lastIndex;
            return result2;
          }
          function cloneSymbol(symbol) {
            return symbolValueOf ? Object2(symbolValueOf.call(symbol)) : {};
          }
          function cloneTypedArray(typedArray, isDeep) {
            var buffer = isDeep ? cloneArrayBuffer(typedArray.buffer) : typedArray.buffer;
            return new typedArray.constructor(buffer, typedArray.byteOffset, typedArray.length);
          }
          function compareAscending(value, other) {
            if (value !== other) {
              var valIsDefined = value !== undefined2, valIsNull = value === null, valIsReflexive = value === value, valIsSymbol = isSymbol(value);
              var othIsDefined = other !== undefined2, othIsNull = other === null, othIsReflexive = other === other, othIsSymbol = isSymbol(other);
              if (!othIsNull && !othIsSymbol && !valIsSymbol && value > other || valIsSymbol && othIsDefined && othIsReflexive && !othIsNull && !othIsSymbol || valIsNull && othIsDefined && othIsReflexive || !valIsDefined && othIsReflexive || !valIsReflexive) {
                return 1;
              }
              if (!valIsNull && !valIsSymbol && !othIsSymbol && value < other || othIsSymbol && valIsDefined && valIsReflexive && !valIsNull && !valIsSymbol || othIsNull && valIsDefined && valIsReflexive || !othIsDefined && valIsReflexive || !othIsReflexive) {
                return -1;
              }
            }
            return 0;
          }
          function compareMultiple(object, other, orders) {
            var index = -1, objCriteria = object.criteria, othCriteria = other.criteria, length = objCriteria.length, ordersLength = orders.length;
            while (++index < length) {
              var result2 = compareAscending(objCriteria[index], othCriteria[index]);
              if (result2) {
                if (index >= ordersLength) {
                  return result2;
                }
                var order = orders[index];
                return result2 * (order == "desc" ? -1 : 1);
              }
            }
            return object.index - other.index;
          }
          function composeArgs(args, partials, holders, isCurried) {
            var argsIndex = -1, argsLength = args.length, holdersLength = holders.length, leftIndex = -1, leftLength = partials.length, rangeLength = nativeMax(argsLength - holdersLength, 0), result2 = Array2(leftLength + rangeLength), isUncurried = !isCurried;
            while (++leftIndex < leftLength) {
              result2[leftIndex] = partials[leftIndex];
            }
            while (++argsIndex < holdersLength) {
              if (isUncurried || argsIndex < argsLength) {
                result2[holders[argsIndex]] = args[argsIndex];
              }
            }
            while (rangeLength--) {
              result2[leftIndex++] = args[argsIndex++];
            }
            return result2;
          }
          function composeArgsRight(args, partials, holders, isCurried) {
            var argsIndex = -1, argsLength = args.length, holdersIndex = -1, holdersLength = holders.length, rightIndex = -1, rightLength = partials.length, rangeLength = nativeMax(argsLength - holdersLength, 0), result2 = Array2(rangeLength + rightLength), isUncurried = !isCurried;
            while (++argsIndex < rangeLength) {
              result2[argsIndex] = args[argsIndex];
            }
            var offset = argsIndex;
            while (++rightIndex < rightLength) {
              result2[offset + rightIndex] = partials[rightIndex];
            }
            while (++holdersIndex < holdersLength) {
              if (isUncurried || argsIndex < argsLength) {
                result2[offset + holders[holdersIndex]] = args[argsIndex++];
              }
            }
            return result2;
          }
          function copyArray(source, array) {
            var index = -1, length = source.length;
            array || (array = Array2(length));
            while (++index < length) {
              array[index] = source[index];
            }
            return array;
          }
          function copyObject(source, props, object, customizer) {
            var isNew = !object;
            object || (object = {});
            var index = -1, length = props.length;
            while (++index < length) {
              var key = props[index];
              var newValue = customizer ? customizer(object[key], source[key], key, object, source) : undefined2;
              if (newValue === undefined2) {
                newValue = source[key];
              }
              if (isNew) {
                baseAssignValue(object, key, newValue);
              } else {
                assignValue(object, key, newValue);
              }
            }
            return object;
          }
          function copySymbols(source, object) {
            return copyObject(source, getSymbols(source), object);
          }
          function copySymbolsIn(source, object) {
            return copyObject(source, getSymbolsIn(source), object);
          }
          function createAggregator(setter, initializer) {
            return function(collection, iteratee2) {
              var func = isArray(collection) ? arrayAggregator : baseAggregator, accumulator = initializer ? initializer() : {};
              return func(collection, setter, getIteratee(iteratee2, 2), accumulator);
            };
          }
          function createAssigner(assigner) {
            return baseRest(function(object, sources) {
              var index = -1, length = sources.length, customizer = length > 1 ? sources[length - 1] : undefined2, guard = length > 2 ? sources[2] : undefined2;
              customizer = assigner.length > 3 && typeof customizer == "function" ? (length--, customizer) : undefined2;
              if (guard && isIterateeCall(sources[0], sources[1], guard)) {
                customizer = length < 3 ? undefined2 : customizer;
                length = 1;
              }
              object = Object2(object);
              while (++index < length) {
                var source = sources[index];
                if (source) {
                  assigner(object, source, index, customizer);
                }
              }
              return object;
            });
          }
          function createBaseEach(eachFunc, fromRight) {
            return function(collection, iteratee2) {
              if (collection == null) {
                return collection;
              }
              if (!isArrayLike(collection)) {
                return eachFunc(collection, iteratee2);
              }
              var length = collection.length, index = fromRight ? length : -1, iterable = Object2(collection);
              while (fromRight ? index-- : ++index < length) {
                if (iteratee2(iterable[index], index, iterable) === false) {
                  break;
                }
              }
              return collection;
            };
          }
          function createBaseFor(fromRight) {
            return function(object, iteratee2, keysFunc) {
              var index = -1, iterable = Object2(object), props = keysFunc(object), length = props.length;
              while (length--) {
                var key = props[fromRight ? length : ++index];
                if (iteratee2(iterable[key], key, iterable) === false) {
                  break;
                }
              }
              return object;
            };
          }
          function createBind(func, bitmask, thisArg) {
            var isBind = bitmask & WRAP_BIND_FLAG, Ctor = createCtor(func);
            function wrapper() {
              var fn = this && this !== root && this instanceof wrapper ? Ctor : func;
              return fn.apply(isBind ? thisArg : this, arguments);
            }
            return wrapper;
          }
          function createCaseFirst(methodName) {
            return function(string) {
              string = toString(string);
              var strSymbols = hasUnicode(string) ? stringToArray(string) : undefined2;
              var chr = strSymbols ? strSymbols[0] : string.charAt(0);
              var trailing = strSymbols ? castSlice(strSymbols, 1).join("") : string.slice(1);
              return chr[methodName]() + trailing;
            };
          }
          function createCompounder(callback) {
            return function(string) {
              return arrayReduce(words(deburr(string).replace(reApos, "")), callback, "");
            };
          }
          function createCtor(Ctor) {
            return function() {
              var args = arguments;
              switch (args.length) {
                case 0:
                  return new Ctor();
                case 1:
                  return new Ctor(args[0]);
                case 2:
                  return new Ctor(args[0], args[1]);
                case 3:
                  return new Ctor(args[0], args[1], args[2]);
                case 4:
                  return new Ctor(args[0], args[1], args[2], args[3]);
                case 5:
                  return new Ctor(args[0], args[1], args[2], args[3], args[4]);
                case 6:
                  return new Ctor(args[0], args[1], args[2], args[3], args[4], args[5]);
                case 7:
                  return new Ctor(args[0], args[1], args[2], args[3], args[4], args[5], args[6]);
              }
              var thisBinding = baseCreate(Ctor.prototype), result2 = Ctor.apply(thisBinding, args);
              return isObject(result2) ? result2 : thisBinding;
            };
          }
          function createCurry(func, bitmask, arity) {
            var Ctor = createCtor(func);
            function wrapper() {
              var length = arguments.length, args = Array2(length), index = length, placeholder = getHolder(wrapper);
              while (index--) {
                args[index] = arguments[index];
              }
              var holders = length < 3 && args[0] !== placeholder && args[length - 1] !== placeholder ? [] : replaceHolders(args, placeholder);
              length -= holders.length;
              if (length < arity) {
                return createRecurry(
                  func,
                  bitmask,
                  createHybrid,
                  wrapper.placeholder,
                  undefined2,
                  args,
                  holders,
                  undefined2,
                  undefined2,
                  arity - length
                );
              }
              var fn = this && this !== root && this instanceof wrapper ? Ctor : func;
              return apply(fn, this, args);
            }
            return wrapper;
          }
          function createFind(findIndexFunc) {
            return function(collection, predicate, fromIndex) {
              var iterable = Object2(collection);
              if (!isArrayLike(collection)) {
                var iteratee2 = getIteratee(predicate, 3);
                collection = keys(collection);
                predicate = function(key) {
                  return iteratee2(iterable[key], key, iterable);
                };
              }
              var index = findIndexFunc(collection, predicate, fromIndex);
              return index > -1 ? iterable[iteratee2 ? collection[index] : index] : undefined2;
            };
          }
          function createFlow(fromRight) {
            return flatRest(function(funcs) {
              var length = funcs.length, index = length, prereq = LodashWrapper.prototype.thru;
              if (fromRight) {
                funcs.reverse();
              }
              while (index--) {
                var func = funcs[index];
                if (typeof func != "function") {
                  throw new TypeError2(FUNC_ERROR_TEXT);
                }
                if (prereq && !wrapper && getFuncName(func) == "wrapper") {
                  var wrapper = new LodashWrapper([], true);
                }
              }
              index = wrapper ? index : length;
              while (++index < length) {
                func = funcs[index];
                var funcName = getFuncName(func), data = funcName == "wrapper" ? getData(func) : undefined2;
                if (data && isLaziable(data[0]) && data[1] == (WRAP_ARY_FLAG | WRAP_CURRY_FLAG | WRAP_PARTIAL_FLAG | WRAP_REARG_FLAG) && !data[4].length && data[9] == 1) {
                  wrapper = wrapper[getFuncName(data[0])].apply(wrapper, data[3]);
                } else {
                  wrapper = func.length == 1 && isLaziable(func) ? wrapper[funcName]() : wrapper.thru(func);
                }
              }
              return function() {
                var args = arguments, value = args[0];
                if (wrapper && args.length == 1 && isArray(value)) {
                  return wrapper.plant(value).value();
                }
                var index2 = 0, result2 = length ? funcs[index2].apply(this, args) : value;
                while (++index2 < length) {
                  result2 = funcs[index2].call(this, result2);
                }
                return result2;
              };
            });
          }
          function createHybrid(func, bitmask, thisArg, partials, holders, partialsRight, holdersRight, argPos, ary2, arity) {
            var isAry = bitmask & WRAP_ARY_FLAG, isBind = bitmask & WRAP_BIND_FLAG, isBindKey = bitmask & WRAP_BIND_KEY_FLAG, isCurried = bitmask & (WRAP_CURRY_FLAG | WRAP_CURRY_RIGHT_FLAG), isFlip = bitmask & WRAP_FLIP_FLAG, Ctor = isBindKey ? undefined2 : createCtor(func);
            function wrapper() {
              var length = arguments.length, args = Array2(length), index = length;
              while (index--) {
                args[index] = arguments[index];
              }
              if (isCurried) {
                var placeholder = getHolder(wrapper), holdersCount = countHolders(args, placeholder);
              }
              if (partials) {
                args = composeArgs(args, partials, holders, isCurried);
              }
              if (partialsRight) {
                args = composeArgsRight(args, partialsRight, holdersRight, isCurried);
              }
              length -= holdersCount;
              if (isCurried && length < arity) {
                var newHolders = replaceHolders(args, placeholder);
                return createRecurry(
                  func,
                  bitmask,
                  createHybrid,
                  wrapper.placeholder,
                  thisArg,
                  args,
                  newHolders,
                  argPos,
                  ary2,
                  arity - length
                );
              }
              var thisBinding = isBind ? thisArg : this, fn = isBindKey ? thisBinding[func] : func;
              length = args.length;
              if (argPos) {
                args = reorder(args, argPos);
              } else if (isFlip && length > 1) {
                args.reverse();
              }
              if (isAry && ary2 < length) {
                args.length = ary2;
              }
              if (this && this !== root && this instanceof wrapper) {
                fn = Ctor || createCtor(fn);
              }
              return fn.apply(thisBinding, args);
            }
            return wrapper;
          }
          function createInverter(setter, toIteratee) {
            return function(object, iteratee2) {
              return baseInverter(object, setter, toIteratee(iteratee2), {});
            };
          }
          function createMathOperation(operator, defaultValue) {
            return function(value, other) {
              var result2;
              if (value === undefined2 && other === undefined2) {
                return defaultValue;
              }
              if (value !== undefined2) {
                result2 = value;
              }
              if (other !== undefined2) {
                if (result2 === undefined2) {
                  return other;
                }
                if (typeof value == "string" || typeof other == "string") {
                  value = baseToString(value);
                  other = baseToString(other);
                } else {
                  value = baseToNumber(value);
                  other = baseToNumber(other);
                }
                result2 = operator(value, other);
              }
              return result2;
            };
          }
          function createOver(arrayFunc) {
            return flatRest(function(iteratees) {
              iteratees = arrayMap(iteratees, baseUnary(getIteratee()));
              return baseRest(function(args) {
                var thisArg = this;
                return arrayFunc(iteratees, function(iteratee2) {
                  return apply(iteratee2, thisArg, args);
                });
              });
            });
          }
          function createPadding(length, chars) {
            chars = chars === undefined2 ? " " : baseToString(chars);
            var charsLength = chars.length;
            if (charsLength < 2) {
              return charsLength ? baseRepeat(chars, length) : chars;
            }
            var result2 = baseRepeat(chars, nativeCeil(length / stringSize(chars)));
            return hasUnicode(chars) ? castSlice(stringToArray(result2), 0, length).join("") : result2.slice(0, length);
          }
          function createPartial(func, bitmask, thisArg, partials) {
            var isBind = bitmask & WRAP_BIND_FLAG, Ctor = createCtor(func);
            function wrapper() {
              var argsIndex = -1, argsLength = arguments.length, leftIndex = -1, leftLength = partials.length, args = Array2(leftLength + argsLength), fn = this && this !== root && this instanceof wrapper ? Ctor : func;
              while (++leftIndex < leftLength) {
                args[leftIndex] = partials[leftIndex];
              }
              while (argsLength--) {
                args[leftIndex++] = arguments[++argsIndex];
              }
              return apply(fn, isBind ? thisArg : this, args);
            }
            return wrapper;
          }
          function createRange(fromRight) {
            return function(start, end, step) {
              if (step && typeof step != "number" && isIterateeCall(start, end, step)) {
                end = step = undefined2;
              }
              start = toFinite(start);
              if (end === undefined2) {
                end = start;
                start = 0;
              } else {
                end = toFinite(end);
              }
              step = step === undefined2 ? start < end ? 1 : -1 : toFinite(step);
              return baseRange(start, end, step, fromRight);
            };
          }
          function createRelationalOperation(operator) {
            return function(value, other) {
              if (!(typeof value == "string" && typeof other == "string")) {
                value = toNumber(value);
                other = toNumber(other);
              }
              return operator(value, other);
            };
          }
          function createRecurry(func, bitmask, wrapFunc, placeholder, thisArg, partials, holders, argPos, ary2, arity) {
            var isCurry = bitmask & WRAP_CURRY_FLAG, newHolders = isCurry ? holders : undefined2, newHoldersRight = isCurry ? undefined2 : holders, newPartials = isCurry ? partials : undefined2, newPartialsRight = isCurry ? undefined2 : partials;
            bitmask |= isCurry ? WRAP_PARTIAL_FLAG : WRAP_PARTIAL_RIGHT_FLAG;
            bitmask &= ~(isCurry ? WRAP_PARTIAL_RIGHT_FLAG : WRAP_PARTIAL_FLAG);
            if (!(bitmask & WRAP_CURRY_BOUND_FLAG)) {
              bitmask &= ~(WRAP_BIND_FLAG | WRAP_BIND_KEY_FLAG);
            }
            var newData = [
              func,
              bitmask,
              thisArg,
              newPartials,
              newHolders,
              newPartialsRight,
              newHoldersRight,
              argPos,
              ary2,
              arity
            ];
            var result2 = wrapFunc.apply(undefined2, newData);
            if (isLaziable(func)) {
              setData(result2, newData);
            }
            result2.placeholder = placeholder;
            return setWrapToString(result2, func, bitmask);
          }
          function createRound(methodName) {
            var func = Math2[methodName];
            return function(number, precision) {
              number = toNumber(number);
              precision = precision == null ? 0 : nativeMin(toInteger(precision), 292);
              if (precision && nativeIsFinite(number)) {
                var pair = (toString(number) + "e").split("e"), value = func(pair[0] + "e" + (+pair[1] + precision));
                pair = (toString(value) + "e").split("e");
                return +(pair[0] + "e" + (+pair[1] - precision));
              }
              return func(number);
            };
          }
          var createSet = !(Set && 1 / setToArray(new Set([, -0]))[1] == INFINITY) ? noop : function(values2) {
            return new Set(values2);
          };
          function createToPairs(keysFunc) {
            return function(object) {
              var tag = getTag(object);
              if (tag == mapTag) {
                return mapToArray(object);
              }
              if (tag == setTag) {
                return setToPairs(object);
              }
              return baseToPairs(object, keysFunc(object));
            };
          }
          function createWrap(func, bitmask, thisArg, partials, holders, argPos, ary2, arity) {
            var isBindKey = bitmask & WRAP_BIND_KEY_FLAG;
            if (!isBindKey && typeof func != "function") {
              throw new TypeError2(FUNC_ERROR_TEXT);
            }
            var length = partials ? partials.length : 0;
            if (!length) {
              bitmask &= ~(WRAP_PARTIAL_FLAG | WRAP_PARTIAL_RIGHT_FLAG);
              partials = holders = undefined2;
            }
            ary2 = ary2 === undefined2 ? ary2 : nativeMax(toInteger(ary2), 0);
            arity = arity === undefined2 ? arity : toInteger(arity);
            length -= holders ? holders.length : 0;
            if (bitmask & WRAP_PARTIAL_RIGHT_FLAG) {
              var partialsRight = partials, holdersRight = holders;
              partials = holders = undefined2;
            }
            var data = isBindKey ? undefined2 : getData(func);
            var newData = [
              func,
              bitmask,
              thisArg,
              partials,
              holders,
              partialsRight,
              holdersRight,
              argPos,
              ary2,
              arity
            ];
            if (data) {
              mergeData(newData, data);
            }
            func = newData[0];
            bitmask = newData[1];
            thisArg = newData[2];
            partials = newData[3];
            holders = newData[4];
            arity = newData[9] = newData[9] === undefined2 ? isBindKey ? 0 : func.length : nativeMax(newData[9] - length, 0);
            if (!arity && bitmask & (WRAP_CURRY_FLAG | WRAP_CURRY_RIGHT_FLAG)) {
              bitmask &= ~(WRAP_CURRY_FLAG | WRAP_CURRY_RIGHT_FLAG);
            }
            if (!bitmask || bitmask == WRAP_BIND_FLAG) {
              var result2 = createBind(func, bitmask, thisArg);
            } else if (bitmask == WRAP_CURRY_FLAG || bitmask == WRAP_CURRY_RIGHT_FLAG) {
              result2 = createCurry(func, bitmask, arity);
            } else if ((bitmask == WRAP_PARTIAL_FLAG || bitmask == (WRAP_BIND_FLAG | WRAP_PARTIAL_FLAG)) && !holders.length) {
              result2 = createPartial(func, bitmask, thisArg, partials);
            } else {
              result2 = createHybrid.apply(undefined2, newData);
            }
            var setter = data ? baseSetData : setData;
            return setWrapToString(setter(result2, newData), func, bitmask);
          }
          function customDefaultsAssignIn(objValue, srcValue, key, object) {
            if (objValue === undefined2 || eq(objValue, objectProto[key]) && !hasOwnProperty.call(object, key)) {
              return srcValue;
            }
            return objValue;
          }
          function customDefaultsMerge(objValue, srcValue, key, object, source, stack) {
            if (isObject(objValue) && isObject(srcValue)) {
              stack.set(srcValue, objValue);
              baseMerge(objValue, srcValue, undefined2, customDefaultsMerge, stack);
              stack["delete"](srcValue);
            }
            return objValue;
          }
          function customOmitClone(value) {
            return isPlainObject(value) ? undefined2 : value;
          }
          function equalArrays(array, other, bitmask, customizer, equalFunc, stack) {
            var isPartial = bitmask & COMPARE_PARTIAL_FLAG, arrLength = array.length, othLength = other.length;
            if (arrLength != othLength && !(isPartial && othLength > arrLength)) {
              return false;
            }
            var arrStacked = stack.get(array);
            var othStacked = stack.get(other);
            if (arrStacked && othStacked) {
              return arrStacked == other && othStacked == array;
            }
            var index = -1, result2 = true, seen = bitmask & COMPARE_UNORDERED_FLAG ? new SetCache() : undefined2;
            stack.set(array, other);
            stack.set(other, array);
            while (++index < arrLength) {
              var arrValue = array[index], othValue = other[index];
              if (customizer) {
                var compared = isPartial ? customizer(othValue, arrValue, index, other, array, stack) : customizer(arrValue, othValue, index, array, other, stack);
              }
              if (compared !== undefined2) {
                if (compared) {
                  continue;
                }
                result2 = false;
                break;
              }
              if (seen) {
                if (!arraySome(other, function(othValue2, othIndex) {
                  if (!cacheHas(seen, othIndex) && (arrValue === othValue2 || equalFunc(arrValue, othValue2, bitmask, customizer, stack))) {
                    return seen.push(othIndex);
                  }
                })) {
                  result2 = false;
                  break;
                }
              } else if (!(arrValue === othValue || equalFunc(arrValue, othValue, bitmask, customizer, stack))) {
                result2 = false;
                break;
              }
            }
            stack["delete"](array);
            stack["delete"](other);
            return result2;
          }
          function equalByTag(object, other, tag, bitmask, customizer, equalFunc, stack) {
            switch (tag) {
              case dataViewTag:
                if (object.byteLength != other.byteLength || object.byteOffset != other.byteOffset) {
                  return false;
                }
                object = object.buffer;
                other = other.buffer;
              case arrayBufferTag:
                if (object.byteLength != other.byteLength || !equalFunc(new Uint8Array2(object), new Uint8Array2(other))) {
                  return false;
                }
                return true;
              case boolTag:
              case dateTag:
              case numberTag:
                return eq(+object, +other);
              case errorTag:
                return object.name == other.name && object.message == other.message;
              case regexpTag:
              case stringTag:
                return object == other + "";
              case mapTag:
                var convert = mapToArray;
              case setTag:
                var isPartial = bitmask & COMPARE_PARTIAL_FLAG;
                convert || (convert = setToArray);
                if (object.size != other.size && !isPartial) {
                  return false;
                }
                var stacked = stack.get(object);
                if (stacked) {
                  return stacked == other;
                }
                bitmask |= COMPARE_UNORDERED_FLAG;
                stack.set(object, other);
                var result2 = equalArrays(convert(object), convert(other), bitmask, customizer, equalFunc, stack);
                stack["delete"](object);
                return result2;
              case symbolTag:
                if (symbolValueOf) {
                  return symbolValueOf.call(object) == symbolValueOf.call(other);
                }
            }
            return false;
          }
          function equalObjects(object, other, bitmask, customizer, equalFunc, stack) {
            var isPartial = bitmask & COMPARE_PARTIAL_FLAG, objProps = getAllKeys(object), objLength = objProps.length, othProps = getAllKeys(other), othLength = othProps.length;
            if (objLength != othLength && !isPartial) {
              return false;
            }
            var index = objLength;
            while (index--) {
              var key = objProps[index];
              if (!(isPartial ? key in other : hasOwnProperty.call(other, key))) {
                return false;
              }
            }
            var objStacked = stack.get(object);
            var othStacked = stack.get(other);
            if (objStacked && othStacked) {
              return objStacked == other && othStacked == object;
            }
            var result2 = true;
            stack.set(object, other);
            stack.set(other, object);
            var skipCtor = isPartial;
            while (++index < objLength) {
              key = objProps[index];
              var objValue = object[key], othValue = other[key];
              if (customizer) {
                var compared = isPartial ? customizer(othValue, objValue, key, other, object, stack) : customizer(objValue, othValue, key, object, other, stack);
              }
              if (!(compared === undefined2 ? objValue === othValue || equalFunc(objValue, othValue, bitmask, customizer, stack) : compared)) {
                result2 = false;
                break;
              }
              skipCtor || (skipCtor = key == "constructor");
            }
            if (result2 && !skipCtor) {
              var objCtor = object.constructor, othCtor = other.constructor;
              if (objCtor != othCtor && ("constructor" in object && "constructor" in other) && !(typeof objCtor == "function" && objCtor instanceof objCtor && typeof othCtor == "function" && othCtor instanceof othCtor)) {
                result2 = false;
              }
            }
            stack["delete"](object);
            stack["delete"](other);
            return result2;
          }
          function flatRest(func) {
            return setToString(overRest(func, undefined2, flatten), func + "");
          }
          function getAllKeys(object) {
            return baseGetAllKeys(object, keys, getSymbols);
          }
          function getAllKeysIn(object) {
            return baseGetAllKeys(object, keysIn, getSymbolsIn);
          }
          var getData = !metaMap ? noop : function(func) {
            return metaMap.get(func);
          };
          function getFuncName(func) {
            var result2 = func.name + "", array = realNames[result2], length = hasOwnProperty.call(realNames, result2) ? array.length : 0;
            while (length--) {
              var data = array[length], otherFunc = data.func;
              if (otherFunc == null || otherFunc == func) {
                return data.name;
              }
            }
            return result2;
          }
          function getHolder(func) {
            var object = hasOwnProperty.call(lodash, "placeholder") ? lodash : func;
            return object.placeholder;
          }
          function getIteratee() {
            var result2 = lodash.iteratee || iteratee;
            result2 = result2 === iteratee ? baseIteratee : result2;
            return arguments.length ? result2(arguments[0], arguments[1]) : result2;
          }
          function getMapData(map2, key) {
            var data = map2.__data__;
            return isKeyable(key) ? data[typeof key == "string" ? "string" : "hash"] : data.map;
          }
          function getMatchData(object) {
            var result2 = keys(object), length = result2.length;
            while (length--) {
              var key = result2[length], value = object[key];
              result2[length] = [key, value, isStrictComparable(value)];
            }
            return result2;
          }
          function getNative(object, key) {
            var value = getValue(object, key);
            return baseIsNative(value) ? value : undefined2;
          }
          function getRawTag(value) {
            var isOwn = hasOwnProperty.call(value, symToStringTag), tag = value[symToStringTag];
            try {
              value[symToStringTag] = undefined2;
              var unmasked = true;
            } catch (e) {
            }
            var result2 = nativeObjectToString.call(value);
            if (unmasked) {
              if (isOwn) {
                value[symToStringTag] = tag;
              } else {
                delete value[symToStringTag];
              }
            }
            return result2;
          }
          var getSymbols = !nativeGetSymbols ? stubArray : function(object) {
            if (object == null) {
              return [];
            }
            object = Object2(object);
            return arrayFilter(nativeGetSymbols(object), function(symbol) {
              return propertyIsEnumerable.call(object, symbol);
            });
          };
          var getSymbolsIn = !nativeGetSymbols ? stubArray : function(object) {
            var result2 = [];
            while (object) {
              arrayPush(result2, getSymbols(object));
              object = getPrototype(object);
            }
            return result2;
          };
          var getTag = baseGetTag;
          if (DataView && getTag(new DataView(new ArrayBuffer(1))) != dataViewTag || Map2 && getTag(new Map2()) != mapTag || Promise2 && getTag(Promise2.resolve()) != promiseTag || Set && getTag(new Set()) != setTag || WeakMap && getTag(new WeakMap()) != weakMapTag) {
            getTag = function(value) {
              var result2 = baseGetTag(value), Ctor = result2 == objectTag ? value.constructor : undefined2, ctorString = Ctor ? toSource(Ctor) : "";
              if (ctorString) {
                switch (ctorString) {
                  case dataViewCtorString:
                    return dataViewTag;
                  case mapCtorString:
                    return mapTag;
                  case promiseCtorString:
                    return promiseTag;
                  case setCtorString:
                    return setTag;
                  case weakMapCtorString:
                    return weakMapTag;
                }
              }
              return result2;
            };
          }
          function getView(start, end, transforms) {
            var index = -1, length = transforms.length;
            while (++index < length) {
              var data = transforms[index], size2 = data.size;
              switch (data.type) {
                case "drop":
                  start += size2;
                  break;
                case "dropRight":
                  end -= size2;
                  break;
                case "take":
                  end = nativeMin(end, start + size2);
                  break;
                case "takeRight":
                  start = nativeMax(start, end - size2);
                  break;
              }
            }
            return { "start": start, "end": end };
          }
          function getWrapDetails(source) {
            var match = source.match(reWrapDetails);
            return match ? match[1].split(reSplitDetails) : [];
          }
          function hasPath(object, path, hasFunc) {
            path = castPath(path, object);
            var index = -1, length = path.length, result2 = false;
            while (++index < length) {
              var key = toKey(path[index]);
              if (!(result2 = object != null && hasFunc(object, key))) {
                break;
              }
              object = object[key];
            }
            if (result2 || ++index != length) {
              return result2;
            }
            length = object == null ? 0 : object.length;
            return !!length && isLength(length) && isIndex(key, length) && (isArray(object) || isArguments(object));
          }
          function initCloneArray(array) {
            var length = array.length, result2 = new array.constructor(length);
            if (length && typeof array[0] == "string" && hasOwnProperty.call(array, "index")) {
              result2.index = array.index;
              result2.input = array.input;
            }
            return result2;
          }
          function initCloneObject(object) {
            return typeof object.constructor == "function" && !isPrototype(object) ? baseCreate(getPrototype(object)) : {};
          }
          function initCloneByTag(object, tag, isDeep) {
            var Ctor = object.constructor;
            switch (tag) {
              case arrayBufferTag:
                return cloneArrayBuffer(object);
              case boolTag:
              case dateTag:
                return new Ctor(+object);
              case dataViewTag:
                return cloneDataView(object, isDeep);
              case float32Tag:
              case float64Tag:
              case int8Tag:
              case int16Tag:
              case int32Tag:
              case uint8Tag:
              case uint8ClampedTag:
              case uint16Tag:
              case uint32Tag:
                return cloneTypedArray(object, isDeep);
              case mapTag:
                return new Ctor();
              case numberTag:
              case stringTag:
                return new Ctor(object);
              case regexpTag:
                return cloneRegExp(object);
              case setTag:
                return new Ctor();
              case symbolTag:
                return cloneSymbol(object);
            }
          }
          function insertWrapDetails(source, details) {
            var length = details.length;
            if (!length) {
              return source;
            }
            var lastIndex = length - 1;
            details[lastIndex] = (length > 1 ? "& " : "") + details[lastIndex];
            details = details.join(length > 2 ? ", " : " ");
            return source.replace(reWrapComment, "{\n/* [wrapped with " + details + "] */\n");
          }
          function isFlattenable(value) {
            return isArray(value) || isArguments(value) || !!(spreadableSymbol && value && value[spreadableSymbol]);
          }
          function isIndex(value, length) {
            var type = typeof value;
            length = length == null ? MAX_SAFE_INTEGER : length;
            return !!length && (type == "number" || type != "symbol" && reIsUint.test(value)) && (value > -1 && value % 1 == 0 && value < length);
          }
          function isIterateeCall(value, index, object) {
            if (!isObject(object)) {
              return false;
            }
            var type = typeof index;
            if (type == "number" ? isArrayLike(object) && isIndex(index, object.length) : type == "string" && index in object) {
              return eq(object[index], value);
            }
            return false;
          }
          function isKey(value, object) {
            if (isArray(value)) {
              return false;
            }
            var type = typeof value;
            if (type == "number" || type == "symbol" || type == "boolean" || value == null || isSymbol(value)) {
              return true;
            }
            return reIsPlainProp.test(value) || !reIsDeepProp.test(value) || object != null && value in Object2(object);
          }
          function isKeyable(value) {
            var type = typeof value;
            return type == "string" || type == "number" || type == "symbol" || type == "boolean" ? value !== "__proto__" : value === null;
          }
          function isLaziable(func) {
            var funcName = getFuncName(func), other = lodash[funcName];
            if (typeof other != "function" || !(funcName in LazyWrapper.prototype)) {
              return false;
            }
            if (func === other) {
              return true;
            }
            var data = getData(other);
            return !!data && func === data[0];
          }
          function isMasked(func) {
            return !!maskSrcKey && maskSrcKey in func;
          }
          var isMaskable = coreJsData ? isFunction : stubFalse;
          function isPrototype(value) {
            var Ctor = value && value.constructor, proto = typeof Ctor == "function" && Ctor.prototype || objectProto;
            return value === proto;
          }
          function isStrictComparable(value) {
            return value === value && !isObject(value);
          }
          function matchesStrictComparable(key, srcValue) {
            return function(object) {
              if (object == null) {
                return false;
              }
              return object[key] === srcValue && (srcValue !== undefined2 || key in Object2(object));
            };
          }
          function memoizeCapped(func) {
            var result2 = memoize(func, function(key) {
              if (cache.size === MAX_MEMOIZE_SIZE) {
                cache.clear();
              }
              return key;
            });
            var cache = result2.cache;
            return result2;
          }
          function mergeData(data, source) {
            var bitmask = data[1], srcBitmask = source[1], newBitmask = bitmask | srcBitmask, isCommon = newBitmask < (WRAP_BIND_FLAG | WRAP_BIND_KEY_FLAG | WRAP_ARY_FLAG);
            var isCombo = srcBitmask == WRAP_ARY_FLAG && bitmask == WRAP_CURRY_FLAG || srcBitmask == WRAP_ARY_FLAG && bitmask == WRAP_REARG_FLAG && data[7].length <= source[8] || srcBitmask == (WRAP_ARY_FLAG | WRAP_REARG_FLAG) && source[7].length <= source[8] && bitmask == WRAP_CURRY_FLAG;
            if (!(isCommon || isCombo)) {
              return data;
            }
            if (srcBitmask & WRAP_BIND_FLAG) {
              data[2] = source[2];
              newBitmask |= bitmask & WRAP_BIND_FLAG ? 0 : WRAP_CURRY_BOUND_FLAG;
            }
            var value = source[3];
            if (value) {
              var partials = data[3];
              data[3] = partials ? composeArgs(partials, value, source[4]) : value;
              data[4] = partials ? replaceHolders(data[3], PLACEHOLDER) : source[4];
            }
            value = source[5];
            if (value) {
              partials = data[5];
              data[5] = partials ? composeArgsRight(partials, value, source[6]) : value;
              data[6] = partials ? replaceHolders(data[5], PLACEHOLDER) : source[6];
            }
            value = source[7];
            if (value) {
              data[7] = value;
            }
            if (srcBitmask & WRAP_ARY_FLAG) {
              data[8] = data[8] == null ? source[8] : nativeMin(data[8], source[8]);
            }
            if (data[9] == null) {
              data[9] = source[9];
            }
            data[0] = source[0];
            data[1] = newBitmask;
            return data;
          }
          function nativeKeysIn(object) {
            var result2 = [];
            if (object != null) {
              for (var key in Object2(object)) {
                result2.push(key);
              }
            }
            return result2;
          }
          function objectToString(value) {
            return nativeObjectToString.call(value);
          }
          function overRest(func, start, transform2) {
            start = nativeMax(start === undefined2 ? func.length - 1 : start, 0);
            return function() {
              var args = arguments, index = -1, length = nativeMax(args.length - start, 0), array = Array2(length);
              while (++index < length) {
                array[index] = args[start + index];
              }
              index = -1;
              var otherArgs = Array2(start + 1);
              while (++index < start) {
                otherArgs[index] = args[index];
              }
              otherArgs[start] = transform2(array);
              return apply(func, this, otherArgs);
            };
          }
          function parent(object, path) {
            return path.length < 2 ? object : baseGet(object, baseSlice(path, 0, -1));
          }
          function reorder(array, indexes) {
            var arrLength = array.length, length = nativeMin(indexes.length, arrLength), oldArray = copyArray(array);
            while (length--) {
              var index = indexes[length];
              array[length] = isIndex(index, arrLength) ? oldArray[index] : undefined2;
            }
            return array;
          }
          function safeGet(object, key) {
            if (key === "constructor" && typeof object[key] === "function") {
              return;
            }
            if (key == "__proto__") {
              return;
            }
            return object[key];
          }
          var setData = shortOut(baseSetData);
          var setTimeout2 = ctxSetTimeout || function(func, wait) {
            return root.setTimeout(func, wait);
          };
          var setToString = shortOut(baseSetToString);
          function setWrapToString(wrapper, reference, bitmask) {
            var source = reference + "";
            return setToString(wrapper, insertWrapDetails(source, updateWrapDetails(getWrapDetails(source), bitmask)));
          }
          function shortOut(func) {
            var count = 0, lastCalled = 0;
            return function() {
              var stamp = nativeNow(), remaining = HOT_SPAN - (stamp - lastCalled);
              lastCalled = stamp;
              if (remaining > 0) {
                if (++count >= HOT_COUNT) {
                  return arguments[0];
                }
              } else {
                count = 0;
              }
              return func.apply(undefined2, arguments);
            };
          }
          function shuffleSelf(array, size2) {
            var index = -1, length = array.length, lastIndex = length - 1;
            size2 = size2 === undefined2 ? length : size2;
            while (++index < size2) {
              var rand = baseRandom(index, lastIndex), value = array[rand];
              array[rand] = array[index];
              array[index] = value;
            }
            array.length = size2;
            return array;
          }
          var stringToPath = memoizeCapped(function(string) {
            var result2 = [];
            if (string.charCodeAt(0) === 46) {
              result2.push("");
            }
            string.replace(rePropName, function(match, number, quote, subString) {
              result2.push(quote ? subString.replace(reEscapeChar, "$1") : number || match);
            });
            return result2;
          });
          function toKey(value) {
            if (typeof value == "string" || isSymbol(value)) {
              return value;
            }
            var result2 = value + "";
            return result2 == "0" && 1 / value == -INFINITY ? "-0" : result2;
          }
          function toSource(func) {
            if (func != null) {
              try {
                return funcToString.call(func);
              } catch (e) {
              }
              try {
                return func + "";
              } catch (e) {
              }
            }
            return "";
          }
          function updateWrapDetails(details, bitmask) {
            arrayEach(wrapFlags, function(pair) {
              var value = "_." + pair[0];
              if (bitmask & pair[1] && !arrayIncludes(details, value)) {
                details.push(value);
              }
            });
            return details.sort();
          }
          function wrapperClone(wrapper) {
            if (wrapper instanceof LazyWrapper) {
              return wrapper.clone();
            }
            var result2 = new LodashWrapper(wrapper.__wrapped__, wrapper.__chain__);
            result2.__actions__ = copyArray(wrapper.__actions__);
            result2.__index__ = wrapper.__index__;
            result2.__values__ = wrapper.__values__;
            return result2;
          }
          function chunk(array, size2, guard) {
            if (guard ? isIterateeCall(array, size2, guard) : size2 === undefined2) {
              size2 = 1;
            } else {
              size2 = nativeMax(toInteger(size2), 0);
            }
            var length = array == null ? 0 : array.length;
            if (!length || size2 < 1) {
              return [];
            }
            var index = 0, resIndex = 0, result2 = Array2(nativeCeil(length / size2));
            while (index < length) {
              result2[resIndex++] = baseSlice(array, index, index += size2);
            }
            return result2;
          }
          function compact(array) {
            var index = -1, length = array == null ? 0 : array.length, resIndex = 0, result2 = [];
            while (++index < length) {
              var value = array[index];
              if (value) {
                result2[resIndex++] = value;
              }
            }
            return result2;
          }
          function concat() {
            var length = arguments.length;
            if (!length) {
              return [];
            }
            var args = Array2(length - 1), array = arguments[0], index = length;
            while (index--) {
              args[index - 1] = arguments[index];
            }
            return arrayPush(isArray(array) ? copyArray(array) : [array], baseFlatten(args, 1));
          }
          var difference = baseRest(function(array, values2) {
            return isArrayLikeObject(array) ? baseDifference(array, baseFlatten(values2, 1, isArrayLikeObject, true)) : [];
          });
          var differenceBy = baseRest(function(array, values2) {
            var iteratee2 = last(values2);
            if (isArrayLikeObject(iteratee2)) {
              iteratee2 = undefined2;
            }
            return isArrayLikeObject(array) ? baseDifference(array, baseFlatten(values2, 1, isArrayLikeObject, true), getIteratee(iteratee2, 2)) : [];
          });
          var differenceWith = baseRest(function(array, values2) {
            var comparator = last(values2);
            if (isArrayLikeObject(comparator)) {
              comparator = undefined2;
            }
            return isArrayLikeObject(array) ? baseDifference(array, baseFlatten(values2, 1, isArrayLikeObject, true), undefined2, comparator) : [];
          });
          function drop(array, n, guard) {
            var length = array == null ? 0 : array.length;
            if (!length) {
              return [];
            }
            n = guard || n === undefined2 ? 1 : toInteger(n);
            return baseSlice(array, n < 0 ? 0 : n, length);
          }
          function dropRight(array, n, guard) {
            var length = array == null ? 0 : array.length;
            if (!length) {
              return [];
            }
            n = guard || n === undefined2 ? 1 : toInteger(n);
            n = length - n;
            return baseSlice(array, 0, n < 0 ? 0 : n);
          }
          function dropRightWhile(array, predicate) {
            return array && array.length ? baseWhile(array, getIteratee(predicate, 3), true, true) : [];
          }
          function dropWhile(array, predicate) {
            return array && array.length ? baseWhile(array, getIteratee(predicate, 3), true) : [];
          }
          function fill(array, value, start, end) {
            var length = array == null ? 0 : array.length;
            if (!length) {
              return [];
            }
            if (start && typeof start != "number" && isIterateeCall(array, value, start)) {
              start = 0;
              end = length;
            }
            return baseFill(array, value, start, end);
          }
          function findIndex(array, predicate, fromIndex) {
            var length = array == null ? 0 : array.length;
            if (!length) {
              return -1;
            }
            var index = fromIndex == null ? 0 : toInteger(fromIndex);
            if (index < 0) {
              index = nativeMax(length + index, 0);
            }
            return baseFindIndex(array, getIteratee(predicate, 3), index);
          }
          function findLastIndex(array, predicate, fromIndex) {
            var length = array == null ? 0 : array.length;
            if (!length) {
              return -1;
            }
            var index = length - 1;
            if (fromIndex !== undefined2) {
              index = toInteger(fromIndex);
              index = fromIndex < 0 ? nativeMax(length + index, 0) : nativeMin(index, length - 1);
            }
            return baseFindIndex(array, getIteratee(predicate, 3), index, true);
          }
          function flatten(array) {
            var length = array == null ? 0 : array.length;
            return length ? baseFlatten(array, 1) : [];
          }
          function flattenDeep(array) {
            var length = array == null ? 0 : array.length;
            return length ? baseFlatten(array, INFINITY) : [];
          }
          function flattenDepth(array, depth) {
            var length = array == null ? 0 : array.length;
            if (!length) {
              return [];
            }
            depth = depth === undefined2 ? 1 : toInteger(depth);
            return baseFlatten(array, depth);
          }
          function fromPairs(pairs) {
            var index = -1, length = pairs == null ? 0 : pairs.length, result2 = {};
            while (++index < length) {
              var pair = pairs[index];
              result2[pair[0]] = pair[1];
            }
            return result2;
          }
          function head(array) {
            return array && array.length ? array[0] : undefined2;
          }
          function indexOf(array, value, fromIndex) {
            var length = array == null ? 0 : array.length;
            if (!length) {
              return -1;
            }
            var index = fromIndex == null ? 0 : toInteger(fromIndex);
            if (index < 0) {
              index = nativeMax(length + index, 0);
            }
            return baseIndexOf(array, value, index);
          }
          function initial(array) {
            var length = array == null ? 0 : array.length;
            return length ? baseSlice(array, 0, -1) : [];
          }
          var intersection = baseRest(function(arrays) {
            var mapped = arrayMap(arrays, castArrayLikeObject);
            return mapped.length && mapped[0] === arrays[0] ? baseIntersection(mapped) : [];
          });
          var intersectionBy = baseRest(function(arrays) {
            var iteratee2 = last(arrays), mapped = arrayMap(arrays, castArrayLikeObject);
            if (iteratee2 === last(mapped)) {
              iteratee2 = undefined2;
            } else {
              mapped.pop();
            }
            return mapped.length && mapped[0] === arrays[0] ? baseIntersection(mapped, getIteratee(iteratee2, 2)) : [];
          });
          var intersectionWith = baseRest(function(arrays) {
            var comparator = last(arrays), mapped = arrayMap(arrays, castArrayLikeObject);
            comparator = typeof comparator == "function" ? comparator : undefined2;
            if (comparator) {
              mapped.pop();
            }
            return mapped.length && mapped[0] === arrays[0] ? baseIntersection(mapped, undefined2, comparator) : [];
          });
          function join(array, separator) {
            return array == null ? "" : nativeJoin.call(array, separator);
          }
          function last(array) {
            var length = array == null ? 0 : array.length;
            return length ? array[length - 1] : undefined2;
          }
          function lastIndexOf(array, value, fromIndex) {
            var length = array == null ? 0 : array.length;
            if (!length) {
              return -1;
            }
            var index = length;
            if (fromIndex !== undefined2) {
              index = toInteger(fromIndex);
              index = index < 0 ? nativeMax(length + index, 0) : nativeMin(index, length - 1);
            }
            return value === value ? strictLastIndexOf(array, value, index) : baseFindIndex(array, baseIsNaN, index, true);
          }
          function nth(array, n) {
            return array && array.length ? baseNth(array, toInteger(n)) : undefined2;
          }
          var pull = baseRest(pullAll);
          function pullAll(array, values2) {
            return array && array.length && values2 && values2.length ? basePullAll(array, values2) : array;
          }
          function pullAllBy(array, values2, iteratee2) {
            return array && array.length && values2 && values2.length ? basePullAll(array, values2, getIteratee(iteratee2, 2)) : array;
          }
          function pullAllWith(array, values2, comparator) {
            return array && array.length && values2 && values2.length ? basePullAll(array, values2, undefined2, comparator) : array;
          }
          var pullAt = flatRest(function(array, indexes) {
            var length = array == null ? 0 : array.length, result2 = baseAt(array, indexes);
            basePullAt(array, arrayMap(indexes, function(index) {
              return isIndex(index, length) ? +index : index;
            }).sort(compareAscending));
            return result2;
          });
          function remove(array, predicate) {
            var result2 = [];
            if (!(array && array.length)) {
              return result2;
            }
            var index = -1, indexes = [], length = array.length;
            predicate = getIteratee(predicate, 3);
            while (++index < length) {
              var value = array[index];
              if (predicate(value, index, array)) {
                result2.push(value);
                indexes.push(index);
              }
            }
            basePullAt(array, indexes);
            return result2;
          }
          function reverse(array) {
            return array == null ? array : nativeReverse.call(array);
          }
          function slice(array, start, end) {
            var length = array == null ? 0 : array.length;
            if (!length) {
              return [];
            }
            if (end && typeof end != "number" && isIterateeCall(array, start, end)) {
              start = 0;
              end = length;
            } else {
              start = start == null ? 0 : toInteger(start);
              end = end === undefined2 ? length : toInteger(end);
            }
            return baseSlice(array, start, end);
          }
          function sortedIndex(array, value) {
            return baseSortedIndex(array, value);
          }
          function sortedIndexBy(array, value, iteratee2) {
            return baseSortedIndexBy(array, value, getIteratee(iteratee2, 2));
          }
          function sortedIndexOf(array, value) {
            var length = array == null ? 0 : array.length;
            if (length) {
              var index = baseSortedIndex(array, value);
              if (index < length && eq(array[index], value)) {
                return index;
              }
            }
            return -1;
          }
          function sortedLastIndex(array, value) {
            return baseSortedIndex(array, value, true);
          }
          function sortedLastIndexBy(array, value, iteratee2) {
            return baseSortedIndexBy(array, value, getIteratee(iteratee2, 2), true);
          }
          function sortedLastIndexOf(array, value) {
            var length = array == null ? 0 : array.length;
            if (length) {
              var index = baseSortedIndex(array, value, true) - 1;
              if (eq(array[index], value)) {
                return index;
              }
            }
            return -1;
          }
          function sortedUniq(array) {
            return array && array.length ? baseSortedUniq(array) : [];
          }
          function sortedUniqBy(array, iteratee2) {
            return array && array.length ? baseSortedUniq(array, getIteratee(iteratee2, 2)) : [];
          }
          function tail(array) {
            var length = array == null ? 0 : array.length;
            return length ? baseSlice(array, 1, length) : [];
          }
          function take(array, n, guard) {
            if (!(array && array.length)) {
              return [];
            }
            n = guard || n === undefined2 ? 1 : toInteger(n);
            return baseSlice(array, 0, n < 0 ? 0 : n);
          }
          function takeRight(array, n, guard) {
            var length = array == null ? 0 : array.length;
            if (!length) {
              return [];
            }
            n = guard || n === undefined2 ? 1 : toInteger(n);
            n = length - n;
            return baseSlice(array, n < 0 ? 0 : n, length);
          }
          function takeRightWhile(array, predicate) {
            return array && array.length ? baseWhile(array, getIteratee(predicate, 3), false, true) : [];
          }
          function takeWhile(array, predicate) {
            return array && array.length ? baseWhile(array, getIteratee(predicate, 3)) : [];
          }
          var union = baseRest(function(arrays) {
            return baseUniq(baseFlatten(arrays, 1, isArrayLikeObject, true));
          });
          var unionBy = baseRest(function(arrays) {
            var iteratee2 = last(arrays);
            if (isArrayLikeObject(iteratee2)) {
              iteratee2 = undefined2;
            }
            return baseUniq(baseFlatten(arrays, 1, isArrayLikeObject, true), getIteratee(iteratee2, 2));
          });
          var unionWith = baseRest(function(arrays) {
            var comparator = last(arrays);
            comparator = typeof comparator == "function" ? comparator : undefined2;
            return baseUniq(baseFlatten(arrays, 1, isArrayLikeObject, true), undefined2, comparator);
          });
          function uniq(array) {
            return array && array.length ? baseUniq(array) : [];
          }
          function uniqBy(array, iteratee2) {
            return array && array.length ? baseUniq(array, getIteratee(iteratee2, 2)) : [];
          }
          function uniqWith(array, comparator) {
            comparator = typeof comparator == "function" ? comparator : undefined2;
            return array && array.length ? baseUniq(array, undefined2, comparator) : [];
          }
          function unzip(array) {
            if (!(array && array.length)) {
              return [];
            }
            var length = 0;
            array = arrayFilter(array, function(group) {
              if (isArrayLikeObject(group)) {
                length = nativeMax(group.length, length);
                return true;
              }
            });
            return baseTimes(length, function(index) {
              return arrayMap(array, baseProperty(index));
            });
          }
          function unzipWith(array, iteratee2) {
            if (!(array && array.length)) {
              return [];
            }
            var result2 = unzip(array);
            if (iteratee2 == null) {
              return result2;
            }
            return arrayMap(result2, function(group) {
              return apply(iteratee2, undefined2, group);
            });
          }
          var without = baseRest(function(array, values2) {
            return isArrayLikeObject(array) ? baseDifference(array, values2) : [];
          });
          var xor = baseRest(function(arrays) {
            return baseXor(arrayFilter(arrays, isArrayLikeObject));
          });
          var xorBy = baseRest(function(arrays) {
            var iteratee2 = last(arrays);
            if (isArrayLikeObject(iteratee2)) {
              iteratee2 = undefined2;
            }
            return baseXor(arrayFilter(arrays, isArrayLikeObject), getIteratee(iteratee2, 2));
          });
          var xorWith = baseRest(function(arrays) {
            var comparator = last(arrays);
            comparator = typeof comparator == "function" ? comparator : undefined2;
            return baseXor(arrayFilter(arrays, isArrayLikeObject), undefined2, comparator);
          });
          var zip = baseRest(unzip);
          function zipObject(props, values2) {
            return baseZipObject(props || [], values2 || [], assignValue);
          }
          function zipObjectDeep(props, values2) {
            return baseZipObject(props || [], values2 || [], baseSet);
          }
          var zipWith = baseRest(function(arrays) {
            var length = arrays.length, iteratee2 = length > 1 ? arrays[length - 1] : undefined2;
            iteratee2 = typeof iteratee2 == "function" ? (arrays.pop(), iteratee2) : undefined2;
            return unzipWith(arrays, iteratee2);
          });
          function chain(value) {
            var result2 = lodash(value);
            result2.__chain__ = true;
            return result2;
          }
          function tap(value, interceptor) {
            interceptor(value);
            return value;
          }
          function thru(value, interceptor) {
            return interceptor(value);
          }
          var wrapperAt = flatRest(function(paths) {
            var length = paths.length, start = length ? paths[0] : 0, value = this.__wrapped__, interceptor = function(object) {
              return baseAt(object, paths);
            };
            if (length > 1 || this.__actions__.length || !(value instanceof LazyWrapper) || !isIndex(start)) {
              return this.thru(interceptor);
            }
            value = value.slice(start, +start + (length ? 1 : 0));
            value.__actions__.push({
              "func": thru,
              "args": [interceptor],
              "thisArg": undefined2
            });
            return new LodashWrapper(value, this.__chain__).thru(function(array) {
              if (length && !array.length) {
                array.push(undefined2);
              }
              return array;
            });
          });
          function wrapperChain() {
            return chain(this);
          }
          function wrapperCommit() {
            return new LodashWrapper(this.value(), this.__chain__);
          }
          function wrapperNext() {
            if (this.__values__ === undefined2) {
              this.__values__ = toArray(this.value());
            }
            var done = this.__index__ >= this.__values__.length, value = done ? undefined2 : this.__values__[this.__index__++];
            return { "done": done, "value": value };
          }
          function wrapperToIterator() {
            return this;
          }
          function wrapperPlant(value) {
            var result2, parent2 = this;
            while (parent2 instanceof baseLodash) {
              var clone2 = wrapperClone(parent2);
              clone2.__index__ = 0;
              clone2.__values__ = undefined2;
              if (result2) {
                previous.__wrapped__ = clone2;
              } else {
                result2 = clone2;
              }
              var previous = clone2;
              parent2 = parent2.__wrapped__;
            }
            previous.__wrapped__ = value;
            return result2;
          }
          function wrapperReverse() {
            var value = this.__wrapped__;
            if (value instanceof LazyWrapper) {
              var wrapped = value;
              if (this.__actions__.length) {
                wrapped = new LazyWrapper(this);
              }
              wrapped = wrapped.reverse();
              wrapped.__actions__.push({
                "func": thru,
                "args": [reverse],
                "thisArg": undefined2
              });
              return new LodashWrapper(wrapped, this.__chain__);
            }
            return this.thru(reverse);
          }
          function wrapperValue() {
            return baseWrapperValue(this.__wrapped__, this.__actions__);
          }
          var countBy = createAggregator(function(result2, value, key) {
            if (hasOwnProperty.call(result2, key)) {
              ++result2[key];
            } else {
              baseAssignValue(result2, key, 1);
            }
          });
          function every(collection, predicate, guard) {
            var func = isArray(collection) ? arrayEvery : baseEvery;
            if (guard && isIterateeCall(collection, predicate, guard)) {
              predicate = undefined2;
            }
            return func(collection, getIteratee(predicate, 3));
          }
          function filter(collection, predicate) {
            var func = isArray(collection) ? arrayFilter : baseFilter;
            return func(collection, getIteratee(predicate, 3));
          }
          var find = createFind(findIndex);
          var findLast = createFind(findLastIndex);
          function flatMap(collection, iteratee2) {
            return baseFlatten(map(collection, iteratee2), 1);
          }
          function flatMapDeep(collection, iteratee2) {
            return baseFlatten(map(collection, iteratee2), INFINITY);
          }
          function flatMapDepth(collection, iteratee2, depth) {
            depth = depth === undefined2 ? 1 : toInteger(depth);
            return baseFlatten(map(collection, iteratee2), depth);
          }
          function forEach(collection, iteratee2) {
            var func = isArray(collection) ? arrayEach : baseEach;
            return func(collection, getIteratee(iteratee2, 3));
          }
          function forEachRight(collection, iteratee2) {
            var func = isArray(collection) ? arrayEachRight : baseEachRight;
            return func(collection, getIteratee(iteratee2, 3));
          }
          var groupBy = createAggregator(function(result2, value, key) {
            if (hasOwnProperty.call(result2, key)) {
              result2[key].push(value);
            } else {
              baseAssignValue(result2, key, [value]);
            }
          });
          function includes(collection, value, fromIndex, guard) {
            collection = isArrayLike(collection) ? collection : values(collection);
            fromIndex = fromIndex && !guard ? toInteger(fromIndex) : 0;
            var length = collection.length;
            if (fromIndex < 0) {
              fromIndex = nativeMax(length + fromIndex, 0);
            }
            return isString(collection) ? fromIndex <= length && collection.indexOf(value, fromIndex) > -1 : !!length && baseIndexOf(collection, value, fromIndex) > -1;
          }
          var invokeMap = baseRest(function(collection, path, args) {
            var index = -1, isFunc = typeof path == "function", result2 = isArrayLike(collection) ? Array2(collection.length) : [];
            baseEach(collection, function(value) {
              result2[++index] = isFunc ? apply(path, value, args) : baseInvoke(value, path, args);
            });
            return result2;
          });
          var keyBy = createAggregator(function(result2, value, key) {
            baseAssignValue(result2, key, value);
          });
          function map(collection, iteratee2) {
            var func = isArray(collection) ? arrayMap : baseMap;
            return func(collection, getIteratee(iteratee2, 3));
          }
          function orderBy(collection, iteratees, orders, guard) {
            if (collection == null) {
              return [];
            }
            if (!isArray(iteratees)) {
              iteratees = iteratees == null ? [] : [iteratees];
            }
            orders = guard ? undefined2 : orders;
            if (!isArray(orders)) {
              orders = orders == null ? [] : [orders];
            }
            return baseOrderBy(collection, iteratees, orders);
          }
          var partition = createAggregator(function(result2, value, key) {
            result2[key ? 0 : 1].push(value);
          }, function() {
            return [[], []];
          });
          function reduce(collection, iteratee2, accumulator) {
            var func = isArray(collection) ? arrayReduce : baseReduce, initAccum = arguments.length < 3;
            return func(collection, getIteratee(iteratee2, 4), accumulator, initAccum, baseEach);
          }
          function reduceRight(collection, iteratee2, accumulator) {
            var func = isArray(collection) ? arrayReduceRight : baseReduce, initAccum = arguments.length < 3;
            return func(collection, getIteratee(iteratee2, 4), accumulator, initAccum, baseEachRight);
          }
          function reject(collection, predicate) {
            var func = isArray(collection) ? arrayFilter : baseFilter;
            return func(collection, negate(getIteratee(predicate, 3)));
          }
          function sample(collection) {
            var func = isArray(collection) ? arraySample : baseSample;
            return func(collection);
          }
          function sampleSize(collection, n, guard) {
            if (guard ? isIterateeCall(collection, n, guard) : n === undefined2) {
              n = 1;
            } else {
              n = toInteger(n);
            }
            var func = isArray(collection) ? arraySampleSize : baseSampleSize;
            return func(collection, n);
          }
          function shuffle(collection) {
            var func = isArray(collection) ? arrayShuffle : baseShuffle;
            return func(collection);
          }
          function size(collection) {
            if (collection == null) {
              return 0;
            }
            if (isArrayLike(collection)) {
              return isString(collection) ? stringSize(collection) : collection.length;
            }
            var tag = getTag(collection);
            if (tag == mapTag || tag == setTag) {
              return collection.size;
            }
            return baseKeys(collection).length;
          }
          function some(collection, predicate, guard) {
            var func = isArray(collection) ? arraySome : baseSome;
            if (guard && isIterateeCall(collection, predicate, guard)) {
              predicate = undefined2;
            }
            return func(collection, getIteratee(predicate, 3));
          }
          var sortBy = baseRest(function(collection, iteratees) {
            if (collection == null) {
              return [];
            }
            var length = iteratees.length;
            if (length > 1 && isIterateeCall(collection, iteratees[0], iteratees[1])) {
              iteratees = [];
            } else if (length > 2 && isIterateeCall(iteratees[0], iteratees[1], iteratees[2])) {
              iteratees = [iteratees[0]];
            }
            return baseOrderBy(collection, baseFlatten(iteratees, 1), []);
          });
          var now = ctxNow || function() {
            return root.Date.now();
          };
          function after(n, func) {
            if (typeof func != "function") {
              throw new TypeError2(FUNC_ERROR_TEXT);
            }
            n = toInteger(n);
            return function() {
              if (--n < 1) {
                return func.apply(this, arguments);
              }
            };
          }
          function ary(func, n, guard) {
            n = guard ? undefined2 : n;
            n = func && n == null ? func.length : n;
            return createWrap(func, WRAP_ARY_FLAG, undefined2, undefined2, undefined2, undefined2, n);
          }
          function before(n, func) {
            var result2;
            if (typeof func != "function") {
              throw new TypeError2(FUNC_ERROR_TEXT);
            }
            n = toInteger(n);
            return function() {
              if (--n > 0) {
                result2 = func.apply(this, arguments);
              }
              if (n <= 1) {
                func = undefined2;
              }
              return result2;
            };
          }
          var bind = baseRest(function(func, thisArg, partials) {
            var bitmask = WRAP_BIND_FLAG;
            if (partials.length) {
              var holders = replaceHolders(partials, getHolder(bind));
              bitmask |= WRAP_PARTIAL_FLAG;
            }
            return createWrap(func, bitmask, thisArg, partials, holders);
          });
          var bindKey = baseRest(function(object, key, partials) {
            var bitmask = WRAP_BIND_FLAG | WRAP_BIND_KEY_FLAG;
            if (partials.length) {
              var holders = replaceHolders(partials, getHolder(bindKey));
              bitmask |= WRAP_PARTIAL_FLAG;
            }
            return createWrap(key, bitmask, object, partials, holders);
          });
          function curry(func, arity, guard) {
            arity = guard ? undefined2 : arity;
            var result2 = createWrap(func, WRAP_CURRY_FLAG, undefined2, undefined2, undefined2, undefined2, undefined2, arity);
            result2.placeholder = curry.placeholder;
            return result2;
          }
          function curryRight(func, arity, guard) {
            arity = guard ? undefined2 : arity;
            var result2 = createWrap(func, WRAP_CURRY_RIGHT_FLAG, undefined2, undefined2, undefined2, undefined2, undefined2, arity);
            result2.placeholder = curryRight.placeholder;
            return result2;
          }
          function debounce(func, wait, options) {
            var lastArgs, lastThis, maxWait, result2, timerId, lastCallTime, lastInvokeTime = 0, leading = false, maxing = false, trailing = true;
            if (typeof func != "function") {
              throw new TypeError2(FUNC_ERROR_TEXT);
            }
            wait = toNumber(wait) || 0;
            if (isObject(options)) {
              leading = !!options.leading;
              maxing = "maxWait" in options;
              maxWait = maxing ? nativeMax(toNumber(options.maxWait) || 0, wait) : maxWait;
              trailing = "trailing" in options ? !!options.trailing : trailing;
            }
            function invokeFunc(time) {
              var args = lastArgs, thisArg = lastThis;
              lastArgs = lastThis = undefined2;
              lastInvokeTime = time;
              result2 = func.apply(thisArg, args);
              return result2;
            }
            function leadingEdge(time) {
              lastInvokeTime = time;
              timerId = setTimeout2(timerExpired, wait);
              return leading ? invokeFunc(time) : result2;
            }
            function remainingWait(time) {
              var timeSinceLastCall = time - lastCallTime, timeSinceLastInvoke = time - lastInvokeTime, timeWaiting = wait - timeSinceLastCall;
              return maxing ? nativeMin(timeWaiting, maxWait - timeSinceLastInvoke) : timeWaiting;
            }
            function shouldInvoke(time) {
              var timeSinceLastCall = time - lastCallTime, timeSinceLastInvoke = time - lastInvokeTime;
              return lastCallTime === undefined2 || timeSinceLastCall >= wait || timeSinceLastCall < 0 || maxing && timeSinceLastInvoke >= maxWait;
            }
            function timerExpired() {
              var time = now();
              if (shouldInvoke(time)) {
                return trailingEdge(time);
              }
              timerId = setTimeout2(timerExpired, remainingWait(time));
            }
            function trailingEdge(time) {
              timerId = undefined2;
              if (trailing && lastArgs) {
                return invokeFunc(time);
              }
              lastArgs = lastThis = undefined2;
              return result2;
            }
            function cancel() {
              if (timerId !== undefined2) {
                clearTimeout2(timerId);
              }
              lastInvokeTime = 0;
              lastArgs = lastCallTime = lastThis = timerId = undefined2;
            }
            function flush() {
              return timerId === undefined2 ? result2 : trailingEdge(now());
            }
            function debounced() {
              var time = now(), isInvoking = shouldInvoke(time);
              lastArgs = arguments;
              lastThis = this;
              lastCallTime = time;
              if (isInvoking) {
                if (timerId === undefined2) {
                  return leadingEdge(lastCallTime);
                }
                if (maxing) {
                  clearTimeout2(timerId);
                  timerId = setTimeout2(timerExpired, wait);
                  return invokeFunc(lastCallTime);
                }
              }
              if (timerId === undefined2) {
                timerId = setTimeout2(timerExpired, wait);
              }
              return result2;
            }
            debounced.cancel = cancel;
            debounced.flush = flush;
            return debounced;
          }
          var defer = baseRest(function(func, args) {
            return baseDelay(func, 1, args);
          });
          var delay = baseRest(function(func, wait, args) {
            return baseDelay(func, toNumber(wait) || 0, args);
          });
          function flip(func) {
            return createWrap(func, WRAP_FLIP_FLAG);
          }
          function memoize(func, resolver) {
            if (typeof func != "function" || resolver != null && typeof resolver != "function") {
              throw new TypeError2(FUNC_ERROR_TEXT);
            }
            var memoized = function() {
              var args = arguments, key = resolver ? resolver.apply(this, args) : args[0], cache = memoized.cache;
              if (cache.has(key)) {
                return cache.get(key);
              }
              var result2 = func.apply(this, args);
              memoized.cache = cache.set(key, result2) || cache;
              return result2;
            };
            memoized.cache = new (memoize.Cache || MapCache)();
            return memoized;
          }
          memoize.Cache = MapCache;
          function negate(predicate) {
            if (typeof predicate != "function") {
              throw new TypeError2(FUNC_ERROR_TEXT);
            }
            return function() {
              var args = arguments;
              switch (args.length) {
                case 0:
                  return !predicate.call(this);
                case 1:
                  return !predicate.call(this, args[0]);
                case 2:
                  return !predicate.call(this, args[0], args[1]);
                case 3:
                  return !predicate.call(this, args[0], args[1], args[2]);
              }
              return !predicate.apply(this, args);
            };
          }
          function once(func) {
            return before(2, func);
          }
          var overArgs = castRest(function(func, transforms) {
            transforms = transforms.length == 1 && isArray(transforms[0]) ? arrayMap(transforms[0], baseUnary(getIteratee())) : arrayMap(baseFlatten(transforms, 1), baseUnary(getIteratee()));
            var funcsLength = transforms.length;
            return baseRest(function(args) {
              var index = -1, length = nativeMin(args.length, funcsLength);
              while (++index < length) {
                args[index] = transforms[index].call(this, args[index]);
              }
              return apply(func, this, args);
            });
          });
          var partial = baseRest(function(func, partials) {
            var holders = replaceHolders(partials, getHolder(partial));
            return createWrap(func, WRAP_PARTIAL_FLAG, undefined2, partials, holders);
          });
          var partialRight = baseRest(function(func, partials) {
            var holders = replaceHolders(partials, getHolder(partialRight));
            return createWrap(func, WRAP_PARTIAL_RIGHT_FLAG, undefined2, partials, holders);
          });
          var rearg = flatRest(function(func, indexes) {
            return createWrap(func, WRAP_REARG_FLAG, undefined2, undefined2, undefined2, indexes);
          });
          function rest(func, start) {
            if (typeof func != "function") {
              throw new TypeError2(FUNC_ERROR_TEXT);
            }
            start = start === undefined2 ? start : toInteger(start);
            return baseRest(func, start);
          }
          function spread(func, start) {
            if (typeof func != "function") {
              throw new TypeError2(FUNC_ERROR_TEXT);
            }
            start = start == null ? 0 : nativeMax(toInteger(start), 0);
            return baseRest(function(args) {
              var array = args[start], otherArgs = castSlice(args, 0, start);
              if (array) {
                arrayPush(otherArgs, array);
              }
              return apply(func, this, otherArgs);
            });
          }
          function throttle(func, wait, options) {
            var leading = true, trailing = true;
            if (typeof func != "function") {
              throw new TypeError2(FUNC_ERROR_TEXT);
            }
            if (isObject(options)) {
              leading = "leading" in options ? !!options.leading : leading;
              trailing = "trailing" in options ? !!options.trailing : trailing;
            }
            return debounce(func, wait, {
              "leading": leading,
              "maxWait": wait,
              "trailing": trailing
            });
          }
          function unary(func) {
            return ary(func, 1);
          }
          function wrap(value, wrapper) {
            return partial(castFunction(wrapper), value);
          }
          function castArray() {
            if (!arguments.length) {
              return [];
            }
            var value = arguments[0];
            return isArray(value) ? value : [value];
          }
          function clone(value) {
            return baseClone(value, CLONE_SYMBOLS_FLAG);
          }
          function cloneWith(value, customizer) {
            customizer = typeof customizer == "function" ? customizer : undefined2;
            return baseClone(value, CLONE_SYMBOLS_FLAG, customizer);
          }
          function cloneDeep(value) {
            return baseClone(value, CLONE_DEEP_FLAG | CLONE_SYMBOLS_FLAG);
          }
          function cloneDeepWith(value, customizer) {
            customizer = typeof customizer == "function" ? customizer : undefined2;
            return baseClone(value, CLONE_DEEP_FLAG | CLONE_SYMBOLS_FLAG, customizer);
          }
          function conformsTo(object, source) {
            return source == null || baseConformsTo(object, source, keys(source));
          }
          function eq(value, other) {
            return value === other || value !== value && other !== other;
          }
          var gt = createRelationalOperation(baseGt);
          var gte = createRelationalOperation(function(value, other) {
            return value >= other;
          });
          var isArguments = baseIsArguments(/* @__PURE__ */ (function() {
            return arguments;
          })()) ? baseIsArguments : function(value) {
            return isObjectLike(value) && hasOwnProperty.call(value, "callee") && !propertyIsEnumerable.call(value, "callee");
          };
          var isArray = Array2.isArray;
          var isArrayBuffer = nodeIsArrayBuffer ? baseUnary(nodeIsArrayBuffer) : baseIsArrayBuffer;
          function isArrayLike(value) {
            return value != null && isLength(value.length) && !isFunction(value);
          }
          function isArrayLikeObject(value) {
            return isObjectLike(value) && isArrayLike(value);
          }
          function isBoolean(value) {
            return value === true || value === false || isObjectLike(value) && baseGetTag(value) == boolTag;
          }
          var isBuffer = nativeIsBuffer || stubFalse;
          var isDate = nodeIsDate ? baseUnary(nodeIsDate) : baseIsDate;
          function isElement(value) {
            return isObjectLike(value) && value.nodeType === 1 && !isPlainObject(value);
          }
          function isEmpty(value) {
            if (value == null) {
              return true;
            }
            if (isArrayLike(value) && (isArray(value) || typeof value == "string" || typeof value.splice == "function" || isBuffer(value) || isTypedArray(value) || isArguments(value))) {
              return !value.length;
            }
            var tag = getTag(value);
            if (tag == mapTag || tag == setTag) {
              return !value.size;
            }
            if (isPrototype(value)) {
              return !baseKeys(value).length;
            }
            for (var key in value) {
              if (hasOwnProperty.call(value, key)) {
                return false;
              }
            }
            return true;
          }
          function isEqual(value, other) {
            return baseIsEqual(value, other);
          }
          function isEqualWith(value, other, customizer) {
            customizer = typeof customizer == "function" ? customizer : undefined2;
            var result2 = customizer ? customizer(value, other) : undefined2;
            return result2 === undefined2 ? baseIsEqual(value, other, undefined2, customizer) : !!result2;
          }
          function isError(value) {
            if (!isObjectLike(value)) {
              return false;
            }
            var tag = baseGetTag(value);
            return tag == errorTag || tag == domExcTag || typeof value.message == "string" && typeof value.name == "string" && !isPlainObject(value);
          }
          function isFinite(value) {
            return typeof value == "number" && nativeIsFinite(value);
          }
          function isFunction(value) {
            if (!isObject(value)) {
              return false;
            }
            var tag = baseGetTag(value);
            return tag == funcTag || tag == genTag || tag == asyncTag || tag == proxyTag;
          }
          function isInteger(value) {
            return typeof value == "number" && value == toInteger(value);
          }
          function isLength(value) {
            return typeof value == "number" && value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
          }
          function isObject(value) {
            var type = typeof value;
            return value != null && (type == "object" || type == "function");
          }
          function isObjectLike(value) {
            return value != null && typeof value == "object";
          }
          var isMap = nodeIsMap ? baseUnary(nodeIsMap) : baseIsMap;
          function isMatch(object, source) {
            return object === source || baseIsMatch(object, source, getMatchData(source));
          }
          function isMatchWith(object, source, customizer) {
            customizer = typeof customizer == "function" ? customizer : undefined2;
            return baseIsMatch(object, source, getMatchData(source), customizer);
          }
          function isNaN(value) {
            return isNumber(value) && value != +value;
          }
          function isNative(value) {
            if (isMaskable(value)) {
              throw new Error2(CORE_ERROR_TEXT);
            }
            return baseIsNative(value);
          }
          function isNull(value) {
            return value === null;
          }
          function isNil(value) {
            return value == null;
          }
          function isNumber(value) {
            return typeof value == "number" || isObjectLike(value) && baseGetTag(value) == numberTag;
          }
          function isPlainObject(value) {
            if (!isObjectLike(value) || baseGetTag(value) != objectTag) {
              return false;
            }
            var proto = getPrototype(value);
            if (proto === null) {
              return true;
            }
            var Ctor = hasOwnProperty.call(proto, "constructor") && proto.constructor;
            return typeof Ctor == "function" && Ctor instanceof Ctor && funcToString.call(Ctor) == objectCtorString;
          }
          var isRegExp = nodeIsRegExp ? baseUnary(nodeIsRegExp) : baseIsRegExp;
          function isSafeInteger(value) {
            return isInteger(value) && value >= -MAX_SAFE_INTEGER && value <= MAX_SAFE_INTEGER;
          }
          var isSet = nodeIsSet ? baseUnary(nodeIsSet) : baseIsSet;
          function isString(value) {
            return typeof value == "string" || !isArray(value) && isObjectLike(value) && baseGetTag(value) == stringTag;
          }
          function isSymbol(value) {
            return typeof value == "symbol" || isObjectLike(value) && baseGetTag(value) == symbolTag;
          }
          var isTypedArray = nodeIsTypedArray ? baseUnary(nodeIsTypedArray) : baseIsTypedArray;
          function isUndefined(value) {
            return value === undefined2;
          }
          function isWeakMap(value) {
            return isObjectLike(value) && getTag(value) == weakMapTag;
          }
          function isWeakSet(value) {
            return isObjectLike(value) && baseGetTag(value) == weakSetTag;
          }
          var lt = createRelationalOperation(baseLt);
          var lte = createRelationalOperation(function(value, other) {
            return value <= other;
          });
          function toArray(value) {
            if (!value) {
              return [];
            }
            if (isArrayLike(value)) {
              return isString(value) ? stringToArray(value) : copyArray(value);
            }
            if (symIterator && value[symIterator]) {
              return iteratorToArray(value[symIterator]());
            }
            var tag = getTag(value), func = tag == mapTag ? mapToArray : tag == setTag ? setToArray : values;
            return func(value);
          }
          function toFinite(value) {
            if (!value) {
              return value === 0 ? value : 0;
            }
            value = toNumber(value);
            if (value === INFINITY || value === -INFINITY) {
              var sign = value < 0 ? -1 : 1;
              return sign * MAX_INTEGER;
            }
            return value === value ? value : 0;
          }
          function toInteger(value) {
            var result2 = toFinite(value), remainder = result2 % 1;
            return result2 === result2 ? remainder ? result2 - remainder : result2 : 0;
          }
          function toLength(value) {
            return value ? baseClamp(toInteger(value), 0, MAX_ARRAY_LENGTH) : 0;
          }
          function toNumber(value) {
            if (typeof value == "number") {
              return value;
            }
            if (isSymbol(value)) {
              return NAN;
            }
            if (isObject(value)) {
              var other = typeof value.valueOf == "function" ? value.valueOf() : value;
              value = isObject(other) ? other + "" : other;
            }
            if (typeof value != "string") {
              return value === 0 ? value : +value;
            }
            value = baseTrim(value);
            var isBinary = reIsBinary.test(value);
            return isBinary || reIsOctal.test(value) ? freeParseInt(value.slice(2), isBinary ? 2 : 8) : reIsBadHex.test(value) ? NAN : +value;
          }
          function toPlainObject(value) {
            return copyObject(value, keysIn(value));
          }
          function toSafeInteger(value) {
            return value ? baseClamp(toInteger(value), -MAX_SAFE_INTEGER, MAX_SAFE_INTEGER) : value === 0 ? value : 0;
          }
          function toString(value) {
            return value == null ? "" : baseToString(value);
          }
          var assign = createAssigner(function(object, source) {
            if (isPrototype(source) || isArrayLike(source)) {
              copyObject(source, keys(source), object);
              return;
            }
            for (var key in source) {
              if (hasOwnProperty.call(source, key)) {
                assignValue(object, key, source[key]);
              }
            }
          });
          var assignIn = createAssigner(function(object, source) {
            copyObject(source, keysIn(source), object);
          });
          var assignInWith = createAssigner(function(object, source, srcIndex, customizer) {
            copyObject(source, keysIn(source), object, customizer);
          });
          var assignWith = createAssigner(function(object, source, srcIndex, customizer) {
            copyObject(source, keys(source), object, customizer);
          });
          var at = flatRest(baseAt);
          function create(prototype, properties) {
            var result2 = baseCreate(prototype);
            return properties == null ? result2 : baseAssign(result2, properties);
          }
          var defaults = baseRest(function(object, sources) {
            object = Object2(object);
            var index = -1;
            var length = sources.length;
            var guard = length > 2 ? sources[2] : undefined2;
            if (guard && isIterateeCall(sources[0], sources[1], guard)) {
              length = 1;
            }
            while (++index < length) {
              var source = sources[index];
              var props = keysIn(source);
              var propsIndex = -1;
              var propsLength = props.length;
              while (++propsIndex < propsLength) {
                var key = props[propsIndex];
                var value = object[key];
                if (value === undefined2 || eq(value, objectProto[key]) && !hasOwnProperty.call(object, key)) {
                  object[key] = source[key];
                }
              }
            }
            return object;
          });
          var defaultsDeep = baseRest(function(args) {
            args.push(undefined2, customDefaultsMerge);
            return apply(mergeWith, undefined2, args);
          });
          function findKey(object, predicate) {
            return baseFindKey(object, getIteratee(predicate, 3), baseForOwn);
          }
          function findLastKey(object, predicate) {
            return baseFindKey(object, getIteratee(predicate, 3), baseForOwnRight);
          }
          function forIn(object, iteratee2) {
            return object == null ? object : baseFor(object, getIteratee(iteratee2, 3), keysIn);
          }
          function forInRight(object, iteratee2) {
            return object == null ? object : baseForRight(object, getIteratee(iteratee2, 3), keysIn);
          }
          function forOwn(object, iteratee2) {
            return object && baseForOwn(object, getIteratee(iteratee2, 3));
          }
          function forOwnRight(object, iteratee2) {
            return object && baseForOwnRight(object, getIteratee(iteratee2, 3));
          }
          function functions(object) {
            return object == null ? [] : baseFunctions(object, keys(object));
          }
          function functionsIn(object) {
            return object == null ? [] : baseFunctions(object, keysIn(object));
          }
          function get(object, path, defaultValue) {
            var result2 = object == null ? undefined2 : baseGet(object, path);
            return result2 === undefined2 ? defaultValue : result2;
          }
          function has(object, path) {
            return object != null && hasPath(object, path, baseHas);
          }
          function hasIn(object, path) {
            return object != null && hasPath(object, path, baseHasIn);
          }
          var invert = createInverter(function(result2, value, key) {
            if (value != null && typeof value.toString != "function") {
              value = nativeObjectToString.call(value);
            }
            result2[value] = key;
          }, constant(identity));
          var invertBy = createInverter(function(result2, value, key) {
            if (value != null && typeof value.toString != "function") {
              value = nativeObjectToString.call(value);
            }
            if (hasOwnProperty.call(result2, value)) {
              result2[value].push(key);
            } else {
              result2[value] = [key];
            }
          }, getIteratee);
          var invoke = baseRest(baseInvoke);
          function keys(object) {
            return isArrayLike(object) ? arrayLikeKeys(object) : baseKeys(object);
          }
          function keysIn(object) {
            return isArrayLike(object) ? arrayLikeKeys(object, true) : baseKeysIn(object);
          }
          function mapKeys(object, iteratee2) {
            var result2 = {};
            iteratee2 = getIteratee(iteratee2, 3);
            baseForOwn(object, function(value, key, object2) {
              baseAssignValue(result2, iteratee2(value, key, object2), value);
            });
            return result2;
          }
          function mapValues(object, iteratee2) {
            var result2 = {};
            iteratee2 = getIteratee(iteratee2, 3);
            baseForOwn(object, function(value, key, object2) {
              baseAssignValue(result2, key, iteratee2(value, key, object2));
            });
            return result2;
          }
          var merge = createAssigner(function(object, source, srcIndex) {
            baseMerge(object, source, srcIndex);
          });
          var mergeWith = createAssigner(function(object, source, srcIndex, customizer) {
            baseMerge(object, source, srcIndex, customizer);
          });
          var omit = flatRest(function(object, paths) {
            var result2 = {};
            if (object == null) {
              return result2;
            }
            var isDeep = false;
            paths = arrayMap(paths, function(path) {
              path = castPath(path, object);
              isDeep || (isDeep = path.length > 1);
              return path;
            });
            copyObject(object, getAllKeysIn(object), result2);
            if (isDeep) {
              result2 = baseClone(result2, CLONE_DEEP_FLAG | CLONE_FLAT_FLAG | CLONE_SYMBOLS_FLAG, customOmitClone);
            }
            var length = paths.length;
            while (length--) {
              baseUnset(result2, paths[length]);
            }
            return result2;
          });
          function omitBy(object, predicate) {
            return pickBy(object, negate(getIteratee(predicate)));
          }
          var pick = flatRest(function(object, paths) {
            return object == null ? {} : basePick(object, paths);
          });
          function pickBy(object, predicate) {
            if (object == null) {
              return {};
            }
            var props = arrayMap(getAllKeysIn(object), function(prop) {
              return [prop];
            });
            predicate = getIteratee(predicate);
            return basePickBy(object, props, function(value, path) {
              return predicate(value, path[0]);
            });
          }
          function result(object, path, defaultValue) {
            path = castPath(path, object);
            var index = -1, length = path.length;
            if (!length) {
              length = 1;
              object = undefined2;
            }
            while (++index < length) {
              var value = object == null ? undefined2 : object[toKey(path[index])];
              if (value === undefined2) {
                index = length;
                value = defaultValue;
              }
              object = isFunction(value) ? value.call(object) : value;
            }
            return object;
          }
          function set(object, path, value) {
            return object == null ? object : baseSet(object, path, value);
          }
          function setWith(object, path, value, customizer) {
            customizer = typeof customizer == "function" ? customizer : undefined2;
            return object == null ? object : baseSet(object, path, value, customizer);
          }
          var toPairs = createToPairs(keys);
          var toPairsIn = createToPairs(keysIn);
          function transform(object, iteratee2, accumulator) {
            var isArr = isArray(object), isArrLike = isArr || isBuffer(object) || isTypedArray(object);
            iteratee2 = getIteratee(iteratee2, 4);
            if (accumulator == null) {
              var Ctor = object && object.constructor;
              if (isArrLike) {
                accumulator = isArr ? new Ctor() : [];
              } else if (isObject(object)) {
                accumulator = isFunction(Ctor) ? baseCreate(getPrototype(object)) : {};
              } else {
                accumulator = {};
              }
            }
            (isArrLike ? arrayEach : baseForOwn)(object, function(value, index, object2) {
              return iteratee2(accumulator, value, index, object2);
            });
            return accumulator;
          }
          function unset(object, path) {
            return object == null ? true : baseUnset(object, path);
          }
          function update(object, path, updater) {
            return object == null ? object : baseUpdate(object, path, castFunction(updater));
          }
          function updateWith(object, path, updater, customizer) {
            customizer = typeof customizer == "function" ? customizer : undefined2;
            return object == null ? object : baseUpdate(object, path, castFunction(updater), customizer);
          }
          function values(object) {
            return object == null ? [] : baseValues(object, keys(object));
          }
          function valuesIn(object) {
            return object == null ? [] : baseValues(object, keysIn(object));
          }
          function clamp(number, lower, upper) {
            if (upper === undefined2) {
              upper = lower;
              lower = undefined2;
            }
            if (upper !== undefined2) {
              upper = toNumber(upper);
              upper = upper === upper ? upper : 0;
            }
            if (lower !== undefined2) {
              lower = toNumber(lower);
              lower = lower === lower ? lower : 0;
            }
            return baseClamp(toNumber(number), lower, upper);
          }
          function inRange(number, start, end) {
            start = toFinite(start);
            if (end === undefined2) {
              end = start;
              start = 0;
            } else {
              end = toFinite(end);
            }
            number = toNumber(number);
            return baseInRange(number, start, end);
          }
          function random(lower, upper, floating) {
            if (floating && typeof floating != "boolean" && isIterateeCall(lower, upper, floating)) {
              upper = floating = undefined2;
            }
            if (floating === undefined2) {
              if (typeof upper == "boolean") {
                floating = upper;
                upper = undefined2;
              } else if (typeof lower == "boolean") {
                floating = lower;
                lower = undefined2;
              }
            }
            if (lower === undefined2 && upper === undefined2) {
              lower = 0;
              upper = 1;
            } else {
              lower = toFinite(lower);
              if (upper === undefined2) {
                upper = lower;
                lower = 0;
              } else {
                upper = toFinite(upper);
              }
            }
            if (lower > upper) {
              var temp = lower;
              lower = upper;
              upper = temp;
            }
            if (floating || lower % 1 || upper % 1) {
              var rand = nativeRandom();
              return nativeMin(lower + rand * (upper - lower + freeParseFloat("1e-" + ((rand + "").length - 1))), upper);
            }
            return baseRandom(lower, upper);
          }
          var camelCase = createCompounder(function(result2, word, index) {
            word = word.toLowerCase();
            return result2 + (index ? capitalize(word) : word);
          });
          function capitalize(string) {
            return upperFirst(toString(string).toLowerCase());
          }
          function deburr(string) {
            string = toString(string);
            return string && string.replace(reLatin, deburrLetter).replace(reComboMark, "");
          }
          function endsWith(string, target, position) {
            string = toString(string);
            target = baseToString(target);
            var length = string.length;
            position = position === undefined2 ? length : baseClamp(toInteger(position), 0, length);
            var end = position;
            position -= target.length;
            return position >= 0 && string.slice(position, end) == target;
          }
          function escape(string) {
            string = toString(string);
            return string && reHasUnescapedHtml.test(string) ? string.replace(reUnescapedHtml, escapeHtmlChar) : string;
          }
          function escapeRegExp(string) {
            string = toString(string);
            return string && reHasRegExpChar.test(string) ? string.replace(reRegExpChar, "\\$&") : string;
          }
          var kebabCase = createCompounder(function(result2, word, index) {
            return result2 + (index ? "-" : "") + word.toLowerCase();
          });
          var lowerCase = createCompounder(function(result2, word, index) {
            return result2 + (index ? " " : "") + word.toLowerCase();
          });
          var lowerFirst = createCaseFirst("toLowerCase");
          function pad(string, length, chars) {
            string = toString(string);
            length = toInteger(length);
            var strLength = length ? stringSize(string) : 0;
            if (!length || strLength >= length) {
              return string;
            }
            var mid = (length - strLength) / 2;
            return createPadding(nativeFloor(mid), chars) + string + createPadding(nativeCeil(mid), chars);
          }
          function padEnd(string, length, chars) {
            string = toString(string);
            length = toInteger(length);
            var strLength = length ? stringSize(string) : 0;
            return length && strLength < length ? string + createPadding(length - strLength, chars) : string;
          }
          function padStart(string, length, chars) {
            string = toString(string);
            length = toInteger(length);
            var strLength = length ? stringSize(string) : 0;
            return length && strLength < length ? createPadding(length - strLength, chars) + string : string;
          }
          function parseInt2(string, radix, guard) {
            if (guard || radix == null) {
              radix = 0;
            } else if (radix) {
              radix = +radix;
            }
            return nativeParseInt(toString(string).replace(reTrimStart, ""), radix || 0);
          }
          function repeat(string, n, guard) {
            if (guard ? isIterateeCall(string, n, guard) : n === undefined2) {
              n = 1;
            } else {
              n = toInteger(n);
            }
            return baseRepeat(toString(string), n);
          }
          function replace() {
            var args = arguments, string = toString(args[0]);
            return args.length < 3 ? string : string.replace(args[1], args[2]);
          }
          var snakeCase = createCompounder(function(result2, word, index) {
            return result2 + (index ? "_" : "") + word.toLowerCase();
          });
          function split(string, separator, limit) {
            if (limit && typeof limit != "number" && isIterateeCall(string, separator, limit)) {
              separator = limit = undefined2;
            }
            limit = limit === undefined2 ? MAX_ARRAY_LENGTH : limit >>> 0;
            if (!limit) {
              return [];
            }
            string = toString(string);
            if (string && (typeof separator == "string" || separator != null && !isRegExp(separator))) {
              separator = baseToString(separator);
              if (!separator && hasUnicode(string)) {
                return castSlice(stringToArray(string), 0, limit);
              }
            }
            return string.split(separator, limit);
          }
          var startCase = createCompounder(function(result2, word, index) {
            return result2 + (index ? " " : "") + upperFirst(word);
          });
          function startsWith(string, target, position) {
            string = toString(string);
            position = position == null ? 0 : baseClamp(toInteger(position), 0, string.length);
            target = baseToString(target);
            return string.slice(position, position + target.length) == target;
          }
          function template(string, options, guard) {
            var settings = lodash.templateSettings;
            if (guard && isIterateeCall(string, options, guard)) {
              options = undefined2;
            }
            string = toString(string);
            options = assignInWith({}, options, settings, customDefaultsAssignIn);
            var imports = assignInWith({}, options.imports, settings.imports, customDefaultsAssignIn), importsKeys = keys(imports), importsValues = baseValues(imports, importsKeys);
            var isEscaping, isEvaluating, index = 0, interpolate = options.interpolate || reNoMatch, source = "__p += '";
            var reDelimiters = RegExp2(
              (options.escape || reNoMatch).source + "|" + interpolate.source + "|" + (interpolate === reInterpolate ? reEsTemplate : reNoMatch).source + "|" + (options.evaluate || reNoMatch).source + "|$",
              "g"
            );
            var sourceURL = "//# sourceURL=" + (hasOwnProperty.call(options, "sourceURL") ? (options.sourceURL + "").replace(/\s/g, " ") : "lodash.templateSources[" + ++templateCounter + "]") + "\n";
            string.replace(reDelimiters, function(match, escapeValue, interpolateValue, esTemplateValue, evaluateValue, offset) {
              interpolateValue || (interpolateValue = esTemplateValue);
              source += string.slice(index, offset).replace(reUnescapedString, escapeStringChar);
              if (escapeValue) {
                isEscaping = true;
                source += "' +\n__e(" + escapeValue + ") +\n'";
              }
              if (evaluateValue) {
                isEvaluating = true;
                source += "';\n" + evaluateValue + ";\n__p += '";
              }
              if (interpolateValue) {
                source += "' +\n((__t = (" + interpolateValue + ")) == null ? '' : __t) +\n'";
              }
              index = offset + match.length;
              return match;
            });
            source += "';\n";
            var variable = hasOwnProperty.call(options, "variable") && options.variable;
            if (!variable) {
              source = "with (obj) {\n" + source + "\n}\n";
            } else if (reForbiddenIdentifierChars.test(variable)) {
              throw new Error2(INVALID_TEMPL_VAR_ERROR_TEXT);
            }
            source = (isEvaluating ? source.replace(reEmptyStringLeading, "") : source).replace(reEmptyStringMiddle, "$1").replace(reEmptyStringTrailing, "$1;");
            source = "function(" + (variable || "obj") + ") {\n" + (variable ? "" : "obj || (obj = {});\n") + "var __t, __p = ''" + (isEscaping ? ", __e = _.escape" : "") + (isEvaluating ? ", __j = Array.prototype.join;\nfunction print() { __p += __j.call(arguments, '') }\n" : ";\n") + source + "return __p\n}";
            var result2 = attempt(function() {
              return Function2(importsKeys, sourceURL + "return " + source).apply(undefined2, importsValues);
            });
            result2.source = source;
            if (isError(result2)) {
              throw result2;
            }
            return result2;
          }
          function toLower(value) {
            return toString(value).toLowerCase();
          }
          function toUpper(value) {
            return toString(value).toUpperCase();
          }
          function trim(string, chars, guard) {
            string = toString(string);
            if (string && (guard || chars === undefined2)) {
              return baseTrim(string);
            }
            if (!string || !(chars = baseToString(chars))) {
              return string;
            }
            var strSymbols = stringToArray(string), chrSymbols = stringToArray(chars), start = charsStartIndex(strSymbols, chrSymbols), end = charsEndIndex(strSymbols, chrSymbols) + 1;
            return castSlice(strSymbols, start, end).join("");
          }
          function trimEnd(string, chars, guard) {
            string = toString(string);
            if (string && (guard || chars === undefined2)) {
              return string.slice(0, trimmedEndIndex(string) + 1);
            }
            if (!string || !(chars = baseToString(chars))) {
              return string;
            }
            var strSymbols = stringToArray(string), end = charsEndIndex(strSymbols, stringToArray(chars)) + 1;
            return castSlice(strSymbols, 0, end).join("");
          }
          function trimStart(string, chars, guard) {
            string = toString(string);
            if (string && (guard || chars === undefined2)) {
              return string.replace(reTrimStart, "");
            }
            if (!string || !(chars = baseToString(chars))) {
              return string;
            }
            var strSymbols = stringToArray(string), start = charsStartIndex(strSymbols, stringToArray(chars));
            return castSlice(strSymbols, start).join("");
          }
          function truncate(string, options) {
            var length = DEFAULT_TRUNC_LENGTH, omission = DEFAULT_TRUNC_OMISSION;
            if (isObject(options)) {
              var separator = "separator" in options ? options.separator : separator;
              length = "length" in options ? toInteger(options.length) : length;
              omission = "omission" in options ? baseToString(options.omission) : omission;
            }
            string = toString(string);
            var strLength = string.length;
            if (hasUnicode(string)) {
              var strSymbols = stringToArray(string);
              strLength = strSymbols.length;
            }
            if (length >= strLength) {
              return string;
            }
            var end = length - stringSize(omission);
            if (end < 1) {
              return omission;
            }
            var result2 = strSymbols ? castSlice(strSymbols, 0, end).join("") : string.slice(0, end);
            if (separator === undefined2) {
              return result2 + omission;
            }
            if (strSymbols) {
              end += result2.length - end;
            }
            if (isRegExp(separator)) {
              if (string.slice(end).search(separator)) {
                var match, substring = result2;
                if (!separator.global) {
                  separator = RegExp2(separator.source, toString(reFlags.exec(separator)) + "g");
                }
                separator.lastIndex = 0;
                while (match = separator.exec(substring)) {
                  var newEnd = match.index;
                }
                result2 = result2.slice(0, newEnd === undefined2 ? end : newEnd);
              }
            } else if (string.indexOf(baseToString(separator), end) != end) {
              var index = result2.lastIndexOf(separator);
              if (index > -1) {
                result2 = result2.slice(0, index);
              }
            }
            return result2 + omission;
          }
          function unescape2(string) {
            string = toString(string);
            return string && reHasEscapedHtml.test(string) ? string.replace(reEscapedHtml, unescapeHtmlChar) : string;
          }
          var upperCase = createCompounder(function(result2, word, index) {
            return result2 + (index ? " " : "") + word.toUpperCase();
          });
          var upperFirst = createCaseFirst("toUpperCase");
          function words(string, pattern, guard) {
            string = toString(string);
            pattern = guard ? undefined2 : pattern;
            if (pattern === undefined2) {
              return hasUnicodeWord(string) ? unicodeWords(string) : asciiWords(string);
            }
            return string.match(pattern) || [];
          }
          var attempt = baseRest(function(func, args) {
            try {
              return apply(func, undefined2, args);
            } catch (e) {
              return isError(e) ? e : new Error2(e);
            }
          });
          var bindAll = flatRest(function(object, methodNames) {
            arrayEach(methodNames, function(key) {
              key = toKey(key);
              baseAssignValue(object, key, bind(object[key], object));
            });
            return object;
          });
          function cond(pairs) {
            var length = pairs == null ? 0 : pairs.length, toIteratee = getIteratee();
            pairs = !length ? [] : arrayMap(pairs, function(pair) {
              if (typeof pair[1] != "function") {
                throw new TypeError2(FUNC_ERROR_TEXT);
              }
              return [toIteratee(pair[0]), pair[1]];
            });
            return baseRest(function(args) {
              var index = -1;
              while (++index < length) {
                var pair = pairs[index];
                if (apply(pair[0], this, args)) {
                  return apply(pair[1], this, args);
                }
              }
            });
          }
          function conforms(source) {
            return baseConforms(baseClone(source, CLONE_DEEP_FLAG));
          }
          function constant(value) {
            return function() {
              return value;
            };
          }
          function defaultTo(value, defaultValue) {
            return value == null || value !== value ? defaultValue : value;
          }
          var flow = createFlow();
          var flowRight = createFlow(true);
          function identity(value) {
            return value;
          }
          function iteratee(func) {
            return baseIteratee(typeof func == "function" ? func : baseClone(func, CLONE_DEEP_FLAG));
          }
          function matches(source) {
            return baseMatches(baseClone(source, CLONE_DEEP_FLAG));
          }
          function matchesProperty(path, srcValue) {
            return baseMatchesProperty(path, baseClone(srcValue, CLONE_DEEP_FLAG));
          }
          var method = baseRest(function(path, args) {
            return function(object) {
              return baseInvoke(object, path, args);
            };
          });
          var methodOf = baseRest(function(object, args) {
            return function(path) {
              return baseInvoke(object, path, args);
            };
          });
          function mixin(object, source, options) {
            var props = keys(source), methodNames = baseFunctions(source, props);
            if (options == null && !(isObject(source) && (methodNames.length || !props.length))) {
              options = source;
              source = object;
              object = this;
              methodNames = baseFunctions(source, keys(source));
            }
            var chain2 = !(isObject(options) && "chain" in options) || !!options.chain, isFunc = isFunction(object);
            arrayEach(methodNames, function(methodName) {
              var func = source[methodName];
              object[methodName] = func;
              if (isFunc) {
                object.prototype[methodName] = function() {
                  var chainAll = this.__chain__;
                  if (chain2 || chainAll) {
                    var result2 = object(this.__wrapped__), actions = result2.__actions__ = copyArray(this.__actions__);
                    actions.push({ "func": func, "args": arguments, "thisArg": object });
                    result2.__chain__ = chainAll;
                    return result2;
                  }
                  return func.apply(object, arrayPush([this.value()], arguments));
                };
              }
            });
            return object;
          }
          function noConflict() {
            if (root._ === this) {
              root._ = oldDash;
            }
            return this;
          }
          function noop() {
          }
          function nthArg(n) {
            n = toInteger(n);
            return baseRest(function(args) {
              return baseNth(args, n);
            });
          }
          var over = createOver(arrayMap);
          var overEvery = createOver(arrayEvery);
          var overSome = createOver(arraySome);
          function property(path) {
            return isKey(path) ? baseProperty(toKey(path)) : basePropertyDeep(path);
          }
          function propertyOf(object) {
            return function(path) {
              return object == null ? undefined2 : baseGet(object, path);
            };
          }
          var range = createRange();
          var rangeRight = createRange(true);
          function stubArray() {
            return [];
          }
          function stubFalse() {
            return false;
          }
          function stubObject() {
            return {};
          }
          function stubString() {
            return "";
          }
          function stubTrue() {
            return true;
          }
          function times(n, iteratee2) {
            n = toInteger(n);
            if (n < 1 || n > MAX_SAFE_INTEGER) {
              return [];
            }
            var index = MAX_ARRAY_LENGTH, length = nativeMin(n, MAX_ARRAY_LENGTH);
            iteratee2 = getIteratee(iteratee2);
            n -= MAX_ARRAY_LENGTH;
            var result2 = baseTimes(length, iteratee2);
            while (++index < n) {
              iteratee2(index);
            }
            return result2;
          }
          function toPath(value) {
            if (isArray(value)) {
              return arrayMap(value, toKey);
            }
            return isSymbol(value) ? [value] : copyArray(stringToPath(toString(value)));
          }
          function uniqueId(prefix) {
            var id = ++idCounter;
            return toString(prefix) + id;
          }
          var add = createMathOperation(function(augend, addend) {
            return augend + addend;
          }, 0);
          var ceil = createRound("ceil");
          var divide = createMathOperation(function(dividend, divisor) {
            return dividend / divisor;
          }, 1);
          var floor = createRound("floor");
          function max(array) {
            return array && array.length ? baseExtremum(array, identity, baseGt) : undefined2;
          }
          function maxBy(array, iteratee2) {
            return array && array.length ? baseExtremum(array, getIteratee(iteratee2, 2), baseGt) : undefined2;
          }
          function mean(array) {
            return baseMean(array, identity);
          }
          function meanBy(array, iteratee2) {
            return baseMean(array, getIteratee(iteratee2, 2));
          }
          function min(array) {
            return array && array.length ? baseExtremum(array, identity, baseLt) : undefined2;
          }
          function minBy(array, iteratee2) {
            return array && array.length ? baseExtremum(array, getIteratee(iteratee2, 2), baseLt) : undefined2;
          }
          var multiply = createMathOperation(function(multiplier, multiplicand) {
            return multiplier * multiplicand;
          }, 1);
          var round = createRound("round");
          var subtract = createMathOperation(function(minuend, subtrahend) {
            return minuend - subtrahend;
          }, 0);
          function sum(array) {
            return array && array.length ? baseSum(array, identity) : 0;
          }
          function sumBy(array, iteratee2) {
            return array && array.length ? baseSum(array, getIteratee(iteratee2, 2)) : 0;
          }
          lodash.after = after;
          lodash.ary = ary;
          lodash.assign = assign;
          lodash.assignIn = assignIn;
          lodash.assignInWith = assignInWith;
          lodash.assignWith = assignWith;
          lodash.at = at;
          lodash.before = before;
          lodash.bind = bind;
          lodash.bindAll = bindAll;
          lodash.bindKey = bindKey;
          lodash.castArray = castArray;
          lodash.chain = chain;
          lodash.chunk = chunk;
          lodash.compact = compact;
          lodash.concat = concat;
          lodash.cond = cond;
          lodash.conforms = conforms;
          lodash.constant = constant;
          lodash.countBy = countBy;
          lodash.create = create;
          lodash.curry = curry;
          lodash.curryRight = curryRight;
          lodash.debounce = debounce;
          lodash.defaults = defaults;
          lodash.defaultsDeep = defaultsDeep;
          lodash.defer = defer;
          lodash.delay = delay;
          lodash.difference = difference;
          lodash.differenceBy = differenceBy;
          lodash.differenceWith = differenceWith;
          lodash.drop = drop;
          lodash.dropRight = dropRight;
          lodash.dropRightWhile = dropRightWhile;
          lodash.dropWhile = dropWhile;
          lodash.fill = fill;
          lodash.filter = filter;
          lodash.flatMap = flatMap;
          lodash.flatMapDeep = flatMapDeep;
          lodash.flatMapDepth = flatMapDepth;
          lodash.flatten = flatten;
          lodash.flattenDeep = flattenDeep;
          lodash.flattenDepth = flattenDepth;
          lodash.flip = flip;
          lodash.flow = flow;
          lodash.flowRight = flowRight;
          lodash.fromPairs = fromPairs;
          lodash.functions = functions;
          lodash.functionsIn = functionsIn;
          lodash.groupBy = groupBy;
          lodash.initial = initial;
          lodash.intersection = intersection;
          lodash.intersectionBy = intersectionBy;
          lodash.intersectionWith = intersectionWith;
          lodash.invert = invert;
          lodash.invertBy = invertBy;
          lodash.invokeMap = invokeMap;
          lodash.iteratee = iteratee;
          lodash.keyBy = keyBy;
          lodash.keys = keys;
          lodash.keysIn = keysIn;
          lodash.map = map;
          lodash.mapKeys = mapKeys;
          lodash.mapValues = mapValues;
          lodash.matches = matches;
          lodash.matchesProperty = matchesProperty;
          lodash.memoize = memoize;
          lodash.merge = merge;
          lodash.mergeWith = mergeWith;
          lodash.method = method;
          lodash.methodOf = methodOf;
          lodash.mixin = mixin;
          lodash.negate = negate;
          lodash.nthArg = nthArg;
          lodash.omit = omit;
          lodash.omitBy = omitBy;
          lodash.once = once;
          lodash.orderBy = orderBy;
          lodash.over = over;
          lodash.overArgs = overArgs;
          lodash.overEvery = overEvery;
          lodash.overSome = overSome;
          lodash.partial = partial;
          lodash.partialRight = partialRight;
          lodash.partition = partition;
          lodash.pick = pick;
          lodash.pickBy = pickBy;
          lodash.property = property;
          lodash.propertyOf = propertyOf;
          lodash.pull = pull;
          lodash.pullAll = pullAll;
          lodash.pullAllBy = pullAllBy;
          lodash.pullAllWith = pullAllWith;
          lodash.pullAt = pullAt;
          lodash.range = range;
          lodash.rangeRight = rangeRight;
          lodash.rearg = rearg;
          lodash.reject = reject;
          lodash.remove = remove;
          lodash.rest = rest;
          lodash.reverse = reverse;
          lodash.sampleSize = sampleSize;
          lodash.set = set;
          lodash.setWith = setWith;
          lodash.shuffle = shuffle;
          lodash.slice = slice;
          lodash.sortBy = sortBy;
          lodash.sortedUniq = sortedUniq;
          lodash.sortedUniqBy = sortedUniqBy;
          lodash.split = split;
          lodash.spread = spread;
          lodash.tail = tail;
          lodash.take = take;
          lodash.takeRight = takeRight;
          lodash.takeRightWhile = takeRightWhile;
          lodash.takeWhile = takeWhile;
          lodash.tap = tap;
          lodash.throttle = throttle;
          lodash.thru = thru;
          lodash.toArray = toArray;
          lodash.toPairs = toPairs;
          lodash.toPairsIn = toPairsIn;
          lodash.toPath = toPath;
          lodash.toPlainObject = toPlainObject;
          lodash.transform = transform;
          lodash.unary = unary;
          lodash.union = union;
          lodash.unionBy = unionBy;
          lodash.unionWith = unionWith;
          lodash.uniq = uniq;
          lodash.uniqBy = uniqBy;
          lodash.uniqWith = uniqWith;
          lodash.unset = unset;
          lodash.unzip = unzip;
          lodash.unzipWith = unzipWith;
          lodash.update = update;
          lodash.updateWith = updateWith;
          lodash.values = values;
          lodash.valuesIn = valuesIn;
          lodash.without = without;
          lodash.words = words;
          lodash.wrap = wrap;
          lodash.xor = xor;
          lodash.xorBy = xorBy;
          lodash.xorWith = xorWith;
          lodash.zip = zip;
          lodash.zipObject = zipObject;
          lodash.zipObjectDeep = zipObjectDeep;
          lodash.zipWith = zipWith;
          lodash.entries = toPairs;
          lodash.entriesIn = toPairsIn;
          lodash.extend = assignIn;
          lodash.extendWith = assignInWith;
          mixin(lodash, lodash);
          lodash.add = add;
          lodash.attempt = attempt;
          lodash.camelCase = camelCase;
          lodash.capitalize = capitalize;
          lodash.ceil = ceil;
          lodash.clamp = clamp;
          lodash.clone = clone;
          lodash.cloneDeep = cloneDeep;
          lodash.cloneDeepWith = cloneDeepWith;
          lodash.cloneWith = cloneWith;
          lodash.conformsTo = conformsTo;
          lodash.deburr = deburr;
          lodash.defaultTo = defaultTo;
          lodash.divide = divide;
          lodash.endsWith = endsWith;
          lodash.eq = eq;
          lodash.escape = escape;
          lodash.escapeRegExp = escapeRegExp;
          lodash.every = every;
          lodash.find = find;
          lodash.findIndex = findIndex;
          lodash.findKey = findKey;
          lodash.findLast = findLast;
          lodash.findLastIndex = findLastIndex;
          lodash.findLastKey = findLastKey;
          lodash.floor = floor;
          lodash.forEach = forEach;
          lodash.forEachRight = forEachRight;
          lodash.forIn = forIn;
          lodash.forInRight = forInRight;
          lodash.forOwn = forOwn;
          lodash.forOwnRight = forOwnRight;
          lodash.get = get;
          lodash.gt = gt;
          lodash.gte = gte;
          lodash.has = has;
          lodash.hasIn = hasIn;
          lodash.head = head;
          lodash.identity = identity;
          lodash.includes = includes;
          lodash.indexOf = indexOf;
          lodash.inRange = inRange;
          lodash.invoke = invoke;
          lodash.isArguments = isArguments;
          lodash.isArray = isArray;
          lodash.isArrayBuffer = isArrayBuffer;
          lodash.isArrayLike = isArrayLike;
          lodash.isArrayLikeObject = isArrayLikeObject;
          lodash.isBoolean = isBoolean;
          lodash.isBuffer = isBuffer;
          lodash.isDate = isDate;
          lodash.isElement = isElement;
          lodash.isEmpty = isEmpty;
          lodash.isEqual = isEqual;
          lodash.isEqualWith = isEqualWith;
          lodash.isError = isError;
          lodash.isFinite = isFinite;
          lodash.isFunction = isFunction;
          lodash.isInteger = isInteger;
          lodash.isLength = isLength;
          lodash.isMap = isMap;
          lodash.isMatch = isMatch;
          lodash.isMatchWith = isMatchWith;
          lodash.isNaN = isNaN;
          lodash.isNative = isNative;
          lodash.isNil = isNil;
          lodash.isNull = isNull;
          lodash.isNumber = isNumber;
          lodash.isObject = isObject;
          lodash.isObjectLike = isObjectLike;
          lodash.isPlainObject = isPlainObject;
          lodash.isRegExp = isRegExp;
          lodash.isSafeInteger = isSafeInteger;
          lodash.isSet = isSet;
          lodash.isString = isString;
          lodash.isSymbol = isSymbol;
          lodash.isTypedArray = isTypedArray;
          lodash.isUndefined = isUndefined;
          lodash.isWeakMap = isWeakMap;
          lodash.isWeakSet = isWeakSet;
          lodash.join = join;
          lodash.kebabCase = kebabCase;
          lodash.last = last;
          lodash.lastIndexOf = lastIndexOf;
          lodash.lowerCase = lowerCase;
          lodash.lowerFirst = lowerFirst;
          lodash.lt = lt;
          lodash.lte = lte;
          lodash.max = max;
          lodash.maxBy = maxBy;
          lodash.mean = mean;
          lodash.meanBy = meanBy;
          lodash.min = min;
          lodash.minBy = minBy;
          lodash.stubArray = stubArray;
          lodash.stubFalse = stubFalse;
          lodash.stubObject = stubObject;
          lodash.stubString = stubString;
          lodash.stubTrue = stubTrue;
          lodash.multiply = multiply;
          lodash.nth = nth;
          lodash.noConflict = noConflict;
          lodash.noop = noop;
          lodash.now = now;
          lodash.pad = pad;
          lodash.padEnd = padEnd;
          lodash.padStart = padStart;
          lodash.parseInt = parseInt2;
          lodash.random = random;
          lodash.reduce = reduce;
          lodash.reduceRight = reduceRight;
          lodash.repeat = repeat;
          lodash.replace = replace;
          lodash.result = result;
          lodash.round = round;
          lodash.runInContext = runInContext2;
          lodash.sample = sample;
          lodash.size = size;
          lodash.snakeCase = snakeCase;
          lodash.some = some;
          lodash.sortedIndex = sortedIndex;
          lodash.sortedIndexBy = sortedIndexBy;
          lodash.sortedIndexOf = sortedIndexOf;
          lodash.sortedLastIndex = sortedLastIndex;
          lodash.sortedLastIndexBy = sortedLastIndexBy;
          lodash.sortedLastIndexOf = sortedLastIndexOf;
          lodash.startCase = startCase;
          lodash.startsWith = startsWith;
          lodash.subtract = subtract;
          lodash.sum = sum;
          lodash.sumBy = sumBy;
          lodash.template = template;
          lodash.times = times;
          lodash.toFinite = toFinite;
          lodash.toInteger = toInteger;
          lodash.toLength = toLength;
          lodash.toLower = toLower;
          lodash.toNumber = toNumber;
          lodash.toSafeInteger = toSafeInteger;
          lodash.toString = toString;
          lodash.toUpper = toUpper;
          lodash.trim = trim;
          lodash.trimEnd = trimEnd;
          lodash.trimStart = trimStart;
          lodash.truncate = truncate;
          lodash.unescape = unescape2;
          lodash.uniqueId = uniqueId;
          lodash.upperCase = upperCase;
          lodash.upperFirst = upperFirst;
          lodash.each = forEach;
          lodash.eachRight = forEachRight;
          lodash.first = head;
          mixin(lodash, (function() {
            var source = {};
            baseForOwn(lodash, function(func, methodName) {
              if (!hasOwnProperty.call(lodash.prototype, methodName)) {
                source[methodName] = func;
              }
            });
            return source;
          })(), { "chain": false });
          lodash.VERSION = VERSION;
          arrayEach(["bind", "bindKey", "curry", "curryRight", "partial", "partialRight"], function(methodName) {
            lodash[methodName].placeholder = lodash;
          });
          arrayEach(["drop", "take"], function(methodName, index) {
            LazyWrapper.prototype[methodName] = function(n) {
              n = n === undefined2 ? 1 : nativeMax(toInteger(n), 0);
              var result2 = this.__filtered__ && !index ? new LazyWrapper(this) : this.clone();
              if (result2.__filtered__) {
                result2.__takeCount__ = nativeMin(n, result2.__takeCount__);
              } else {
                result2.__views__.push({
                  "size": nativeMin(n, MAX_ARRAY_LENGTH),
                  "type": methodName + (result2.__dir__ < 0 ? "Right" : "")
                });
              }
              return result2;
            };
            LazyWrapper.prototype[methodName + "Right"] = function(n) {
              return this.reverse()[methodName](n).reverse();
            };
          });
          arrayEach(["filter", "map", "takeWhile"], function(methodName, index) {
            var type = index + 1, isFilter = type == LAZY_FILTER_FLAG || type == LAZY_WHILE_FLAG;
            LazyWrapper.prototype[methodName] = function(iteratee2) {
              var result2 = this.clone();
              result2.__iteratees__.push({
                "iteratee": getIteratee(iteratee2, 3),
                "type": type
              });
              result2.__filtered__ = result2.__filtered__ || isFilter;
              return result2;
            };
          });
          arrayEach(["head", "last"], function(methodName, index) {
            var takeName = "take" + (index ? "Right" : "");
            LazyWrapper.prototype[methodName] = function() {
              return this[takeName](1).value()[0];
            };
          });
          arrayEach(["initial", "tail"], function(methodName, index) {
            var dropName = "drop" + (index ? "" : "Right");
            LazyWrapper.prototype[methodName] = function() {
              return this.__filtered__ ? new LazyWrapper(this) : this[dropName](1);
            };
          });
          LazyWrapper.prototype.compact = function() {
            return this.filter(identity);
          };
          LazyWrapper.prototype.find = function(predicate) {
            return this.filter(predicate).head();
          };
          LazyWrapper.prototype.findLast = function(predicate) {
            return this.reverse().find(predicate);
          };
          LazyWrapper.prototype.invokeMap = baseRest(function(path, args) {
            if (typeof path == "function") {
              return new LazyWrapper(this);
            }
            return this.map(function(value) {
              return baseInvoke(value, path, args);
            });
          });
          LazyWrapper.prototype.reject = function(predicate) {
            return this.filter(negate(getIteratee(predicate)));
          };
          LazyWrapper.prototype.slice = function(start, end) {
            start = toInteger(start);
            var result2 = this;
            if (result2.__filtered__ && (start > 0 || end < 0)) {
              return new LazyWrapper(result2);
            }
            if (start < 0) {
              result2 = result2.takeRight(-start);
            } else if (start) {
              result2 = result2.drop(start);
            }
            if (end !== undefined2) {
              end = toInteger(end);
              result2 = end < 0 ? result2.dropRight(-end) : result2.take(end - start);
            }
            return result2;
          };
          LazyWrapper.prototype.takeRightWhile = function(predicate) {
            return this.reverse().takeWhile(predicate).reverse();
          };
          LazyWrapper.prototype.toArray = function() {
            return this.take(MAX_ARRAY_LENGTH);
          };
          baseForOwn(LazyWrapper.prototype, function(func, methodName) {
            var checkIteratee = /^(?:filter|find|map|reject)|While$/.test(methodName), isTaker = /^(?:head|last)$/.test(methodName), lodashFunc = lodash[isTaker ? "take" + (methodName == "last" ? "Right" : "") : methodName], retUnwrapped = isTaker || /^find/.test(methodName);
            if (!lodashFunc) {
              return;
            }
            lodash.prototype[methodName] = function() {
              var value = this.__wrapped__, args = isTaker ? [1] : arguments, isLazy = value instanceof LazyWrapper, iteratee2 = args[0], useLazy = isLazy || isArray(value);
              var interceptor = function(value2) {
                var result3 = lodashFunc.apply(lodash, arrayPush([value2], args));
                return isTaker && chainAll ? result3[0] : result3;
              };
              if (useLazy && checkIteratee && typeof iteratee2 == "function" && iteratee2.length != 1) {
                isLazy = useLazy = false;
              }
              var chainAll = this.__chain__, isHybrid = !!this.__actions__.length, isUnwrapped = retUnwrapped && !chainAll, onlyLazy = isLazy && !isHybrid;
              if (!retUnwrapped && useLazy) {
                value = onlyLazy ? value : new LazyWrapper(this);
                var result2 = func.apply(value, args);
                result2.__actions__.push({ "func": thru, "args": [interceptor], "thisArg": undefined2 });
                return new LodashWrapper(result2, chainAll);
              }
              if (isUnwrapped && onlyLazy) {
                return func.apply(this, args);
              }
              result2 = this.thru(interceptor);
              return isUnwrapped ? isTaker ? result2.value()[0] : result2.value() : result2;
            };
          });
          arrayEach(["pop", "push", "shift", "sort", "splice", "unshift"], function(methodName) {
            var func = arrayProto[methodName], chainName = /^(?:push|sort|unshift)$/.test(methodName) ? "tap" : "thru", retUnwrapped = /^(?:pop|shift)$/.test(methodName);
            lodash.prototype[methodName] = function() {
              var args = arguments;
              if (retUnwrapped && !this.__chain__) {
                var value = this.value();
                return func.apply(isArray(value) ? value : [], args);
              }
              return this[chainName](function(value2) {
                return func.apply(isArray(value2) ? value2 : [], args);
              });
            };
          });
          baseForOwn(LazyWrapper.prototype, function(func, methodName) {
            var lodashFunc = lodash[methodName];
            if (lodashFunc) {
              var key = lodashFunc.name + "";
              if (!hasOwnProperty.call(realNames, key)) {
                realNames[key] = [];
              }
              realNames[key].push({ "name": methodName, "func": lodashFunc });
            }
          });
          realNames[createHybrid(undefined2, WRAP_BIND_KEY_FLAG).name] = [{
            "name": "wrapper",
            "func": undefined2
          }];
          LazyWrapper.prototype.clone = lazyClone;
          LazyWrapper.prototype.reverse = lazyReverse;
          LazyWrapper.prototype.value = lazyValue;
          lodash.prototype.at = wrapperAt;
          lodash.prototype.chain = wrapperChain;
          lodash.prototype.commit = wrapperCommit;
          lodash.prototype.next = wrapperNext;
          lodash.prototype.plant = wrapperPlant;
          lodash.prototype.reverse = wrapperReverse;
          lodash.prototype.toJSON = lodash.prototype.valueOf = lodash.prototype.value = wrapperValue;
          lodash.prototype.first = lodash.prototype.head;
          if (symIterator) {
            lodash.prototype[symIterator] = wrapperToIterator;
          }
          return lodash;
        });
        var _ = runInContext();
        if (typeof define == "function" && typeof define.amd == "object" && define.amd) {
          root._ = _;
          define(function() {
            return _;
          });
        } else if (freeModule) {
          (freeModule.exports = _)._ = _;
          freeExports._ = _;
        } else {
          root._ = _;
        }
      }).call(exports);
    }
  });

  // node_modules/axios/dist/browser/axios.cjs
  var require_axios = __commonJS({
    "node_modules/axios/dist/browser/axios.cjs"(exports, module) {
      "use strict";
      function bind(fn, thisArg) {
        return function wrap() {
          return fn.apply(thisArg, arguments);
        };
      }
      var { toString } = Object.prototype;
      var { getPrototypeOf } = Object;
      var { iterator, toStringTag } = Symbol;
      var kindOf = /* @__PURE__ */ ((cache) => (thing) => {
        const str = toString.call(thing);
        return cache[str] || (cache[str] = str.slice(8, -1).toLowerCase());
      })(/* @__PURE__ */ Object.create(null));
      var kindOfTest = (type) => {
        type = type.toLowerCase();
        return (thing) => kindOf(thing) === type;
      };
      var typeOfTest = (type) => (thing) => typeof thing === type;
      var { isArray } = Array;
      var isUndefined = typeOfTest("undefined");
      function isBuffer(val) {
        return val !== null && !isUndefined(val) && val.constructor !== null && !isUndefined(val.constructor) && isFunction$1(val.constructor.isBuffer) && val.constructor.isBuffer(val);
      }
      var isArrayBuffer = kindOfTest("ArrayBuffer");
      function isArrayBufferView(val) {
        let result;
        if (typeof ArrayBuffer !== "undefined" && ArrayBuffer.isView) {
          result = ArrayBuffer.isView(val);
        } else {
          result = val && val.buffer && isArrayBuffer(val.buffer);
        }
        return result;
      }
      var isString = typeOfTest("string");
      var isFunction$1 = typeOfTest("function");
      var isNumber = typeOfTest("number");
      var isObject = (thing) => thing !== null && typeof thing === "object";
      var isBoolean = (thing) => thing === true || thing === false;
      var isPlainObject = (val) => {
        if (kindOf(val) !== "object") {
          return false;
        }
        const prototype2 = getPrototypeOf(val);
        return (prototype2 === null || prototype2 === Object.prototype || Object.getPrototypeOf(prototype2) === null) && !(toStringTag in val) && !(iterator in val);
      };
      var isEmptyObject = (val) => {
        if (!isObject(val) || isBuffer(val)) {
          return false;
        }
        try {
          return Object.keys(val).length === 0 && Object.getPrototypeOf(val) === Object.prototype;
        } catch (e) {
          return false;
        }
      };
      var isDate = kindOfTest("Date");
      var isFile = kindOfTest("File");
      var isBlob = kindOfTest("Blob");
      var isFileList = kindOfTest("FileList");
      var isStream = (val) => isObject(val) && isFunction$1(val.pipe);
      var isFormData = (thing) => {
        let kind;
        return thing && (typeof FormData === "function" && thing instanceof FormData || isFunction$1(thing.append) && ((kind = kindOf(thing)) === "formdata" || // detect form-data instance
        kind === "object" && isFunction$1(thing.toString) && thing.toString() === "[object FormData]"));
      };
      var isURLSearchParams = kindOfTest("URLSearchParams");
      var [isReadableStream, isRequest, isResponse, isHeaders] = ["ReadableStream", "Request", "Response", "Headers"].map(kindOfTest);
      var trim = (str) => str.trim ? str.trim() : str.replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, "");
      function forEach(obj, fn, { allOwnKeys = false } = {}) {
        if (obj === null || typeof obj === "undefined") {
          return;
        }
        let i;
        let l;
        if (typeof obj !== "object") {
          obj = [obj];
        }
        if (isArray(obj)) {
          for (i = 0, l = obj.length; i < l; i++) {
            fn.call(null, obj[i], i, obj);
          }
        } else {
          if (isBuffer(obj)) {
            return;
          }
          const keys = allOwnKeys ? Object.getOwnPropertyNames(obj) : Object.keys(obj);
          const len = keys.length;
          let key;
          for (i = 0; i < len; i++) {
            key = keys[i];
            fn.call(null, obj[key], key, obj);
          }
        }
      }
      function findKey(obj, key) {
        if (isBuffer(obj)) {
          return null;
        }
        key = key.toLowerCase();
        const keys = Object.keys(obj);
        let i = keys.length;
        let _key;
        while (i-- > 0) {
          _key = keys[i];
          if (key === _key.toLowerCase()) {
            return _key;
          }
        }
        return null;
      }
      var _global = (() => {
        if (typeof globalThis !== "undefined") return globalThis;
        return typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : global;
      })();
      var isContextDefined = (context) => !isUndefined(context) && context !== _global;
      function merge() {
        const { caseless, skipUndefined } = isContextDefined(this) && this || {};
        const result = {};
        const assignValue = (val, key) => {
          const targetKey = caseless && findKey(result, key) || key;
          if (isPlainObject(result[targetKey]) && isPlainObject(val)) {
            result[targetKey] = merge(result[targetKey], val);
          } else if (isPlainObject(val)) {
            result[targetKey] = merge({}, val);
          } else if (isArray(val)) {
            result[targetKey] = val.slice();
          } else if (!skipUndefined || !isUndefined(val)) {
            result[targetKey] = val;
          }
        };
        for (let i = 0, l = arguments.length; i < l; i++) {
          arguments[i] && forEach(arguments[i], assignValue);
        }
        return result;
      }
      var extend = (a, b, thisArg, { allOwnKeys } = {}) => {
        forEach(b, (val, key) => {
          if (thisArg && isFunction$1(val)) {
            a[key] = bind(val, thisArg);
          } else {
            a[key] = val;
          }
        }, { allOwnKeys });
        return a;
      };
      var stripBOM = (content) => {
        if (content.charCodeAt(0) === 65279) {
          content = content.slice(1);
        }
        return content;
      };
      var inherits = (constructor, superConstructor, props, descriptors2) => {
        constructor.prototype = Object.create(superConstructor.prototype, descriptors2);
        constructor.prototype.constructor = constructor;
        Object.defineProperty(constructor, "super", {
          value: superConstructor.prototype
        });
        props && Object.assign(constructor.prototype, props);
      };
      var toFlatObject = (sourceObj, destObj, filter, propFilter) => {
        let props;
        let i;
        let prop;
        const merged = {};
        destObj = destObj || {};
        if (sourceObj == null) return destObj;
        do {
          props = Object.getOwnPropertyNames(sourceObj);
          i = props.length;
          while (i-- > 0) {
            prop = props[i];
            if ((!propFilter || propFilter(prop, sourceObj, destObj)) && !merged[prop]) {
              destObj[prop] = sourceObj[prop];
              merged[prop] = true;
            }
          }
          sourceObj = filter !== false && getPrototypeOf(sourceObj);
        } while (sourceObj && (!filter || filter(sourceObj, destObj)) && sourceObj !== Object.prototype);
        return destObj;
      };
      var endsWith = (str, searchString, position) => {
        str = String(str);
        if (position === void 0 || position > str.length) {
          position = str.length;
        }
        position -= searchString.length;
        const lastIndex = str.indexOf(searchString, position);
        return lastIndex !== -1 && lastIndex === position;
      };
      var toArray = (thing) => {
        if (!thing) return null;
        if (isArray(thing)) return thing;
        let i = thing.length;
        if (!isNumber(i)) return null;
        const arr = new Array(i);
        while (i-- > 0) {
          arr[i] = thing[i];
        }
        return arr;
      };
      var isTypedArray = /* @__PURE__ */ ((TypedArray) => {
        return (thing) => {
          return TypedArray && thing instanceof TypedArray;
        };
      })(typeof Uint8Array !== "undefined" && getPrototypeOf(Uint8Array));
      var forEachEntry = (obj, fn) => {
        const generator = obj && obj[iterator];
        const _iterator = generator.call(obj);
        let result;
        while ((result = _iterator.next()) && !result.done) {
          const pair = result.value;
          fn.call(obj, pair[0], pair[1]);
        }
      };
      var matchAll = (regExp, str) => {
        let matches;
        const arr = [];
        while ((matches = regExp.exec(str)) !== null) {
          arr.push(matches);
        }
        return arr;
      };
      var isHTMLForm = kindOfTest("HTMLFormElement");
      var toCamelCase = (str) => {
        return str.toLowerCase().replace(
          /[-_\s]([a-z\d])(\w*)/g,
          function replacer(m, p1, p2) {
            return p1.toUpperCase() + p2;
          }
        );
      };
      var hasOwnProperty = (({ hasOwnProperty: hasOwnProperty2 }) => (obj, prop) => hasOwnProperty2.call(obj, prop))(Object.prototype);
      var isRegExp = kindOfTest("RegExp");
      var reduceDescriptors = (obj, reducer) => {
        const descriptors2 = Object.getOwnPropertyDescriptors(obj);
        const reducedDescriptors = {};
        forEach(descriptors2, (descriptor, name) => {
          let ret;
          if ((ret = reducer(descriptor, name, obj)) !== false) {
            reducedDescriptors[name] = ret || descriptor;
          }
        });
        Object.defineProperties(obj, reducedDescriptors);
      };
      var freezeMethods = (obj) => {
        reduceDescriptors(obj, (descriptor, name) => {
          if (isFunction$1(obj) && ["arguments", "caller", "callee"].indexOf(name) !== -1) {
            return false;
          }
          const value = obj[name];
          if (!isFunction$1(value)) return;
          descriptor.enumerable = false;
          if ("writable" in descriptor) {
            descriptor.writable = false;
            return;
          }
          if (!descriptor.set) {
            descriptor.set = () => {
              throw Error("Can not rewrite read-only method '" + name + "'");
            };
          }
        });
      };
      var toObjectSet = (arrayOrString, delimiter) => {
        const obj = {};
        const define2 = (arr) => {
          arr.forEach((value) => {
            obj[value] = true;
          });
        };
        isArray(arrayOrString) ? define2(arrayOrString) : define2(String(arrayOrString).split(delimiter));
        return obj;
      };
      var noop = () => {
      };
      var toFiniteNumber = (value, defaultValue) => {
        return value != null && Number.isFinite(value = +value) ? value : defaultValue;
      };
      function isSpecCompliantForm(thing) {
        return !!(thing && isFunction$1(thing.append) && thing[toStringTag] === "FormData" && thing[iterator]);
      }
      var toJSONObject = (obj) => {
        const stack = new Array(10);
        const visit = (source, i) => {
          if (isObject(source)) {
            if (stack.indexOf(source) >= 0) {
              return;
            }
            if (isBuffer(source)) {
              return source;
            }
            if (!("toJSON" in source)) {
              stack[i] = source;
              const target = isArray(source) ? [] : {};
              forEach(source, (value, key) => {
                const reducedValue = visit(value, i + 1);
                !isUndefined(reducedValue) && (target[key] = reducedValue);
              });
              stack[i] = void 0;
              return target;
            }
          }
          return source;
        };
        return visit(obj, 0);
      };
      var isAsyncFn = kindOfTest("AsyncFunction");
      var isThenable = (thing) => thing && (isObject(thing) || isFunction$1(thing)) && isFunction$1(thing.then) && isFunction$1(thing.catch);
      var _setImmediate = ((setImmediateSupported, postMessageSupported) => {
        if (setImmediateSupported) {
          return setImmediate;
        }
        return postMessageSupported ? ((token, callbacks) => {
          _global.addEventListener("message", ({ source, data }) => {
            if (source === _global && data === token) {
              callbacks.length && callbacks.shift()();
            }
          }, false);
          return (cb) => {
            callbacks.push(cb);
            _global.postMessage(token, "*");
          };
        })(`axios@${Math.random()}`, []) : (cb) => setTimeout(cb);
      })(
        typeof setImmediate === "function",
        isFunction$1(_global.postMessage)
      );
      var asap = typeof queueMicrotask !== "undefined" ? queueMicrotask.bind(_global) : typeof process !== "undefined" && process.nextTick || _setImmediate;
      var isIterable = (thing) => thing != null && isFunction$1(thing[iterator]);
      var utils$1 = {
        isArray,
        isArrayBuffer,
        isBuffer,
        isFormData,
        isArrayBufferView,
        isString,
        isNumber,
        isBoolean,
        isObject,
        isPlainObject,
        isEmptyObject,
        isReadableStream,
        isRequest,
        isResponse,
        isHeaders,
        isUndefined,
        isDate,
        isFile,
        isBlob,
        isRegExp,
        isFunction: isFunction$1,
        isStream,
        isURLSearchParams,
        isTypedArray,
        isFileList,
        forEach,
        merge,
        extend,
        trim,
        stripBOM,
        inherits,
        toFlatObject,
        kindOf,
        kindOfTest,
        endsWith,
        toArray,
        forEachEntry,
        matchAll,
        isHTMLForm,
        hasOwnProperty,
        hasOwnProp: hasOwnProperty,
        // an alias to avoid ESLint no-prototype-builtins detection
        reduceDescriptors,
        freezeMethods,
        toObjectSet,
        toCamelCase,
        noop,
        toFiniteNumber,
        findKey,
        global: _global,
        isContextDefined,
        isSpecCompliantForm,
        toJSONObject,
        isAsyncFn,
        isThenable,
        setImmediate: _setImmediate,
        asap,
        isIterable
      };
      function AxiosError(message, code, config, request, response) {
        Error.call(this);
        if (Error.captureStackTrace) {
          Error.captureStackTrace(this, this.constructor);
        } else {
          this.stack = new Error().stack;
        }
        this.message = message;
        this.name = "AxiosError";
        code && (this.code = code);
        config && (this.config = config);
        request && (this.request = request);
        if (response) {
          this.response = response;
          this.status = response.status ? response.status : null;
        }
      }
      utils$1.inherits(AxiosError, Error, {
        toJSON: function toJSON() {
          return {
            // Standard
            message: this.message,
            name: this.name,
            // Microsoft
            description: this.description,
            number: this.number,
            // Mozilla
            fileName: this.fileName,
            lineNumber: this.lineNumber,
            columnNumber: this.columnNumber,
            stack: this.stack,
            // Axios
            config: utils$1.toJSONObject(this.config),
            code: this.code,
            status: this.status
          };
        }
      });
      var prototype$1 = AxiosError.prototype;
      var descriptors = {};
      [
        "ERR_BAD_OPTION_VALUE",
        "ERR_BAD_OPTION",
        "ECONNABORTED",
        "ETIMEDOUT",
        "ERR_NETWORK",
        "ERR_FR_TOO_MANY_REDIRECTS",
        "ERR_DEPRECATED",
        "ERR_BAD_RESPONSE",
        "ERR_BAD_REQUEST",
        "ERR_CANCELED",
        "ERR_NOT_SUPPORT",
        "ERR_INVALID_URL"
        // eslint-disable-next-line func-names
      ].forEach((code) => {
        descriptors[code] = { value: code };
      });
      Object.defineProperties(AxiosError, descriptors);
      Object.defineProperty(prototype$1, "isAxiosError", { value: true });
      AxiosError.from = (error, code, config, request, response, customProps) => {
        const axiosError = Object.create(prototype$1);
        utils$1.toFlatObject(error, axiosError, function filter(obj) {
          return obj !== Error.prototype;
        }, (prop) => {
          return prop !== "isAxiosError";
        });
        const msg = error && error.message ? error.message : "Error";
        const errCode = code == null && error ? error.code : code;
        AxiosError.call(axiosError, msg, errCode, config, request, response);
        if (error && axiosError.cause == null) {
          Object.defineProperty(axiosError, "cause", { value: error, configurable: true });
        }
        axiosError.name = error && error.name || "Error";
        customProps && Object.assign(axiosError, customProps);
        return axiosError;
      };
      var httpAdapter = null;
      function isVisitable(thing) {
        return utils$1.isPlainObject(thing) || utils$1.isArray(thing);
      }
      function removeBrackets(key) {
        return utils$1.endsWith(key, "[]") ? key.slice(0, -2) : key;
      }
      function renderKey(path, key, dots) {
        if (!path) return key;
        return path.concat(key).map(function each(token, i) {
          token = removeBrackets(token);
          return !dots && i ? "[" + token + "]" : token;
        }).join(dots ? "." : "");
      }
      function isFlatArray(arr) {
        return utils$1.isArray(arr) && !arr.some(isVisitable);
      }
      var predicates = utils$1.toFlatObject(utils$1, {}, null, function filter(prop) {
        return /^is[A-Z]/.test(prop);
      });
      function toFormData(obj, formData, options) {
        if (!utils$1.isObject(obj)) {
          throw new TypeError("target must be an object");
        }
        formData = formData || new FormData();
        options = utils$1.toFlatObject(options, {
          metaTokens: true,
          dots: false,
          indexes: false
        }, false, function defined(option, source) {
          return !utils$1.isUndefined(source[option]);
        });
        const metaTokens = options.metaTokens;
        const visitor = options.visitor || defaultVisitor;
        const dots = options.dots;
        const indexes = options.indexes;
        const _Blob = options.Blob || typeof Blob !== "undefined" && Blob;
        const useBlob = _Blob && utils$1.isSpecCompliantForm(formData);
        if (!utils$1.isFunction(visitor)) {
          throw new TypeError("visitor must be a function");
        }
        function convertValue(value) {
          if (value === null) return "";
          if (utils$1.isDate(value)) {
            return value.toISOString();
          }
          if (utils$1.isBoolean(value)) {
            return value.toString();
          }
          if (!useBlob && utils$1.isBlob(value)) {
            throw new AxiosError("Blob is not supported. Use a Buffer instead.");
          }
          if (utils$1.isArrayBuffer(value) || utils$1.isTypedArray(value)) {
            return useBlob && typeof Blob === "function" ? new Blob([value]) : Buffer.from(value);
          }
          return value;
        }
        function defaultVisitor(value, key, path) {
          let arr = value;
          if (value && !path && typeof value === "object") {
            if (utils$1.endsWith(key, "{}")) {
              key = metaTokens ? key : key.slice(0, -2);
              value = JSON.stringify(value);
            } else if (utils$1.isArray(value) && isFlatArray(value) || (utils$1.isFileList(value) || utils$1.endsWith(key, "[]")) && (arr = utils$1.toArray(value))) {
              key = removeBrackets(key);
              arr.forEach(function each(el, index) {
                !(utils$1.isUndefined(el) || el === null) && formData.append(
                  // eslint-disable-next-line no-nested-ternary
                  indexes === true ? renderKey([key], index, dots) : indexes === null ? key : key + "[]",
                  convertValue(el)
                );
              });
              return false;
            }
          }
          if (isVisitable(value)) {
            return true;
          }
          formData.append(renderKey(path, key, dots), convertValue(value));
          return false;
        }
        const stack = [];
        const exposedHelpers = Object.assign(predicates, {
          defaultVisitor,
          convertValue,
          isVisitable
        });
        function build(value, path) {
          if (utils$1.isUndefined(value)) return;
          if (stack.indexOf(value) !== -1) {
            throw Error("Circular reference detected in " + path.join("."));
          }
          stack.push(value);
          utils$1.forEach(value, function each(el, key) {
            const result = !(utils$1.isUndefined(el) || el === null) && visitor.call(
              formData,
              el,
              utils$1.isString(key) ? key.trim() : key,
              path,
              exposedHelpers
            );
            if (result === true) {
              build(el, path ? path.concat(key) : [key]);
            }
          });
          stack.pop();
        }
        if (!utils$1.isObject(obj)) {
          throw new TypeError("data must be an object");
        }
        build(obj);
        return formData;
      }
      function encode$1(str) {
        const charMap = {
          "!": "%21",
          "'": "%27",
          "(": "%28",
          ")": "%29",
          "~": "%7E",
          "%20": "+",
          "%00": "\0"
        };
        return encodeURIComponent(str).replace(/[!'()~]|%20|%00/g, function replacer(match) {
          return charMap[match];
        });
      }
      function AxiosURLSearchParams(params, options) {
        this._pairs = [];
        params && toFormData(params, this, options);
      }
      var prototype = AxiosURLSearchParams.prototype;
      prototype.append = function append(name, value) {
        this._pairs.push([name, value]);
      };
      prototype.toString = function toString2(encoder) {
        const _encode = encoder ? function(value) {
          return encoder.call(this, value, encode$1);
        } : encode$1;
        return this._pairs.map(function each(pair) {
          return _encode(pair[0]) + "=" + _encode(pair[1]);
        }, "").join("&");
      };
      function encode(val) {
        return encodeURIComponent(val).replace(/%3A/gi, ":").replace(/%24/g, "$").replace(/%2C/gi, ",").replace(/%20/g, "+");
      }
      function buildURL(url, params, options) {
        if (!params) {
          return url;
        }
        const _encode = options && options.encode || encode;
        if (utils$1.isFunction(options)) {
          options = {
            serialize: options
          };
        }
        const serializeFn = options && options.serialize;
        let serializedParams;
        if (serializeFn) {
          serializedParams = serializeFn(params, options);
        } else {
          serializedParams = utils$1.isURLSearchParams(params) ? params.toString() : new AxiosURLSearchParams(params, options).toString(_encode);
        }
        if (serializedParams) {
          const hashmarkIndex = url.indexOf("#");
          if (hashmarkIndex !== -1) {
            url = url.slice(0, hashmarkIndex);
          }
          url += (url.indexOf("?") === -1 ? "?" : "&") + serializedParams;
        }
        return url;
      }
      var InterceptorManager = class {
        constructor() {
          this.handlers = [];
        }
        /**
         * Add a new interceptor to the stack
         *
         * @param {Function} fulfilled The function to handle `then` for a `Promise`
         * @param {Function} rejected The function to handle `reject` for a `Promise`
         *
         * @return {Number} An ID used to remove interceptor later
         */
        use(fulfilled, rejected, options) {
          this.handlers.push({
            fulfilled,
            rejected,
            synchronous: options ? options.synchronous : false,
            runWhen: options ? options.runWhen : null
          });
          return this.handlers.length - 1;
        }
        /**
         * Remove an interceptor from the stack
         *
         * @param {Number} id The ID that was returned by `use`
         *
         * @returns {void}
         */
        eject(id) {
          if (this.handlers[id]) {
            this.handlers[id] = null;
          }
        }
        /**
         * Clear all interceptors from the stack
         *
         * @returns {void}
         */
        clear() {
          if (this.handlers) {
            this.handlers = [];
          }
        }
        /**
         * Iterate over all the registered interceptors
         *
         * This method is particularly useful for skipping over any
         * interceptors that may have become `null` calling `eject`.
         *
         * @param {Function} fn The function to call for each interceptor
         *
         * @returns {void}
         */
        forEach(fn) {
          utils$1.forEach(this.handlers, function forEachHandler(h) {
            if (h !== null) {
              fn(h);
            }
          });
        }
      };
      var InterceptorManager$1 = InterceptorManager;
      var transitionalDefaults = {
        silentJSONParsing: true,
        forcedJSONParsing: true,
        clarifyTimeoutError: false
      };
      var URLSearchParams$1 = typeof URLSearchParams !== "undefined" ? URLSearchParams : AxiosURLSearchParams;
      var FormData$1 = typeof FormData !== "undefined" ? FormData : null;
      var Blob$1 = typeof Blob !== "undefined" ? Blob : null;
      var platform$1 = {
        isBrowser: true,
        classes: {
          URLSearchParams: URLSearchParams$1,
          FormData: FormData$1,
          Blob: Blob$1
        },
        protocols: ["http", "https", "file", "blob", "url", "data"]
      };
      var hasBrowserEnv = typeof window !== "undefined" && typeof document !== "undefined";
      var _navigator = typeof navigator === "object" && navigator || void 0;
      var hasStandardBrowserEnv = hasBrowserEnv && (!_navigator || ["ReactNative", "NativeScript", "NS"].indexOf(_navigator.product) < 0);
      var hasStandardBrowserWebWorkerEnv = (() => {
        return typeof WorkerGlobalScope !== "undefined" && // eslint-disable-next-line no-undef
        self instanceof WorkerGlobalScope && typeof self.importScripts === "function";
      })();
      var origin = hasBrowserEnv && window.location.href || "http://localhost";
      var utils = /* @__PURE__ */ Object.freeze({
        __proto__: null,
        hasBrowserEnv,
        hasStandardBrowserWebWorkerEnv,
        hasStandardBrowserEnv,
        navigator: _navigator,
        origin
      });
      var platform = {
        ...utils,
        ...platform$1
      };
      function toURLEncodedForm(data, options) {
        return toFormData(data, new platform.classes.URLSearchParams(), {
          visitor: function(value, key, path, helpers) {
            if (platform.isNode && utils$1.isBuffer(value)) {
              this.append(key, value.toString("base64"));
              return false;
            }
            return helpers.defaultVisitor.apply(this, arguments);
          },
          ...options
        });
      }
      function parsePropPath(name) {
        return utils$1.matchAll(/\w+|\[(\w*)]/g, name).map((match) => {
          return match[0] === "[]" ? "" : match[1] || match[0];
        });
      }
      function arrayToObject(arr) {
        const obj = {};
        const keys = Object.keys(arr);
        let i;
        const len = keys.length;
        let key;
        for (i = 0; i < len; i++) {
          key = keys[i];
          obj[key] = arr[key];
        }
        return obj;
      }
      function formDataToJSON(formData) {
        function buildPath(path, value, target, index) {
          let name = path[index++];
          if (name === "__proto__") return true;
          const isNumericKey = Number.isFinite(+name);
          const isLast = index >= path.length;
          name = !name && utils$1.isArray(target) ? target.length : name;
          if (isLast) {
            if (utils$1.hasOwnProp(target, name)) {
              target[name] = [target[name], value];
            } else {
              target[name] = value;
            }
            return !isNumericKey;
          }
          if (!target[name] || !utils$1.isObject(target[name])) {
            target[name] = [];
          }
          const result = buildPath(path, value, target[name], index);
          if (result && utils$1.isArray(target[name])) {
            target[name] = arrayToObject(target[name]);
          }
          return !isNumericKey;
        }
        if (utils$1.isFormData(formData) && utils$1.isFunction(formData.entries)) {
          const obj = {};
          utils$1.forEachEntry(formData, (name, value) => {
            buildPath(parsePropPath(name), value, obj, 0);
          });
          return obj;
        }
        return null;
      }
      function stringifySafely(rawValue, parser, encoder) {
        if (utils$1.isString(rawValue)) {
          try {
            (parser || JSON.parse)(rawValue);
            return utils$1.trim(rawValue);
          } catch (e) {
            if (e.name !== "SyntaxError") {
              throw e;
            }
          }
        }
        return (encoder || JSON.stringify)(rawValue);
      }
      var defaults = {
        transitional: transitionalDefaults,
        adapter: ["xhr", "http", "fetch"],
        transformRequest: [function transformRequest(data, headers) {
          const contentType = headers.getContentType() || "";
          const hasJSONContentType = contentType.indexOf("application/json") > -1;
          const isObjectPayload = utils$1.isObject(data);
          if (isObjectPayload && utils$1.isHTMLForm(data)) {
            data = new FormData(data);
          }
          const isFormData2 = utils$1.isFormData(data);
          if (isFormData2) {
            return hasJSONContentType ? JSON.stringify(formDataToJSON(data)) : data;
          }
          if (utils$1.isArrayBuffer(data) || utils$1.isBuffer(data) || utils$1.isStream(data) || utils$1.isFile(data) || utils$1.isBlob(data) || utils$1.isReadableStream(data)) {
            return data;
          }
          if (utils$1.isArrayBufferView(data)) {
            return data.buffer;
          }
          if (utils$1.isURLSearchParams(data)) {
            headers.setContentType("application/x-www-form-urlencoded;charset=utf-8", false);
            return data.toString();
          }
          let isFileList2;
          if (isObjectPayload) {
            if (contentType.indexOf("application/x-www-form-urlencoded") > -1) {
              return toURLEncodedForm(data, this.formSerializer).toString();
            }
            if ((isFileList2 = utils$1.isFileList(data)) || contentType.indexOf("multipart/form-data") > -1) {
              const _FormData = this.env && this.env.FormData;
              return toFormData(
                isFileList2 ? { "files[]": data } : data,
                _FormData && new _FormData(),
                this.formSerializer
              );
            }
          }
          if (isObjectPayload || hasJSONContentType) {
            headers.setContentType("application/json", false);
            return stringifySafely(data);
          }
          return data;
        }],
        transformResponse: [function transformResponse(data) {
          const transitional = this.transitional || defaults.transitional;
          const forcedJSONParsing = transitional && transitional.forcedJSONParsing;
          const JSONRequested = this.responseType === "json";
          if (utils$1.isResponse(data) || utils$1.isReadableStream(data)) {
            return data;
          }
          if (data && utils$1.isString(data) && (forcedJSONParsing && !this.responseType || JSONRequested)) {
            const silentJSONParsing = transitional && transitional.silentJSONParsing;
            const strictJSONParsing = !silentJSONParsing && JSONRequested;
            try {
              return JSON.parse(data, this.parseReviver);
            } catch (e) {
              if (strictJSONParsing) {
                if (e.name === "SyntaxError") {
                  throw AxiosError.from(e, AxiosError.ERR_BAD_RESPONSE, this, null, this.response);
                }
                throw e;
              }
            }
          }
          return data;
        }],
        /**
         * A timeout in milliseconds to abort a request. If set to 0 (default) a
         * timeout is not created.
         */
        timeout: 0,
        xsrfCookieName: "XSRF-TOKEN",
        xsrfHeaderName: "X-XSRF-TOKEN",
        maxContentLength: -1,
        maxBodyLength: -1,
        env: {
          FormData: platform.classes.FormData,
          Blob: platform.classes.Blob
        },
        validateStatus: function validateStatus(status) {
          return status >= 200 && status < 300;
        },
        headers: {
          common: {
            "Accept": "application/json, text/plain, */*",
            "Content-Type": void 0
          }
        }
      };
      utils$1.forEach(["delete", "get", "head", "post", "put", "patch"], (method) => {
        defaults.headers[method] = {};
      });
      var defaults$1 = defaults;
      var ignoreDuplicateOf = utils$1.toObjectSet([
        "age",
        "authorization",
        "content-length",
        "content-type",
        "etag",
        "expires",
        "from",
        "host",
        "if-modified-since",
        "if-unmodified-since",
        "last-modified",
        "location",
        "max-forwards",
        "proxy-authorization",
        "referer",
        "retry-after",
        "user-agent"
      ]);
      var parseHeaders = (rawHeaders) => {
        const parsed = {};
        let key;
        let val;
        let i;
        rawHeaders && rawHeaders.split("\n").forEach(function parser(line) {
          i = line.indexOf(":");
          key = line.substring(0, i).trim().toLowerCase();
          val = line.substring(i + 1).trim();
          if (!key || parsed[key] && ignoreDuplicateOf[key]) {
            return;
          }
          if (key === "set-cookie") {
            if (parsed[key]) {
              parsed[key].push(val);
            } else {
              parsed[key] = [val];
            }
          } else {
            parsed[key] = parsed[key] ? parsed[key] + ", " + val : val;
          }
        });
        return parsed;
      };
      var $internals = Symbol("internals");
      function normalizeHeader(header) {
        return header && String(header).trim().toLowerCase();
      }
      function normalizeValue(value) {
        if (value === false || value == null) {
          return value;
        }
        return utils$1.isArray(value) ? value.map(normalizeValue) : String(value);
      }
      function parseTokens(str) {
        const tokens = /* @__PURE__ */ Object.create(null);
        const tokensRE = /([^\s,;=]+)\s*(?:=\s*([^,;]+))?/g;
        let match;
        while (match = tokensRE.exec(str)) {
          tokens[match[1]] = match[2];
        }
        return tokens;
      }
      var isValidHeaderName = (str) => /^[-_a-zA-Z0-9^`|~,!#$%&'*+.]+$/.test(str.trim());
      function matchHeaderValue(context, value, header, filter, isHeaderNameFilter) {
        if (utils$1.isFunction(filter)) {
          return filter.call(this, value, header);
        }
        if (isHeaderNameFilter) {
          value = header;
        }
        if (!utils$1.isString(value)) return;
        if (utils$1.isString(filter)) {
          return value.indexOf(filter) !== -1;
        }
        if (utils$1.isRegExp(filter)) {
          return filter.test(value);
        }
      }
      function formatHeader(header) {
        return header.trim().toLowerCase().replace(/([a-z\d])(\w*)/g, (w, char, str) => {
          return char.toUpperCase() + str;
        });
      }
      function buildAccessors(obj, header) {
        const accessorName = utils$1.toCamelCase(" " + header);
        ["get", "set", "has"].forEach((methodName) => {
          Object.defineProperty(obj, methodName + accessorName, {
            value: function(arg1, arg2, arg3) {
              return this[methodName].call(this, header, arg1, arg2, arg3);
            },
            configurable: true
          });
        });
      }
      var AxiosHeaders = class {
        constructor(headers) {
          headers && this.set(headers);
        }
        set(header, valueOrRewrite, rewrite) {
          const self2 = this;
          function setHeader(_value, _header, _rewrite) {
            const lHeader = normalizeHeader(_header);
            if (!lHeader) {
              throw new Error("header name must be a non-empty string");
            }
            const key = utils$1.findKey(self2, lHeader);
            if (!key || self2[key] === void 0 || _rewrite === true || _rewrite === void 0 && self2[key] !== false) {
              self2[key || _header] = normalizeValue(_value);
            }
          }
          const setHeaders = (headers, _rewrite) => utils$1.forEach(headers, (_value, _header) => setHeader(_value, _header, _rewrite));
          if (utils$1.isPlainObject(header) || header instanceof this.constructor) {
            setHeaders(header, valueOrRewrite);
          } else if (utils$1.isString(header) && (header = header.trim()) && !isValidHeaderName(header)) {
            setHeaders(parseHeaders(header), valueOrRewrite);
          } else if (utils$1.isObject(header) && utils$1.isIterable(header)) {
            let obj = {}, dest, key;
            for (const entry of header) {
              if (!utils$1.isArray(entry)) {
                throw TypeError("Object iterator must return a key-value pair");
              }
              obj[key = entry[0]] = (dest = obj[key]) ? utils$1.isArray(dest) ? [...dest, entry[1]] : [dest, entry[1]] : entry[1];
            }
            setHeaders(obj, valueOrRewrite);
          } else {
            header != null && setHeader(valueOrRewrite, header, rewrite);
          }
          return this;
        }
        get(header, parser) {
          header = normalizeHeader(header);
          if (header) {
            const key = utils$1.findKey(this, header);
            if (key) {
              const value = this[key];
              if (!parser) {
                return value;
              }
              if (parser === true) {
                return parseTokens(value);
              }
              if (utils$1.isFunction(parser)) {
                return parser.call(this, value, key);
              }
              if (utils$1.isRegExp(parser)) {
                return parser.exec(value);
              }
              throw new TypeError("parser must be boolean|regexp|function");
            }
          }
        }
        has(header, matcher) {
          header = normalizeHeader(header);
          if (header) {
            const key = utils$1.findKey(this, header);
            return !!(key && this[key] !== void 0 && (!matcher || matchHeaderValue(this, this[key], key, matcher)));
          }
          return false;
        }
        delete(header, matcher) {
          const self2 = this;
          let deleted = false;
          function deleteHeader(_header) {
            _header = normalizeHeader(_header);
            if (_header) {
              const key = utils$1.findKey(self2, _header);
              if (key && (!matcher || matchHeaderValue(self2, self2[key], key, matcher))) {
                delete self2[key];
                deleted = true;
              }
            }
          }
          if (utils$1.isArray(header)) {
            header.forEach(deleteHeader);
          } else {
            deleteHeader(header);
          }
          return deleted;
        }
        clear(matcher) {
          const keys = Object.keys(this);
          let i = keys.length;
          let deleted = false;
          while (i--) {
            const key = keys[i];
            if (!matcher || matchHeaderValue(this, this[key], key, matcher, true)) {
              delete this[key];
              deleted = true;
            }
          }
          return deleted;
        }
        normalize(format) {
          const self2 = this;
          const headers = {};
          utils$1.forEach(this, (value, header) => {
            const key = utils$1.findKey(headers, header);
            if (key) {
              self2[key] = normalizeValue(value);
              delete self2[header];
              return;
            }
            const normalized = format ? formatHeader(header) : String(header).trim();
            if (normalized !== header) {
              delete self2[header];
            }
            self2[normalized] = normalizeValue(value);
            headers[normalized] = true;
          });
          return this;
        }
        concat(...targets) {
          return this.constructor.concat(this, ...targets);
        }
        toJSON(asStrings) {
          const obj = /* @__PURE__ */ Object.create(null);
          utils$1.forEach(this, (value, header) => {
            value != null && value !== false && (obj[header] = asStrings && utils$1.isArray(value) ? value.join(", ") : value);
          });
          return obj;
        }
        [Symbol.iterator]() {
          return Object.entries(this.toJSON())[Symbol.iterator]();
        }
        toString() {
          return Object.entries(this.toJSON()).map(([header, value]) => header + ": " + value).join("\n");
        }
        getSetCookie() {
          return this.get("set-cookie") || [];
        }
        get [Symbol.toStringTag]() {
          return "AxiosHeaders";
        }
        static from(thing) {
          return thing instanceof this ? thing : new this(thing);
        }
        static concat(first, ...targets) {
          const computed = new this(first);
          targets.forEach((target) => computed.set(target));
          return computed;
        }
        static accessor(header) {
          const internals = this[$internals] = this[$internals] = {
            accessors: {}
          };
          const accessors = internals.accessors;
          const prototype2 = this.prototype;
          function defineAccessor(_header) {
            const lHeader = normalizeHeader(_header);
            if (!accessors[lHeader]) {
              buildAccessors(prototype2, _header);
              accessors[lHeader] = true;
            }
          }
          utils$1.isArray(header) ? header.forEach(defineAccessor) : defineAccessor(header);
          return this;
        }
      };
      AxiosHeaders.accessor(["Content-Type", "Content-Length", "Accept", "Accept-Encoding", "User-Agent", "Authorization"]);
      utils$1.reduceDescriptors(AxiosHeaders.prototype, ({ value }, key) => {
        let mapped = key[0].toUpperCase() + key.slice(1);
        return {
          get: () => value,
          set(headerValue) {
            this[mapped] = headerValue;
          }
        };
      });
      utils$1.freezeMethods(AxiosHeaders);
      var AxiosHeaders$1 = AxiosHeaders;
      function transformData(fns, response) {
        const config = this || defaults$1;
        const context = response || config;
        const headers = AxiosHeaders$1.from(context.headers);
        let data = context.data;
        utils$1.forEach(fns, function transform(fn) {
          data = fn.call(config, data, headers.normalize(), response ? response.status : void 0);
        });
        headers.normalize();
        return data;
      }
      function isCancel(value) {
        return !!(value && value.__CANCEL__);
      }
      function CanceledError(message, config, request) {
        AxiosError.call(this, message == null ? "canceled" : message, AxiosError.ERR_CANCELED, config, request);
        this.name = "CanceledError";
      }
      utils$1.inherits(CanceledError, AxiosError, {
        __CANCEL__: true
      });
      function settle(resolve, reject, response) {
        const validateStatus = response.config.validateStatus;
        if (!response.status || !validateStatus || validateStatus(response.status)) {
          resolve(response);
        } else {
          reject(new AxiosError(
            "Request failed with status code " + response.status,
            [AxiosError.ERR_BAD_REQUEST, AxiosError.ERR_BAD_RESPONSE][Math.floor(response.status / 100) - 4],
            response.config,
            response.request,
            response
          ));
        }
      }
      function parseProtocol(url) {
        const match = /^([-+\w]{1,25})(:?\/\/|:)/.exec(url);
        return match && match[1] || "";
      }
      function speedometer(samplesCount, min) {
        samplesCount = samplesCount || 10;
        const bytes = new Array(samplesCount);
        const timestamps = new Array(samplesCount);
        let head = 0;
        let tail = 0;
        let firstSampleTS;
        min = min !== void 0 ? min : 1e3;
        return function push(chunkLength) {
          const now = Date.now();
          const startedAt = timestamps[tail];
          if (!firstSampleTS) {
            firstSampleTS = now;
          }
          bytes[head] = chunkLength;
          timestamps[head] = now;
          let i = tail;
          let bytesCount = 0;
          while (i !== head) {
            bytesCount += bytes[i++];
            i = i % samplesCount;
          }
          head = (head + 1) % samplesCount;
          if (head === tail) {
            tail = (tail + 1) % samplesCount;
          }
          if (now - firstSampleTS < min) {
            return;
          }
          const passed = startedAt && now - startedAt;
          return passed ? Math.round(bytesCount * 1e3 / passed) : void 0;
        };
      }
      function throttle(fn, freq) {
        let timestamp = 0;
        let threshold = 1e3 / freq;
        let lastArgs;
        let timer;
        const invoke = (args, now = Date.now()) => {
          timestamp = now;
          lastArgs = null;
          if (timer) {
            clearTimeout(timer);
            timer = null;
          }
          fn(...args);
        };
        const throttled = (...args) => {
          const now = Date.now();
          const passed = now - timestamp;
          if (passed >= threshold) {
            invoke(args, now);
          } else {
            lastArgs = args;
            if (!timer) {
              timer = setTimeout(() => {
                timer = null;
                invoke(lastArgs);
              }, threshold - passed);
            }
          }
        };
        const flush = () => lastArgs && invoke(lastArgs);
        return [throttled, flush];
      }
      var progressEventReducer = (listener, isDownloadStream, freq = 3) => {
        let bytesNotified = 0;
        const _speedometer = speedometer(50, 250);
        return throttle((e) => {
          const loaded = e.loaded;
          const total = e.lengthComputable ? e.total : void 0;
          const progressBytes = loaded - bytesNotified;
          const rate = _speedometer(progressBytes);
          const inRange = loaded <= total;
          bytesNotified = loaded;
          const data = {
            loaded,
            total,
            progress: total ? loaded / total : void 0,
            bytes: progressBytes,
            rate: rate ? rate : void 0,
            estimated: rate && total && inRange ? (total - loaded) / rate : void 0,
            event: e,
            lengthComputable: total != null,
            [isDownloadStream ? "download" : "upload"]: true
          };
          listener(data);
        }, freq);
      };
      var progressEventDecorator = (total, throttled) => {
        const lengthComputable = total != null;
        return [(loaded) => throttled[0]({
          lengthComputable,
          total,
          loaded
        }), throttled[1]];
      };
      var asyncDecorator = (fn) => (...args) => utils$1.asap(() => fn(...args));
      var isURLSameOrigin = platform.hasStandardBrowserEnv ? /* @__PURE__ */ ((origin2, isMSIE) => (url) => {
        url = new URL(url, platform.origin);
        return origin2.protocol === url.protocol && origin2.host === url.host && (isMSIE || origin2.port === url.port);
      })(
        new URL(platform.origin),
        platform.navigator && /(msie|trident)/i.test(platform.navigator.userAgent)
      ) : () => true;
      var cookies = platform.hasStandardBrowserEnv ? (
        // Standard browser envs support document.cookie
        {
          write(name, value, expires, path, domain, secure, sameSite) {
            if (typeof document === "undefined") return;
            const cookie = [`${name}=${encodeURIComponent(value)}`];
            if (utils$1.isNumber(expires)) {
              cookie.push(`expires=${new Date(expires).toUTCString()}`);
            }
            if (utils$1.isString(path)) {
              cookie.push(`path=${path}`);
            }
            if (utils$1.isString(domain)) {
              cookie.push(`domain=${domain}`);
            }
            if (secure === true) {
              cookie.push("secure");
            }
            if (utils$1.isString(sameSite)) {
              cookie.push(`SameSite=${sameSite}`);
            }
            document.cookie = cookie.join("; ");
          },
          read(name) {
            if (typeof document === "undefined") return null;
            const match = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
            return match ? decodeURIComponent(match[1]) : null;
          },
          remove(name) {
            this.write(name, "", Date.now() - 864e5, "/");
          }
        }
      ) : (
        // Non-standard browser env (web workers, react-native) lack needed support.
        {
          write() {
          },
          read() {
            return null;
          },
          remove() {
          }
        }
      );
      function isAbsoluteURL(url) {
        return /^([a-z][a-z\d+\-.]*:)?\/\//i.test(url);
      }
      function combineURLs(baseURL, relativeURL) {
        return relativeURL ? baseURL.replace(/\/?\/$/, "") + "/" + relativeURL.replace(/^\/+/, "") : baseURL;
      }
      function buildFullPath(baseURL, requestedURL, allowAbsoluteUrls) {
        let isRelativeUrl = !isAbsoluteURL(requestedURL);
        if (baseURL && (isRelativeUrl || allowAbsoluteUrls == false)) {
          return combineURLs(baseURL, requestedURL);
        }
        return requestedURL;
      }
      var headersToObject = (thing) => thing instanceof AxiosHeaders$1 ? { ...thing } : thing;
      function mergeConfig(config1, config2) {
        config2 = config2 || {};
        const config = {};
        function getMergedValue(target, source, prop, caseless) {
          if (utils$1.isPlainObject(target) && utils$1.isPlainObject(source)) {
            return utils$1.merge.call({ caseless }, target, source);
          } else if (utils$1.isPlainObject(source)) {
            return utils$1.merge({}, source);
          } else if (utils$1.isArray(source)) {
            return source.slice();
          }
          return source;
        }
        function mergeDeepProperties(a, b, prop, caseless) {
          if (!utils$1.isUndefined(b)) {
            return getMergedValue(a, b, prop, caseless);
          } else if (!utils$1.isUndefined(a)) {
            return getMergedValue(void 0, a, prop, caseless);
          }
        }
        function valueFromConfig2(a, b) {
          if (!utils$1.isUndefined(b)) {
            return getMergedValue(void 0, b);
          }
        }
        function defaultToConfig2(a, b) {
          if (!utils$1.isUndefined(b)) {
            return getMergedValue(void 0, b);
          } else if (!utils$1.isUndefined(a)) {
            return getMergedValue(void 0, a);
          }
        }
        function mergeDirectKeys(a, b, prop) {
          if (prop in config2) {
            return getMergedValue(a, b);
          } else if (prop in config1) {
            return getMergedValue(void 0, a);
          }
        }
        const mergeMap = {
          url: valueFromConfig2,
          method: valueFromConfig2,
          data: valueFromConfig2,
          baseURL: defaultToConfig2,
          transformRequest: defaultToConfig2,
          transformResponse: defaultToConfig2,
          paramsSerializer: defaultToConfig2,
          timeout: defaultToConfig2,
          timeoutMessage: defaultToConfig2,
          withCredentials: defaultToConfig2,
          withXSRFToken: defaultToConfig2,
          adapter: defaultToConfig2,
          responseType: defaultToConfig2,
          xsrfCookieName: defaultToConfig2,
          xsrfHeaderName: defaultToConfig2,
          onUploadProgress: defaultToConfig2,
          onDownloadProgress: defaultToConfig2,
          decompress: defaultToConfig2,
          maxContentLength: defaultToConfig2,
          maxBodyLength: defaultToConfig2,
          beforeRedirect: defaultToConfig2,
          transport: defaultToConfig2,
          httpAgent: defaultToConfig2,
          httpsAgent: defaultToConfig2,
          cancelToken: defaultToConfig2,
          socketPath: defaultToConfig2,
          responseEncoding: defaultToConfig2,
          validateStatus: mergeDirectKeys,
          headers: (a, b, prop) => mergeDeepProperties(headersToObject(a), headersToObject(b), prop, true)
        };
        utils$1.forEach(Object.keys({ ...config1, ...config2 }), function computeConfigValue(prop) {
          const merge2 = mergeMap[prop] || mergeDeepProperties;
          const configValue = merge2(config1[prop], config2[prop], prop);
          utils$1.isUndefined(configValue) && merge2 !== mergeDirectKeys || (config[prop] = configValue);
        });
        return config;
      }
      var resolveConfig = (config) => {
        const newConfig = mergeConfig({}, config);
        let { data, withXSRFToken, xsrfHeaderName, xsrfCookieName, headers, auth } = newConfig;
        newConfig.headers = headers = AxiosHeaders$1.from(headers);
        newConfig.url = buildURL(buildFullPath(newConfig.baseURL, newConfig.url, newConfig.allowAbsoluteUrls), config.params, config.paramsSerializer);
        if (auth) {
          headers.set(
            "Authorization",
            "Basic " + btoa((auth.username || "") + ":" + (auth.password ? unescape(encodeURIComponent(auth.password)) : ""))
          );
        }
        if (utils$1.isFormData(data)) {
          if (platform.hasStandardBrowserEnv || platform.hasStandardBrowserWebWorkerEnv) {
            headers.setContentType(void 0);
          } else if (utils$1.isFunction(data.getHeaders)) {
            const formHeaders = data.getHeaders();
            const allowedHeaders = ["content-type", "content-length"];
            Object.entries(formHeaders).forEach(([key, val]) => {
              if (allowedHeaders.includes(key.toLowerCase())) {
                headers.set(key, val);
              }
            });
          }
        }
        if (platform.hasStandardBrowserEnv) {
          withXSRFToken && utils$1.isFunction(withXSRFToken) && (withXSRFToken = withXSRFToken(newConfig));
          if (withXSRFToken || withXSRFToken !== false && isURLSameOrigin(newConfig.url)) {
            const xsrfValue = xsrfHeaderName && xsrfCookieName && cookies.read(xsrfCookieName);
            if (xsrfValue) {
              headers.set(xsrfHeaderName, xsrfValue);
            }
          }
        }
        return newConfig;
      };
      var isXHRAdapterSupported = typeof XMLHttpRequest !== "undefined";
      var xhrAdapter = isXHRAdapterSupported && function(config) {
        return new Promise(function dispatchXhrRequest(resolve, reject) {
          const _config = resolveConfig(config);
          let requestData = _config.data;
          const requestHeaders = AxiosHeaders$1.from(_config.headers).normalize();
          let { responseType, onUploadProgress, onDownloadProgress } = _config;
          let onCanceled;
          let uploadThrottled, downloadThrottled;
          let flushUpload, flushDownload;
          function done() {
            flushUpload && flushUpload();
            flushDownload && flushDownload();
            _config.cancelToken && _config.cancelToken.unsubscribe(onCanceled);
            _config.signal && _config.signal.removeEventListener("abort", onCanceled);
          }
          let request = new XMLHttpRequest();
          request.open(_config.method.toUpperCase(), _config.url, true);
          request.timeout = _config.timeout;
          function onloadend() {
            if (!request) {
              return;
            }
            const responseHeaders = AxiosHeaders$1.from(
              "getAllResponseHeaders" in request && request.getAllResponseHeaders()
            );
            const responseData = !responseType || responseType === "text" || responseType === "json" ? request.responseText : request.response;
            const response = {
              data: responseData,
              status: request.status,
              statusText: request.statusText,
              headers: responseHeaders,
              config,
              request
            };
            settle(function _resolve(value) {
              resolve(value);
              done();
            }, function _reject(err) {
              reject(err);
              done();
            }, response);
            request = null;
          }
          if ("onloadend" in request) {
            request.onloadend = onloadend;
          } else {
            request.onreadystatechange = function handleLoad() {
              if (!request || request.readyState !== 4) {
                return;
              }
              if (request.status === 0 && !(request.responseURL && request.responseURL.indexOf("file:") === 0)) {
                return;
              }
              setTimeout(onloadend);
            };
          }
          request.onabort = function handleAbort() {
            if (!request) {
              return;
            }
            reject(new AxiosError("Request aborted", AxiosError.ECONNABORTED, config, request));
            request = null;
          };
          request.onerror = function handleError(event) {
            const msg = event && event.message ? event.message : "Network Error";
            const err = new AxiosError(msg, AxiosError.ERR_NETWORK, config, request);
            err.event = event || null;
            reject(err);
            request = null;
          };
          request.ontimeout = function handleTimeout() {
            let timeoutErrorMessage = _config.timeout ? "timeout of " + _config.timeout + "ms exceeded" : "timeout exceeded";
            const transitional = _config.transitional || transitionalDefaults;
            if (_config.timeoutErrorMessage) {
              timeoutErrorMessage = _config.timeoutErrorMessage;
            }
            reject(new AxiosError(
              timeoutErrorMessage,
              transitional.clarifyTimeoutError ? AxiosError.ETIMEDOUT : AxiosError.ECONNABORTED,
              config,
              request
            ));
            request = null;
          };
          requestData === void 0 && requestHeaders.setContentType(null);
          if ("setRequestHeader" in request) {
            utils$1.forEach(requestHeaders.toJSON(), function setRequestHeader(val, key) {
              request.setRequestHeader(key, val);
            });
          }
          if (!utils$1.isUndefined(_config.withCredentials)) {
            request.withCredentials = !!_config.withCredentials;
          }
          if (responseType && responseType !== "json") {
            request.responseType = _config.responseType;
          }
          if (onDownloadProgress) {
            [downloadThrottled, flushDownload] = progressEventReducer(onDownloadProgress, true);
            request.addEventListener("progress", downloadThrottled);
          }
          if (onUploadProgress && request.upload) {
            [uploadThrottled, flushUpload] = progressEventReducer(onUploadProgress);
            request.upload.addEventListener("progress", uploadThrottled);
            request.upload.addEventListener("loadend", flushUpload);
          }
          if (_config.cancelToken || _config.signal) {
            onCanceled = (cancel) => {
              if (!request) {
                return;
              }
              reject(!cancel || cancel.type ? new CanceledError(null, config, request) : cancel);
              request.abort();
              request = null;
            };
            _config.cancelToken && _config.cancelToken.subscribe(onCanceled);
            if (_config.signal) {
              _config.signal.aborted ? onCanceled() : _config.signal.addEventListener("abort", onCanceled);
            }
          }
          const protocol = parseProtocol(_config.url);
          if (protocol && platform.protocols.indexOf(protocol) === -1) {
            reject(new AxiosError("Unsupported protocol " + protocol + ":", AxiosError.ERR_BAD_REQUEST, config));
            return;
          }
          request.send(requestData || null);
        });
      };
      var composeSignals = (signals, timeout) => {
        const { length } = signals = signals ? signals.filter(Boolean) : [];
        if (timeout || length) {
          let controller = new AbortController();
          let aborted;
          const onabort = function(reason) {
            if (!aborted) {
              aborted = true;
              unsubscribe();
              const err = reason instanceof Error ? reason : this.reason;
              controller.abort(err instanceof AxiosError ? err : new CanceledError(err instanceof Error ? err.message : err));
            }
          };
          let timer = timeout && setTimeout(() => {
            timer = null;
            onabort(new AxiosError(`timeout ${timeout} of ms exceeded`, AxiosError.ETIMEDOUT));
          }, timeout);
          const unsubscribe = () => {
            if (signals) {
              timer && clearTimeout(timer);
              timer = null;
              signals.forEach((signal2) => {
                signal2.unsubscribe ? signal2.unsubscribe(onabort) : signal2.removeEventListener("abort", onabort);
              });
              signals = null;
            }
          };
          signals.forEach((signal2) => signal2.addEventListener("abort", onabort));
          const { signal } = controller;
          signal.unsubscribe = () => utils$1.asap(unsubscribe);
          return signal;
        }
      };
      var composeSignals$1 = composeSignals;
      var streamChunk = function* (chunk, chunkSize) {
        let len = chunk.byteLength;
        if (!chunkSize || len < chunkSize) {
          yield chunk;
          return;
        }
        let pos = 0;
        let end;
        while (pos < len) {
          end = pos + chunkSize;
          yield chunk.slice(pos, end);
          pos = end;
        }
      };
      var readBytes = async function* (iterable, chunkSize) {
        for await (const chunk of readStream(iterable)) {
          yield* streamChunk(chunk, chunkSize);
        }
      };
      var readStream = async function* (stream) {
        if (stream[Symbol.asyncIterator]) {
          yield* stream;
          return;
        }
        const reader = stream.getReader();
        try {
          for (; ; ) {
            const { done, value } = await reader.read();
            if (done) {
              break;
            }
            yield value;
          }
        } finally {
          await reader.cancel();
        }
      };
      var trackStream = (stream, chunkSize, onProgress, onFinish) => {
        const iterator2 = readBytes(stream, chunkSize);
        let bytes = 0;
        let done;
        let _onFinish = (e) => {
          if (!done) {
            done = true;
            onFinish && onFinish(e);
          }
        };
        return new ReadableStream({
          async pull(controller) {
            try {
              const { done: done2, value } = await iterator2.next();
              if (done2) {
                _onFinish();
                controller.close();
                return;
              }
              let len = value.byteLength;
              if (onProgress) {
                let loadedBytes = bytes += len;
                onProgress(loadedBytes);
              }
              controller.enqueue(new Uint8Array(value));
            } catch (err) {
              _onFinish(err);
              throw err;
            }
          },
          cancel(reason) {
            _onFinish(reason);
            return iterator2.return();
          }
        }, {
          highWaterMark: 2
        });
      };
      var DEFAULT_CHUNK_SIZE = 64 * 1024;
      var { isFunction } = utils$1;
      var globalFetchAPI = (({ Request, Response }) => ({
        Request,
        Response
      }))(utils$1.global);
      var {
        ReadableStream: ReadableStream$1,
        TextEncoder
      } = utils$1.global;
      var test = (fn, ...args) => {
        try {
          return !!fn(...args);
        } catch (e) {
          return false;
        }
      };
      var factory = (env) => {
        env = utils$1.merge.call({
          skipUndefined: true
        }, globalFetchAPI, env);
        const { fetch: envFetch, Request, Response } = env;
        const isFetchSupported = envFetch ? isFunction(envFetch) : typeof fetch === "function";
        const isRequestSupported = isFunction(Request);
        const isResponseSupported = isFunction(Response);
        if (!isFetchSupported) {
          return false;
        }
        const isReadableStreamSupported = isFetchSupported && isFunction(ReadableStream$1);
        const encodeText = isFetchSupported && (typeof TextEncoder === "function" ? /* @__PURE__ */ ((encoder) => (str) => encoder.encode(str))(new TextEncoder()) : async (str) => new Uint8Array(await new Request(str).arrayBuffer()));
        const supportsRequestStream = isRequestSupported && isReadableStreamSupported && test(() => {
          let duplexAccessed = false;
          const hasContentType = new Request(platform.origin, {
            body: new ReadableStream$1(),
            method: "POST",
            get duplex() {
              duplexAccessed = true;
              return "half";
            }
          }).headers.has("Content-Type");
          return duplexAccessed && !hasContentType;
        });
        const supportsResponseStream = isResponseSupported && isReadableStreamSupported && test(() => utils$1.isReadableStream(new Response("").body));
        const resolvers = {
          stream: supportsResponseStream && ((res) => res.body)
        };
        isFetchSupported && (() => {
          ["text", "arrayBuffer", "blob", "formData", "stream"].forEach((type) => {
            !resolvers[type] && (resolvers[type] = (res, config) => {
              let method = res && res[type];
              if (method) {
                return method.call(res);
              }
              throw new AxiosError(`Response type '${type}' is not supported`, AxiosError.ERR_NOT_SUPPORT, config);
            });
          });
        })();
        const getBodyLength = async (body) => {
          if (body == null) {
            return 0;
          }
          if (utils$1.isBlob(body)) {
            return body.size;
          }
          if (utils$1.isSpecCompliantForm(body)) {
            const _request = new Request(platform.origin, {
              method: "POST",
              body
            });
            return (await _request.arrayBuffer()).byteLength;
          }
          if (utils$1.isArrayBufferView(body) || utils$1.isArrayBuffer(body)) {
            return body.byteLength;
          }
          if (utils$1.isURLSearchParams(body)) {
            body = body + "";
          }
          if (utils$1.isString(body)) {
            return (await encodeText(body)).byteLength;
          }
        };
        const resolveBodyLength = async (headers, body) => {
          const length = utils$1.toFiniteNumber(headers.getContentLength());
          return length == null ? getBodyLength(body) : length;
        };
        return async (config) => {
          let {
            url,
            method,
            data,
            signal,
            cancelToken,
            timeout,
            onDownloadProgress,
            onUploadProgress,
            responseType,
            headers,
            withCredentials = "same-origin",
            fetchOptions
          } = resolveConfig(config);
          let _fetch = envFetch || fetch;
          responseType = responseType ? (responseType + "").toLowerCase() : "text";
          let composedSignal = composeSignals$1([signal, cancelToken && cancelToken.toAbortSignal()], timeout);
          let request = null;
          const unsubscribe = composedSignal && composedSignal.unsubscribe && (() => {
            composedSignal.unsubscribe();
          });
          let requestContentLength;
          try {
            if (onUploadProgress && supportsRequestStream && method !== "get" && method !== "head" && (requestContentLength = await resolveBodyLength(headers, data)) !== 0) {
              let _request = new Request(url, {
                method: "POST",
                body: data,
                duplex: "half"
              });
              let contentTypeHeader;
              if (utils$1.isFormData(data) && (contentTypeHeader = _request.headers.get("content-type"))) {
                headers.setContentType(contentTypeHeader);
              }
              if (_request.body) {
                const [onProgress, flush] = progressEventDecorator(
                  requestContentLength,
                  progressEventReducer(asyncDecorator(onUploadProgress))
                );
                data = trackStream(_request.body, DEFAULT_CHUNK_SIZE, onProgress, flush);
              }
            }
            if (!utils$1.isString(withCredentials)) {
              withCredentials = withCredentials ? "include" : "omit";
            }
            const isCredentialsSupported = isRequestSupported && "credentials" in Request.prototype;
            const resolvedOptions = {
              ...fetchOptions,
              signal: composedSignal,
              method: method.toUpperCase(),
              headers: headers.normalize().toJSON(),
              body: data,
              duplex: "half",
              credentials: isCredentialsSupported ? withCredentials : void 0
            };
            request = isRequestSupported && new Request(url, resolvedOptions);
            let response = await (isRequestSupported ? _fetch(request, fetchOptions) : _fetch(url, resolvedOptions));
            const isStreamResponse = supportsResponseStream && (responseType === "stream" || responseType === "response");
            if (supportsResponseStream && (onDownloadProgress || isStreamResponse && unsubscribe)) {
              const options = {};
              ["status", "statusText", "headers"].forEach((prop) => {
                options[prop] = response[prop];
              });
              const responseContentLength = utils$1.toFiniteNumber(response.headers.get("content-length"));
              const [onProgress, flush] = onDownloadProgress && progressEventDecorator(
                responseContentLength,
                progressEventReducer(asyncDecorator(onDownloadProgress), true)
              ) || [];
              response = new Response(
                trackStream(response.body, DEFAULT_CHUNK_SIZE, onProgress, () => {
                  flush && flush();
                  unsubscribe && unsubscribe();
                }),
                options
              );
            }
            responseType = responseType || "text";
            let responseData = await resolvers[utils$1.findKey(resolvers, responseType) || "text"](response, config);
            !isStreamResponse && unsubscribe && unsubscribe();
            return await new Promise((resolve, reject) => {
              settle(resolve, reject, {
                data: responseData,
                headers: AxiosHeaders$1.from(response.headers),
                status: response.status,
                statusText: response.statusText,
                config,
                request
              });
            });
          } catch (err) {
            unsubscribe && unsubscribe();
            if (err && err.name === "TypeError" && /Load failed|fetch/i.test(err.message)) {
              throw Object.assign(
                new AxiosError("Network Error", AxiosError.ERR_NETWORK, config, request),
                {
                  cause: err.cause || err
                }
              );
            }
            throw AxiosError.from(err, err && err.code, config, request);
          }
        };
      };
      var seedCache = /* @__PURE__ */ new Map();
      var getFetch = (config) => {
        let env = config && config.env || {};
        const { fetch: fetch2, Request, Response } = env;
        const seeds = [
          Request,
          Response,
          fetch2
        ];
        let len = seeds.length, i = len, seed, target, map = seedCache;
        while (i--) {
          seed = seeds[i];
          target = map.get(seed);
          target === void 0 && map.set(seed, target = i ? /* @__PURE__ */ new Map() : factory(env));
          map = target;
        }
        return target;
      };
      getFetch();
      var knownAdapters = {
        http: httpAdapter,
        xhr: xhrAdapter,
        fetch: {
          get: getFetch
        }
      };
      utils$1.forEach(knownAdapters, (fn, value) => {
        if (fn) {
          try {
            Object.defineProperty(fn, "name", { value });
          } catch (e) {
          }
          Object.defineProperty(fn, "adapterName", { value });
        }
      });
      var renderReason = (reason) => `- ${reason}`;
      var isResolvedHandle = (adapter) => utils$1.isFunction(adapter) || adapter === null || adapter === false;
      function getAdapter(adapters2, config) {
        adapters2 = utils$1.isArray(adapters2) ? adapters2 : [adapters2];
        const { length } = adapters2;
        let nameOrAdapter;
        let adapter;
        const rejectedReasons = {};
        for (let i = 0; i < length; i++) {
          nameOrAdapter = adapters2[i];
          let id;
          adapter = nameOrAdapter;
          if (!isResolvedHandle(nameOrAdapter)) {
            adapter = knownAdapters[(id = String(nameOrAdapter)).toLowerCase()];
            if (adapter === void 0) {
              throw new AxiosError(`Unknown adapter '${id}'`);
            }
          }
          if (adapter && (utils$1.isFunction(adapter) || (adapter = adapter.get(config)))) {
            break;
          }
          rejectedReasons[id || "#" + i] = adapter;
        }
        if (!adapter) {
          const reasons = Object.entries(rejectedReasons).map(
            ([id, state]) => `adapter ${id} ` + (state === false ? "is not supported by the environment" : "is not available in the build")
          );
          let s = length ? reasons.length > 1 ? "since :\n" + reasons.map(renderReason).join("\n") : " " + renderReason(reasons[0]) : "as no adapter specified";
          throw new AxiosError(
            `There is no suitable adapter to dispatch the request ` + s,
            "ERR_NOT_SUPPORT"
          );
        }
        return adapter;
      }
      var adapters = {
        /**
         * Resolve an adapter from a list of adapter names or functions.
         * @type {Function}
         */
        getAdapter,
        /**
         * Exposes all known adapters
         * @type {Object<string, Function|Object>}
         */
        adapters: knownAdapters
      };
      function throwIfCancellationRequested(config) {
        if (config.cancelToken) {
          config.cancelToken.throwIfRequested();
        }
        if (config.signal && config.signal.aborted) {
          throw new CanceledError(null, config);
        }
      }
      function dispatchRequest(config) {
        throwIfCancellationRequested(config);
        config.headers = AxiosHeaders$1.from(config.headers);
        config.data = transformData.call(
          config,
          config.transformRequest
        );
        if (["post", "put", "patch"].indexOf(config.method) !== -1) {
          config.headers.setContentType("application/x-www-form-urlencoded", false);
        }
        const adapter = adapters.getAdapter(config.adapter || defaults$1.adapter, config);
        return adapter(config).then(function onAdapterResolution(response) {
          throwIfCancellationRequested(config);
          response.data = transformData.call(
            config,
            config.transformResponse,
            response
          );
          response.headers = AxiosHeaders$1.from(response.headers);
          return response;
        }, function onAdapterRejection(reason) {
          if (!isCancel(reason)) {
            throwIfCancellationRequested(config);
            if (reason && reason.response) {
              reason.response.data = transformData.call(
                config,
                config.transformResponse,
                reason.response
              );
              reason.response.headers = AxiosHeaders$1.from(reason.response.headers);
            }
          }
          return Promise.reject(reason);
        });
      }
      var VERSION = "1.13.2";
      var validators$1 = {};
      ["object", "boolean", "number", "function", "string", "symbol"].forEach((type, i) => {
        validators$1[type] = function validator2(thing) {
          return typeof thing === type || "a" + (i < 1 ? "n " : " ") + type;
        };
      });
      var deprecatedWarnings = {};
      validators$1.transitional = function transitional(validator2, version, message) {
        function formatMessage(opt, desc) {
          return "[Axios v" + VERSION + "] Transitional option '" + opt + "'" + desc + (message ? ". " + message : "");
        }
        return (value, opt, opts) => {
          if (validator2 === false) {
            throw new AxiosError(
              formatMessage(opt, " has been removed" + (version ? " in " + version : "")),
              AxiosError.ERR_DEPRECATED
            );
          }
          if (version && !deprecatedWarnings[opt]) {
            deprecatedWarnings[opt] = true;
            console.warn(
              formatMessage(
                opt,
                " has been deprecated since v" + version + " and will be removed in the near future"
              )
            );
          }
          return validator2 ? validator2(value, opt, opts) : true;
        };
      };
      validators$1.spelling = function spelling(correctSpelling) {
        return (value, opt) => {
          console.warn(`${opt} is likely a misspelling of ${correctSpelling}`);
          return true;
        };
      };
      function assertOptions(options, schema, allowUnknown) {
        if (typeof options !== "object") {
          throw new AxiosError("options must be an object", AxiosError.ERR_BAD_OPTION_VALUE);
        }
        const keys = Object.keys(options);
        let i = keys.length;
        while (i-- > 0) {
          const opt = keys[i];
          const validator2 = schema[opt];
          if (validator2) {
            const value = options[opt];
            const result = value === void 0 || validator2(value, opt, options);
            if (result !== true) {
              throw new AxiosError("option " + opt + " must be " + result, AxiosError.ERR_BAD_OPTION_VALUE);
            }
            continue;
          }
          if (allowUnknown !== true) {
            throw new AxiosError("Unknown option " + opt, AxiosError.ERR_BAD_OPTION);
          }
        }
      }
      var validator = {
        assertOptions,
        validators: validators$1
      };
      var validators = validator.validators;
      var Axios = class {
        constructor(instanceConfig) {
          this.defaults = instanceConfig || {};
          this.interceptors = {
            request: new InterceptorManager$1(),
            response: new InterceptorManager$1()
          };
        }
        /**
         * Dispatch a request
         *
         * @param {String|Object} configOrUrl The config specific for this request (merged with this.defaults)
         * @param {?Object} config
         *
         * @returns {Promise} The Promise to be fulfilled
         */
        async request(configOrUrl, config) {
          try {
            return await this._request(configOrUrl, config);
          } catch (err) {
            if (err instanceof Error) {
              let dummy = {};
              Error.captureStackTrace ? Error.captureStackTrace(dummy) : dummy = new Error();
              const stack = dummy.stack ? dummy.stack.replace(/^.+\n/, "") : "";
              try {
                if (!err.stack) {
                  err.stack = stack;
                } else if (stack && !String(err.stack).endsWith(stack.replace(/^.+\n.+\n/, ""))) {
                  err.stack += "\n" + stack;
                }
              } catch (e) {
              }
            }
            throw err;
          }
        }
        _request(configOrUrl, config) {
          if (typeof configOrUrl === "string") {
            config = config || {};
            config.url = configOrUrl;
          } else {
            config = configOrUrl || {};
          }
          config = mergeConfig(this.defaults, config);
          const { transitional, paramsSerializer, headers } = config;
          if (transitional !== void 0) {
            validator.assertOptions(transitional, {
              silentJSONParsing: validators.transitional(validators.boolean),
              forcedJSONParsing: validators.transitional(validators.boolean),
              clarifyTimeoutError: validators.transitional(validators.boolean)
            }, false);
          }
          if (paramsSerializer != null) {
            if (utils$1.isFunction(paramsSerializer)) {
              config.paramsSerializer = {
                serialize: paramsSerializer
              };
            } else {
              validator.assertOptions(paramsSerializer, {
                encode: validators.function,
                serialize: validators.function
              }, true);
            }
          }
          if (config.allowAbsoluteUrls !== void 0) ;
          else if (this.defaults.allowAbsoluteUrls !== void 0) {
            config.allowAbsoluteUrls = this.defaults.allowAbsoluteUrls;
          } else {
            config.allowAbsoluteUrls = true;
          }
          validator.assertOptions(config, {
            baseUrl: validators.spelling("baseURL"),
            withXsrfToken: validators.spelling("withXSRFToken")
          }, true);
          config.method = (config.method || this.defaults.method || "get").toLowerCase();
          let contextHeaders = headers && utils$1.merge(
            headers.common,
            headers[config.method]
          );
          headers && utils$1.forEach(
            ["delete", "get", "head", "post", "put", "patch", "common"],
            (method) => {
              delete headers[method];
            }
          );
          config.headers = AxiosHeaders$1.concat(contextHeaders, headers);
          const requestInterceptorChain = [];
          let synchronousRequestInterceptors = true;
          this.interceptors.request.forEach(function unshiftRequestInterceptors(interceptor) {
            if (typeof interceptor.runWhen === "function" && interceptor.runWhen(config) === false) {
              return;
            }
            synchronousRequestInterceptors = synchronousRequestInterceptors && interceptor.synchronous;
            requestInterceptorChain.unshift(interceptor.fulfilled, interceptor.rejected);
          });
          const responseInterceptorChain = [];
          this.interceptors.response.forEach(function pushResponseInterceptors(interceptor) {
            responseInterceptorChain.push(interceptor.fulfilled, interceptor.rejected);
          });
          let promise;
          let i = 0;
          let len;
          if (!synchronousRequestInterceptors) {
            const chain = [dispatchRequest.bind(this), void 0];
            chain.unshift(...requestInterceptorChain);
            chain.push(...responseInterceptorChain);
            len = chain.length;
            promise = Promise.resolve(config);
            while (i < len) {
              promise = promise.then(chain[i++], chain[i++]);
            }
            return promise;
          }
          len = requestInterceptorChain.length;
          let newConfig = config;
          while (i < len) {
            const onFulfilled = requestInterceptorChain[i++];
            const onRejected = requestInterceptorChain[i++];
            try {
              newConfig = onFulfilled(newConfig);
            } catch (error) {
              onRejected.call(this, error);
              break;
            }
          }
          try {
            promise = dispatchRequest.call(this, newConfig);
          } catch (error) {
            return Promise.reject(error);
          }
          i = 0;
          len = responseInterceptorChain.length;
          while (i < len) {
            promise = promise.then(responseInterceptorChain[i++], responseInterceptorChain[i++]);
          }
          return promise;
        }
        getUri(config) {
          config = mergeConfig(this.defaults, config);
          const fullPath = buildFullPath(config.baseURL, config.url, config.allowAbsoluteUrls);
          return buildURL(fullPath, config.params, config.paramsSerializer);
        }
      };
      utils$1.forEach(["delete", "get", "head", "options"], function forEachMethodNoData(method) {
        Axios.prototype[method] = function(url, config) {
          return this.request(mergeConfig(config || {}, {
            method,
            url,
            data: (config || {}).data
          }));
        };
      });
      utils$1.forEach(["post", "put", "patch"], function forEachMethodWithData(method) {
        function generateHTTPMethod(isForm) {
          return function httpMethod(url, data, config) {
            return this.request(mergeConfig(config || {}, {
              method,
              headers: isForm ? {
                "Content-Type": "multipart/form-data"
              } : {},
              url,
              data
            }));
          };
        }
        Axios.prototype[method] = generateHTTPMethod();
        Axios.prototype[method + "Form"] = generateHTTPMethod(true);
      });
      var Axios$1 = Axios;
      var CancelToken = class _CancelToken {
        constructor(executor) {
          if (typeof executor !== "function") {
            throw new TypeError("executor must be a function.");
          }
          let resolvePromise;
          this.promise = new Promise(function promiseExecutor(resolve) {
            resolvePromise = resolve;
          });
          const token = this;
          this.promise.then((cancel) => {
            if (!token._listeners) return;
            let i = token._listeners.length;
            while (i-- > 0) {
              token._listeners[i](cancel);
            }
            token._listeners = null;
          });
          this.promise.then = (onfulfilled) => {
            let _resolve;
            const promise = new Promise((resolve) => {
              token.subscribe(resolve);
              _resolve = resolve;
            }).then(onfulfilled);
            promise.cancel = function reject() {
              token.unsubscribe(_resolve);
            };
            return promise;
          };
          executor(function cancel(message, config, request) {
            if (token.reason) {
              return;
            }
            token.reason = new CanceledError(message, config, request);
            resolvePromise(token.reason);
          });
        }
        /**
         * Throws a `CanceledError` if cancellation has been requested.
         */
        throwIfRequested() {
          if (this.reason) {
            throw this.reason;
          }
        }
        /**
         * Subscribe to the cancel signal
         */
        subscribe(listener) {
          if (this.reason) {
            listener(this.reason);
            return;
          }
          if (this._listeners) {
            this._listeners.push(listener);
          } else {
            this._listeners = [listener];
          }
        }
        /**
         * Unsubscribe from the cancel signal
         */
        unsubscribe(listener) {
          if (!this._listeners) {
            return;
          }
          const index = this._listeners.indexOf(listener);
          if (index !== -1) {
            this._listeners.splice(index, 1);
          }
        }
        toAbortSignal() {
          const controller = new AbortController();
          const abort = (err) => {
            controller.abort(err);
          };
          this.subscribe(abort);
          controller.signal.unsubscribe = () => this.unsubscribe(abort);
          return controller.signal;
        }
        /**
         * Returns an object that contains a new `CancelToken` and a function that, when called,
         * cancels the `CancelToken`.
         */
        static source() {
          let cancel;
          const token = new _CancelToken(function executor(c) {
            cancel = c;
          });
          return {
            token,
            cancel
          };
        }
      };
      var CancelToken$1 = CancelToken;
      function spread(callback) {
        return function wrap(arr) {
          return callback.apply(null, arr);
        };
      }
      function isAxiosError(payload) {
        return utils$1.isObject(payload) && payload.isAxiosError === true;
      }
      var HttpStatusCode = {
        Continue: 100,
        SwitchingProtocols: 101,
        Processing: 102,
        EarlyHints: 103,
        Ok: 200,
        Created: 201,
        Accepted: 202,
        NonAuthoritativeInformation: 203,
        NoContent: 204,
        ResetContent: 205,
        PartialContent: 206,
        MultiStatus: 207,
        AlreadyReported: 208,
        ImUsed: 226,
        MultipleChoices: 300,
        MovedPermanently: 301,
        Found: 302,
        SeeOther: 303,
        NotModified: 304,
        UseProxy: 305,
        Unused: 306,
        TemporaryRedirect: 307,
        PermanentRedirect: 308,
        BadRequest: 400,
        Unauthorized: 401,
        PaymentRequired: 402,
        Forbidden: 403,
        NotFound: 404,
        MethodNotAllowed: 405,
        NotAcceptable: 406,
        ProxyAuthenticationRequired: 407,
        RequestTimeout: 408,
        Conflict: 409,
        Gone: 410,
        LengthRequired: 411,
        PreconditionFailed: 412,
        PayloadTooLarge: 413,
        UriTooLong: 414,
        UnsupportedMediaType: 415,
        RangeNotSatisfiable: 416,
        ExpectationFailed: 417,
        ImATeapot: 418,
        MisdirectedRequest: 421,
        UnprocessableEntity: 422,
        Locked: 423,
        FailedDependency: 424,
        TooEarly: 425,
        UpgradeRequired: 426,
        PreconditionRequired: 428,
        TooManyRequests: 429,
        RequestHeaderFieldsTooLarge: 431,
        UnavailableForLegalReasons: 451,
        InternalServerError: 500,
        NotImplemented: 501,
        BadGateway: 502,
        ServiceUnavailable: 503,
        GatewayTimeout: 504,
        HttpVersionNotSupported: 505,
        VariantAlsoNegotiates: 506,
        InsufficientStorage: 507,
        LoopDetected: 508,
        NotExtended: 510,
        NetworkAuthenticationRequired: 511,
        WebServerIsDown: 521,
        ConnectionTimedOut: 522,
        OriginIsUnreachable: 523,
        TimeoutOccurred: 524,
        SslHandshakeFailed: 525,
        InvalidSslCertificate: 526
      };
      Object.entries(HttpStatusCode).forEach(([key, value]) => {
        HttpStatusCode[value] = key;
      });
      var HttpStatusCode$1 = HttpStatusCode;
      function createInstance(defaultConfig) {
        const context = new Axios$1(defaultConfig);
        const instance = bind(Axios$1.prototype.request, context);
        utils$1.extend(instance, Axios$1.prototype, context, { allOwnKeys: true });
        utils$1.extend(instance, context, null, { allOwnKeys: true });
        instance.create = function create(instanceConfig) {
          return createInstance(mergeConfig(defaultConfig, instanceConfig));
        };
        return instance;
      }
      var axios2 = createInstance(defaults$1);
      axios2.Axios = Axios$1;
      axios2.CanceledError = CanceledError;
      axios2.CancelToken = CancelToken$1;
      axios2.isCancel = isCancel;
      axios2.VERSION = VERSION;
      axios2.toFormData = toFormData;
      axios2.AxiosError = AxiosError;
      axios2.Cancel = axios2.CanceledError;
      axios2.all = function all(promises) {
        return Promise.all(promises);
      };
      axios2.spread = spread;
      axios2.isAxiosError = isAxiosError;
      axios2.mergeConfig = mergeConfig;
      axios2.AxiosHeaders = AxiosHeaders$1;
      axios2.formToJSON = (thing) => formDataToJSON(utils$1.isHTMLForm(thing) ? new FormData(thing) : thing);
      axios2.getAdapter = adapters.getAdapter;
      axios2.HttpStatusCode = HttpStatusCode$1;
      axios2.default = axios2;
      module.exports = axios2;
    }
  });

  // node_modules/pusher-js/dist/web/pusher.js
  var require_pusher = __commonJS({
    "node_modules/pusher-js/dist/web/pusher.js"(exports, module) {
      (function webpackUniversalModuleDefinition(root, factory) {
        if (typeof exports === "object" && typeof module === "object")
          module.exports = factory();
        else if (typeof define === "function" && define.amd)
          define([], factory);
        else if (typeof exports === "object")
          exports["Pusher"] = factory();
        else
          root["Pusher"] = factory();
      })(window, function() {
        return (
          /******/
          (function(modules) {
            var installedModules = {};
            function __webpack_require__(moduleId) {
              if (installedModules[moduleId]) {
                return installedModules[moduleId].exports;
              }
              var module2 = installedModules[moduleId] = {
                /******/
                i: moduleId,
                /******/
                l: false,
                /******/
                exports: {}
                /******/
              };
              modules[moduleId].call(module2.exports, module2, module2.exports, __webpack_require__);
              module2.l = true;
              return module2.exports;
            }
            __webpack_require__.m = modules;
            __webpack_require__.c = installedModules;
            __webpack_require__.d = function(exports2, name, getter) {
              if (!__webpack_require__.o(exports2, name)) {
                Object.defineProperty(exports2, name, { enumerable: true, get: getter });
              }
            };
            __webpack_require__.r = function(exports2) {
              if (typeof Symbol !== "undefined" && Symbol.toStringTag) {
                Object.defineProperty(exports2, Symbol.toStringTag, { value: "Module" });
              }
              Object.defineProperty(exports2, "__esModule", { value: true });
            };
            __webpack_require__.t = function(value, mode) {
              if (mode & 1) value = __webpack_require__(value);
              if (mode & 8) return value;
              if (mode & 4 && typeof value === "object" && value && value.__esModule) return value;
              var ns = /* @__PURE__ */ Object.create(null);
              __webpack_require__.r(ns);
              Object.defineProperty(ns, "default", { enumerable: true, value });
              if (mode & 2 && typeof value != "string") for (var key in value) __webpack_require__.d(ns, key, function(key2) {
                return value[key2];
              }.bind(null, key));
              return ns;
            };
            __webpack_require__.n = function(module2) {
              var getter = module2 && module2.__esModule ? (
                /******/
                function getDefault() {
                  return module2["default"];
                }
              ) : (
                /******/
                function getModuleExports() {
                  return module2;
                }
              );
              __webpack_require__.d(getter, "a", getter);
              return getter;
            };
            __webpack_require__.o = function(object, property) {
              return Object.prototype.hasOwnProperty.call(object, property);
            };
            __webpack_require__.p = "";
            return __webpack_require__(__webpack_require__.s = 2);
          })([
            /* 0 */
            /***/
            (function(module2, exports2, __webpack_require__) {
              "use strict";
              var __extends = this && this.__extends || /* @__PURE__ */ (function() {
                var extendStatics = function(d, b) {
                  extendStatics = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(d2, b2) {
                    d2.__proto__ = b2;
                  } || function(d2, b2) {
                    for (var p in b2) if (b2.hasOwnProperty(p)) d2[p] = b2[p];
                  };
                  return extendStatics(d, b);
                };
                return function(d, b) {
                  extendStatics(d, b);
                  function __() {
                    this.constructor = d;
                  }
                  d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
                };
              })();
              Object.defineProperty(exports2, "__esModule", { value: true });
              var INVALID_BYTE = 256;
              var Coder = (
                /** @class */
                (function() {
                  function Coder2(_paddingCharacter) {
                    if (_paddingCharacter === void 0) {
                      _paddingCharacter = "=";
                    }
                    this._paddingCharacter = _paddingCharacter;
                  }
                  Coder2.prototype.encodedLength = function(length) {
                    if (!this._paddingCharacter) {
                      return (length * 8 + 5) / 6 | 0;
                    }
                    return (length + 2) / 3 * 4 | 0;
                  };
                  Coder2.prototype.encode = function(data) {
                    var out = "";
                    var i = 0;
                    for (; i < data.length - 2; i += 3) {
                      var c = data[i] << 16 | data[i + 1] << 8 | data[i + 2];
                      out += this._encodeByte(c >>> 3 * 6 & 63);
                      out += this._encodeByte(c >>> 2 * 6 & 63);
                      out += this._encodeByte(c >>> 1 * 6 & 63);
                      out += this._encodeByte(c >>> 0 * 6 & 63);
                    }
                    var left = data.length - i;
                    if (left > 0) {
                      var c = data[i] << 16 | (left === 2 ? data[i + 1] << 8 : 0);
                      out += this._encodeByte(c >>> 3 * 6 & 63);
                      out += this._encodeByte(c >>> 2 * 6 & 63);
                      if (left === 2) {
                        out += this._encodeByte(c >>> 1 * 6 & 63);
                      } else {
                        out += this._paddingCharacter || "";
                      }
                      out += this._paddingCharacter || "";
                    }
                    return out;
                  };
                  Coder2.prototype.maxDecodedLength = function(length) {
                    if (!this._paddingCharacter) {
                      return (length * 6 + 7) / 8 | 0;
                    }
                    return length / 4 * 3 | 0;
                  };
                  Coder2.prototype.decodedLength = function(s) {
                    return this.maxDecodedLength(s.length - this._getPaddingLength(s));
                  };
                  Coder2.prototype.decode = function(s) {
                    if (s.length === 0) {
                      return new Uint8Array(0);
                    }
                    var paddingLength = this._getPaddingLength(s);
                    var length = s.length - paddingLength;
                    var out = new Uint8Array(this.maxDecodedLength(length));
                    var op = 0;
                    var i = 0;
                    var haveBad = 0;
                    var v0 = 0, v1 = 0, v2 = 0, v3 = 0;
                    for (; i < length - 4; i += 4) {
                      v0 = this._decodeChar(s.charCodeAt(i + 0));
                      v1 = this._decodeChar(s.charCodeAt(i + 1));
                      v2 = this._decodeChar(s.charCodeAt(i + 2));
                      v3 = this._decodeChar(s.charCodeAt(i + 3));
                      out[op++] = v0 << 2 | v1 >>> 4;
                      out[op++] = v1 << 4 | v2 >>> 2;
                      out[op++] = v2 << 6 | v3;
                      haveBad |= v0 & INVALID_BYTE;
                      haveBad |= v1 & INVALID_BYTE;
                      haveBad |= v2 & INVALID_BYTE;
                      haveBad |= v3 & INVALID_BYTE;
                    }
                    if (i < length - 1) {
                      v0 = this._decodeChar(s.charCodeAt(i));
                      v1 = this._decodeChar(s.charCodeAt(i + 1));
                      out[op++] = v0 << 2 | v1 >>> 4;
                      haveBad |= v0 & INVALID_BYTE;
                      haveBad |= v1 & INVALID_BYTE;
                    }
                    if (i < length - 2) {
                      v2 = this._decodeChar(s.charCodeAt(i + 2));
                      out[op++] = v1 << 4 | v2 >>> 2;
                      haveBad |= v2 & INVALID_BYTE;
                    }
                    if (i < length - 3) {
                      v3 = this._decodeChar(s.charCodeAt(i + 3));
                      out[op++] = v2 << 6 | v3;
                      haveBad |= v3 & INVALID_BYTE;
                    }
                    if (haveBad !== 0) {
                      throw new Error("Base64Coder: incorrect characters for decoding");
                    }
                    return out;
                  };
                  Coder2.prototype._encodeByte = function(b) {
                    var result = b;
                    result += 65;
                    result += 25 - b >>> 8 & 0 - 65 - 26 + 97;
                    result += 51 - b >>> 8 & 26 - 97 - 52 + 48;
                    result += 61 - b >>> 8 & 52 - 48 - 62 + 43;
                    result += 62 - b >>> 8 & 62 - 43 - 63 + 47;
                    return String.fromCharCode(result);
                  };
                  Coder2.prototype._decodeChar = function(c) {
                    var result = INVALID_BYTE;
                    result += (42 - c & c - 44) >>> 8 & -INVALID_BYTE + c - 43 + 62;
                    result += (46 - c & c - 48) >>> 8 & -INVALID_BYTE + c - 47 + 63;
                    result += (47 - c & c - 58) >>> 8 & -INVALID_BYTE + c - 48 + 52;
                    result += (64 - c & c - 91) >>> 8 & -INVALID_BYTE + c - 65 + 0;
                    result += (96 - c & c - 123) >>> 8 & -INVALID_BYTE + c - 97 + 26;
                    return result;
                  };
                  Coder2.prototype._getPaddingLength = function(s) {
                    var paddingLength = 0;
                    if (this._paddingCharacter) {
                      for (var i = s.length - 1; i >= 0; i--) {
                        if (s[i] !== this._paddingCharacter) {
                          break;
                        }
                        paddingLength++;
                      }
                      if (s.length < 4 || paddingLength > 2) {
                        throw new Error("Base64Coder: incorrect padding");
                      }
                    }
                    return paddingLength;
                  };
                  return Coder2;
                })()
              );
              exports2.Coder = Coder;
              var stdCoder = new Coder();
              function encode(data) {
                return stdCoder.encode(data);
              }
              exports2.encode = encode;
              function decode(s) {
                return stdCoder.decode(s);
              }
              exports2.decode = decode;
              var URLSafeCoder = (
                /** @class */
                (function(_super) {
                  __extends(URLSafeCoder2, _super);
                  function URLSafeCoder2() {
                    return _super !== null && _super.apply(this, arguments) || this;
                  }
                  URLSafeCoder2.prototype._encodeByte = function(b) {
                    var result = b;
                    result += 65;
                    result += 25 - b >>> 8 & 0 - 65 - 26 + 97;
                    result += 51 - b >>> 8 & 26 - 97 - 52 + 48;
                    result += 61 - b >>> 8 & 52 - 48 - 62 + 45;
                    result += 62 - b >>> 8 & 62 - 45 - 63 + 95;
                    return String.fromCharCode(result);
                  };
                  URLSafeCoder2.prototype._decodeChar = function(c) {
                    var result = INVALID_BYTE;
                    result += (44 - c & c - 46) >>> 8 & -INVALID_BYTE + c - 45 + 62;
                    result += (94 - c & c - 96) >>> 8 & -INVALID_BYTE + c - 95 + 63;
                    result += (47 - c & c - 58) >>> 8 & -INVALID_BYTE + c - 48 + 52;
                    result += (64 - c & c - 91) >>> 8 & -INVALID_BYTE + c - 65 + 0;
                    result += (96 - c & c - 123) >>> 8 & -INVALID_BYTE + c - 97 + 26;
                    return result;
                  };
                  return URLSafeCoder2;
                })(Coder)
              );
              exports2.URLSafeCoder = URLSafeCoder;
              var urlSafeCoder = new URLSafeCoder();
              function encodeURLSafe(data) {
                return urlSafeCoder.encode(data);
              }
              exports2.encodeURLSafe = encodeURLSafe;
              function decodeURLSafe(s) {
                return urlSafeCoder.decode(s);
              }
              exports2.decodeURLSafe = decodeURLSafe;
              exports2.encodedLength = function(length) {
                return stdCoder.encodedLength(length);
              };
              exports2.maxDecodedLength = function(length) {
                return stdCoder.maxDecodedLength(length);
              };
              exports2.decodedLength = function(s) {
                return stdCoder.decodedLength(s);
              };
            }),
            /* 1 */
            /***/
            (function(module2, exports2, __webpack_require__) {
              "use strict";
              Object.defineProperty(exports2, "__esModule", { value: true });
              var INVALID_UTF16 = "utf8: invalid string";
              var INVALID_UTF8 = "utf8: invalid source encoding";
              function encode(s) {
                var arr = new Uint8Array(encodedLength(s));
                var pos = 0;
                for (var i = 0; i < s.length; i++) {
                  var c = s.charCodeAt(i);
                  if (c < 128) {
                    arr[pos++] = c;
                  } else if (c < 2048) {
                    arr[pos++] = 192 | c >> 6;
                    arr[pos++] = 128 | c & 63;
                  } else if (c < 55296) {
                    arr[pos++] = 224 | c >> 12;
                    arr[pos++] = 128 | c >> 6 & 63;
                    arr[pos++] = 128 | c & 63;
                  } else {
                    i++;
                    c = (c & 1023) << 10;
                    c |= s.charCodeAt(i) & 1023;
                    c += 65536;
                    arr[pos++] = 240 | c >> 18;
                    arr[pos++] = 128 | c >> 12 & 63;
                    arr[pos++] = 128 | c >> 6 & 63;
                    arr[pos++] = 128 | c & 63;
                  }
                }
                return arr;
              }
              exports2.encode = encode;
              function encodedLength(s) {
                var result = 0;
                for (var i = 0; i < s.length; i++) {
                  var c = s.charCodeAt(i);
                  if (c < 128) {
                    result += 1;
                  } else if (c < 2048) {
                    result += 2;
                  } else if (c < 55296) {
                    result += 3;
                  } else if (c <= 57343) {
                    if (i >= s.length - 1) {
                      throw new Error(INVALID_UTF16);
                    }
                    i++;
                    result += 4;
                  } else {
                    throw new Error(INVALID_UTF16);
                  }
                }
                return result;
              }
              exports2.encodedLength = encodedLength;
              function decode(arr) {
                var chars = [];
                for (var i = 0; i < arr.length; i++) {
                  var b = arr[i];
                  if (b & 128) {
                    var min = void 0;
                    if (b < 224) {
                      if (i >= arr.length) {
                        throw new Error(INVALID_UTF8);
                      }
                      var n1 = arr[++i];
                      if ((n1 & 192) !== 128) {
                        throw new Error(INVALID_UTF8);
                      }
                      b = (b & 31) << 6 | n1 & 63;
                      min = 128;
                    } else if (b < 240) {
                      if (i >= arr.length - 1) {
                        throw new Error(INVALID_UTF8);
                      }
                      var n1 = arr[++i];
                      var n2 = arr[++i];
                      if ((n1 & 192) !== 128 || (n2 & 192) !== 128) {
                        throw new Error(INVALID_UTF8);
                      }
                      b = (b & 15) << 12 | (n1 & 63) << 6 | n2 & 63;
                      min = 2048;
                    } else if (b < 248) {
                      if (i >= arr.length - 2) {
                        throw new Error(INVALID_UTF8);
                      }
                      var n1 = arr[++i];
                      var n2 = arr[++i];
                      var n3 = arr[++i];
                      if ((n1 & 192) !== 128 || (n2 & 192) !== 128 || (n3 & 192) !== 128) {
                        throw new Error(INVALID_UTF8);
                      }
                      b = (b & 15) << 18 | (n1 & 63) << 12 | (n2 & 63) << 6 | n3 & 63;
                      min = 65536;
                    } else {
                      throw new Error(INVALID_UTF8);
                    }
                    if (b < min || b >= 55296 && b <= 57343) {
                      throw new Error(INVALID_UTF8);
                    }
                    if (b >= 65536) {
                      if (b > 1114111) {
                        throw new Error(INVALID_UTF8);
                      }
                      b -= 65536;
                      chars.push(String.fromCharCode(55296 | b >> 10));
                      b = 56320 | b & 1023;
                    }
                  }
                  chars.push(String.fromCharCode(b));
                }
                return chars.join("");
              }
              exports2.decode = decode;
            }),
            /* 2 */
            /***/
            (function(module2, exports2, __webpack_require__) {
              module2.exports = __webpack_require__(3).default;
            }),
            /* 3 */
            /***/
            (function(module2, __webpack_exports__, __webpack_require__) {
              "use strict";
              __webpack_require__.r(__webpack_exports__);
              var ScriptReceiverFactory = (function() {
                function ScriptReceiverFactory2(prefix2, name) {
                  this.lastId = 0;
                  this.prefix = prefix2;
                  this.name = name;
                }
                ScriptReceiverFactory2.prototype.create = function(callback) {
                  this.lastId++;
                  var number = this.lastId;
                  var id = this.prefix + number;
                  var name = this.name + "[" + number + "]";
                  var called = false;
                  var callbackWrapper = function() {
                    if (!called) {
                      callback.apply(null, arguments);
                      called = true;
                    }
                  };
                  this[number] = callbackWrapper;
                  return { number, id, name, callback: callbackWrapper };
                };
                ScriptReceiverFactory2.prototype.remove = function(receiver) {
                  delete this[receiver.number];
                };
                return ScriptReceiverFactory2;
              })();
              var ScriptReceivers = new ScriptReceiverFactory("_pusher_script_", "Pusher.ScriptReceivers");
              var Defaults = {
                VERSION: "7.4.0",
                PROTOCOL: 7,
                wsPort: 80,
                wssPort: 443,
                wsPath: "",
                httpHost: "sockjs.pusher.com",
                httpPort: 80,
                httpsPort: 443,
                httpPath: "/pusher",
                stats_host: "stats.pusher.com",
                authEndpoint: "/pusher/auth",
                authTransport: "ajax",
                activityTimeout: 12e4,
                pongTimeout: 3e4,
                unavailableTimeout: 1e4,
                cluster: "mt1",
                userAuthentication: {
                  endpoint: "/pusher/user-auth",
                  transport: "ajax"
                },
                channelAuthorization: {
                  endpoint: "/pusher/auth",
                  transport: "ajax"
                },
                cdn_http: "http://js.pusher.com",
                cdn_https: "https://js.pusher.com",
                dependency_suffix: ""
              };
              var defaults = Defaults;
              var dependency_loader_DependencyLoader = (function() {
                function DependencyLoader(options) {
                  this.options = options;
                  this.receivers = options.receivers || ScriptReceivers;
                  this.loading = {};
                }
                DependencyLoader.prototype.load = function(name, options, callback) {
                  var self2 = this;
                  if (self2.loading[name] && self2.loading[name].length > 0) {
                    self2.loading[name].push(callback);
                  } else {
                    self2.loading[name] = [callback];
                    var request = runtime.createScriptRequest(self2.getPath(name, options));
                    var receiver = self2.receivers.create(function(error) {
                      self2.receivers.remove(receiver);
                      if (self2.loading[name]) {
                        var callbacks = self2.loading[name];
                        delete self2.loading[name];
                        var successCallback = function(wasSuccessful) {
                          if (!wasSuccessful) {
                            request.cleanup();
                          }
                        };
                        for (var i = 0; i < callbacks.length; i++) {
                          callbacks[i](error, successCallback);
                        }
                      }
                    });
                    request.send(receiver);
                  }
                };
                DependencyLoader.prototype.getRoot = function(options) {
                  var cdn;
                  var protocol = runtime.getDocument().location.protocol;
                  if (options && options.useTLS || protocol === "https:") {
                    cdn = this.options.cdn_https;
                  } else {
                    cdn = this.options.cdn_http;
                  }
                  return cdn.replace(/\/*$/, "") + "/" + this.options.version;
                };
                DependencyLoader.prototype.getPath = function(name, options) {
                  return this.getRoot(options) + "/" + name + this.options.suffix + ".js";
                };
                return DependencyLoader;
              })();
              var dependency_loader = dependency_loader_DependencyLoader;
              var DependenciesReceivers = new ScriptReceiverFactory("_pusher_dependencies", "Pusher.DependenciesReceivers");
              var Dependencies = new dependency_loader({
                cdn_http: defaults.cdn_http,
                cdn_https: defaults.cdn_https,
                version: defaults.VERSION,
                suffix: defaults.dependency_suffix,
                receivers: DependenciesReceivers
              });
              var urlStore = {
                baseUrl: "https://pusher.com",
                urls: {
                  authenticationEndpoint: {
                    path: "/docs/channels/server_api/authenticating_users"
                  },
                  authorizationEndpoint: {
                    path: "/docs/channels/server_api/authorizing-users/"
                  },
                  javascriptQuickStart: {
                    path: "/docs/javascript_quick_start"
                  },
                  triggeringClientEvents: {
                    path: "/docs/client_api_guide/client_events#trigger-events"
                  },
                  encryptedChannelSupport: {
                    fullUrl: "https://github.com/pusher/pusher-js/tree/cc491015371a4bde5743d1c87a0fbac0feb53195#encrypted-channel-support"
                  }
                }
              };
              var buildLogSuffix = function(key) {
                var urlPrefix = "See:";
                var urlObj = urlStore.urls[key];
                if (!urlObj)
                  return "";
                var url;
                if (urlObj.fullUrl) {
                  url = urlObj.fullUrl;
                } else if (urlObj.path) {
                  url = urlStore.baseUrl + urlObj.path;
                }
                if (!url)
                  return "";
                return urlPrefix + " " + url;
              };
              var url_store = { buildLogSuffix };
              var AuthRequestType;
              (function(AuthRequestType2) {
                AuthRequestType2["UserAuthentication"] = "user-authentication";
                AuthRequestType2["ChannelAuthorization"] = "channel-authorization";
              })(AuthRequestType || (AuthRequestType = {}));
              var __extends = /* @__PURE__ */ (function() {
                var extendStatics = function(d, b) {
                  extendStatics = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(d2, b2) {
                    d2.__proto__ = b2;
                  } || function(d2, b2) {
                    for (var p in b2) if (b2.hasOwnProperty(p)) d2[p] = b2[p];
                  };
                  return extendStatics(d, b);
                };
                return function(d, b) {
                  extendStatics(d, b);
                  function __() {
                    this.constructor = d;
                  }
                  d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
                };
              })();
              var BadEventName = (function(_super) {
                __extends(BadEventName2, _super);
                function BadEventName2(msg) {
                  var _newTarget = this.constructor;
                  var _this = _super.call(this, msg) || this;
                  Object.setPrototypeOf(_this, _newTarget.prototype);
                  return _this;
                }
                return BadEventName2;
              })(Error);
              var BadChannelName = (function(_super) {
                __extends(BadChannelName2, _super);
                function BadChannelName2(msg) {
                  var _newTarget = this.constructor;
                  var _this = _super.call(this, msg) || this;
                  Object.setPrototypeOf(_this, _newTarget.prototype);
                  return _this;
                }
                return BadChannelName2;
              })(Error);
              var RequestTimedOut = (function(_super) {
                __extends(RequestTimedOut2, _super);
                function RequestTimedOut2(msg) {
                  var _newTarget = this.constructor;
                  var _this = _super.call(this, msg) || this;
                  Object.setPrototypeOf(_this, _newTarget.prototype);
                  return _this;
                }
                return RequestTimedOut2;
              })(Error);
              var TransportPriorityTooLow = (function(_super) {
                __extends(TransportPriorityTooLow2, _super);
                function TransportPriorityTooLow2(msg) {
                  var _newTarget = this.constructor;
                  var _this = _super.call(this, msg) || this;
                  Object.setPrototypeOf(_this, _newTarget.prototype);
                  return _this;
                }
                return TransportPriorityTooLow2;
              })(Error);
              var TransportClosed = (function(_super) {
                __extends(TransportClosed2, _super);
                function TransportClosed2(msg) {
                  var _newTarget = this.constructor;
                  var _this = _super.call(this, msg) || this;
                  Object.setPrototypeOf(_this, _newTarget.prototype);
                  return _this;
                }
                return TransportClosed2;
              })(Error);
              var UnsupportedFeature = (function(_super) {
                __extends(UnsupportedFeature2, _super);
                function UnsupportedFeature2(msg) {
                  var _newTarget = this.constructor;
                  var _this = _super.call(this, msg) || this;
                  Object.setPrototypeOf(_this, _newTarget.prototype);
                  return _this;
                }
                return UnsupportedFeature2;
              })(Error);
              var UnsupportedTransport = (function(_super) {
                __extends(UnsupportedTransport2, _super);
                function UnsupportedTransport2(msg) {
                  var _newTarget = this.constructor;
                  var _this = _super.call(this, msg) || this;
                  Object.setPrototypeOf(_this, _newTarget.prototype);
                  return _this;
                }
                return UnsupportedTransport2;
              })(Error);
              var UnsupportedStrategy = (function(_super) {
                __extends(UnsupportedStrategy2, _super);
                function UnsupportedStrategy2(msg) {
                  var _newTarget = this.constructor;
                  var _this = _super.call(this, msg) || this;
                  Object.setPrototypeOf(_this, _newTarget.prototype);
                  return _this;
                }
                return UnsupportedStrategy2;
              })(Error);
              var HTTPAuthError = (function(_super) {
                __extends(HTTPAuthError2, _super);
                function HTTPAuthError2(status, msg) {
                  var _newTarget = this.constructor;
                  var _this = _super.call(this, msg) || this;
                  _this.status = status;
                  Object.setPrototypeOf(_this, _newTarget.prototype);
                  return _this;
                }
                return HTTPAuthError2;
              })(Error);
              var ajax = function(context, query, authOptions, authRequestType, callback) {
                var xhr = runtime.createXHR();
                xhr.open("POST", authOptions.endpoint, true);
                xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
                for (var headerName in authOptions.headers) {
                  xhr.setRequestHeader(headerName, authOptions.headers[headerName]);
                }
                xhr.onreadystatechange = function() {
                  if (xhr.readyState === 4) {
                    if (xhr.status === 200) {
                      var data = void 0;
                      var parsed = false;
                      try {
                        data = JSON.parse(xhr.responseText);
                        parsed = true;
                      } catch (e) {
                        callback(new HTTPAuthError(200, "JSON returned from " + authRequestType.toString() + " endpoint was invalid, yet status code was 200. Data was: " + xhr.responseText), null);
                      }
                      if (parsed) {
                        callback(null, data);
                      }
                    } else {
                      var suffix = "";
                      switch (authRequestType) {
                        case AuthRequestType.UserAuthentication:
                          suffix = url_store.buildLogSuffix("authenticationEndpoint");
                          break;
                        case AuthRequestType.ChannelAuthorization:
                          suffix = "Clients must be authenticated to join private or presence channels. " + url_store.buildLogSuffix("authorizationEndpoint");
                          break;
                      }
                      callback(new HTTPAuthError(xhr.status, "Unable to retrieve auth string from " + authRequestType.toString() + " endpoint - " + ("received status: " + xhr.status + " from " + authOptions.endpoint + ". " + suffix)), null);
                    }
                  }
                };
                xhr.send(query);
                return xhr;
              };
              var xhr_auth = ajax;
              function encode(s) {
                return btoa2(utob(s));
              }
              var fromCharCode = String.fromCharCode;
              var b64chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
              var b64tab = {};
              for (var base64_i = 0, l = b64chars.length; base64_i < l; base64_i++) {
                b64tab[b64chars.charAt(base64_i)] = base64_i;
              }
              var cb_utob = function(c) {
                var cc = c.charCodeAt(0);
                return cc < 128 ? c : cc < 2048 ? fromCharCode(192 | cc >>> 6) + fromCharCode(128 | cc & 63) : fromCharCode(224 | cc >>> 12 & 15) + fromCharCode(128 | cc >>> 6 & 63) + fromCharCode(128 | cc & 63);
              };
              var utob = function(u) {
                return u.replace(/[^\x00-\x7F]/g, cb_utob);
              };
              var cb_encode = function(ccc) {
                var padlen = [0, 2, 1][ccc.length % 3];
                var ord = ccc.charCodeAt(0) << 16 | (ccc.length > 1 ? ccc.charCodeAt(1) : 0) << 8 | (ccc.length > 2 ? ccc.charCodeAt(2) : 0);
                var chars = [
                  b64chars.charAt(ord >>> 18),
                  b64chars.charAt(ord >>> 12 & 63),
                  padlen >= 2 ? "=" : b64chars.charAt(ord >>> 6 & 63),
                  padlen >= 1 ? "=" : b64chars.charAt(ord & 63)
                ];
                return chars.join("");
              };
              var btoa2 = window.btoa || function(b) {
                return b.replace(/[\s\S]{1,3}/g, cb_encode);
              };
              var Timer = (function() {
                function Timer2(set, clear, delay, callback) {
                  var _this = this;
                  this.clear = clear;
                  this.timer = set(function() {
                    if (_this.timer) {
                      _this.timer = callback(_this.timer);
                    }
                  }, delay);
                }
                Timer2.prototype.isRunning = function() {
                  return this.timer !== null;
                };
                Timer2.prototype.ensureAborted = function() {
                  if (this.timer) {
                    this.clear(this.timer);
                    this.timer = null;
                  }
                };
                return Timer2;
              })();
              var abstract_timer = Timer;
              var timers_extends = /* @__PURE__ */ (function() {
                var extendStatics = function(d, b) {
                  extendStatics = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(d2, b2) {
                    d2.__proto__ = b2;
                  } || function(d2, b2) {
                    for (var p in b2) if (b2.hasOwnProperty(p)) d2[p] = b2[p];
                  };
                  return extendStatics(d, b);
                };
                return function(d, b) {
                  extendStatics(d, b);
                  function __() {
                    this.constructor = d;
                  }
                  d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
                };
              })();
              function timers_clearTimeout(timer) {
                window.clearTimeout(timer);
              }
              function timers_clearInterval(timer) {
                window.clearInterval(timer);
              }
              var OneOffTimer = (function(_super) {
                timers_extends(OneOffTimer2, _super);
                function OneOffTimer2(delay, callback) {
                  return _super.call(this, setTimeout, timers_clearTimeout, delay, function(timer) {
                    callback();
                    return null;
                  }) || this;
                }
                return OneOffTimer2;
              })(abstract_timer);
              var PeriodicTimer = (function(_super) {
                timers_extends(PeriodicTimer2, _super);
                function PeriodicTimer2(delay, callback) {
                  return _super.call(this, setInterval, timers_clearInterval, delay, function(timer) {
                    callback();
                    return timer;
                  }) || this;
                }
                return PeriodicTimer2;
              })(abstract_timer);
              var Util = {
                now: function() {
                  if (Date.now) {
                    return Date.now();
                  } else {
                    return (/* @__PURE__ */ new Date()).valueOf();
                  }
                },
                defer: function(callback) {
                  return new OneOffTimer(0, callback);
                },
                method: function(name) {
                  var args = [];
                  for (var _i = 1; _i < arguments.length; _i++) {
                    args[_i - 1] = arguments[_i];
                  }
                  var boundArguments = Array.prototype.slice.call(arguments, 1);
                  return function(object) {
                    return object[name].apply(object, boundArguments.concat(arguments));
                  };
                }
              };
              var util = Util;
              function extend(target) {
                var sources = [];
                for (var _i = 1; _i < arguments.length; _i++) {
                  sources[_i - 1] = arguments[_i];
                }
                for (var i = 0; i < sources.length; i++) {
                  var extensions = sources[i];
                  for (var property in extensions) {
                    if (extensions[property] && extensions[property].constructor && extensions[property].constructor === Object) {
                      target[property] = extend(target[property] || {}, extensions[property]);
                    } else {
                      target[property] = extensions[property];
                    }
                  }
                }
                return target;
              }
              function stringify() {
                var m = ["Pusher"];
                for (var i = 0; i < arguments.length; i++) {
                  if (typeof arguments[i] === "string") {
                    m.push(arguments[i]);
                  } else {
                    m.push(safeJSONStringify(arguments[i]));
                  }
                }
                return m.join(" : ");
              }
              function arrayIndexOf(array, item) {
                var nativeIndexOf = Array.prototype.indexOf;
                if (array === null) {
                  return -1;
                }
                if (nativeIndexOf && array.indexOf === nativeIndexOf) {
                  return array.indexOf(item);
                }
                for (var i = 0, l2 = array.length; i < l2; i++) {
                  if (array[i] === item) {
                    return i;
                  }
                }
                return -1;
              }
              function objectApply(object, f) {
                for (var key in object) {
                  if (Object.prototype.hasOwnProperty.call(object, key)) {
                    f(object[key], key, object);
                  }
                }
              }
              function keys(object) {
                var keys2 = [];
                objectApply(object, function(_, key) {
                  keys2.push(key);
                });
                return keys2;
              }
              function values(object) {
                var values2 = [];
                objectApply(object, function(value) {
                  values2.push(value);
                });
                return values2;
              }
              function apply(array, f, context) {
                for (var i = 0; i < array.length; i++) {
                  f.call(context || window, array[i], i, array);
                }
              }
              function map(array, f) {
                var result = [];
                for (var i = 0; i < array.length; i++) {
                  result.push(f(array[i], i, array, result));
                }
                return result;
              }
              function mapObject(object, f) {
                var result = {};
                objectApply(object, function(value, key) {
                  result[key] = f(value);
                });
                return result;
              }
              function filter(array, test) {
                test = test || function(value) {
                  return !!value;
                };
                var result = [];
                for (var i = 0; i < array.length; i++) {
                  if (test(array[i], i, array, result)) {
                    result.push(array[i]);
                  }
                }
                return result;
              }
              function filterObject(object, test) {
                var result = {};
                objectApply(object, function(value, key) {
                  if (test && test(value, key, object, result) || Boolean(value)) {
                    result[key] = value;
                  }
                });
                return result;
              }
              function flatten(object) {
                var result = [];
                objectApply(object, function(value, key) {
                  result.push([key, value]);
                });
                return result;
              }
              function any(array, test) {
                for (var i = 0; i < array.length; i++) {
                  if (test(array[i], i, array)) {
                    return true;
                  }
                }
                return false;
              }
              function collections_all(array, test) {
                for (var i = 0; i < array.length; i++) {
                  if (!test(array[i], i, array)) {
                    return false;
                  }
                }
                return true;
              }
              function encodeParamsObject(data) {
                return mapObject(data, function(value) {
                  if (typeof value === "object") {
                    value = safeJSONStringify(value);
                  }
                  return encodeURIComponent(encode(value.toString()));
                });
              }
              function buildQueryString(data) {
                var params = filterObject(data, function(value) {
                  return value !== void 0;
                });
                var query = map(flatten(encodeParamsObject(params)), util.method("join", "=")).join("&");
                return query;
              }
              function decycleObject(object) {
                var objects = [], paths = [];
                return (function derez(value, path) {
                  var i, name, nu;
                  switch (typeof value) {
                    case "object":
                      if (!value) {
                        return null;
                      }
                      for (i = 0; i < objects.length; i += 1) {
                        if (objects[i] === value) {
                          return { $ref: paths[i] };
                        }
                      }
                      objects.push(value);
                      paths.push(path);
                      if (Object.prototype.toString.apply(value) === "[object Array]") {
                        nu = [];
                        for (i = 0; i < value.length; i += 1) {
                          nu[i] = derez(value[i], path + "[" + i + "]");
                        }
                      } else {
                        nu = {};
                        for (name in value) {
                          if (Object.prototype.hasOwnProperty.call(value, name)) {
                            nu[name] = derez(value[name], path + "[" + JSON.stringify(name) + "]");
                          }
                        }
                      }
                      return nu;
                    case "number":
                    case "string":
                    case "boolean":
                      return value;
                  }
                })(object, "$");
              }
              function safeJSONStringify(source) {
                try {
                  return JSON.stringify(source);
                } catch (e) {
                  return JSON.stringify(decycleObject(source));
                }
              }
              var logger_Logger = (function() {
                function Logger() {
                  this.globalLog = function(message) {
                    if (window.console && window.console.log) {
                      window.console.log(message);
                    }
                  };
                }
                Logger.prototype.debug = function() {
                  var args = [];
                  for (var _i = 0; _i < arguments.length; _i++) {
                    args[_i] = arguments[_i];
                  }
                  this.log(this.globalLog, args);
                };
                Logger.prototype.warn = function() {
                  var args = [];
                  for (var _i = 0; _i < arguments.length; _i++) {
                    args[_i] = arguments[_i];
                  }
                  this.log(this.globalLogWarn, args);
                };
                Logger.prototype.error = function() {
                  var args = [];
                  for (var _i = 0; _i < arguments.length; _i++) {
                    args[_i] = arguments[_i];
                  }
                  this.log(this.globalLogError, args);
                };
                Logger.prototype.globalLogWarn = function(message) {
                  if (window.console && window.console.warn) {
                    window.console.warn(message);
                  } else {
                    this.globalLog(message);
                  }
                };
                Logger.prototype.globalLogError = function(message) {
                  if (window.console && window.console.error) {
                    window.console.error(message);
                  } else {
                    this.globalLogWarn(message);
                  }
                };
                Logger.prototype.log = function(defaultLoggingFunction) {
                  var args = [];
                  for (var _i = 1; _i < arguments.length; _i++) {
                    args[_i - 1] = arguments[_i];
                  }
                  var message = stringify.apply(this, arguments);
                  if (core_pusher.log) {
                    core_pusher.log(message);
                  } else if (core_pusher.logToConsole) {
                    var log = defaultLoggingFunction.bind(this);
                    log(message);
                  }
                };
                return Logger;
              })();
              var logger = new logger_Logger();
              var jsonp = function(context, query, authOptions, authRequestType, callback) {
                if (authOptions.headers !== void 0) {
                  logger.warn("To send headers with the " + authRequestType.toString() + " request, you must use AJAX, rather than JSONP.");
                }
                var callbackName = context.nextAuthCallbackID.toString();
                context.nextAuthCallbackID++;
                var document2 = context.getDocument();
                var script = document2.createElement("script");
                context.auth_callbacks[callbackName] = function(data) {
                  callback(null, data);
                };
                var callback_name = "Pusher.auth_callbacks['" + callbackName + "']";
                script.src = authOptions.endpoint + "?callback=" + encodeURIComponent(callback_name) + "&" + query;
                var head = document2.getElementsByTagName("head")[0] || document2.documentElement;
                head.insertBefore(script, head.firstChild);
              };
              var jsonp_auth = jsonp;
              var ScriptRequest = (function() {
                function ScriptRequest2(src) {
                  this.src = src;
                }
                ScriptRequest2.prototype.send = function(receiver) {
                  var self2 = this;
                  var errorString = "Error loading " + self2.src;
                  self2.script = document.createElement("script");
                  self2.script.id = receiver.id;
                  self2.script.src = self2.src;
                  self2.script.type = "text/javascript";
                  self2.script.charset = "UTF-8";
                  if (self2.script.addEventListener) {
                    self2.script.onerror = function() {
                      receiver.callback(errorString);
                    };
                    self2.script.onload = function() {
                      receiver.callback(null);
                    };
                  } else {
                    self2.script.onreadystatechange = function() {
                      if (self2.script.readyState === "loaded" || self2.script.readyState === "complete") {
                        receiver.callback(null);
                      }
                    };
                  }
                  if (self2.script.async === void 0 && document.attachEvent && /opera/i.test(navigator.userAgent)) {
                    self2.errorScript = document.createElement("script");
                    self2.errorScript.id = receiver.id + "_error";
                    self2.errorScript.text = receiver.name + "('" + errorString + "');";
                    self2.script.async = self2.errorScript.async = false;
                  } else {
                    self2.script.async = true;
                  }
                  var head = document.getElementsByTagName("head")[0];
                  head.insertBefore(self2.script, head.firstChild);
                  if (self2.errorScript) {
                    head.insertBefore(self2.errorScript, self2.script.nextSibling);
                  }
                };
                ScriptRequest2.prototype.cleanup = function() {
                  if (this.script) {
                    this.script.onload = this.script.onerror = null;
                    this.script.onreadystatechange = null;
                  }
                  if (this.script && this.script.parentNode) {
                    this.script.parentNode.removeChild(this.script);
                  }
                  if (this.errorScript && this.errorScript.parentNode) {
                    this.errorScript.parentNode.removeChild(this.errorScript);
                  }
                  this.script = null;
                  this.errorScript = null;
                };
                return ScriptRequest2;
              })();
              var script_request = ScriptRequest;
              var jsonp_request_JSONPRequest = (function() {
                function JSONPRequest(url, data) {
                  this.url = url;
                  this.data = data;
                }
                JSONPRequest.prototype.send = function(receiver) {
                  if (this.request) {
                    return;
                  }
                  var query = buildQueryString(this.data);
                  var url = this.url + "/" + receiver.number + "?" + query;
                  this.request = runtime.createScriptRequest(url);
                  this.request.send(receiver);
                };
                JSONPRequest.prototype.cleanup = function() {
                  if (this.request) {
                    this.request.cleanup();
                  }
                };
                return JSONPRequest;
              })();
              var jsonp_request = jsonp_request_JSONPRequest;
              var getAgent = function(sender, useTLS) {
                return function(data, callback) {
                  var scheme = "http" + (useTLS ? "s" : "") + "://";
                  var url = scheme + (sender.host || sender.options.host) + sender.options.path;
                  var request = runtime.createJSONPRequest(url, data);
                  var receiver = runtime.ScriptReceivers.create(function(error, result) {
                    ScriptReceivers.remove(receiver);
                    request.cleanup();
                    if (result && result.host) {
                      sender.host = result.host;
                    }
                    if (callback) {
                      callback(error, result);
                    }
                  });
                  request.send(receiver);
                };
              };
              var jsonp_timeline_jsonp = {
                name: "jsonp",
                getAgent
              };
              var jsonp_timeline = jsonp_timeline_jsonp;
              function getGenericURL(baseScheme, params, path) {
                var scheme = baseScheme + (params.useTLS ? "s" : "");
                var host = params.useTLS ? params.hostTLS : params.hostNonTLS;
                return scheme + "://" + host + path;
              }
              function getGenericPath(key, queryString) {
                var path = "/app/" + key;
                var query = "?protocol=" + defaults.PROTOCOL + "&client=js&version=" + defaults.VERSION + (queryString ? "&" + queryString : "");
                return path + query;
              }
              var ws = {
                getInitial: function(key, params) {
                  var path = (params.httpPath || "") + getGenericPath(key, "flash=false");
                  return getGenericURL("ws", params, path);
                }
              };
              var http = {
                getInitial: function(key, params) {
                  var path = (params.httpPath || "/pusher") + getGenericPath(key);
                  return getGenericURL("http", params, path);
                }
              };
              var sockjs = {
                getInitial: function(key, params) {
                  return getGenericURL("http", params, params.httpPath || "/pusher");
                },
                getPath: function(key, params) {
                  return getGenericPath(key);
                }
              };
              var callback_registry_CallbackRegistry = (function() {
                function CallbackRegistry() {
                  this._callbacks = {};
                }
                CallbackRegistry.prototype.get = function(name) {
                  return this._callbacks[prefix(name)];
                };
                CallbackRegistry.prototype.add = function(name, callback, context) {
                  var prefixedEventName = prefix(name);
                  this._callbacks[prefixedEventName] = this._callbacks[prefixedEventName] || [];
                  this._callbacks[prefixedEventName].push({
                    fn: callback,
                    context
                  });
                };
                CallbackRegistry.prototype.remove = function(name, callback, context) {
                  if (!name && !callback && !context) {
                    this._callbacks = {};
                    return;
                  }
                  var names = name ? [prefix(name)] : keys(this._callbacks);
                  if (callback || context) {
                    this.removeCallback(names, callback, context);
                  } else {
                    this.removeAllCallbacks(names);
                  }
                };
                CallbackRegistry.prototype.removeCallback = function(names, callback, context) {
                  apply(names, function(name) {
                    this._callbacks[name] = filter(this._callbacks[name] || [], function(binding) {
                      return callback && callback !== binding.fn || context && context !== binding.context;
                    });
                    if (this._callbacks[name].length === 0) {
                      delete this._callbacks[name];
                    }
                  }, this);
                };
                CallbackRegistry.prototype.removeAllCallbacks = function(names) {
                  apply(names, function(name) {
                    delete this._callbacks[name];
                  }, this);
                };
                return CallbackRegistry;
              })();
              var callback_registry = callback_registry_CallbackRegistry;
              function prefix(name) {
                return "_" + name;
              }
              var dispatcher_Dispatcher = (function() {
                function Dispatcher(failThrough) {
                  this.callbacks = new callback_registry();
                  this.global_callbacks = [];
                  this.failThrough = failThrough;
                }
                Dispatcher.prototype.bind = function(eventName, callback, context) {
                  this.callbacks.add(eventName, callback, context);
                  return this;
                };
                Dispatcher.prototype.bind_global = function(callback) {
                  this.global_callbacks.push(callback);
                  return this;
                };
                Dispatcher.prototype.unbind = function(eventName, callback, context) {
                  this.callbacks.remove(eventName, callback, context);
                  return this;
                };
                Dispatcher.prototype.unbind_global = function(callback) {
                  if (!callback) {
                    this.global_callbacks = [];
                    return this;
                  }
                  this.global_callbacks = filter(this.global_callbacks || [], function(c) {
                    return c !== callback;
                  });
                  return this;
                };
                Dispatcher.prototype.unbind_all = function() {
                  this.unbind();
                  this.unbind_global();
                  return this;
                };
                Dispatcher.prototype.emit = function(eventName, data, metadata) {
                  for (var i = 0; i < this.global_callbacks.length; i++) {
                    this.global_callbacks[i](eventName, data);
                  }
                  var callbacks = this.callbacks.get(eventName);
                  var args = [];
                  if (metadata) {
                    args.push(data, metadata);
                  } else if (data) {
                    args.push(data);
                  }
                  if (callbacks && callbacks.length > 0) {
                    for (var i = 0; i < callbacks.length; i++) {
                      callbacks[i].fn.apply(callbacks[i].context || window, args);
                    }
                  } else if (this.failThrough) {
                    this.failThrough(eventName, data);
                  }
                  return this;
                };
                return Dispatcher;
              })();
              var dispatcher = dispatcher_Dispatcher;
              var transport_connection_extends = /* @__PURE__ */ (function() {
                var extendStatics = function(d, b) {
                  extendStatics = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(d2, b2) {
                    d2.__proto__ = b2;
                  } || function(d2, b2) {
                    for (var p in b2) if (b2.hasOwnProperty(p)) d2[p] = b2[p];
                  };
                  return extendStatics(d, b);
                };
                return function(d, b) {
                  extendStatics(d, b);
                  function __() {
                    this.constructor = d;
                  }
                  d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
                };
              })();
              var transport_connection_TransportConnection = (function(_super) {
                transport_connection_extends(TransportConnection, _super);
                function TransportConnection(hooks, name, priority, key, options) {
                  var _this = _super.call(this) || this;
                  _this.initialize = runtime.transportConnectionInitializer;
                  _this.hooks = hooks;
                  _this.name = name;
                  _this.priority = priority;
                  _this.key = key;
                  _this.options = options;
                  _this.state = "new";
                  _this.timeline = options.timeline;
                  _this.activityTimeout = options.activityTimeout;
                  _this.id = _this.timeline.generateUniqueID();
                  return _this;
                }
                TransportConnection.prototype.handlesActivityChecks = function() {
                  return Boolean(this.hooks.handlesActivityChecks);
                };
                TransportConnection.prototype.supportsPing = function() {
                  return Boolean(this.hooks.supportsPing);
                };
                TransportConnection.prototype.connect = function() {
                  var _this = this;
                  if (this.socket || this.state !== "initialized") {
                    return false;
                  }
                  var url = this.hooks.urls.getInitial(this.key, this.options);
                  try {
                    this.socket = this.hooks.getSocket(url, this.options);
                  } catch (e) {
                    util.defer(function() {
                      _this.onError(e);
                      _this.changeState("closed");
                    });
                    return false;
                  }
                  this.bindListeners();
                  logger.debug("Connecting", { transport: this.name, url });
                  this.changeState("connecting");
                  return true;
                };
                TransportConnection.prototype.close = function() {
                  if (this.socket) {
                    this.socket.close();
                    return true;
                  } else {
                    return false;
                  }
                };
                TransportConnection.prototype.send = function(data) {
                  var _this = this;
                  if (this.state === "open") {
                    util.defer(function() {
                      if (_this.socket) {
                        _this.socket.send(data);
                      }
                    });
                    return true;
                  } else {
                    return false;
                  }
                };
                TransportConnection.prototype.ping = function() {
                  if (this.state === "open" && this.supportsPing()) {
                    this.socket.ping();
                  }
                };
                TransportConnection.prototype.onOpen = function() {
                  if (this.hooks.beforeOpen) {
                    this.hooks.beforeOpen(this.socket, this.hooks.urls.getPath(this.key, this.options));
                  }
                  this.changeState("open");
                  this.socket.onopen = void 0;
                };
                TransportConnection.prototype.onError = function(error) {
                  this.emit("error", { type: "WebSocketError", error });
                  this.timeline.error(this.buildTimelineMessage({ error: error.toString() }));
                };
                TransportConnection.prototype.onClose = function(closeEvent) {
                  if (closeEvent) {
                    this.changeState("closed", {
                      code: closeEvent.code,
                      reason: closeEvent.reason,
                      wasClean: closeEvent.wasClean
                    });
                  } else {
                    this.changeState("closed");
                  }
                  this.unbindListeners();
                  this.socket = void 0;
                };
                TransportConnection.prototype.onMessage = function(message) {
                  this.emit("message", message);
                };
                TransportConnection.prototype.onActivity = function() {
                  this.emit("activity");
                };
                TransportConnection.prototype.bindListeners = function() {
                  var _this = this;
                  this.socket.onopen = function() {
                    _this.onOpen();
                  };
                  this.socket.onerror = function(error) {
                    _this.onError(error);
                  };
                  this.socket.onclose = function(closeEvent) {
                    _this.onClose(closeEvent);
                  };
                  this.socket.onmessage = function(message) {
                    _this.onMessage(message);
                  };
                  if (this.supportsPing()) {
                    this.socket.onactivity = function() {
                      _this.onActivity();
                    };
                  }
                };
                TransportConnection.prototype.unbindListeners = function() {
                  if (this.socket) {
                    this.socket.onopen = void 0;
                    this.socket.onerror = void 0;
                    this.socket.onclose = void 0;
                    this.socket.onmessage = void 0;
                    if (this.supportsPing()) {
                      this.socket.onactivity = void 0;
                    }
                  }
                };
                TransportConnection.prototype.changeState = function(state2, params) {
                  this.state = state2;
                  this.timeline.info(this.buildTimelineMessage({
                    state: state2,
                    params
                  }));
                  this.emit(state2, params);
                };
                TransportConnection.prototype.buildTimelineMessage = function(message) {
                  return extend({ cid: this.id }, message);
                };
                return TransportConnection;
              })(dispatcher);
              var transport_connection = transport_connection_TransportConnection;
              var transport_Transport = (function() {
                function Transport(hooks) {
                  this.hooks = hooks;
                }
                Transport.prototype.isSupported = function(environment) {
                  return this.hooks.isSupported(environment);
                };
                Transport.prototype.createConnection = function(name, priority, key, options) {
                  return new transport_connection(this.hooks, name, priority, key, options);
                };
                return Transport;
              })();
              var transports_transport = transport_Transport;
              var WSTransport = new transports_transport({
                urls: ws,
                handlesActivityChecks: false,
                supportsPing: false,
                isInitialized: function() {
                  return Boolean(runtime.getWebSocketAPI());
                },
                isSupported: function() {
                  return Boolean(runtime.getWebSocketAPI());
                },
                getSocket: function(url) {
                  return runtime.createWebSocket(url);
                }
              });
              var httpConfiguration = {
                urls: http,
                handlesActivityChecks: false,
                supportsPing: true,
                isInitialized: function() {
                  return true;
                }
              };
              var streamingConfiguration = extend({
                getSocket: function(url) {
                  return runtime.HTTPFactory.createStreamingSocket(url);
                }
              }, httpConfiguration);
              var pollingConfiguration = extend({
                getSocket: function(url) {
                  return runtime.HTTPFactory.createPollingSocket(url);
                }
              }, httpConfiguration);
              var xhrConfiguration = {
                isSupported: function() {
                  return runtime.isXHRSupported();
                }
              };
              var XHRStreamingTransport = new transports_transport(extend({}, streamingConfiguration, xhrConfiguration));
              var XHRPollingTransport = new transports_transport(extend({}, pollingConfiguration, xhrConfiguration));
              var Transports = {
                ws: WSTransport,
                xhr_streaming: XHRStreamingTransport,
                xhr_polling: XHRPollingTransport
              };
              var transports = Transports;
              var SockJSTransport = new transports_transport({
                file: "sockjs",
                urls: sockjs,
                handlesActivityChecks: true,
                supportsPing: false,
                isSupported: function() {
                  return true;
                },
                isInitialized: function() {
                  return window.SockJS !== void 0;
                },
                getSocket: function(url, options) {
                  return new window.SockJS(url, null, {
                    js_path: Dependencies.getPath("sockjs", {
                      useTLS: options.useTLS
                    }),
                    ignore_null_origin: options.ignoreNullOrigin
                  });
                },
                beforeOpen: function(socket, path) {
                  socket.send(JSON.stringify({
                    path
                  }));
                }
              });
              var xdrConfiguration = {
                isSupported: function(environment) {
                  var yes = runtime.isXDRSupported(environment.useTLS);
                  return yes;
                }
              };
              var XDRStreamingTransport = new transports_transport(extend({}, streamingConfiguration, xdrConfiguration));
              var XDRPollingTransport = new transports_transport(extend({}, pollingConfiguration, xdrConfiguration));
              transports.xdr_streaming = XDRStreamingTransport;
              transports.xdr_polling = XDRPollingTransport;
              transports.sockjs = SockJSTransport;
              var transports_transports = transports;
              var net_info_extends = /* @__PURE__ */ (function() {
                var extendStatics = function(d, b) {
                  extendStatics = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(d2, b2) {
                    d2.__proto__ = b2;
                  } || function(d2, b2) {
                    for (var p in b2) if (b2.hasOwnProperty(p)) d2[p] = b2[p];
                  };
                  return extendStatics(d, b);
                };
                return function(d, b) {
                  extendStatics(d, b);
                  function __() {
                    this.constructor = d;
                  }
                  d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
                };
              })();
              var NetInfo = (function(_super) {
                net_info_extends(NetInfo2, _super);
                function NetInfo2() {
                  var _this = _super.call(this) || this;
                  var self2 = _this;
                  if (window.addEventListener !== void 0) {
                    window.addEventListener("online", function() {
                      self2.emit("online");
                    }, false);
                    window.addEventListener("offline", function() {
                      self2.emit("offline");
                    }, false);
                  }
                  return _this;
                }
                NetInfo2.prototype.isOnline = function() {
                  if (window.navigator.onLine === void 0) {
                    return true;
                  } else {
                    return window.navigator.onLine;
                  }
                };
                return NetInfo2;
              })(dispatcher);
              var net_info_Network = new NetInfo();
              var assistant_to_the_transport_manager_AssistantToTheTransportManager = (function() {
                function AssistantToTheTransportManager(manager, transport, options) {
                  this.manager = manager;
                  this.transport = transport;
                  this.minPingDelay = options.minPingDelay;
                  this.maxPingDelay = options.maxPingDelay;
                  this.pingDelay = void 0;
                }
                AssistantToTheTransportManager.prototype.createConnection = function(name, priority, key, options) {
                  var _this = this;
                  options = extend({}, options, {
                    activityTimeout: this.pingDelay
                  });
                  var connection = this.transport.createConnection(name, priority, key, options);
                  var openTimestamp = null;
                  var onOpen = function() {
                    connection.unbind("open", onOpen);
                    connection.bind("closed", onClosed);
                    openTimestamp = util.now();
                  };
                  var onClosed = function(closeEvent) {
                    connection.unbind("closed", onClosed);
                    if (closeEvent.code === 1002 || closeEvent.code === 1003) {
                      _this.manager.reportDeath();
                    } else if (!closeEvent.wasClean && openTimestamp) {
                      var lifespan = util.now() - openTimestamp;
                      if (lifespan < 2 * _this.maxPingDelay) {
                        _this.manager.reportDeath();
                        _this.pingDelay = Math.max(lifespan / 2, _this.minPingDelay);
                      }
                    }
                  };
                  connection.bind("open", onOpen);
                  return connection;
                };
                AssistantToTheTransportManager.prototype.isSupported = function(environment) {
                  return this.manager.isAlive() && this.transport.isSupported(environment);
                };
                return AssistantToTheTransportManager;
              })();
              var assistant_to_the_transport_manager = assistant_to_the_transport_manager_AssistantToTheTransportManager;
              var Protocol = {
                decodeMessage: function(messageEvent) {
                  try {
                    var messageData = JSON.parse(messageEvent.data);
                    var pusherEventData = messageData.data;
                    if (typeof pusherEventData === "string") {
                      try {
                        pusherEventData = JSON.parse(messageData.data);
                      } catch (e) {
                      }
                    }
                    var pusherEvent = {
                      event: messageData.event,
                      channel: messageData.channel,
                      data: pusherEventData
                    };
                    if (messageData.user_id) {
                      pusherEvent.user_id = messageData.user_id;
                    }
                    return pusherEvent;
                  } catch (e) {
                    throw { type: "MessageParseError", error: e, data: messageEvent.data };
                  }
                },
                encodeMessage: function(event) {
                  return JSON.stringify(event);
                },
                processHandshake: function(messageEvent) {
                  var message = Protocol.decodeMessage(messageEvent);
                  if (message.event === "pusher:connection_established") {
                    if (!message.data.activity_timeout) {
                      throw "No activity timeout specified in handshake";
                    }
                    return {
                      action: "connected",
                      id: message.data.socket_id,
                      activityTimeout: message.data.activity_timeout * 1e3
                    };
                  } else if (message.event === "pusher:error") {
                    return {
                      action: this.getCloseAction(message.data),
                      error: this.getCloseError(message.data)
                    };
                  } else {
                    throw "Invalid handshake";
                  }
                },
                getCloseAction: function(closeEvent) {
                  if (closeEvent.code < 4e3) {
                    if (closeEvent.code >= 1002 && closeEvent.code <= 1004) {
                      return "backoff";
                    } else {
                      return null;
                    }
                  } else if (closeEvent.code === 4e3) {
                    return "tls_only";
                  } else if (closeEvent.code < 4100) {
                    return "refused";
                  } else if (closeEvent.code < 4200) {
                    return "backoff";
                  } else if (closeEvent.code < 4300) {
                    return "retry";
                  } else {
                    return "refused";
                  }
                },
                getCloseError: function(closeEvent) {
                  if (closeEvent.code !== 1e3 && closeEvent.code !== 1001) {
                    return {
                      type: "PusherError",
                      data: {
                        code: closeEvent.code,
                        message: closeEvent.reason || closeEvent.message
                      }
                    };
                  } else {
                    return null;
                  }
                }
              };
              var protocol_protocol = Protocol;
              var connection_extends = /* @__PURE__ */ (function() {
                var extendStatics = function(d, b) {
                  extendStatics = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(d2, b2) {
                    d2.__proto__ = b2;
                  } || function(d2, b2) {
                    for (var p in b2) if (b2.hasOwnProperty(p)) d2[p] = b2[p];
                  };
                  return extendStatics(d, b);
                };
                return function(d, b) {
                  extendStatics(d, b);
                  function __() {
                    this.constructor = d;
                  }
                  d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
                };
              })();
              var connection_Connection = (function(_super) {
                connection_extends(Connection, _super);
                function Connection(id, transport) {
                  var _this = _super.call(this) || this;
                  _this.id = id;
                  _this.transport = transport;
                  _this.activityTimeout = transport.activityTimeout;
                  _this.bindListeners();
                  return _this;
                }
                Connection.prototype.handlesActivityChecks = function() {
                  return this.transport.handlesActivityChecks();
                };
                Connection.prototype.send = function(data) {
                  return this.transport.send(data);
                };
                Connection.prototype.send_event = function(name, data, channel) {
                  var event = { event: name, data };
                  if (channel) {
                    event.channel = channel;
                  }
                  logger.debug("Event sent", event);
                  return this.send(protocol_protocol.encodeMessage(event));
                };
                Connection.prototype.ping = function() {
                  if (this.transport.supportsPing()) {
                    this.transport.ping();
                  } else {
                    this.send_event("pusher:ping", {});
                  }
                };
                Connection.prototype.close = function() {
                  this.transport.close();
                };
                Connection.prototype.bindListeners = function() {
                  var _this = this;
                  var listeners = {
                    message: function(messageEvent) {
                      var pusherEvent;
                      try {
                        pusherEvent = protocol_protocol.decodeMessage(messageEvent);
                      } catch (e) {
                        _this.emit("error", {
                          type: "MessageParseError",
                          error: e,
                          data: messageEvent.data
                        });
                      }
                      if (pusherEvent !== void 0) {
                        logger.debug("Event recd", pusherEvent);
                        switch (pusherEvent.event) {
                          case "pusher:error":
                            _this.emit("error", {
                              type: "PusherError",
                              data: pusherEvent.data
                            });
                            break;
                          case "pusher:ping":
                            _this.emit("ping");
                            break;
                          case "pusher:pong":
                            _this.emit("pong");
                            break;
                        }
                        _this.emit("message", pusherEvent);
                      }
                    },
                    activity: function() {
                      _this.emit("activity");
                    },
                    error: function(error) {
                      _this.emit("error", error);
                    },
                    closed: function(closeEvent) {
                      unbindListeners();
                      if (closeEvent && closeEvent.code) {
                        _this.handleCloseEvent(closeEvent);
                      }
                      _this.transport = null;
                      _this.emit("closed");
                    }
                  };
                  var unbindListeners = function() {
                    objectApply(listeners, function(listener, event) {
                      _this.transport.unbind(event, listener);
                    });
                  };
                  objectApply(listeners, function(listener, event) {
                    _this.transport.bind(event, listener);
                  });
                };
                Connection.prototype.handleCloseEvent = function(closeEvent) {
                  var action = protocol_protocol.getCloseAction(closeEvent);
                  var error = protocol_protocol.getCloseError(closeEvent);
                  if (error) {
                    this.emit("error", error);
                  }
                  if (action) {
                    this.emit(action, { action, error });
                  }
                };
                return Connection;
              })(dispatcher);
              var connection_connection = connection_Connection;
              var handshake_Handshake = (function() {
                function Handshake(transport, callback) {
                  this.transport = transport;
                  this.callback = callback;
                  this.bindListeners();
                }
                Handshake.prototype.close = function() {
                  this.unbindListeners();
                  this.transport.close();
                };
                Handshake.prototype.bindListeners = function() {
                  var _this = this;
                  this.onMessage = function(m) {
                    _this.unbindListeners();
                    var result;
                    try {
                      result = protocol_protocol.processHandshake(m);
                    } catch (e) {
                      _this.finish("error", { error: e });
                      _this.transport.close();
                      return;
                    }
                    if (result.action === "connected") {
                      _this.finish("connected", {
                        connection: new connection_connection(result.id, _this.transport),
                        activityTimeout: result.activityTimeout
                      });
                    } else {
                      _this.finish(result.action, { error: result.error });
                      _this.transport.close();
                    }
                  };
                  this.onClosed = function(closeEvent) {
                    _this.unbindListeners();
                    var action = protocol_protocol.getCloseAction(closeEvent) || "backoff";
                    var error = protocol_protocol.getCloseError(closeEvent);
                    _this.finish(action, { error });
                  };
                  this.transport.bind("message", this.onMessage);
                  this.transport.bind("closed", this.onClosed);
                };
                Handshake.prototype.unbindListeners = function() {
                  this.transport.unbind("message", this.onMessage);
                  this.transport.unbind("closed", this.onClosed);
                };
                Handshake.prototype.finish = function(action, params) {
                  this.callback(extend({ transport: this.transport, action }, params));
                };
                return Handshake;
              })();
              var connection_handshake = handshake_Handshake;
              var timeline_sender_TimelineSender = (function() {
                function TimelineSender(timeline, options) {
                  this.timeline = timeline;
                  this.options = options || {};
                }
                TimelineSender.prototype.send = function(useTLS, callback) {
                  if (this.timeline.isEmpty()) {
                    return;
                  }
                  this.timeline.send(runtime.TimelineTransport.getAgent(this, useTLS), callback);
                };
                return TimelineSender;
              })();
              var timeline_sender = timeline_sender_TimelineSender;
              var channel_extends = /* @__PURE__ */ (function() {
                var extendStatics = function(d, b) {
                  extendStatics = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(d2, b2) {
                    d2.__proto__ = b2;
                  } || function(d2, b2) {
                    for (var p in b2) if (b2.hasOwnProperty(p)) d2[p] = b2[p];
                  };
                  return extendStatics(d, b);
                };
                return function(d, b) {
                  extendStatics(d, b);
                  function __() {
                    this.constructor = d;
                  }
                  d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
                };
              })();
              var channel_Channel = (function(_super) {
                channel_extends(Channel2, _super);
                function Channel2(name, pusher) {
                  var _this = _super.call(this, function(event, data) {
                    logger.debug("No callbacks on " + name + " for " + event);
                  }) || this;
                  _this.name = name;
                  _this.pusher = pusher;
                  _this.subscribed = false;
                  _this.subscriptionPending = false;
                  _this.subscriptionCancelled = false;
                  return _this;
                }
                Channel2.prototype.authorize = function(socketId, callback) {
                  return callback(null, { auth: "" });
                };
                Channel2.prototype.trigger = function(event, data) {
                  if (event.indexOf("client-") !== 0) {
                    throw new BadEventName("Event '" + event + "' does not start with 'client-'");
                  }
                  if (!this.subscribed) {
                    var suffix = url_store.buildLogSuffix("triggeringClientEvents");
                    logger.warn("Client event triggered before channel 'subscription_succeeded' event . " + suffix);
                  }
                  return this.pusher.send_event(event, data, this.name);
                };
                Channel2.prototype.disconnect = function() {
                  this.subscribed = false;
                  this.subscriptionPending = false;
                };
                Channel2.prototype.handleEvent = function(event) {
                  var eventName = event.event;
                  var data = event.data;
                  if (eventName === "pusher_internal:subscription_succeeded") {
                    this.handleSubscriptionSucceededEvent(event);
                  } else if (eventName === "pusher_internal:subscription_count") {
                    this.handleSubscriptionCountEvent(event);
                  } else if (eventName.indexOf("pusher_internal:") !== 0) {
                    var metadata = {};
                    this.emit(eventName, data, metadata);
                  }
                };
                Channel2.prototype.handleSubscriptionSucceededEvent = function(event) {
                  this.subscriptionPending = false;
                  this.subscribed = true;
                  if (this.subscriptionCancelled) {
                    this.pusher.unsubscribe(this.name);
                  } else {
                    this.emit("pusher:subscription_succeeded", event.data);
                  }
                };
                Channel2.prototype.handleSubscriptionCountEvent = function(event) {
                  if (event.data.subscription_count) {
                    this.subscriptionCount = event.data.subscription_count;
                  }
                  this.emit("pusher:subscription_count", event.data);
                };
                Channel2.prototype.subscribe = function() {
                  var _this = this;
                  if (this.subscribed) {
                    return;
                  }
                  this.subscriptionPending = true;
                  this.subscriptionCancelled = false;
                  this.authorize(this.pusher.connection.socket_id, function(error, data) {
                    if (error) {
                      _this.subscriptionPending = false;
                      logger.error(error.toString());
                      _this.emit("pusher:subscription_error", Object.assign({}, {
                        type: "AuthError",
                        error: error.message
                      }, error instanceof HTTPAuthError ? { status: error.status } : {}));
                    } else {
                      _this.pusher.send_event("pusher:subscribe", {
                        auth: data.auth,
                        channel_data: data.channel_data,
                        channel: _this.name
                      });
                    }
                  });
                };
                Channel2.prototype.unsubscribe = function() {
                  this.subscribed = false;
                  this.pusher.send_event("pusher:unsubscribe", {
                    channel: this.name
                  });
                };
                Channel2.prototype.cancelSubscription = function() {
                  this.subscriptionCancelled = true;
                };
                Channel2.prototype.reinstateSubscription = function() {
                  this.subscriptionCancelled = false;
                };
                return Channel2;
              })(dispatcher);
              var channels_channel = channel_Channel;
              var private_channel_extends = /* @__PURE__ */ (function() {
                var extendStatics = function(d, b) {
                  extendStatics = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(d2, b2) {
                    d2.__proto__ = b2;
                  } || function(d2, b2) {
                    for (var p in b2) if (b2.hasOwnProperty(p)) d2[p] = b2[p];
                  };
                  return extendStatics(d, b);
                };
                return function(d, b) {
                  extendStatics(d, b);
                  function __() {
                    this.constructor = d;
                  }
                  d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
                };
              })();
              var PrivateChannel = (function(_super) {
                private_channel_extends(PrivateChannel2, _super);
                function PrivateChannel2() {
                  return _super !== null && _super.apply(this, arguments) || this;
                }
                PrivateChannel2.prototype.authorize = function(socketId, callback) {
                  return this.pusher.config.channelAuthorizer({
                    channelName: this.name,
                    socketId
                  }, callback);
                };
                return PrivateChannel2;
              })(channels_channel);
              var private_channel = PrivateChannel;
              var members_Members = (function() {
                function Members() {
                  this.reset();
                }
                Members.prototype.get = function(id) {
                  if (Object.prototype.hasOwnProperty.call(this.members, id)) {
                    return {
                      id,
                      info: this.members[id]
                    };
                  } else {
                    return null;
                  }
                };
                Members.prototype.each = function(callback) {
                  var _this = this;
                  objectApply(this.members, function(member, id) {
                    callback(_this.get(id));
                  });
                };
                Members.prototype.setMyID = function(id) {
                  this.myID = id;
                };
                Members.prototype.onSubscription = function(subscriptionData) {
                  this.members = subscriptionData.presence.hash;
                  this.count = subscriptionData.presence.count;
                  this.me = this.get(this.myID);
                };
                Members.prototype.addMember = function(memberData) {
                  if (this.get(memberData.user_id) === null) {
                    this.count++;
                  }
                  this.members[memberData.user_id] = memberData.user_info;
                  return this.get(memberData.user_id);
                };
                Members.prototype.removeMember = function(memberData) {
                  var member = this.get(memberData.user_id);
                  if (member) {
                    delete this.members[memberData.user_id];
                    this.count--;
                  }
                  return member;
                };
                Members.prototype.reset = function() {
                  this.members = {};
                  this.count = 0;
                  this.myID = null;
                  this.me = null;
                };
                return Members;
              })();
              var members = members_Members;
              var presence_channel_extends = /* @__PURE__ */ (function() {
                var extendStatics = function(d, b) {
                  extendStatics = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(d2, b2) {
                    d2.__proto__ = b2;
                  } || function(d2, b2) {
                    for (var p in b2) if (b2.hasOwnProperty(p)) d2[p] = b2[p];
                  };
                  return extendStatics(d, b);
                };
                return function(d, b) {
                  extendStatics(d, b);
                  function __() {
                    this.constructor = d;
                  }
                  d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
                };
              })();
              var __awaiter = function(thisArg, _arguments, P, generator) {
                return new (P || (P = Promise))(function(resolve, reject) {
                  function fulfilled(value) {
                    try {
                      step(generator.next(value));
                    } catch (e) {
                      reject(e);
                    }
                  }
                  function rejected(value) {
                    try {
                      step(generator["throw"](value));
                    } catch (e) {
                      reject(e);
                    }
                  }
                  function step(result) {
                    result.done ? resolve(result.value) : new P(function(resolve2) {
                      resolve2(result.value);
                    }).then(fulfilled, rejected);
                  }
                  step((generator = generator.apply(thisArg, _arguments || [])).next());
                });
              };
              var __generator = function(thisArg, body) {
                var _ = { label: 0, sent: function() {
                  if (t[0] & 1) throw t[1];
                  return t[1];
                }, trys: [], ops: [] }, f, y, t, g;
                return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() {
                  return this;
                }), g;
                function verb(n) {
                  return function(v) {
                    return step([n, v]);
                  };
                }
                function step(op) {
                  if (f) throw new TypeError("Generator is already executing.");
                  while (_) try {
                    if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
                    if (y = 0, t) op = [op[0] & 2, t.value];
                    switch (op[0]) {
                      case 0:
                      case 1:
                        t = op;
                        break;
                      case 4:
                        _.label++;
                        return { value: op[1], done: false };
                      case 5:
                        _.label++;
                        y = op[1];
                        op = [0];
                        continue;
                      case 7:
                        op = _.ops.pop();
                        _.trys.pop();
                        continue;
                      default:
                        if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) {
                          _ = 0;
                          continue;
                        }
                        if (op[0] === 3 && (!t || op[1] > t[0] && op[1] < t[3])) {
                          _.label = op[1];
                          break;
                        }
                        if (op[0] === 6 && _.label < t[1]) {
                          _.label = t[1];
                          t = op;
                          break;
                        }
                        if (t && _.label < t[2]) {
                          _.label = t[2];
                          _.ops.push(op);
                          break;
                        }
                        if (t[2]) _.ops.pop();
                        _.trys.pop();
                        continue;
                    }
                    op = body.call(thisArg, _);
                  } catch (e) {
                    op = [6, e];
                    y = 0;
                  } finally {
                    f = t = 0;
                  }
                  if (op[0] & 5) throw op[1];
                  return { value: op[0] ? op[1] : void 0, done: true };
                }
              };
              var presence_channel_PresenceChannel = (function(_super) {
                presence_channel_extends(PresenceChannel, _super);
                function PresenceChannel(name, pusher) {
                  var _this = _super.call(this, name, pusher) || this;
                  _this.members = new members();
                  return _this;
                }
                PresenceChannel.prototype.authorize = function(socketId, callback) {
                  var _this = this;
                  _super.prototype.authorize.call(this, socketId, function(error, authData) {
                    return __awaiter(_this, void 0, void 0, function() {
                      var channelData, suffix;
                      return __generator(this, function(_a) {
                        switch (_a.label) {
                          case 0:
                            if (!!error) return [3, 3];
                            authData = authData;
                            if (!(authData.channel_data != null)) return [3, 1];
                            channelData = JSON.parse(authData.channel_data);
                            this.members.setMyID(channelData.user_id);
                            return [3, 3];
                          case 1:
                            return [4, this.pusher.user.signinDonePromise];
                          case 2:
                            _a.sent();
                            if (this.pusher.user.user_data != null) {
                              this.members.setMyID(this.pusher.user.user_data.id);
                            } else {
                              suffix = url_store.buildLogSuffix("authorizationEndpoint");
                              logger.error("Invalid auth response for channel '" + this.name + "', " + ("expected 'channel_data' field. " + suffix + ", ") + "or the user should be signed in.");
                              callback("Invalid auth response");
                              return [2];
                            }
                            _a.label = 3;
                          case 3:
                            callback(error, authData);
                            return [2];
                        }
                      });
                    });
                  });
                };
                PresenceChannel.prototype.handleEvent = function(event) {
                  var eventName = event.event;
                  if (eventName.indexOf("pusher_internal:") === 0) {
                    this.handleInternalEvent(event);
                  } else {
                    var data = event.data;
                    var metadata = {};
                    if (event.user_id) {
                      metadata.user_id = event.user_id;
                    }
                    this.emit(eventName, data, metadata);
                  }
                };
                PresenceChannel.prototype.handleInternalEvent = function(event) {
                  var eventName = event.event;
                  var data = event.data;
                  switch (eventName) {
                    case "pusher_internal:subscription_succeeded":
                      this.handleSubscriptionSucceededEvent(event);
                      break;
                    case "pusher_internal:subscription_count":
                      this.handleSubscriptionCountEvent(event);
                      break;
                    case "pusher_internal:member_added":
                      var addedMember = this.members.addMember(data);
                      this.emit("pusher:member_added", addedMember);
                      break;
                    case "pusher_internal:member_removed":
                      var removedMember = this.members.removeMember(data);
                      if (removedMember) {
                        this.emit("pusher:member_removed", removedMember);
                      }
                      break;
                  }
                };
                PresenceChannel.prototype.handleSubscriptionSucceededEvent = function(event) {
                  this.subscriptionPending = false;
                  this.subscribed = true;
                  if (this.subscriptionCancelled) {
                    this.pusher.unsubscribe(this.name);
                  } else {
                    this.members.onSubscription(event.data);
                    this.emit("pusher:subscription_succeeded", this.members);
                  }
                };
                PresenceChannel.prototype.disconnect = function() {
                  this.members.reset();
                  _super.prototype.disconnect.call(this);
                };
                return PresenceChannel;
              })(private_channel);
              var presence_channel = presence_channel_PresenceChannel;
              var utf8 = __webpack_require__(1);
              var base64 = __webpack_require__(0);
              var encrypted_channel_extends = /* @__PURE__ */ (function() {
                var extendStatics = function(d, b) {
                  extendStatics = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(d2, b2) {
                    d2.__proto__ = b2;
                  } || function(d2, b2) {
                    for (var p in b2) if (b2.hasOwnProperty(p)) d2[p] = b2[p];
                  };
                  return extendStatics(d, b);
                };
                return function(d, b) {
                  extendStatics(d, b);
                  function __() {
                    this.constructor = d;
                  }
                  d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
                };
              })();
              var encrypted_channel_EncryptedChannel = (function(_super) {
                encrypted_channel_extends(EncryptedChannel, _super);
                function EncryptedChannel(name, pusher, nacl) {
                  var _this = _super.call(this, name, pusher) || this;
                  _this.key = null;
                  _this.nacl = nacl;
                  return _this;
                }
                EncryptedChannel.prototype.authorize = function(socketId, callback) {
                  var _this = this;
                  _super.prototype.authorize.call(this, socketId, function(error, authData) {
                    if (error) {
                      callback(error, authData);
                      return;
                    }
                    var sharedSecret = authData["shared_secret"];
                    if (!sharedSecret) {
                      callback(new Error("No shared_secret key in auth payload for encrypted channel: " + _this.name), null);
                      return;
                    }
                    _this.key = Object(base64["decode"])(sharedSecret);
                    delete authData["shared_secret"];
                    callback(null, authData);
                  });
                };
                EncryptedChannel.prototype.trigger = function(event, data) {
                  throw new UnsupportedFeature("Client events are not currently supported for encrypted channels");
                };
                EncryptedChannel.prototype.handleEvent = function(event) {
                  var eventName = event.event;
                  var data = event.data;
                  if (eventName.indexOf("pusher_internal:") === 0 || eventName.indexOf("pusher:") === 0) {
                    _super.prototype.handleEvent.call(this, event);
                    return;
                  }
                  this.handleEncryptedEvent(eventName, data);
                };
                EncryptedChannel.prototype.handleEncryptedEvent = function(event, data) {
                  var _this = this;
                  if (!this.key) {
                    logger.debug("Received encrypted event before key has been retrieved from the authEndpoint");
                    return;
                  }
                  if (!data.ciphertext || !data.nonce) {
                    logger.error("Unexpected format for encrypted event, expected object with `ciphertext` and `nonce` fields, got: " + data);
                    return;
                  }
                  var cipherText = Object(base64["decode"])(data.ciphertext);
                  if (cipherText.length < this.nacl.secretbox.overheadLength) {
                    logger.error("Expected encrypted event ciphertext length to be " + this.nacl.secretbox.overheadLength + ", got: " + cipherText.length);
                    return;
                  }
                  var nonce = Object(base64["decode"])(data.nonce);
                  if (nonce.length < this.nacl.secretbox.nonceLength) {
                    logger.error("Expected encrypted event nonce length to be " + this.nacl.secretbox.nonceLength + ", got: " + nonce.length);
                    return;
                  }
                  var bytes = this.nacl.secretbox.open(cipherText, nonce, this.key);
                  if (bytes === null) {
                    logger.debug("Failed to decrypt an event, probably because it was encrypted with a different key. Fetching a new key from the authEndpoint...");
                    this.authorize(this.pusher.connection.socket_id, function(error, authData) {
                      if (error) {
                        logger.error("Failed to make a request to the authEndpoint: " + authData + ". Unable to fetch new key, so dropping encrypted event");
                        return;
                      }
                      bytes = _this.nacl.secretbox.open(cipherText, nonce, _this.key);
                      if (bytes === null) {
                        logger.error("Failed to decrypt event with new key. Dropping encrypted event");
                        return;
                      }
                      _this.emit(event, _this.getDataToEmit(bytes));
                      return;
                    });
                    return;
                  }
                  this.emit(event, this.getDataToEmit(bytes));
                };
                EncryptedChannel.prototype.getDataToEmit = function(bytes) {
                  var raw = Object(utf8["decode"])(bytes);
                  try {
                    return JSON.parse(raw);
                  } catch (_a) {
                    return raw;
                  }
                };
                return EncryptedChannel;
              })(private_channel);
              var encrypted_channel = encrypted_channel_EncryptedChannel;
              var connection_manager_extends = /* @__PURE__ */ (function() {
                var extendStatics = function(d, b) {
                  extendStatics = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(d2, b2) {
                    d2.__proto__ = b2;
                  } || function(d2, b2) {
                    for (var p in b2) if (b2.hasOwnProperty(p)) d2[p] = b2[p];
                  };
                  return extendStatics(d, b);
                };
                return function(d, b) {
                  extendStatics(d, b);
                  function __() {
                    this.constructor = d;
                  }
                  d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
                };
              })();
              var connection_manager_ConnectionManager = (function(_super) {
                connection_manager_extends(ConnectionManager, _super);
                function ConnectionManager(key, options) {
                  var _this = _super.call(this) || this;
                  _this.state = "initialized";
                  _this.connection = null;
                  _this.key = key;
                  _this.options = options;
                  _this.timeline = _this.options.timeline;
                  _this.usingTLS = _this.options.useTLS;
                  _this.errorCallbacks = _this.buildErrorCallbacks();
                  _this.connectionCallbacks = _this.buildConnectionCallbacks(_this.errorCallbacks);
                  _this.handshakeCallbacks = _this.buildHandshakeCallbacks(_this.errorCallbacks);
                  var Network = runtime.getNetwork();
                  Network.bind("online", function() {
                    _this.timeline.info({ netinfo: "online" });
                    if (_this.state === "connecting" || _this.state === "unavailable") {
                      _this.retryIn(0);
                    }
                  });
                  Network.bind("offline", function() {
                    _this.timeline.info({ netinfo: "offline" });
                    if (_this.connection) {
                      _this.sendActivityCheck();
                    }
                  });
                  _this.updateStrategy();
                  return _this;
                }
                ConnectionManager.prototype.connect = function() {
                  if (this.connection || this.runner) {
                    return;
                  }
                  if (!this.strategy.isSupported()) {
                    this.updateState("failed");
                    return;
                  }
                  this.updateState("connecting");
                  this.startConnecting();
                  this.setUnavailableTimer();
                };
                ConnectionManager.prototype.send = function(data) {
                  if (this.connection) {
                    return this.connection.send(data);
                  } else {
                    return false;
                  }
                };
                ConnectionManager.prototype.send_event = function(name, data, channel) {
                  if (this.connection) {
                    return this.connection.send_event(name, data, channel);
                  } else {
                    return false;
                  }
                };
                ConnectionManager.prototype.disconnect = function() {
                  this.disconnectInternally();
                  this.updateState("disconnected");
                };
                ConnectionManager.prototype.isUsingTLS = function() {
                  return this.usingTLS;
                };
                ConnectionManager.prototype.startConnecting = function() {
                  var _this = this;
                  var callback = function(error, handshake) {
                    if (error) {
                      _this.runner = _this.strategy.connect(0, callback);
                    } else {
                      if (handshake.action === "error") {
                        _this.emit("error", {
                          type: "HandshakeError",
                          error: handshake.error
                        });
                        _this.timeline.error({ handshakeError: handshake.error });
                      } else {
                        _this.abortConnecting();
                        _this.handshakeCallbacks[handshake.action](handshake);
                      }
                    }
                  };
                  this.runner = this.strategy.connect(0, callback);
                };
                ConnectionManager.prototype.abortConnecting = function() {
                  if (this.runner) {
                    this.runner.abort();
                    this.runner = null;
                  }
                };
                ConnectionManager.prototype.disconnectInternally = function() {
                  this.abortConnecting();
                  this.clearRetryTimer();
                  this.clearUnavailableTimer();
                  if (this.connection) {
                    var connection = this.abandonConnection();
                    connection.close();
                  }
                };
                ConnectionManager.prototype.updateStrategy = function() {
                  this.strategy = this.options.getStrategy({
                    key: this.key,
                    timeline: this.timeline,
                    useTLS: this.usingTLS
                  });
                };
                ConnectionManager.prototype.retryIn = function(delay) {
                  var _this = this;
                  this.timeline.info({ action: "retry", delay });
                  if (delay > 0) {
                    this.emit("connecting_in", Math.round(delay / 1e3));
                  }
                  this.retryTimer = new OneOffTimer(delay || 0, function() {
                    _this.disconnectInternally();
                    _this.connect();
                  });
                };
                ConnectionManager.prototype.clearRetryTimer = function() {
                  if (this.retryTimer) {
                    this.retryTimer.ensureAborted();
                    this.retryTimer = null;
                  }
                };
                ConnectionManager.prototype.setUnavailableTimer = function() {
                  var _this = this;
                  this.unavailableTimer = new OneOffTimer(this.options.unavailableTimeout, function() {
                    _this.updateState("unavailable");
                  });
                };
                ConnectionManager.prototype.clearUnavailableTimer = function() {
                  if (this.unavailableTimer) {
                    this.unavailableTimer.ensureAborted();
                  }
                };
                ConnectionManager.prototype.sendActivityCheck = function() {
                  var _this = this;
                  this.stopActivityCheck();
                  this.connection.ping();
                  this.activityTimer = new OneOffTimer(this.options.pongTimeout, function() {
                    _this.timeline.error({ pong_timed_out: _this.options.pongTimeout });
                    _this.retryIn(0);
                  });
                };
                ConnectionManager.prototype.resetActivityCheck = function() {
                  var _this = this;
                  this.stopActivityCheck();
                  if (this.connection && !this.connection.handlesActivityChecks()) {
                    this.activityTimer = new OneOffTimer(this.activityTimeout, function() {
                      _this.sendActivityCheck();
                    });
                  }
                };
                ConnectionManager.prototype.stopActivityCheck = function() {
                  if (this.activityTimer) {
                    this.activityTimer.ensureAborted();
                  }
                };
                ConnectionManager.prototype.buildConnectionCallbacks = function(errorCallbacks) {
                  var _this = this;
                  return extend({}, errorCallbacks, {
                    message: function(message) {
                      _this.resetActivityCheck();
                      _this.emit("message", message);
                    },
                    ping: function() {
                      _this.send_event("pusher:pong", {});
                    },
                    activity: function() {
                      _this.resetActivityCheck();
                    },
                    error: function(error) {
                      _this.emit("error", error);
                    },
                    closed: function() {
                      _this.abandonConnection();
                      if (_this.shouldRetry()) {
                        _this.retryIn(1e3);
                      }
                    }
                  });
                };
                ConnectionManager.prototype.buildHandshakeCallbacks = function(errorCallbacks) {
                  var _this = this;
                  return extend({}, errorCallbacks, {
                    connected: function(handshake) {
                      _this.activityTimeout = Math.min(_this.options.activityTimeout, handshake.activityTimeout, handshake.connection.activityTimeout || Infinity);
                      _this.clearUnavailableTimer();
                      _this.setConnection(handshake.connection);
                      _this.socket_id = _this.connection.id;
                      _this.updateState("connected", { socket_id: _this.socket_id });
                    }
                  });
                };
                ConnectionManager.prototype.buildErrorCallbacks = function() {
                  var _this = this;
                  var withErrorEmitted = function(callback) {
                    return function(result) {
                      if (result.error) {
                        _this.emit("error", { type: "WebSocketError", error: result.error });
                      }
                      callback(result);
                    };
                  };
                  return {
                    tls_only: withErrorEmitted(function() {
                      _this.usingTLS = true;
                      _this.updateStrategy();
                      _this.retryIn(0);
                    }),
                    refused: withErrorEmitted(function() {
                      _this.disconnect();
                    }),
                    backoff: withErrorEmitted(function() {
                      _this.retryIn(1e3);
                    }),
                    retry: withErrorEmitted(function() {
                      _this.retryIn(0);
                    })
                  };
                };
                ConnectionManager.prototype.setConnection = function(connection) {
                  this.connection = connection;
                  for (var event in this.connectionCallbacks) {
                    this.connection.bind(event, this.connectionCallbacks[event]);
                  }
                  this.resetActivityCheck();
                };
                ConnectionManager.prototype.abandonConnection = function() {
                  if (!this.connection) {
                    return;
                  }
                  this.stopActivityCheck();
                  for (var event in this.connectionCallbacks) {
                    this.connection.unbind(event, this.connectionCallbacks[event]);
                  }
                  var connection = this.connection;
                  this.connection = null;
                  return connection;
                };
                ConnectionManager.prototype.updateState = function(newState, data) {
                  var previousState = this.state;
                  this.state = newState;
                  if (previousState !== newState) {
                    var newStateDescription = newState;
                    if (newStateDescription === "connected") {
                      newStateDescription += " with new socket ID " + data.socket_id;
                    }
                    logger.debug("State changed", previousState + " -> " + newStateDescription);
                    this.timeline.info({ state: newState, params: data });
                    this.emit("state_change", { previous: previousState, current: newState });
                    this.emit(newState, data);
                  }
                };
                ConnectionManager.prototype.shouldRetry = function() {
                  return this.state === "connecting" || this.state === "connected";
                };
                return ConnectionManager;
              })(dispatcher);
              var connection_manager = connection_manager_ConnectionManager;
              var channels_Channels = (function() {
                function Channels() {
                  this.channels = {};
                }
                Channels.prototype.add = function(name, pusher) {
                  if (!this.channels[name]) {
                    this.channels[name] = createChannel(name, pusher);
                  }
                  return this.channels[name];
                };
                Channels.prototype.all = function() {
                  return values(this.channels);
                };
                Channels.prototype.find = function(name) {
                  return this.channels[name];
                };
                Channels.prototype.remove = function(name) {
                  var channel = this.channels[name];
                  delete this.channels[name];
                  return channel;
                };
                Channels.prototype.disconnect = function() {
                  objectApply(this.channels, function(channel) {
                    channel.disconnect();
                  });
                };
                return Channels;
              })();
              var channels = channels_Channels;
              function createChannel(name, pusher) {
                if (name.indexOf("private-encrypted-") === 0) {
                  if (pusher.config.nacl) {
                    return factory.createEncryptedChannel(name, pusher, pusher.config.nacl);
                  }
                  var errMsg = "Tried to subscribe to a private-encrypted- channel but no nacl implementation available";
                  var suffix = url_store.buildLogSuffix("encryptedChannelSupport");
                  throw new UnsupportedFeature(errMsg + ". " + suffix);
                } else if (name.indexOf("private-") === 0) {
                  return factory.createPrivateChannel(name, pusher);
                } else if (name.indexOf("presence-") === 0) {
                  return factory.createPresenceChannel(name, pusher);
                } else if (name.indexOf("#") === 0) {
                  throw new BadChannelName('Cannot create a channel with name "' + name + '".');
                } else {
                  return factory.createChannel(name, pusher);
                }
              }
              var Factory = {
                createChannels: function() {
                  return new channels();
                },
                createConnectionManager: function(key, options) {
                  return new connection_manager(key, options);
                },
                createChannel: function(name, pusher) {
                  return new channels_channel(name, pusher);
                },
                createPrivateChannel: function(name, pusher) {
                  return new private_channel(name, pusher);
                },
                createPresenceChannel: function(name, pusher) {
                  return new presence_channel(name, pusher);
                },
                createEncryptedChannel: function(name, pusher, nacl) {
                  return new encrypted_channel(name, pusher, nacl);
                },
                createTimelineSender: function(timeline, options) {
                  return new timeline_sender(timeline, options);
                },
                createHandshake: function(transport, callback) {
                  return new connection_handshake(transport, callback);
                },
                createAssistantToTheTransportManager: function(manager, transport, options) {
                  return new assistant_to_the_transport_manager(manager, transport, options);
                }
              };
              var factory = Factory;
              var transport_manager_TransportManager = (function() {
                function TransportManager(options) {
                  this.options = options || {};
                  this.livesLeft = this.options.lives || Infinity;
                }
                TransportManager.prototype.getAssistant = function(transport) {
                  return factory.createAssistantToTheTransportManager(this, transport, {
                    minPingDelay: this.options.minPingDelay,
                    maxPingDelay: this.options.maxPingDelay
                  });
                };
                TransportManager.prototype.isAlive = function() {
                  return this.livesLeft > 0;
                };
                TransportManager.prototype.reportDeath = function() {
                  this.livesLeft -= 1;
                };
                return TransportManager;
              })();
              var transport_manager = transport_manager_TransportManager;
              var sequential_strategy_SequentialStrategy = (function() {
                function SequentialStrategy(strategies, options) {
                  this.strategies = strategies;
                  this.loop = Boolean(options.loop);
                  this.failFast = Boolean(options.failFast);
                  this.timeout = options.timeout;
                  this.timeoutLimit = options.timeoutLimit;
                }
                SequentialStrategy.prototype.isSupported = function() {
                  return any(this.strategies, util.method("isSupported"));
                };
                SequentialStrategy.prototype.connect = function(minPriority, callback) {
                  var _this = this;
                  var strategies = this.strategies;
                  var current = 0;
                  var timeout = this.timeout;
                  var runner = null;
                  var tryNextStrategy = function(error, handshake) {
                    if (handshake) {
                      callback(null, handshake);
                    } else {
                      current = current + 1;
                      if (_this.loop) {
                        current = current % strategies.length;
                      }
                      if (current < strategies.length) {
                        if (timeout) {
                          timeout = timeout * 2;
                          if (_this.timeoutLimit) {
                            timeout = Math.min(timeout, _this.timeoutLimit);
                          }
                        }
                        runner = _this.tryStrategy(strategies[current], minPriority, { timeout, failFast: _this.failFast }, tryNextStrategy);
                      } else {
                        callback(true);
                      }
                    }
                  };
                  runner = this.tryStrategy(strategies[current], minPriority, { timeout, failFast: this.failFast }, tryNextStrategy);
                  return {
                    abort: function() {
                      runner.abort();
                    },
                    forceMinPriority: function(p) {
                      minPriority = p;
                      if (runner) {
                        runner.forceMinPriority(p);
                      }
                    }
                  };
                };
                SequentialStrategy.prototype.tryStrategy = function(strategy, minPriority, options, callback) {
                  var timer = null;
                  var runner = null;
                  if (options.timeout > 0) {
                    timer = new OneOffTimer(options.timeout, function() {
                      runner.abort();
                      callback(true);
                    });
                  }
                  runner = strategy.connect(minPriority, function(error, handshake) {
                    if (error && timer && timer.isRunning() && !options.failFast) {
                      return;
                    }
                    if (timer) {
                      timer.ensureAborted();
                    }
                    callback(error, handshake);
                  });
                  return {
                    abort: function() {
                      if (timer) {
                        timer.ensureAborted();
                      }
                      runner.abort();
                    },
                    forceMinPriority: function(p) {
                      runner.forceMinPriority(p);
                    }
                  };
                };
                return SequentialStrategy;
              })();
              var sequential_strategy = sequential_strategy_SequentialStrategy;
              var best_connected_ever_strategy_BestConnectedEverStrategy = (function() {
                function BestConnectedEverStrategy(strategies) {
                  this.strategies = strategies;
                }
                BestConnectedEverStrategy.prototype.isSupported = function() {
                  return any(this.strategies, util.method("isSupported"));
                };
                BestConnectedEverStrategy.prototype.connect = function(minPriority, callback) {
                  return connect(this.strategies, minPriority, function(i, runners) {
                    return function(error, handshake) {
                      runners[i].error = error;
                      if (error) {
                        if (allRunnersFailed(runners)) {
                          callback(true);
                        }
                        return;
                      }
                      apply(runners, function(runner) {
                        runner.forceMinPriority(handshake.transport.priority);
                      });
                      callback(null, handshake);
                    };
                  });
                };
                return BestConnectedEverStrategy;
              })();
              var best_connected_ever_strategy = best_connected_ever_strategy_BestConnectedEverStrategy;
              function connect(strategies, minPriority, callbackBuilder) {
                var runners = map(strategies, function(strategy, i, _, rs) {
                  return strategy.connect(minPriority, callbackBuilder(i, rs));
                });
                return {
                  abort: function() {
                    apply(runners, abortRunner);
                  },
                  forceMinPriority: function(p) {
                    apply(runners, function(runner) {
                      runner.forceMinPriority(p);
                    });
                  }
                };
              }
              function allRunnersFailed(runners) {
                return collections_all(runners, function(runner) {
                  return Boolean(runner.error);
                });
              }
              function abortRunner(runner) {
                if (!runner.error && !runner.aborted) {
                  runner.abort();
                  runner.aborted = true;
                }
              }
              var cached_strategy_CachedStrategy = (function() {
                function CachedStrategy(strategy, transports2, options) {
                  this.strategy = strategy;
                  this.transports = transports2;
                  this.ttl = options.ttl || 1800 * 1e3;
                  this.usingTLS = options.useTLS;
                  this.timeline = options.timeline;
                }
                CachedStrategy.prototype.isSupported = function() {
                  return this.strategy.isSupported();
                };
                CachedStrategy.prototype.connect = function(minPriority, callback) {
                  var usingTLS = this.usingTLS;
                  var info = fetchTransportCache(usingTLS);
                  var strategies = [this.strategy];
                  if (info && info.timestamp + this.ttl >= util.now()) {
                    var transport = this.transports[info.transport];
                    if (transport) {
                      this.timeline.info({
                        cached: true,
                        transport: info.transport,
                        latency: info.latency
                      });
                      strategies.push(new sequential_strategy([transport], {
                        timeout: info.latency * 2 + 1e3,
                        failFast: true
                      }));
                    }
                  }
                  var startTimestamp = util.now();
                  var runner = strategies.pop().connect(minPriority, function cb(error, handshake) {
                    if (error) {
                      flushTransportCache(usingTLS);
                      if (strategies.length > 0) {
                        startTimestamp = util.now();
                        runner = strategies.pop().connect(minPriority, cb);
                      } else {
                        callback(error);
                      }
                    } else {
                      storeTransportCache(usingTLS, handshake.transport.name, util.now() - startTimestamp);
                      callback(null, handshake);
                    }
                  });
                  return {
                    abort: function() {
                      runner.abort();
                    },
                    forceMinPriority: function(p) {
                      minPriority = p;
                      if (runner) {
                        runner.forceMinPriority(p);
                      }
                    }
                  };
                };
                return CachedStrategy;
              })();
              var cached_strategy = cached_strategy_CachedStrategy;
              function getTransportCacheKey(usingTLS) {
                return "pusherTransport" + (usingTLS ? "TLS" : "NonTLS");
              }
              function fetchTransportCache(usingTLS) {
                var storage = runtime.getLocalStorage();
                if (storage) {
                  try {
                    var serializedCache = storage[getTransportCacheKey(usingTLS)];
                    if (serializedCache) {
                      return JSON.parse(serializedCache);
                    }
                  } catch (e) {
                    flushTransportCache(usingTLS);
                  }
                }
                return null;
              }
              function storeTransportCache(usingTLS, transport, latency) {
                var storage = runtime.getLocalStorage();
                if (storage) {
                  try {
                    storage[getTransportCacheKey(usingTLS)] = safeJSONStringify({
                      timestamp: util.now(),
                      transport,
                      latency
                    });
                  } catch (e) {
                  }
                }
              }
              function flushTransportCache(usingTLS) {
                var storage = runtime.getLocalStorage();
                if (storage) {
                  try {
                    delete storage[getTransportCacheKey(usingTLS)];
                  } catch (e) {
                  }
                }
              }
              var delayed_strategy_DelayedStrategy = (function() {
                function DelayedStrategy(strategy, _a) {
                  var number = _a.delay;
                  this.strategy = strategy;
                  this.options = { delay: number };
                }
                DelayedStrategy.prototype.isSupported = function() {
                  return this.strategy.isSupported();
                };
                DelayedStrategy.prototype.connect = function(minPriority, callback) {
                  var strategy = this.strategy;
                  var runner;
                  var timer = new OneOffTimer(this.options.delay, function() {
                    runner = strategy.connect(minPriority, callback);
                  });
                  return {
                    abort: function() {
                      timer.ensureAborted();
                      if (runner) {
                        runner.abort();
                      }
                    },
                    forceMinPriority: function(p) {
                      minPriority = p;
                      if (runner) {
                        runner.forceMinPriority(p);
                      }
                    }
                  };
                };
                return DelayedStrategy;
              })();
              var delayed_strategy = delayed_strategy_DelayedStrategy;
              var IfStrategy = (function() {
                function IfStrategy2(test, trueBranch, falseBranch) {
                  this.test = test;
                  this.trueBranch = trueBranch;
                  this.falseBranch = falseBranch;
                }
                IfStrategy2.prototype.isSupported = function() {
                  var branch = this.test() ? this.trueBranch : this.falseBranch;
                  return branch.isSupported();
                };
                IfStrategy2.prototype.connect = function(minPriority, callback) {
                  var branch = this.test() ? this.trueBranch : this.falseBranch;
                  return branch.connect(minPriority, callback);
                };
                return IfStrategy2;
              })();
              var if_strategy = IfStrategy;
              var FirstConnectedStrategy = (function() {
                function FirstConnectedStrategy2(strategy) {
                  this.strategy = strategy;
                }
                FirstConnectedStrategy2.prototype.isSupported = function() {
                  return this.strategy.isSupported();
                };
                FirstConnectedStrategy2.prototype.connect = function(minPriority, callback) {
                  var runner = this.strategy.connect(minPriority, function(error, handshake) {
                    if (handshake) {
                      runner.abort();
                    }
                    callback(error, handshake);
                  });
                  return runner;
                };
                return FirstConnectedStrategy2;
              })();
              var first_connected_strategy = FirstConnectedStrategy;
              function testSupportsStrategy(strategy) {
                return function() {
                  return strategy.isSupported();
                };
              }
              var getDefaultStrategy = function(config, baseOptions, defineTransport) {
                var definedTransports = {};
                function defineTransportStrategy(name, type, priority, options, manager) {
                  var transport = defineTransport(config, name, type, priority, options, manager);
                  definedTransports[name] = transport;
                  return transport;
                }
                var ws_options = Object.assign({}, baseOptions, {
                  hostNonTLS: config.wsHost + ":" + config.wsPort,
                  hostTLS: config.wsHost + ":" + config.wssPort,
                  httpPath: config.wsPath
                });
                var wss_options = Object.assign({}, ws_options, {
                  useTLS: true
                });
                var sockjs_options = Object.assign({}, baseOptions, {
                  hostNonTLS: config.httpHost + ":" + config.httpPort,
                  hostTLS: config.httpHost + ":" + config.httpsPort,
                  httpPath: config.httpPath
                });
                var timeouts = {
                  loop: true,
                  timeout: 15e3,
                  timeoutLimit: 6e4
                };
                var ws_manager = new transport_manager({
                  lives: 2,
                  minPingDelay: 1e4,
                  maxPingDelay: config.activityTimeout
                });
                var streaming_manager = new transport_manager({
                  lives: 2,
                  minPingDelay: 1e4,
                  maxPingDelay: config.activityTimeout
                });
                var ws_transport = defineTransportStrategy("ws", "ws", 3, ws_options, ws_manager);
                var wss_transport = defineTransportStrategy("wss", "ws", 3, wss_options, ws_manager);
                var sockjs_transport = defineTransportStrategy("sockjs", "sockjs", 1, sockjs_options);
                var xhr_streaming_transport = defineTransportStrategy("xhr_streaming", "xhr_streaming", 1, sockjs_options, streaming_manager);
                var xdr_streaming_transport = defineTransportStrategy("xdr_streaming", "xdr_streaming", 1, sockjs_options, streaming_manager);
                var xhr_polling_transport = defineTransportStrategy("xhr_polling", "xhr_polling", 1, sockjs_options);
                var xdr_polling_transport = defineTransportStrategy("xdr_polling", "xdr_polling", 1, sockjs_options);
                var ws_loop = new sequential_strategy([ws_transport], timeouts);
                var wss_loop = new sequential_strategy([wss_transport], timeouts);
                var sockjs_loop = new sequential_strategy([sockjs_transport], timeouts);
                var streaming_loop = new sequential_strategy([
                  new if_strategy(testSupportsStrategy(xhr_streaming_transport), xhr_streaming_transport, xdr_streaming_transport)
                ], timeouts);
                var polling_loop = new sequential_strategy([
                  new if_strategy(testSupportsStrategy(xhr_polling_transport), xhr_polling_transport, xdr_polling_transport)
                ], timeouts);
                var http_loop = new sequential_strategy([
                  new if_strategy(testSupportsStrategy(streaming_loop), new best_connected_ever_strategy([
                    streaming_loop,
                    new delayed_strategy(polling_loop, { delay: 4e3 })
                  ]), polling_loop)
                ], timeouts);
                var http_fallback_loop = new if_strategy(testSupportsStrategy(http_loop), http_loop, sockjs_loop);
                var wsStrategy;
                if (baseOptions.useTLS) {
                  wsStrategy = new best_connected_ever_strategy([
                    ws_loop,
                    new delayed_strategy(http_fallback_loop, { delay: 2e3 })
                  ]);
                } else {
                  wsStrategy = new best_connected_ever_strategy([
                    ws_loop,
                    new delayed_strategy(wss_loop, { delay: 2e3 }),
                    new delayed_strategy(http_fallback_loop, { delay: 5e3 })
                  ]);
                }
                return new cached_strategy(new first_connected_strategy(new if_strategy(testSupportsStrategy(ws_transport), wsStrategy, http_fallback_loop)), definedTransports, {
                  ttl: 18e5,
                  timeline: baseOptions.timeline,
                  useTLS: baseOptions.useTLS
                });
              };
              var default_strategy = getDefaultStrategy;
              var transport_connection_initializer = (function() {
                var self2 = this;
                self2.timeline.info(self2.buildTimelineMessage({
                  transport: self2.name + (self2.options.useTLS ? "s" : "")
                }));
                if (self2.hooks.isInitialized()) {
                  self2.changeState("initialized");
                } else if (self2.hooks.file) {
                  self2.changeState("initializing");
                  Dependencies.load(self2.hooks.file, { useTLS: self2.options.useTLS }, function(error, callback) {
                    if (self2.hooks.isInitialized()) {
                      self2.changeState("initialized");
                      callback(true);
                    } else {
                      if (error) {
                        self2.onError(error);
                      }
                      self2.onClose();
                      callback(false);
                    }
                  });
                } else {
                  self2.onClose();
                }
              });
              var http_xdomain_request_hooks = {
                getRequest: function(socket) {
                  var xdr = new window.XDomainRequest();
                  xdr.ontimeout = function() {
                    socket.emit("error", new RequestTimedOut());
                    socket.close();
                  };
                  xdr.onerror = function(e) {
                    socket.emit("error", e);
                    socket.close();
                  };
                  xdr.onprogress = function() {
                    if (xdr.responseText && xdr.responseText.length > 0) {
                      socket.onChunk(200, xdr.responseText);
                    }
                  };
                  xdr.onload = function() {
                    if (xdr.responseText && xdr.responseText.length > 0) {
                      socket.onChunk(200, xdr.responseText);
                    }
                    socket.emit("finished", 200);
                    socket.close();
                  };
                  return xdr;
                },
                abortRequest: function(xdr) {
                  xdr.ontimeout = xdr.onerror = xdr.onprogress = xdr.onload = null;
                  xdr.abort();
                }
              };
              var http_xdomain_request = http_xdomain_request_hooks;
              var http_request_extends = /* @__PURE__ */ (function() {
                var extendStatics = function(d, b) {
                  extendStatics = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(d2, b2) {
                    d2.__proto__ = b2;
                  } || function(d2, b2) {
                    for (var p in b2) if (b2.hasOwnProperty(p)) d2[p] = b2[p];
                  };
                  return extendStatics(d, b);
                };
                return function(d, b) {
                  extendStatics(d, b);
                  function __() {
                    this.constructor = d;
                  }
                  d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
                };
              })();
              var MAX_BUFFER_LENGTH = 256 * 1024;
              var http_request_HTTPRequest = (function(_super) {
                http_request_extends(HTTPRequest, _super);
                function HTTPRequest(hooks, method, url) {
                  var _this = _super.call(this) || this;
                  _this.hooks = hooks;
                  _this.method = method;
                  _this.url = url;
                  return _this;
                }
                HTTPRequest.prototype.start = function(payload) {
                  var _this = this;
                  this.position = 0;
                  this.xhr = this.hooks.getRequest(this);
                  this.unloader = function() {
                    _this.close();
                  };
                  runtime.addUnloadListener(this.unloader);
                  this.xhr.open(this.method, this.url, true);
                  if (this.xhr.setRequestHeader) {
                    this.xhr.setRequestHeader("Content-Type", "application/json");
                  }
                  this.xhr.send(payload);
                };
                HTTPRequest.prototype.close = function() {
                  if (this.unloader) {
                    runtime.removeUnloadListener(this.unloader);
                    this.unloader = null;
                  }
                  if (this.xhr) {
                    this.hooks.abortRequest(this.xhr);
                    this.xhr = null;
                  }
                };
                HTTPRequest.prototype.onChunk = function(status, data) {
                  while (true) {
                    var chunk = this.advanceBuffer(data);
                    if (chunk) {
                      this.emit("chunk", { status, data: chunk });
                    } else {
                      break;
                    }
                  }
                  if (this.isBufferTooLong(data)) {
                    this.emit("buffer_too_long");
                  }
                };
                HTTPRequest.prototype.advanceBuffer = function(buffer) {
                  var unreadData = buffer.slice(this.position);
                  var endOfLinePosition = unreadData.indexOf("\n");
                  if (endOfLinePosition !== -1) {
                    this.position += endOfLinePosition + 1;
                    return unreadData.slice(0, endOfLinePosition);
                  } else {
                    return null;
                  }
                };
                HTTPRequest.prototype.isBufferTooLong = function(buffer) {
                  return this.position === buffer.length && buffer.length > MAX_BUFFER_LENGTH;
                };
                return HTTPRequest;
              })(dispatcher);
              var http_request = http_request_HTTPRequest;
              var State;
              (function(State2) {
                State2[State2["CONNECTING"] = 0] = "CONNECTING";
                State2[State2["OPEN"] = 1] = "OPEN";
                State2[State2["CLOSED"] = 3] = "CLOSED";
              })(State || (State = {}));
              var state = State;
              var autoIncrement = 1;
              var http_socket_HTTPSocket = (function() {
                function HTTPSocket(hooks, url) {
                  this.hooks = hooks;
                  this.session = randomNumber(1e3) + "/" + randomString(8);
                  this.location = getLocation(url);
                  this.readyState = state.CONNECTING;
                  this.openStream();
                }
                HTTPSocket.prototype.send = function(payload) {
                  return this.sendRaw(JSON.stringify([payload]));
                };
                HTTPSocket.prototype.ping = function() {
                  this.hooks.sendHeartbeat(this);
                };
                HTTPSocket.prototype.close = function(code, reason) {
                  this.onClose(code, reason, true);
                };
                HTTPSocket.prototype.sendRaw = function(payload) {
                  if (this.readyState === state.OPEN) {
                    try {
                      runtime.createSocketRequest("POST", getUniqueURL(getSendURL(this.location, this.session))).start(payload);
                      return true;
                    } catch (e) {
                      return false;
                    }
                  } else {
                    return false;
                  }
                };
                HTTPSocket.prototype.reconnect = function() {
                  this.closeStream();
                  this.openStream();
                };
                HTTPSocket.prototype.onClose = function(code, reason, wasClean) {
                  this.closeStream();
                  this.readyState = state.CLOSED;
                  if (this.onclose) {
                    this.onclose({
                      code,
                      reason,
                      wasClean
                    });
                  }
                };
                HTTPSocket.prototype.onChunk = function(chunk) {
                  if (chunk.status !== 200) {
                    return;
                  }
                  if (this.readyState === state.OPEN) {
                    this.onActivity();
                  }
                  var payload;
                  var type = chunk.data.slice(0, 1);
                  switch (type) {
                    case "o":
                      payload = JSON.parse(chunk.data.slice(1) || "{}");
                      this.onOpen(payload);
                      break;
                    case "a":
                      payload = JSON.parse(chunk.data.slice(1) || "[]");
                      for (var i = 0; i < payload.length; i++) {
                        this.onEvent(payload[i]);
                      }
                      break;
                    case "m":
                      payload = JSON.parse(chunk.data.slice(1) || "null");
                      this.onEvent(payload);
                      break;
                    case "h":
                      this.hooks.onHeartbeat(this);
                      break;
                    case "c":
                      payload = JSON.parse(chunk.data.slice(1) || "[]");
                      this.onClose(payload[0], payload[1], true);
                      break;
                  }
                };
                HTTPSocket.prototype.onOpen = function(options) {
                  if (this.readyState === state.CONNECTING) {
                    if (options && options.hostname) {
                      this.location.base = replaceHost(this.location.base, options.hostname);
                    }
                    this.readyState = state.OPEN;
                    if (this.onopen) {
                      this.onopen();
                    }
                  } else {
                    this.onClose(1006, "Server lost session", true);
                  }
                };
                HTTPSocket.prototype.onEvent = function(event) {
                  if (this.readyState === state.OPEN && this.onmessage) {
                    this.onmessage({ data: event });
                  }
                };
                HTTPSocket.prototype.onActivity = function() {
                  if (this.onactivity) {
                    this.onactivity();
                  }
                };
                HTTPSocket.prototype.onError = function(error) {
                  if (this.onerror) {
                    this.onerror(error);
                  }
                };
                HTTPSocket.prototype.openStream = function() {
                  var _this = this;
                  this.stream = runtime.createSocketRequest("POST", getUniqueURL(this.hooks.getReceiveURL(this.location, this.session)));
                  this.stream.bind("chunk", function(chunk) {
                    _this.onChunk(chunk);
                  });
                  this.stream.bind("finished", function(status) {
                    _this.hooks.onFinished(_this, status);
                  });
                  this.stream.bind("buffer_too_long", function() {
                    _this.reconnect();
                  });
                  try {
                    this.stream.start();
                  } catch (error) {
                    util.defer(function() {
                      _this.onError(error);
                      _this.onClose(1006, "Could not start streaming", false);
                    });
                  }
                };
                HTTPSocket.prototype.closeStream = function() {
                  if (this.stream) {
                    this.stream.unbind_all();
                    this.stream.close();
                    this.stream = null;
                  }
                };
                return HTTPSocket;
              })();
              function getLocation(url) {
                var parts = /([^\?]*)\/*(\??.*)/.exec(url);
                return {
                  base: parts[1],
                  queryString: parts[2]
                };
              }
              function getSendURL(url, session) {
                return url.base + "/" + session + "/xhr_send";
              }
              function getUniqueURL(url) {
                var separator = url.indexOf("?") === -1 ? "?" : "&";
                return url + separator + "t=" + +/* @__PURE__ */ new Date() + "&n=" + autoIncrement++;
              }
              function replaceHost(url, hostname) {
                var urlParts = /(https?:\/\/)([^\/:]+)((\/|:)?.*)/.exec(url);
                return urlParts[1] + hostname + urlParts[3];
              }
              function randomNumber(max) {
                return Math.floor(Math.random() * max);
              }
              function randomString(length) {
                var result = [];
                for (var i = 0; i < length; i++) {
                  result.push(randomNumber(32).toString(32));
                }
                return result.join("");
              }
              var http_socket = http_socket_HTTPSocket;
              var http_streaming_socket_hooks = {
                getReceiveURL: function(url, session) {
                  return url.base + "/" + session + "/xhr_streaming" + url.queryString;
                },
                onHeartbeat: function(socket) {
                  socket.sendRaw("[]");
                },
                sendHeartbeat: function(socket) {
                  socket.sendRaw("[]");
                },
                onFinished: function(socket, status) {
                  socket.onClose(1006, "Connection interrupted (" + status + ")", false);
                }
              };
              var http_streaming_socket = http_streaming_socket_hooks;
              var http_polling_socket_hooks = {
                getReceiveURL: function(url, session) {
                  return url.base + "/" + session + "/xhr" + url.queryString;
                },
                onHeartbeat: function() {
                },
                sendHeartbeat: function(socket) {
                  socket.sendRaw("[]");
                },
                onFinished: function(socket, status) {
                  if (status === 200) {
                    socket.reconnect();
                  } else {
                    socket.onClose(1006, "Connection interrupted (" + status + ")", false);
                  }
                }
              };
              var http_polling_socket = http_polling_socket_hooks;
              var http_xhr_request_hooks = {
                getRequest: function(socket) {
                  var Constructor = runtime.getXHRAPI();
                  var xhr = new Constructor();
                  xhr.onreadystatechange = xhr.onprogress = function() {
                    switch (xhr.readyState) {
                      case 3:
                        if (xhr.responseText && xhr.responseText.length > 0) {
                          socket.onChunk(xhr.status, xhr.responseText);
                        }
                        break;
                      case 4:
                        if (xhr.responseText && xhr.responseText.length > 0) {
                          socket.onChunk(xhr.status, xhr.responseText);
                        }
                        socket.emit("finished", xhr.status);
                        socket.close();
                        break;
                    }
                  };
                  return xhr;
                },
                abortRequest: function(xhr) {
                  xhr.onreadystatechange = null;
                  xhr.abort();
                }
              };
              var http_xhr_request = http_xhr_request_hooks;
              var HTTP = {
                createStreamingSocket: function(url) {
                  return this.createSocket(http_streaming_socket, url);
                },
                createPollingSocket: function(url) {
                  return this.createSocket(http_polling_socket, url);
                },
                createSocket: function(hooks, url) {
                  return new http_socket(hooks, url);
                },
                createXHR: function(method, url) {
                  return this.createRequest(http_xhr_request, method, url);
                },
                createRequest: function(hooks, method, url) {
                  return new http_request(hooks, method, url);
                }
              };
              var http_http = HTTP;
              http_http.createXDR = function(method, url) {
                return this.createRequest(http_xdomain_request, method, url);
              };
              var web_http_http = http_http;
              var Runtime = {
                nextAuthCallbackID: 1,
                auth_callbacks: {},
                ScriptReceivers,
                DependenciesReceivers,
                getDefaultStrategy: default_strategy,
                Transports: transports_transports,
                transportConnectionInitializer: transport_connection_initializer,
                HTTPFactory: web_http_http,
                TimelineTransport: jsonp_timeline,
                getXHRAPI: function() {
                  return window.XMLHttpRequest;
                },
                getWebSocketAPI: function() {
                  return window.WebSocket || window.MozWebSocket;
                },
                setup: function(PusherClass) {
                  var _this = this;
                  window.Pusher = PusherClass;
                  var initializeOnDocumentBody = function() {
                    _this.onDocumentBody(PusherClass.ready);
                  };
                  if (!window.JSON) {
                    Dependencies.load("json2", {}, initializeOnDocumentBody);
                  } else {
                    initializeOnDocumentBody();
                  }
                },
                getDocument: function() {
                  return document;
                },
                getProtocol: function() {
                  return this.getDocument().location.protocol;
                },
                getAuthorizers: function() {
                  return { ajax: xhr_auth, jsonp: jsonp_auth };
                },
                onDocumentBody: function(callback) {
                  var _this = this;
                  if (document.body) {
                    callback();
                  } else {
                    setTimeout(function() {
                      _this.onDocumentBody(callback);
                    }, 0);
                  }
                },
                createJSONPRequest: function(url, data) {
                  return new jsonp_request(url, data);
                },
                createScriptRequest: function(src) {
                  return new script_request(src);
                },
                getLocalStorage: function() {
                  try {
                    return window.localStorage;
                  } catch (e) {
                    return void 0;
                  }
                },
                createXHR: function() {
                  if (this.getXHRAPI()) {
                    return this.createXMLHttpRequest();
                  } else {
                    return this.createMicrosoftXHR();
                  }
                },
                createXMLHttpRequest: function() {
                  var Constructor = this.getXHRAPI();
                  return new Constructor();
                },
                createMicrosoftXHR: function() {
                  return new ActiveXObject("Microsoft.XMLHTTP");
                },
                getNetwork: function() {
                  return net_info_Network;
                },
                createWebSocket: function(url) {
                  var Constructor = this.getWebSocketAPI();
                  return new Constructor(url);
                },
                createSocketRequest: function(method, url) {
                  if (this.isXHRSupported()) {
                    return this.HTTPFactory.createXHR(method, url);
                  } else if (this.isXDRSupported(url.indexOf("https:") === 0)) {
                    return this.HTTPFactory.createXDR(method, url);
                  } else {
                    throw "Cross-origin HTTP requests are not supported";
                  }
                },
                isXHRSupported: function() {
                  var Constructor = this.getXHRAPI();
                  return Boolean(Constructor) && new Constructor().withCredentials !== void 0;
                },
                isXDRSupported: function(useTLS) {
                  var protocol = useTLS ? "https:" : "http:";
                  var documentProtocol = this.getProtocol();
                  return Boolean(window["XDomainRequest"]) && documentProtocol === protocol;
                },
                addUnloadListener: function(listener) {
                  if (window.addEventListener !== void 0) {
                    window.addEventListener("unload", listener, false);
                  } else if (window.attachEvent !== void 0) {
                    window.attachEvent("onunload", listener);
                  }
                },
                removeUnloadListener: function(listener) {
                  if (window.addEventListener !== void 0) {
                    window.removeEventListener("unload", listener, false);
                  } else if (window.detachEvent !== void 0) {
                    window.detachEvent("onunload", listener);
                  }
                }
              };
              var runtime = Runtime;
              var TimelineLevel;
              (function(TimelineLevel2) {
                TimelineLevel2[TimelineLevel2["ERROR"] = 3] = "ERROR";
                TimelineLevel2[TimelineLevel2["INFO"] = 6] = "INFO";
                TimelineLevel2[TimelineLevel2["DEBUG"] = 7] = "DEBUG";
              })(TimelineLevel || (TimelineLevel = {}));
              var timeline_level = TimelineLevel;
              var timeline_Timeline = (function() {
                function Timeline(key, session, options) {
                  this.key = key;
                  this.session = session;
                  this.events = [];
                  this.options = options || {};
                  this.sent = 0;
                  this.uniqueID = 0;
                }
                Timeline.prototype.log = function(level, event) {
                  if (level <= this.options.level) {
                    this.events.push(extend({}, event, { timestamp: util.now() }));
                    if (this.options.limit && this.events.length > this.options.limit) {
                      this.events.shift();
                    }
                  }
                };
                Timeline.prototype.error = function(event) {
                  this.log(timeline_level.ERROR, event);
                };
                Timeline.prototype.info = function(event) {
                  this.log(timeline_level.INFO, event);
                };
                Timeline.prototype.debug = function(event) {
                  this.log(timeline_level.DEBUG, event);
                };
                Timeline.prototype.isEmpty = function() {
                  return this.events.length === 0;
                };
                Timeline.prototype.send = function(sendfn, callback) {
                  var _this = this;
                  var data = extend({
                    session: this.session,
                    bundle: this.sent + 1,
                    key: this.key,
                    lib: "js",
                    version: this.options.version,
                    cluster: this.options.cluster,
                    features: this.options.features,
                    timeline: this.events
                  }, this.options.params);
                  this.events = [];
                  sendfn(data, function(error, result) {
                    if (!error) {
                      _this.sent++;
                    }
                    if (callback) {
                      callback(error, result);
                    }
                  });
                  return true;
                };
                Timeline.prototype.generateUniqueID = function() {
                  this.uniqueID++;
                  return this.uniqueID;
                };
                return Timeline;
              })();
              var timeline_timeline = timeline_Timeline;
              var transport_strategy_TransportStrategy = (function() {
                function TransportStrategy(name, priority, transport, options) {
                  this.name = name;
                  this.priority = priority;
                  this.transport = transport;
                  this.options = options || {};
                }
                TransportStrategy.prototype.isSupported = function() {
                  return this.transport.isSupported({
                    useTLS: this.options.useTLS
                  });
                };
                TransportStrategy.prototype.connect = function(minPriority, callback) {
                  var _this = this;
                  if (!this.isSupported()) {
                    return failAttempt(new UnsupportedStrategy(), callback);
                  } else if (this.priority < minPriority) {
                    return failAttempt(new TransportPriorityTooLow(), callback);
                  }
                  var connected = false;
                  var transport = this.transport.createConnection(this.name, this.priority, this.options.key, this.options);
                  var handshake = null;
                  var onInitialized = function() {
                    transport.unbind("initialized", onInitialized);
                    transport.connect();
                  };
                  var onOpen = function() {
                    handshake = factory.createHandshake(transport, function(result) {
                      connected = true;
                      unbindListeners();
                      callback(null, result);
                    });
                  };
                  var onError = function(error) {
                    unbindListeners();
                    callback(error);
                  };
                  var onClosed = function() {
                    unbindListeners();
                    var serializedTransport;
                    serializedTransport = safeJSONStringify(transport);
                    callback(new TransportClosed(serializedTransport));
                  };
                  var unbindListeners = function() {
                    transport.unbind("initialized", onInitialized);
                    transport.unbind("open", onOpen);
                    transport.unbind("error", onError);
                    transport.unbind("closed", onClosed);
                  };
                  transport.bind("initialized", onInitialized);
                  transport.bind("open", onOpen);
                  transport.bind("error", onError);
                  transport.bind("closed", onClosed);
                  transport.initialize();
                  return {
                    abort: function() {
                      if (connected) {
                        return;
                      }
                      unbindListeners();
                      if (handshake) {
                        handshake.close();
                      } else {
                        transport.close();
                      }
                    },
                    forceMinPriority: function(p) {
                      if (connected) {
                        return;
                      }
                      if (_this.priority < p) {
                        if (handshake) {
                          handshake.close();
                        } else {
                          transport.close();
                        }
                      }
                    }
                  };
                };
                return TransportStrategy;
              })();
              var transport_strategy = transport_strategy_TransportStrategy;
              function failAttempt(error, callback) {
                util.defer(function() {
                  callback(error);
                });
                return {
                  abort: function() {
                  },
                  forceMinPriority: function() {
                  }
                };
              }
              var strategy_builder_Transports = runtime.Transports;
              var strategy_builder_defineTransport = function(config, name, type, priority, options, manager) {
                var transportClass = strategy_builder_Transports[type];
                if (!transportClass) {
                  throw new UnsupportedTransport(type);
                }
                var enabled = (!config.enabledTransports || arrayIndexOf(config.enabledTransports, name) !== -1) && (!config.disabledTransports || arrayIndexOf(config.disabledTransports, name) === -1);
                var transport;
                if (enabled) {
                  options = Object.assign({ ignoreNullOrigin: config.ignoreNullOrigin }, options);
                  transport = new transport_strategy(name, priority, manager ? manager.getAssistant(transportClass) : transportClass, options);
                } else {
                  transport = strategy_builder_UnsupportedStrategy;
                }
                return transport;
              };
              var strategy_builder_UnsupportedStrategy = {
                isSupported: function() {
                  return false;
                },
                connect: function(_, callback) {
                  var deferred = util.defer(function() {
                    callback(new UnsupportedStrategy());
                  });
                  return {
                    abort: function() {
                      deferred.ensureAborted();
                    },
                    forceMinPriority: function() {
                    }
                  };
                }
              };
              var composeChannelQuery = function(params, authOptions) {
                var query = "socket_id=" + encodeURIComponent(params.socketId);
                for (var i in authOptions.params) {
                  query += "&" + encodeURIComponent(i) + "=" + encodeURIComponent(authOptions.params[i]);
                }
                return query;
              };
              var UserAuthenticator = function(authOptions) {
                if (typeof runtime.getAuthorizers()[authOptions.transport] === "undefined") {
                  throw "'" + authOptions.transport + "' is not a recognized auth transport";
                }
                return function(params, callback) {
                  var query = composeChannelQuery(params, authOptions);
                  runtime.getAuthorizers()[authOptions.transport](runtime, query, authOptions, AuthRequestType.UserAuthentication, callback);
                };
              };
              var user_authenticator = UserAuthenticator;
              var channel_authorizer_composeChannelQuery = function(params, authOptions) {
                var query = "socket_id=" + encodeURIComponent(params.socketId);
                query += "&channel_name=" + encodeURIComponent(params.channelName);
                for (var i in authOptions.params) {
                  query += "&" + encodeURIComponent(i) + "=" + encodeURIComponent(authOptions.params[i]);
                }
                return query;
              };
              var ChannelAuthorizer = function(authOptions) {
                if (typeof runtime.getAuthorizers()[authOptions.transport] === "undefined") {
                  throw "'" + authOptions.transport + "' is not a recognized auth transport";
                }
                return function(params, callback) {
                  var query = channel_authorizer_composeChannelQuery(params, authOptions);
                  runtime.getAuthorizers()[authOptions.transport](runtime, query, authOptions, AuthRequestType.ChannelAuthorization, callback);
                };
              };
              var channel_authorizer = ChannelAuthorizer;
              var ChannelAuthorizerProxy = function(pusher, authOptions, channelAuthorizerGenerator) {
                var deprecatedAuthorizerOptions = {
                  authTransport: authOptions.transport,
                  authEndpoint: authOptions.endpoint,
                  auth: {
                    params: authOptions.params,
                    headers: authOptions.headers
                  }
                };
                return function(params, callback) {
                  var channel = pusher.channel(params.channelName);
                  var channelAuthorizer = channelAuthorizerGenerator(channel, deprecatedAuthorizerOptions);
                  channelAuthorizer.authorize(params.socketId, callback);
                };
              };
              var __assign = function() {
                __assign = Object.assign || function(t) {
                  for (var s, i = 1, n = arguments.length; i < n; i++) {
                    s = arguments[i];
                    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                      t[p] = s[p];
                  }
                  return t;
                };
                return __assign.apply(this, arguments);
              };
              function getConfig(opts, pusher) {
                var config = {
                  activityTimeout: opts.activityTimeout || defaults.activityTimeout,
                  cluster: opts.cluster || defaults.cluster,
                  httpPath: opts.httpPath || defaults.httpPath,
                  httpPort: opts.httpPort || defaults.httpPort,
                  httpsPort: opts.httpsPort || defaults.httpsPort,
                  pongTimeout: opts.pongTimeout || defaults.pongTimeout,
                  statsHost: opts.statsHost || defaults.stats_host,
                  unavailableTimeout: opts.unavailableTimeout || defaults.unavailableTimeout,
                  wsPath: opts.wsPath || defaults.wsPath,
                  wsPort: opts.wsPort || defaults.wsPort,
                  wssPort: opts.wssPort || defaults.wssPort,
                  enableStats: getEnableStatsConfig(opts),
                  httpHost: getHttpHost(opts),
                  useTLS: shouldUseTLS(opts),
                  wsHost: getWebsocketHost(opts),
                  userAuthenticator: buildUserAuthenticator(opts),
                  channelAuthorizer: buildChannelAuthorizer(opts, pusher)
                };
                if ("disabledTransports" in opts)
                  config.disabledTransports = opts.disabledTransports;
                if ("enabledTransports" in opts)
                  config.enabledTransports = opts.enabledTransports;
                if ("ignoreNullOrigin" in opts)
                  config.ignoreNullOrigin = opts.ignoreNullOrigin;
                if ("timelineParams" in opts)
                  config.timelineParams = opts.timelineParams;
                if ("nacl" in opts) {
                  config.nacl = opts.nacl;
                }
                return config;
              }
              function getHttpHost(opts) {
                if (opts.httpHost) {
                  return opts.httpHost;
                }
                if (opts.cluster) {
                  return "sockjs-" + opts.cluster + ".pusher.com";
                }
                return defaults.httpHost;
              }
              function getWebsocketHost(opts) {
                if (opts.wsHost) {
                  return opts.wsHost;
                }
                if (opts.cluster) {
                  return getWebsocketHostFromCluster(opts.cluster);
                }
                return getWebsocketHostFromCluster(defaults.cluster);
              }
              function getWebsocketHostFromCluster(cluster) {
                return "ws-" + cluster + ".pusher.com";
              }
              function shouldUseTLS(opts) {
                if (runtime.getProtocol() === "https:") {
                  return true;
                } else if (opts.forceTLS === false) {
                  return false;
                }
                return true;
              }
              function getEnableStatsConfig(opts) {
                if ("enableStats" in opts) {
                  return opts.enableStats;
                }
                if ("disableStats" in opts) {
                  return !opts.disableStats;
                }
                return false;
              }
              function buildUserAuthenticator(opts) {
                var userAuthentication = __assign({}, defaults.userAuthentication, opts.userAuthentication);
                if ("customHandler" in userAuthentication && userAuthentication["customHandler"] != null) {
                  return userAuthentication["customHandler"];
                }
                return user_authenticator(userAuthentication);
              }
              function buildChannelAuth(opts, pusher) {
                var channelAuthorization;
                if ("channelAuthorization" in opts) {
                  channelAuthorization = __assign({}, defaults.channelAuthorization, opts.channelAuthorization);
                } else {
                  channelAuthorization = {
                    transport: opts.authTransport || defaults.authTransport,
                    endpoint: opts.authEndpoint || defaults.authEndpoint
                  };
                  if ("auth" in opts) {
                    if ("params" in opts.auth)
                      channelAuthorization.params = opts.auth.params;
                    if ("headers" in opts.auth)
                      channelAuthorization.headers = opts.auth.headers;
                  }
                  if ("authorizer" in opts)
                    channelAuthorization.customHandler = ChannelAuthorizerProxy(pusher, channelAuthorization, opts.authorizer);
                }
                return channelAuthorization;
              }
              function buildChannelAuthorizer(opts, pusher) {
                var channelAuthorization = buildChannelAuth(opts, pusher);
                if ("customHandler" in channelAuthorization && channelAuthorization["customHandler"] != null) {
                  return channelAuthorization["customHandler"];
                }
                return channel_authorizer(channelAuthorization);
              }
              function flatPromise() {
                var resolve, reject;
                var promise = new Promise(function(res, rej) {
                  resolve = res;
                  reject = rej;
                });
                return { promise, resolve, reject };
              }
              var flat_promise = flatPromise;
              var user_extends = /* @__PURE__ */ (function() {
                var extendStatics = function(d, b) {
                  extendStatics = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(d2, b2) {
                    d2.__proto__ = b2;
                  } || function(d2, b2) {
                    for (var p in b2) if (b2.hasOwnProperty(p)) d2[p] = b2[p];
                  };
                  return extendStatics(d, b);
                };
                return function(d, b) {
                  extendStatics(d, b);
                  function __() {
                    this.constructor = d;
                  }
                  d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
                };
              })();
              var user_UserFacade = (function(_super) {
                user_extends(UserFacade, _super);
                function UserFacade(pusher) {
                  var _this = _super.call(this, function(eventName, data) {
                    logger.debug("No callbacks on user for " + eventName);
                  }) || this;
                  _this.signin_requested = false;
                  _this.user_data = null;
                  _this.serverToUserChannel = null;
                  _this.signinDonePromise = null;
                  _this._signinDoneResolve = null;
                  _this._onAuthorize = function(err, authData) {
                    if (err) {
                      logger.warn("Error during signin: " + err);
                      _this._cleanup();
                      return;
                    }
                    _this.pusher.send_event("pusher:signin", {
                      auth: authData.auth,
                      user_data: authData.user_data
                    });
                  };
                  _this.pusher = pusher;
                  _this.pusher.connection.bind("state_change", function(_a) {
                    var previous = _a.previous, current = _a.current;
                    if (previous !== "connected" && current === "connected") {
                      _this._signin();
                    }
                    if (previous === "connected" && current !== "connected") {
                      _this._cleanup();
                      _this._newSigninPromiseIfNeeded();
                    }
                  });
                  _this.pusher.connection.bind("message", function(event) {
                    var eventName = event.event;
                    if (eventName === "pusher:signin_success") {
                      _this._onSigninSuccess(event.data);
                    }
                    if (_this.serverToUserChannel && _this.serverToUserChannel.name === event.channel) {
                      _this.serverToUserChannel.handleEvent(event);
                    }
                  });
                  return _this;
                }
                UserFacade.prototype.signin = function() {
                  if (this.signin_requested) {
                    return;
                  }
                  this.signin_requested = true;
                  this._signin();
                };
                UserFacade.prototype._signin = function() {
                  if (!this.signin_requested) {
                    return;
                  }
                  this._newSigninPromiseIfNeeded();
                  if (this.pusher.connection.state !== "connected") {
                    return;
                  }
                  this.pusher.config.userAuthenticator({
                    socketId: this.pusher.connection.socket_id
                  }, this._onAuthorize);
                };
                UserFacade.prototype._onSigninSuccess = function(data) {
                  try {
                    this.user_data = JSON.parse(data.user_data);
                  } catch (e) {
                    logger.error("Failed parsing user data after signin: " + data.user_data);
                    this._cleanup();
                    return;
                  }
                  if (typeof this.user_data.id !== "string" || this.user_data.id === "") {
                    logger.error("user_data doesn't contain an id. user_data: " + this.user_data);
                    this._cleanup();
                    return;
                  }
                  this._signinDoneResolve();
                  this._subscribeChannels();
                };
                UserFacade.prototype._subscribeChannels = function() {
                  var _this = this;
                  var ensure_subscribed = function(channel) {
                    if (channel.subscriptionPending && channel.subscriptionCancelled) {
                      channel.reinstateSubscription();
                    } else if (!channel.subscriptionPending && _this.pusher.connection.state === "connected") {
                      channel.subscribe();
                    }
                  };
                  this.serverToUserChannel = new channels_channel("#server-to-user-" + this.user_data.id, this.pusher);
                  this.serverToUserChannel.bind_global(function(eventName, data) {
                    if (eventName.indexOf("pusher_internal:") === 0 || eventName.indexOf("pusher:") === 0) {
                      return;
                    }
                    _this.emit(eventName, data);
                  });
                  ensure_subscribed(this.serverToUserChannel);
                };
                UserFacade.prototype._cleanup = function() {
                  this.user_data = null;
                  if (this.serverToUserChannel) {
                    this.serverToUserChannel.unbind_all();
                    this.serverToUserChannel.disconnect();
                    this.serverToUserChannel = null;
                  }
                  if (this.signin_requested) {
                    this._signinDoneResolve();
                  }
                };
                UserFacade.prototype._newSigninPromiseIfNeeded = function() {
                  if (!this.signin_requested) {
                    return;
                  }
                  if (this.signinDonePromise && !this.signinDonePromise.done) {
                    return;
                  }
                  var _a = flat_promise(), promise = _a.promise, resolve = _a.resolve, _ = _a.reject;
                  promise.done = false;
                  var setDone = function() {
                    promise.done = true;
                  };
                  promise.then(setDone)["catch"](setDone);
                  this.signinDonePromise = promise;
                  this._signinDoneResolve = resolve;
                };
                return UserFacade;
              })(dispatcher);
              var user = user_UserFacade;
              var pusher_Pusher = (function() {
                function Pusher2(app_key, options) {
                  var _this = this;
                  checkAppKey(app_key);
                  options = options || {};
                  if (!options.cluster && !(options.wsHost || options.httpHost)) {
                    var suffix = url_store.buildLogSuffix("javascriptQuickStart");
                    logger.warn("You should always specify a cluster when connecting. " + suffix);
                  }
                  if ("disableStats" in options) {
                    logger.warn("The disableStats option is deprecated in favor of enableStats");
                  }
                  this.key = app_key;
                  this.config = getConfig(options, this);
                  this.channels = factory.createChannels();
                  this.global_emitter = new dispatcher();
                  this.sessionID = Math.floor(Math.random() * 1e9);
                  this.timeline = new timeline_timeline(this.key, this.sessionID, {
                    cluster: this.config.cluster,
                    features: Pusher2.getClientFeatures(),
                    params: this.config.timelineParams || {},
                    limit: 50,
                    level: timeline_level.INFO,
                    version: defaults.VERSION
                  });
                  if (this.config.enableStats) {
                    this.timelineSender = factory.createTimelineSender(this.timeline, {
                      host: this.config.statsHost,
                      path: "/timeline/v2/" + runtime.TimelineTransport.name
                    });
                  }
                  var getStrategy = function(options2) {
                    return runtime.getDefaultStrategy(_this.config, options2, strategy_builder_defineTransport);
                  };
                  this.connection = factory.createConnectionManager(this.key, {
                    getStrategy,
                    timeline: this.timeline,
                    activityTimeout: this.config.activityTimeout,
                    pongTimeout: this.config.pongTimeout,
                    unavailableTimeout: this.config.unavailableTimeout,
                    useTLS: Boolean(this.config.useTLS)
                  });
                  this.connection.bind("connected", function() {
                    _this.subscribeAll();
                    if (_this.timelineSender) {
                      _this.timelineSender.send(_this.connection.isUsingTLS());
                    }
                  });
                  this.connection.bind("message", function(event) {
                    var eventName = event.event;
                    var internal = eventName.indexOf("pusher_internal:") === 0;
                    if (event.channel) {
                      var channel = _this.channel(event.channel);
                      if (channel) {
                        channel.handleEvent(event);
                      }
                    }
                    if (!internal) {
                      _this.global_emitter.emit(event.event, event.data);
                    }
                  });
                  this.connection.bind("connecting", function() {
                    _this.channels.disconnect();
                  });
                  this.connection.bind("disconnected", function() {
                    _this.channels.disconnect();
                  });
                  this.connection.bind("error", function(err) {
                    logger.warn(err);
                  });
                  Pusher2.instances.push(this);
                  this.timeline.info({ instances: Pusher2.instances.length });
                  this.user = new user(this);
                  if (Pusher2.isReady) {
                    this.connect();
                  }
                }
                Pusher2.ready = function() {
                  Pusher2.isReady = true;
                  for (var i = 0, l2 = Pusher2.instances.length; i < l2; i++) {
                    Pusher2.instances[i].connect();
                  }
                };
                Pusher2.getClientFeatures = function() {
                  return keys(filterObject({ ws: runtime.Transports.ws }, function(t) {
                    return t.isSupported({});
                  }));
                };
                Pusher2.prototype.channel = function(name) {
                  return this.channels.find(name);
                };
                Pusher2.prototype.allChannels = function() {
                  return this.channels.all();
                };
                Pusher2.prototype.connect = function() {
                  this.connection.connect();
                  if (this.timelineSender) {
                    if (!this.timelineSenderTimer) {
                      var usingTLS = this.connection.isUsingTLS();
                      var timelineSender = this.timelineSender;
                      this.timelineSenderTimer = new PeriodicTimer(6e4, function() {
                        timelineSender.send(usingTLS);
                      });
                    }
                  }
                };
                Pusher2.prototype.disconnect = function() {
                  this.connection.disconnect();
                  if (this.timelineSenderTimer) {
                    this.timelineSenderTimer.ensureAborted();
                    this.timelineSenderTimer = null;
                  }
                };
                Pusher2.prototype.bind = function(event_name, callback, context) {
                  this.global_emitter.bind(event_name, callback, context);
                  return this;
                };
                Pusher2.prototype.unbind = function(event_name, callback, context) {
                  this.global_emitter.unbind(event_name, callback, context);
                  return this;
                };
                Pusher2.prototype.bind_global = function(callback) {
                  this.global_emitter.bind_global(callback);
                  return this;
                };
                Pusher2.prototype.unbind_global = function(callback) {
                  this.global_emitter.unbind_global(callback);
                  return this;
                };
                Pusher2.prototype.unbind_all = function(callback) {
                  this.global_emitter.unbind_all();
                  return this;
                };
                Pusher2.prototype.subscribeAll = function() {
                  var channelName;
                  for (channelName in this.channels.channels) {
                    if (this.channels.channels.hasOwnProperty(channelName)) {
                      this.subscribe(channelName);
                    }
                  }
                };
                Pusher2.prototype.subscribe = function(channel_name) {
                  var channel = this.channels.add(channel_name, this);
                  if (channel.subscriptionPending && channel.subscriptionCancelled) {
                    channel.reinstateSubscription();
                  } else if (!channel.subscriptionPending && this.connection.state === "connected") {
                    channel.subscribe();
                  }
                  return channel;
                };
                Pusher2.prototype.unsubscribe = function(channel_name) {
                  var channel = this.channels.find(channel_name);
                  if (channel && channel.subscriptionPending) {
                    channel.cancelSubscription();
                  } else {
                    channel = this.channels.remove(channel_name);
                    if (channel && channel.subscribed) {
                      channel.unsubscribe();
                    }
                  }
                };
                Pusher2.prototype.send_event = function(event_name, data, channel) {
                  return this.connection.send_event(event_name, data, channel);
                };
                Pusher2.prototype.shouldUseTLS = function() {
                  return this.config.useTLS;
                };
                Pusher2.prototype.signin = function() {
                  this.user.signin();
                };
                Pusher2.instances = [];
                Pusher2.isReady = false;
                Pusher2.logToConsole = false;
                Pusher2.Runtime = runtime;
                Pusher2.ScriptReceivers = runtime.ScriptReceivers;
                Pusher2.DependenciesReceivers = runtime.DependenciesReceivers;
                Pusher2.auth_callbacks = runtime.auth_callbacks;
                return Pusher2;
              })();
              var core_pusher = __webpack_exports__["default"] = pusher_Pusher;
              function checkAppKey(key) {
                if (key === null || key === void 0) {
                  throw "You must pass your app key when you instantiate Pusher.";
                }
              }
              runtime.setup(pusher_Pusher);
            })
            /******/
          ])
        );
      });
    }
  });

  // node_modules/laravel-echo/dist/echo.js
  function _typeof(obj) {
    "@babel/helpers - typeof";
    return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(obj2) {
      return typeof obj2;
    } : function(obj2) {
      return obj2 && "function" == typeof Symbol && obj2.constructor === Symbol && obj2 !== Symbol.prototype ? "symbol" : typeof obj2;
    }, _typeof(obj);
  }
  function _classCallCheck(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError("Cannot call a class as a function");
    }
  }
  function _defineProperties(target, props) {
    for (var i = 0; i < props.length; i++) {
      var descriptor = props[i];
      descriptor.enumerable = descriptor.enumerable || false;
      descriptor.configurable = true;
      if ("value" in descriptor) descriptor.writable = true;
      Object.defineProperty(target, descriptor.key, descriptor);
    }
  }
  function _createClass(Constructor, protoProps, staticProps) {
    if (protoProps) _defineProperties(Constructor.prototype, protoProps);
    if (staticProps) _defineProperties(Constructor, staticProps);
    Object.defineProperty(Constructor, "prototype", {
      writable: false
    });
    return Constructor;
  }
  function _extends() {
    _extends = Object.assign || function(target) {
      for (var i = 1; i < arguments.length; i++) {
        var source = arguments[i];
        for (var key in source) {
          if (Object.prototype.hasOwnProperty.call(source, key)) {
            target[key] = source[key];
          }
        }
      }
      return target;
    };
    return _extends.apply(this, arguments);
  }
  function _inherits(subClass, superClass) {
    if (typeof superClass !== "function" && superClass !== null) {
      throw new TypeError("Super expression must either be null or a function");
    }
    subClass.prototype = Object.create(superClass && superClass.prototype, {
      constructor: {
        value: subClass,
        writable: true,
        configurable: true
      }
    });
    Object.defineProperty(subClass, "prototype", {
      writable: false
    });
    if (superClass) _setPrototypeOf(subClass, superClass);
  }
  function _getPrototypeOf(o) {
    _getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf : function _getPrototypeOf2(o2) {
      return o2.__proto__ || Object.getPrototypeOf(o2);
    };
    return _getPrototypeOf(o);
  }
  function _setPrototypeOf(o, p) {
    _setPrototypeOf = Object.setPrototypeOf || function _setPrototypeOf2(o2, p2) {
      o2.__proto__ = p2;
      return o2;
    };
    return _setPrototypeOf(o, p);
  }
  function _isNativeReflectConstruct() {
    if (typeof Reflect === "undefined" || !Reflect.construct) return false;
    if (Reflect.construct.sham) return false;
    if (typeof Proxy === "function") return true;
    try {
      Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function() {
      }));
      return true;
    } catch (e) {
      return false;
    }
  }
  function _assertThisInitialized(self2) {
    if (self2 === void 0) {
      throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
    }
    return self2;
  }
  function _possibleConstructorReturn(self2, call) {
    if (call && (typeof call === "object" || typeof call === "function")) {
      return call;
    } else if (call !== void 0) {
      throw new TypeError("Derived constructors may only return object or undefined");
    }
    return _assertThisInitialized(self2);
  }
  function _createSuper(Derived) {
    var hasNativeReflectConstruct = _isNativeReflectConstruct();
    return function _createSuperInternal() {
      var Super = _getPrototypeOf(Derived), result;
      if (hasNativeReflectConstruct) {
        var NewTarget = _getPrototypeOf(this).constructor;
        result = Reflect.construct(Super, arguments, NewTarget);
      } else {
        result = Super.apply(this, arguments);
      }
      return _possibleConstructorReturn(this, result);
    };
  }
  var Channel = /* @__PURE__ */ (function() {
    function Channel2() {
      _classCallCheck(this, Channel2);
    }
    _createClass(Channel2, [{
      key: "listenForWhisper",
      value: (
        /**
         * Listen for a whisper event on the channel instance.
         */
        function listenForWhisper(event, callback) {
          return this.listen(".client-" + event, callback);
        }
      )
      /**
       * Listen for an event on the channel instance.
       */
    }, {
      key: "notification",
      value: function notification(callback) {
        return this.listen(".Illuminate\\Notifications\\Events\\BroadcastNotificationCreated", callback);
      }
      /**
       * Stop listening for a whisper event on the channel instance.
       */
    }, {
      key: "stopListeningForWhisper",
      value: function stopListeningForWhisper(event, callback) {
        return this.stopListening(".client-" + event, callback);
      }
    }]);
    return Channel2;
  })();
  var EventFormatter = /* @__PURE__ */ (function() {
    function EventFormatter2(namespace) {
      _classCallCheck(this, EventFormatter2);
      this.setNamespace(namespace);
    }
    _createClass(EventFormatter2, [{
      key: "format",
      value: function format(event) {
        if (event.charAt(0) === "." || event.charAt(0) === "\\") {
          return event.substr(1);
        } else if (this.namespace) {
          event = this.namespace + "." + event;
        }
        return event.replace(/\./g, "\\");
      }
      /**
       * Set the event namespace.
       */
    }, {
      key: "setNamespace",
      value: function setNamespace(value) {
        this.namespace = value;
      }
    }]);
    return EventFormatter2;
  })();
  var PusherChannel = /* @__PURE__ */ (function(_Channel) {
    _inherits(PusherChannel2, _Channel);
    var _super = _createSuper(PusherChannel2);
    function PusherChannel2(pusher, name, options) {
      var _this;
      _classCallCheck(this, PusherChannel2);
      _this = _super.call(this);
      _this.name = name;
      _this.pusher = pusher;
      _this.options = options;
      _this.eventFormatter = new EventFormatter(_this.options.namespace);
      _this.subscribe();
      return _this;
    }
    _createClass(PusherChannel2, [{
      key: "subscribe",
      value: function subscribe() {
        this.subscription = this.pusher.subscribe(this.name);
      }
      /**
       * Unsubscribe from a Pusher channel.
       */
    }, {
      key: "unsubscribe",
      value: function unsubscribe() {
        this.pusher.unsubscribe(this.name);
      }
      /**
       * Listen for an event on the channel instance.
       */
    }, {
      key: "listen",
      value: function listen(event, callback) {
        this.on(this.eventFormatter.format(event), callback);
        return this;
      }
      /**
       * Listen for all events on the channel instance.
       */
    }, {
      key: "listenToAll",
      value: function listenToAll(callback) {
        var _this2 = this;
        this.subscription.bind_global(function(event, data) {
          if (event.startsWith("pusher:")) {
            return;
          }
          var namespace = _this2.options.namespace.replace(/\./g, "\\");
          var formattedEvent = event.startsWith(namespace) ? event.substring(namespace.length + 1) : "." + event;
          callback(formattedEvent, data);
        });
        return this;
      }
      /**
       * Stop listening for an event on the channel instance.
       */
    }, {
      key: "stopListening",
      value: function stopListening(event, callback) {
        if (callback) {
          this.subscription.unbind(this.eventFormatter.format(event), callback);
        } else {
          this.subscription.unbind(this.eventFormatter.format(event));
        }
        return this;
      }
      /**
       * Stop listening for all events on the channel instance.
       */
    }, {
      key: "stopListeningToAll",
      value: function stopListeningToAll(callback) {
        if (callback) {
          this.subscription.unbind_global(callback);
        } else {
          this.subscription.unbind_global();
        }
        return this;
      }
      /**
       * Register a callback to be called anytime a subscription succeeds.
       */
    }, {
      key: "subscribed",
      value: function subscribed(callback) {
        this.on("pusher:subscription_succeeded", function() {
          callback();
        });
        return this;
      }
      /**
       * Register a callback to be called anytime a subscription error occurs.
       */
    }, {
      key: "error",
      value: function error(callback) {
        this.on("pusher:subscription_error", function(status) {
          callback(status);
        });
        return this;
      }
      /**
       * Bind a channel to an event.
       */
    }, {
      key: "on",
      value: function on(event, callback) {
        this.subscription.bind(event, callback);
        return this;
      }
    }]);
    return PusherChannel2;
  })(Channel);
  var PusherPrivateChannel = /* @__PURE__ */ (function(_PusherChannel) {
    _inherits(PusherPrivateChannel2, _PusherChannel);
    var _super = _createSuper(PusherPrivateChannel2);
    function PusherPrivateChannel2() {
      _classCallCheck(this, PusherPrivateChannel2);
      return _super.apply(this, arguments);
    }
    _createClass(PusherPrivateChannel2, [{
      key: "whisper",
      value: (
        /**
         * Trigger client event on the channel.
         */
        function whisper(eventName, data) {
          this.pusher.channels.channels[this.name].trigger("client-".concat(eventName), data);
          return this;
        }
      )
    }]);
    return PusherPrivateChannel2;
  })(PusherChannel);
  var PusherEncryptedPrivateChannel = /* @__PURE__ */ (function(_PusherChannel) {
    _inherits(PusherEncryptedPrivateChannel2, _PusherChannel);
    var _super = _createSuper(PusherEncryptedPrivateChannel2);
    function PusherEncryptedPrivateChannel2() {
      _classCallCheck(this, PusherEncryptedPrivateChannel2);
      return _super.apply(this, arguments);
    }
    _createClass(PusherEncryptedPrivateChannel2, [{
      key: "whisper",
      value: (
        /**
         * Trigger client event on the channel.
         */
        function whisper(eventName, data) {
          this.pusher.channels.channels[this.name].trigger("client-".concat(eventName), data);
          return this;
        }
      )
    }]);
    return PusherEncryptedPrivateChannel2;
  })(PusherChannel);
  var PusherPresenceChannel = /* @__PURE__ */ (function(_PusherChannel) {
    _inherits(PusherPresenceChannel2, _PusherChannel);
    var _super = _createSuper(PusherPresenceChannel2);
    function PusherPresenceChannel2() {
      _classCallCheck(this, PusherPresenceChannel2);
      return _super.apply(this, arguments);
    }
    _createClass(PusherPresenceChannel2, [{
      key: "here",
      value: (
        /**
         * Register a callback to be called anytime the member list changes.
         */
        function here(callback) {
          this.on("pusher:subscription_succeeded", function(data) {
            callback(Object.keys(data.members).map(function(k) {
              return data.members[k];
            }));
          });
          return this;
        }
      )
      /**
       * Listen for someone joining the channel.
       */
    }, {
      key: "joining",
      value: function joining(callback) {
        this.on("pusher:member_added", function(member) {
          callback(member.info);
        });
        return this;
      }
      /**
       * Listen for someone leaving the channel.
       */
    }, {
      key: "leaving",
      value: function leaving(callback) {
        this.on("pusher:member_removed", function(member) {
          callback(member.info);
        });
        return this;
      }
      /**
       * Trigger client event on the channel.
       */
    }, {
      key: "whisper",
      value: function whisper(eventName, data) {
        this.pusher.channels.channels[this.name].trigger("client-".concat(eventName), data);
        return this;
      }
    }]);
    return PusherPresenceChannel2;
  })(PusherChannel);
  var SocketIoChannel = /* @__PURE__ */ (function(_Channel) {
    _inherits(SocketIoChannel2, _Channel);
    var _super = _createSuper(SocketIoChannel2);
    function SocketIoChannel2(socket, name, options) {
      var _this;
      _classCallCheck(this, SocketIoChannel2);
      _this = _super.call(this);
      _this.events = {};
      _this.listeners = {};
      _this.name = name;
      _this.socket = socket;
      _this.options = options;
      _this.eventFormatter = new EventFormatter(_this.options.namespace);
      _this.subscribe();
      return _this;
    }
    _createClass(SocketIoChannel2, [{
      key: "subscribe",
      value: function subscribe() {
        this.socket.emit("subscribe", {
          channel: this.name,
          auth: this.options.auth || {}
        });
      }
      /**
       * Unsubscribe from channel and ubind event callbacks.
       */
    }, {
      key: "unsubscribe",
      value: function unsubscribe() {
        this.unbind();
        this.socket.emit("unsubscribe", {
          channel: this.name,
          auth: this.options.auth || {}
        });
      }
      /**
       * Listen for an event on the channel instance.
       */
    }, {
      key: "listen",
      value: function listen(event, callback) {
        this.on(this.eventFormatter.format(event), callback);
        return this;
      }
      /**
       * Stop listening for an event on the channel instance.
       */
    }, {
      key: "stopListening",
      value: function stopListening(event, callback) {
        this.unbindEvent(this.eventFormatter.format(event), callback);
        return this;
      }
      /**
       * Register a callback to be called anytime a subscription succeeds.
       */
    }, {
      key: "subscribed",
      value: function subscribed(callback) {
        this.on("connect", function(socket) {
          callback(socket);
        });
        return this;
      }
      /**
       * Register a callback to be called anytime an error occurs.
       */
    }, {
      key: "error",
      value: function error(callback) {
        return this;
      }
      /**
       * Bind the channel's socket to an event and store the callback.
       */
    }, {
      key: "on",
      value: function on(event, callback) {
        var _this2 = this;
        this.listeners[event] = this.listeners[event] || [];
        if (!this.events[event]) {
          this.events[event] = function(channel, data) {
            if (_this2.name === channel && _this2.listeners[event]) {
              _this2.listeners[event].forEach(function(cb) {
                return cb(data);
              });
            }
          };
          this.socket.on(event, this.events[event]);
        }
        this.listeners[event].push(callback);
        return this;
      }
      /**
       * Unbind the channel's socket from all stored event callbacks.
       */
    }, {
      key: "unbind",
      value: function unbind() {
        var _this3 = this;
        Object.keys(this.events).forEach(function(event) {
          _this3.unbindEvent(event);
        });
      }
      /**
       * Unbind the listeners for the given event.
       */
    }, {
      key: "unbindEvent",
      value: function unbindEvent(event, callback) {
        this.listeners[event] = this.listeners[event] || [];
        if (callback) {
          this.listeners[event] = this.listeners[event].filter(function(cb) {
            return cb !== callback;
          });
        }
        if (!callback || this.listeners[event].length === 0) {
          if (this.events[event]) {
            this.socket.removeListener(event, this.events[event]);
            delete this.events[event];
          }
          delete this.listeners[event];
        }
      }
    }]);
    return SocketIoChannel2;
  })(Channel);
  var SocketIoPrivateChannel = /* @__PURE__ */ (function(_SocketIoChannel) {
    _inherits(SocketIoPrivateChannel2, _SocketIoChannel);
    var _super = _createSuper(SocketIoPrivateChannel2);
    function SocketIoPrivateChannel2() {
      _classCallCheck(this, SocketIoPrivateChannel2);
      return _super.apply(this, arguments);
    }
    _createClass(SocketIoPrivateChannel2, [{
      key: "whisper",
      value: (
        /**
         * Trigger client event on the channel.
         */
        function whisper(eventName, data) {
          this.socket.emit("client event", {
            channel: this.name,
            event: "client-".concat(eventName),
            data
          });
          return this;
        }
      )
    }]);
    return SocketIoPrivateChannel2;
  })(SocketIoChannel);
  var SocketIoPresenceChannel = /* @__PURE__ */ (function(_SocketIoPrivateChann) {
    _inherits(SocketIoPresenceChannel2, _SocketIoPrivateChann);
    var _super = _createSuper(SocketIoPresenceChannel2);
    function SocketIoPresenceChannel2() {
      _classCallCheck(this, SocketIoPresenceChannel2);
      return _super.apply(this, arguments);
    }
    _createClass(SocketIoPresenceChannel2, [{
      key: "here",
      value: (
        /**
         * Register a callback to be called anytime the member list changes.
         */
        function here(callback) {
          this.on("presence:subscribed", function(members) {
            callback(members.map(function(m) {
              return m.user_info;
            }));
          });
          return this;
        }
      )
      /**
       * Listen for someone joining the channel.
       */
    }, {
      key: "joining",
      value: function joining(callback) {
        this.on("presence:joining", function(member) {
          return callback(member.user_info);
        });
        return this;
      }
      /**
       * Listen for someone leaving the channel.
       */
    }, {
      key: "leaving",
      value: function leaving(callback) {
        this.on("presence:leaving", function(member) {
          return callback(member.user_info);
        });
        return this;
      }
    }]);
    return SocketIoPresenceChannel2;
  })(SocketIoPrivateChannel);
  var NullChannel = /* @__PURE__ */ (function(_Channel) {
    _inherits(NullChannel2, _Channel);
    var _super = _createSuper(NullChannel2);
    function NullChannel2() {
      _classCallCheck(this, NullChannel2);
      return _super.apply(this, arguments);
    }
    _createClass(NullChannel2, [{
      key: "subscribe",
      value: (
        /**
         * Subscribe to a channel.
         */
        function subscribe() {
        }
      )
      /**
       * Unsubscribe from a channel.
       */
    }, {
      key: "unsubscribe",
      value: function unsubscribe() {
      }
      /**
       * Listen for an event on the channel instance.
       */
    }, {
      key: "listen",
      value: function listen(event, callback) {
        return this;
      }
      /**
       * Stop listening for an event on the channel instance.
       */
    }, {
      key: "stopListening",
      value: function stopListening(event, callback) {
        return this;
      }
      /**
       * Register a callback to be called anytime a subscription succeeds.
       */
    }, {
      key: "subscribed",
      value: function subscribed(callback) {
        return this;
      }
      /**
       * Register a callback to be called anytime an error occurs.
       */
    }, {
      key: "error",
      value: function error(callback) {
        return this;
      }
      /**
       * Bind a channel to an event.
       */
    }, {
      key: "on",
      value: function on(event, callback) {
        return this;
      }
    }]);
    return NullChannel2;
  })(Channel);
  var NullPrivateChannel = /* @__PURE__ */ (function(_NullChannel) {
    _inherits(NullPrivateChannel2, _NullChannel);
    var _super = _createSuper(NullPrivateChannel2);
    function NullPrivateChannel2() {
      _classCallCheck(this, NullPrivateChannel2);
      return _super.apply(this, arguments);
    }
    _createClass(NullPrivateChannel2, [{
      key: "whisper",
      value: (
        /**
         * Trigger client event on the channel.
         */
        function whisper(eventName, data) {
          return this;
        }
      )
    }]);
    return NullPrivateChannel2;
  })(NullChannel);
  var NullPresenceChannel = /* @__PURE__ */ (function(_NullChannel) {
    _inherits(NullPresenceChannel2, _NullChannel);
    var _super = _createSuper(NullPresenceChannel2);
    function NullPresenceChannel2() {
      _classCallCheck(this, NullPresenceChannel2);
      return _super.apply(this, arguments);
    }
    _createClass(NullPresenceChannel2, [{
      key: "here",
      value: (
        /**
         * Register a callback to be called anytime the member list changes.
         */
        function here(callback) {
          return this;
        }
      )
      /**
       * Listen for someone joining the channel.
       */
    }, {
      key: "joining",
      value: function joining(callback) {
        return this;
      }
      /**
       * Listen for someone leaving the channel.
       */
    }, {
      key: "leaving",
      value: function leaving(callback) {
        return this;
      }
      /**
       * Trigger client event on the channel.
       */
    }, {
      key: "whisper",
      value: function whisper(eventName, data) {
        return this;
      }
    }]);
    return NullPresenceChannel2;
  })(NullChannel);
  var Connector = /* @__PURE__ */ (function() {
    function Connector2(options) {
      _classCallCheck(this, Connector2);
      this._defaultOptions = {
        auth: {
          headers: {}
        },
        authEndpoint: "/broadcasting/auth",
        userAuthentication: {
          endpoint: "/broadcasting/user-auth",
          headers: {}
        },
        broadcaster: "pusher",
        csrfToken: null,
        bearerToken: null,
        host: null,
        key: null,
        namespace: "App.Events"
      };
      this.setOptions(options);
      this.connect();
    }
    _createClass(Connector2, [{
      key: "setOptions",
      value: function setOptions(options) {
        this.options = _extends(this._defaultOptions, options);
        var token = this.csrfToken();
        if (token) {
          this.options.auth.headers["X-CSRF-TOKEN"] = token;
          this.options.userAuthentication.headers["X-CSRF-TOKEN"] = token;
        }
        token = this.options.bearerToken;
        if (token) {
          this.options.auth.headers["Authorization"] = "Bearer " + token;
          this.options.userAuthentication.headers["Authorization"] = "Bearer " + token;
        }
        return options;
      }
      /**
       * Extract the CSRF token from the page.
       */
    }, {
      key: "csrfToken",
      value: function csrfToken() {
        var selector;
        if (typeof window !== "undefined" && window["Laravel"] && window["Laravel"].csrfToken) {
          return window["Laravel"].csrfToken;
        } else if (this.options.csrfToken) {
          return this.options.csrfToken;
        } else if (typeof document !== "undefined" && typeof document.querySelector === "function" && (selector = document.querySelector('meta[name="csrf-token"]'))) {
          return selector.getAttribute("content");
        }
        return null;
      }
    }]);
    return Connector2;
  })();
  var PusherConnector = /* @__PURE__ */ (function(_Connector) {
    _inherits(PusherConnector2, _Connector);
    var _super = _createSuper(PusherConnector2);
    function PusherConnector2() {
      var _this;
      _classCallCheck(this, PusherConnector2);
      _this = _super.apply(this, arguments);
      _this.channels = {};
      return _this;
    }
    _createClass(PusherConnector2, [{
      key: "connect",
      value: function connect() {
        if (typeof this.options.client !== "undefined") {
          this.pusher = this.options.client;
        } else {
          this.pusher = new Pusher(this.options.key, this.options);
        }
      }
      /**
       * Sign in the user via Pusher user authentication (https://pusher.com/docs/channels/using_channels/user-authentication/).
       */
    }, {
      key: "signin",
      value: function signin() {
        this.pusher.signin();
      }
      /**
       * Listen for an event on a channel instance.
       */
    }, {
      key: "listen",
      value: function listen(name, event, callback) {
        return this.channel(name).listen(event, callback);
      }
      /**
       * Get a channel instance by name.
       */
    }, {
      key: "channel",
      value: function channel(name) {
        if (!this.channels[name]) {
          this.channels[name] = new PusherChannel(this.pusher, name, this.options);
        }
        return this.channels[name];
      }
      /**
       * Get a private channel instance by name.
       */
    }, {
      key: "privateChannel",
      value: function privateChannel(name) {
        if (!this.channels["private-" + name]) {
          this.channels["private-" + name] = new PusherPrivateChannel(this.pusher, "private-" + name, this.options);
        }
        return this.channels["private-" + name];
      }
      /**
       * Get a private encrypted channel instance by name.
       */
    }, {
      key: "encryptedPrivateChannel",
      value: function encryptedPrivateChannel(name) {
        if (!this.channels["private-encrypted-" + name]) {
          this.channels["private-encrypted-" + name] = new PusherEncryptedPrivateChannel(this.pusher, "private-encrypted-" + name, this.options);
        }
        return this.channels["private-encrypted-" + name];
      }
      /**
       * Get a presence channel instance by name.
       */
    }, {
      key: "presenceChannel",
      value: function presenceChannel(name) {
        if (!this.channels["presence-" + name]) {
          this.channels["presence-" + name] = new PusherPresenceChannel(this.pusher, "presence-" + name, this.options);
        }
        return this.channels["presence-" + name];
      }
      /**
       * Leave the given channel, as well as its private and presence variants.
       */
    }, {
      key: "leave",
      value: function leave(name) {
        var _this2 = this;
        var channels = [name, "private-" + name, "private-encrypted-" + name, "presence-" + name];
        channels.forEach(function(name2, index) {
          _this2.leaveChannel(name2);
        });
      }
      /**
       * Leave the given channel.
       */
    }, {
      key: "leaveChannel",
      value: function leaveChannel(name) {
        if (this.channels[name]) {
          this.channels[name].unsubscribe();
          delete this.channels[name];
        }
      }
      /**
       * Get the socket ID for the connection.
       */
    }, {
      key: "socketId",
      value: function socketId() {
        return this.pusher.connection.socket_id;
      }
      /**
       * Disconnect Pusher connection.
       */
    }, {
      key: "disconnect",
      value: function disconnect() {
        this.pusher.disconnect();
      }
    }]);
    return PusherConnector2;
  })(Connector);
  var SocketIoConnector = /* @__PURE__ */ (function(_Connector) {
    _inherits(SocketIoConnector2, _Connector);
    var _super = _createSuper(SocketIoConnector2);
    function SocketIoConnector2() {
      var _this;
      _classCallCheck(this, SocketIoConnector2);
      _this = _super.apply(this, arguments);
      _this.channels = {};
      return _this;
    }
    _createClass(SocketIoConnector2, [{
      key: "connect",
      value: function connect() {
        var _this2 = this;
        var io2 = this.getSocketIO();
        this.socket = io2(this.options.host, this.options);
        this.socket.on("reconnect", function() {
          Object.values(_this2.channels).forEach(function(channel) {
            channel.subscribe();
          });
        });
        return this.socket;
      }
      /**
       * Get socket.io module from global scope or options.
       */
    }, {
      key: "getSocketIO",
      value: function getSocketIO() {
        if (typeof this.options.client !== "undefined") {
          return this.options.client;
        }
        if (typeof io !== "undefined") {
          return io;
        }
        throw new Error("Socket.io client not found. Should be globally available or passed via options.client");
      }
      /**
       * Listen for an event on a channel instance.
       */
    }, {
      key: "listen",
      value: function listen(name, event, callback) {
        return this.channel(name).listen(event, callback);
      }
      /**
       * Get a channel instance by name.
       */
    }, {
      key: "channel",
      value: function channel(name) {
        if (!this.channels[name]) {
          this.channels[name] = new SocketIoChannel(this.socket, name, this.options);
        }
        return this.channels[name];
      }
      /**
       * Get a private channel instance by name.
       */
    }, {
      key: "privateChannel",
      value: function privateChannel(name) {
        if (!this.channels["private-" + name]) {
          this.channels["private-" + name] = new SocketIoPrivateChannel(this.socket, "private-" + name, this.options);
        }
        return this.channels["private-" + name];
      }
      /**
       * Get a presence channel instance by name.
       */
    }, {
      key: "presenceChannel",
      value: function presenceChannel(name) {
        if (!this.channels["presence-" + name]) {
          this.channels["presence-" + name] = new SocketIoPresenceChannel(this.socket, "presence-" + name, this.options);
        }
        return this.channels["presence-" + name];
      }
      /**
       * Leave the given channel, as well as its private and presence variants.
       */
    }, {
      key: "leave",
      value: function leave(name) {
        var _this3 = this;
        var channels = [name, "private-" + name, "presence-" + name];
        channels.forEach(function(name2) {
          _this3.leaveChannel(name2);
        });
      }
      /**
       * Leave the given channel.
       */
    }, {
      key: "leaveChannel",
      value: function leaveChannel(name) {
        if (this.channels[name]) {
          this.channels[name].unsubscribe();
          delete this.channels[name];
        }
      }
      /**
       * Get the socket ID for the connection.
       */
    }, {
      key: "socketId",
      value: function socketId() {
        return this.socket.id;
      }
      /**
       * Disconnect Socketio connection.
       */
    }, {
      key: "disconnect",
      value: function disconnect() {
        this.socket.disconnect();
      }
    }]);
    return SocketIoConnector2;
  })(Connector);
  var NullConnector = /* @__PURE__ */ (function(_Connector) {
    _inherits(NullConnector2, _Connector);
    var _super = _createSuper(NullConnector2);
    function NullConnector2() {
      var _this;
      _classCallCheck(this, NullConnector2);
      _this = _super.apply(this, arguments);
      _this.channels = {};
      return _this;
    }
    _createClass(NullConnector2, [{
      key: "connect",
      value: function connect() {
      }
      /**
       * Listen for an event on a channel instance.
       */
    }, {
      key: "listen",
      value: function listen(name, event, callback) {
        return new NullChannel();
      }
      /**
       * Get a channel instance by name.
       */
    }, {
      key: "channel",
      value: function channel(name) {
        return new NullChannel();
      }
      /**
       * Get a private channel instance by name.
       */
    }, {
      key: "privateChannel",
      value: function privateChannel(name) {
        return new NullPrivateChannel();
      }
      /**
       * Get a presence channel instance by name.
       */
    }, {
      key: "presenceChannel",
      value: function presenceChannel(name) {
        return new NullPresenceChannel();
      }
      /**
       * Leave the given channel, as well as its private and presence variants.
       */
    }, {
      key: "leave",
      value: function leave(name) {
      }
      /**
       * Leave the given channel.
       */
    }, {
      key: "leaveChannel",
      value: function leaveChannel(name) {
      }
      /**
       * Get the socket ID for the connection.
       */
    }, {
      key: "socketId",
      value: function socketId() {
        return "fake-socket-id";
      }
      /**
       * Disconnect the connection.
       */
    }, {
      key: "disconnect",
      value: function disconnect() {
      }
    }]);
    return NullConnector2;
  })(Connector);
  var Echo = /* @__PURE__ */ (function() {
    function Echo2(options) {
      _classCallCheck(this, Echo2);
      this.options = options;
      this.connect();
      if (!this.options.withoutInterceptors) {
        this.registerInterceptors();
      }
    }
    _createClass(Echo2, [{
      key: "channel",
      value: function channel(_channel) {
        return this.connector.channel(_channel);
      }
      /**
       * Create a new connection.
       */
    }, {
      key: "connect",
      value: function connect() {
        if (this.options.broadcaster == "pusher") {
          this.connector = new PusherConnector(this.options);
        } else if (this.options.broadcaster == "socket.io") {
          this.connector = new SocketIoConnector(this.options);
        } else if (this.options.broadcaster == "null") {
          this.connector = new NullConnector(this.options);
        } else if (typeof this.options.broadcaster == "function") {
          this.connector = new this.options.broadcaster(this.options);
        }
      }
      /**
       * Disconnect from the Echo server.
       */
    }, {
      key: "disconnect",
      value: function disconnect() {
        this.connector.disconnect();
      }
      /**
       * Get a presence channel instance by name.
       */
    }, {
      key: "join",
      value: function join(channel) {
        return this.connector.presenceChannel(channel);
      }
      /**
       * Leave the given channel, as well as its private and presence variants.
       */
    }, {
      key: "leave",
      value: function leave(channel) {
        this.connector.leave(channel);
      }
      /**
       * Leave the given channel.
       */
    }, {
      key: "leaveChannel",
      value: function leaveChannel(channel) {
        this.connector.leaveChannel(channel);
      }
      /**
       * Listen for an event on a channel instance.
       */
    }, {
      key: "listen",
      value: function listen(channel, event, callback) {
        return this.connector.listen(channel, event, callback);
      }
      /**
       * Get a private channel instance by name.
       */
    }, {
      key: "private",
      value: function _private(channel) {
        return this.connector.privateChannel(channel);
      }
      /**
       * Get a private encrypted channel instance by name.
       */
    }, {
      key: "encryptedPrivate",
      value: function encryptedPrivate(channel) {
        return this.connector.encryptedPrivateChannel(channel);
      }
      /**
       * Get the Socket ID for the connection.
       */
    }, {
      key: "socketId",
      value: function socketId() {
        return this.connector.socketId();
      }
      /**
       * Register 3rd party request interceptiors. These are used to automatically
       * send a connections socket id to a Laravel app with a X-Socket-Id header.
       */
    }, {
      key: "registerInterceptors",
      value: function registerInterceptors() {
        if (typeof Vue === "function" && Vue.http) {
          this.registerVueRequestInterceptor();
        }
        if (typeof axios === "function") {
          this.registerAxiosRequestInterceptor();
        }
        if (typeof jQuery === "function") {
          this.registerjQueryAjaxSetup();
        }
        if ((typeof Turbo === "undefined" ? "undefined" : _typeof(Turbo)) === "object") {
          this.registerTurboRequestInterceptor();
        }
      }
      /**
       * Register a Vue HTTP interceptor to add the X-Socket-ID header.
       */
    }, {
      key: "registerVueRequestInterceptor",
      value: function registerVueRequestInterceptor() {
        var _this = this;
        Vue.http.interceptors.push(function(request, next) {
          if (_this.socketId()) {
            request.headers.set("X-Socket-ID", _this.socketId());
          }
          next();
        });
      }
      /**
       * Register an Axios HTTP interceptor to add the X-Socket-ID header.
       */
    }, {
      key: "registerAxiosRequestInterceptor",
      value: function registerAxiosRequestInterceptor() {
        var _this2 = this;
        axios.interceptors.request.use(function(config) {
          if (_this2.socketId()) {
            config.headers["X-Socket-Id"] = _this2.socketId();
          }
          return config;
        });
      }
      /**
       * Register jQuery AjaxPrefilter to add the X-Socket-ID header.
       */
    }, {
      key: "registerjQueryAjaxSetup",
      value: function registerjQueryAjaxSetup() {
        var _this3 = this;
        if (typeof jQuery.ajax != "undefined") {
          jQuery.ajaxPrefilter(function(options, originalOptions, xhr) {
            if (_this3.socketId()) {
              xhr.setRequestHeader("X-Socket-Id", _this3.socketId());
            }
          });
        }
      }
      /**
       * Register the Turbo Request interceptor to add the X-Socket-ID header.
       */
    }, {
      key: "registerTurboRequestInterceptor",
      value: function registerTurboRequestInterceptor() {
        var _this4 = this;
        document.addEventListener("turbo:before-fetch-request", function(event) {
          event.detail.fetchOptions.headers["X-Socket-Id"] = _this4.socketId();
        });
      }
    }]);
    return Echo2;
  })();

  // resources/js/bootstrap.js
  window._ = require_lodash();
  window.axios = require_axios();
  window.axios.defaults.headers.common["X-Requested-With"] = "XMLHttpRequest";
  window.Pusher = require_pusher();
  window.startEcho = function(options) {
    if (window.Echo || !options || !options.key) {
      return window.Echo || null;
    }
    window.Echo = new Echo(Object.assign({
      broadcaster: "pusher",
      forceTLS: true
    }, options));
    return window.Echo;
  };
  if ("") {
    window.startEcho({
      key: "",
      cluster: ""
    });
  }
})();
/*! Bundled license information:

lodash/lodash.js:
  (**
   * @license
   * Lodash <https://lodash.com/>
   * Copyright OpenJS Foundation and other contributors <https://openjsf.org/>
   * Released under MIT license <https://lodash.com/license>
   * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
   * Copyright Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
   *)

axios/dist/browser/axios.cjs:
  (*! Axios v1.13.2 Copyright (c) 2025 Matt Zabriskie and contributors *)

pusher-js/dist/web/pusher.js:
  (*!
   * Pusher JavaScript Library v7.4.0
   * https://pusher.com/
   *
   * Copyright 2020, Pusher
   * Released under the MIT licence.
   *)
*/
