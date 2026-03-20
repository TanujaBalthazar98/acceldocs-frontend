/**
 * Post-render enhancements for code blocks in documentation pages.
 *
 * Call `attachCopyButtons(container)` after the docs HTML is mounted.
 * Returns a cleanup function to remove all injected elements.
 */

export function attachCopyButtons(container: HTMLElement): () => void {
  const pres = container.querySelectorAll<HTMLPreElement>("pre[data-language], pre.shiki-highlighted");
  const cleanups: (() => void)[] = [];

  for (const pre of pres) {
    // Skip if already has a copy button
    if (pre.querySelector(".code-copy-btn")) continue;

    const btn = document.createElement("button");
    btn.className = "code-copy-btn";
    btn.textContent = "Copy";
    btn.type = "button";

    const handleClick = () => {
      const code = pre.querySelector("code")?.textContent || pre.textContent || "";
      navigator.clipboard.writeText(code).then(() => {
        btn.textContent = "Copied!";
        btn.classList.add("copied");
        setTimeout(() => {
          btn.textContent = "Copy";
          btn.classList.remove("copied");
        }, 2000);
      });
    };

    btn.addEventListener("click", handleClick);
    pre.style.position = "relative";
    pre.appendChild(btn);

    cleanups.push(() => {
      btn.removeEventListener("click", handleClick);
      btn.remove();
    });
  }

  return () => cleanups.forEach((fn) => fn());
}
