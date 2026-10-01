/**
 * Whether a key event's target is a field that owns its own key presses.
 *
 * Duck-typed on purpose. Vitest runs this repo's `.test.ts` files in the node
 * environment, where `HTMLElement` is not defined — an `instanceof` check
 * throws there the moment a document-level handler sees any synthetic event.
 * Reading `tagName` works in both environments and against the fake events the
 * plugin tests fire.
 */
export function isTextEntryTarget(target: EventTarget | null | undefined): boolean {
  const el = target as { tagName?: unknown; isContentEditable?: unknown } | null | undefined;
  if (!el || typeof el.tagName !== "string") return false;
  return ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || el.isContentEditable === true;
}
