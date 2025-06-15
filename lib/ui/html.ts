// Reference: https://plainvanillaweb.com/pages/applications.html
// Reference: https://github.com/hawkticehurst/slim-ssr/blob/main/slim-ssr/index.js

class Html extends String {}

/**
 * A utility function that wraps a string in the `Html` marker class.
 * Use this ONLY with HTML that you know is safe and has been sanitized.
 * @param {string} str raw HTML string.
 * @returns An `Html` object.
 */
export const htmlRaw = (str: string): Html => new Html(str);

/**
 * Encodes a value for safe HTML interpolation, unless it's already a Node or raw HTML.
 * @param value The value to encode.
 * @returns The safe value.
 */
const htmlEncode = (value: any) => {
  // If the value is already a Node or is marked as raw HTML, pass it through.
  if (value instanceof Html) {
    return value;
  } else {
    // Otherwise, encode it to prevent XSS.
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
 * HTML tagged template literal that can handle nested templates and Node insertions.
 * It returns a clonable DocumentFragment.
 * @param {TemplateStringsArray} strings
 * @param {...any} values
 * @returns {DocumentFragment}
 */
export const html = (
  strings: TemplateStringsArray,
  ...values: any[]
): DocumentFragment => {
  const nodesToInsert: Node[] = [];

  const processedValues = values.map((value) => {
    // Handle arrays of nodes or templates
    if (Array.isArray(value)) {
      const fragment = document.createDocumentFragment();
      value.forEach((item) => {
        // If the item is already a Node, append it. Otherwise, create a text node.
        fragment.appendChild(
          item instanceof Node ? item : document.createTextNode(String(item))
        );
      });
      value = fragment;
    }

    // If the value is a Node, store it and return a placeholder comment.
    if (value instanceof Node) {
      const index = nodesToInsert.push(value) - 1;
      // The placeholder is wrapped in our `Html` class to prevent encoding.
      return new Html(`<!--node-placeholder-${index}-->`);
    }

    return htmlEncode(value);
  });

  const fullHtml = String.raw({ raw: strings }, ...processedValues);
  const template = document.createElement("template");
  template.innerHTML = fullHtml;
  const fragment = template.content;

  // If we have nodes to insert, perform the swap pass.
  if (nodesToInsert.length > 0) {
    // Use a TreeWalker to efficiently find all comment nodes.
    const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_COMMENT);
    let node;
    while ((node = walker.nextNode())) {
      const comment = node as Comment;
      const match = comment.nodeValue?.match(/node-placeholder-(\d+)/);
      if (match) {
        const index = parseInt(match[1], 10);
        const nodeToInsert = nodesToInsert[index];
        // Replace the placeholder comment with the actual node.
        comment.parentNode?.replaceChild(nodeToInsert, comment);
      }
    }
  }

  return fragment;
};
