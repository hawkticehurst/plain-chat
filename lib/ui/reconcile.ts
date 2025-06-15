/**
 * Efficiently reconciles a list of data with a list of DOM nodes,
 * handling additions, deletions, updates, and re-ordering.
 */
export function reconcile<T>(
  parent: Element,
  existingNodes: Map<string, Element>,
  newData: T[],
  keyFn: (item: T) => string,
  createFn: (item: T) => Element,
  updateFn: (node: Element, item: T) => void
): Map<string, Element> {
  const newNodes = new Map<string, Element>();
  const newKeys = new Set<string>();

  // Pass 1: Update existing nodes and create new ones
  for (const item of newData) {
    const key = keyFn(item);
    newKeys.add(key);

    const existingNode = existingNodes.get(key);
    if (existingNode) {
      // Item exists, update it and move it to the new map
      updateFn(existingNode, item);
      newNodes.set(key, existingNode);
    } else {
      // Item is new, create it
      const newNode = createFn(item);
      newNodes.set(key, newNode);
    }
  }

  // Pass 2: Remove old nodes that are no longer in the new data
  for (const [key, node] of existingNodes.entries()) {
    if (!newKeys.has(key)) {
      parent.removeChild(node);
    }
  }

  // Pass 3: Ensure the DOM order matches the new data order.
  let previousNode: Element | null = null;
  for (let i = newData.length - 1; i >= 0; i--) {
    const item = newData[i];
    const key = keyFn(item);
    const node = newNodes.get(key)!;

    // If previousNode is null, we're at the end of the list.
    // The node should be the last child.
    if (previousNode === null) {
      if (parent.lastChild !== node) {
        parent.appendChild(node);
      }
    } else {
      // If the node is not the one right before the previous node,
      // it needs to be moved.
      if (previousNode.previousSibling !== node) {
        parent.insertBefore(node, previousNode);
      }
    }
    previousNode = node;
  }

  return newNodes;
}