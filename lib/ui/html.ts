// Reference: https://plainvanillaweb.com/pages/applications.html
// Reference: https://github.com/hawkticehurst/slim-ssr/blob/main/slim-ssr/index.js

class Html extends String {}

/**
 * Tag a string as html not to be encoded
 * @param {string} str
 * @returns {string}
 */
export const htmlRaw = (str: string) => new Html(str);

/**
 * Entity encode a string as html
 * @param {*} value The value to encode
 * @returns {string}
 */
export const htmlEncode = (value: any) => {
  // Avoid double-encoding the same string
  if (value instanceof Html) {
    return value;
  } else {
    // https://stackoverflow.com/a/57448862/20980
    return htmlRaw(
      String(value).replace(/[&<>'"]/g, (tag) => {
        const entityMap: { [key: string]: string } = {
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          "'": "&#39;",
          '"': "&quot;",
        };
        return entityMap[tag] || tag;
      })
    );
  }
};

/**
 * HTML tagged template literal, auto-encodes entities and flattens arrays
 * @param {TemplateStringsArray} strings
 * @param {...any} values
 * @returns {Html}
 */
export const html = (strings: TemplateStringsArray, ...values: any[]) => {
  const processedValues = values.map((value) => {
    if (Array.isArray(value)) {
      return value.map(htmlEncode).join("");
    }
    return htmlEncode(value);
  });
  return htmlRaw(String.raw({ raw: strings }, ...processedValues));
};
