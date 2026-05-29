document.querySelectorAll("main h2, main h3").forEach((h) => {
    const a = document.createElement("a");
    a.className = "heading-top";
    a.href = "#";
    a.setAttribute("aria-label", "Back to top");
    a.textContent = "↑";
    a.addEventListener("click", (e) => {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: "smooth" });
    });
    h.append(a);
});

document.querySelectorAll("details").forEach((el) => {
    const btn = document.createElement("button");
    btn.className = "details-close";
    btn.setAttribute("aria-label", "Collapse section");
    btn.type = "button";

    btn.addEventListener("click", () => {
        el.open = false;
        const headerHeight = document.querySelector("header")?.offsetHeight ?? 0;
        el.style.scrollMarginTop = (headerHeight + 10) + "px";
        el.style.scrollMarginLeft = "24px";
        el.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });

        const observer = new IntersectionObserver((entries, obs) => {
            if (entries[0].isIntersecting) {
                el.classList.add("details-returning");
                el.addEventListener("animationend", () => {
                    el.classList.remove("details-returning");
                }, { once: true });
                obs.disconnect();
            }
        }, { threshold: 0.1 });

        observer.observe(el);
    });

    el.appendChild(btn);
});
