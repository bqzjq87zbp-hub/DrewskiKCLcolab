/**
 * The hero: upgrades the walk's invitation into a real opening statement.
 *
 * The aisle owns the invitation element and its fade; this only restyles it and
 * hangs the calls to action off it, so the opener's own code stays untouched.
 * The buttons re-enable pointer events on themselves because the invitation is
 * deliberately click-through.
 */
import { el, reduced, onFrame } from "./motion.js";
import { magnetic } from "./cursor.js";

export function enhanceHero({ bookingHref, onSeeWork }) {
  const invitation = document.querySelector(".aisle-invitation");
  if (!invitation) return null;
  invitation.classList.add("hero");

  const cue = invitation.querySelector(".invitation-cue");

  const book = el("a", {
    class: "hero-cta hero-cta-primary", href: bookingHref,
    dataset: { cursor: "book", cursorLabel: "Book" },
  }, el("span", { text: "Book a session" }),
     el("span", { class: "hero-cta-arrow", text: "→", "aria-hidden": "true" }));

  const see = el("button", {
    class: "hero-cta hero-cta-ghost", type: "button",
    dataset: { cursor: "down", cursorLabel: "Work" },
  }, el("span", { text: "See the work" }));
  see.addEventListener("click", onSeeWork);

  const actions = el("div", { class: "hero-actions" }, book, see);
  cue ? cue.before(actions) : invitation.append(actions);

  magnetic(book);
  magnetic(see);

  // The aisle fades this element out as the walk begins. While it is still
  // reading as the hero, the easel signs would collide with the headline, so
  // they stand down until the visitor actually starts walking.
  onFrame(() => {
    const opaque = parseFloat(getComputedStyle(invitation).opacity) > 0.35;
    if (opaque) document.body.dataset.heroOn = "true";
    else delete document.body.dataset.heroOn;
    return false;
  });

  return { invitation, actions };
}
