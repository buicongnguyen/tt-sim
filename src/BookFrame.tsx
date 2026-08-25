import { useEffect, useMemo, useState, type ReactNode } from "react";

type BookSection = { id: string; title: string };
type BookChapter = {
  href: string;
  number: string;
  title: string;
  note: string;
  sections: readonly BookSection[];
};

const bookGroups = [
  {
    label: "Start here",
    chapters: [
      { href: "./index.html", number: "00", title: "TT•SIM field guide", note: "Build the lab", sections: [] },
      { href: "./discussion.html", number: "01", title: "Discussion workbench", note: "Questions → evidence", sections: [
        { id: "workflow", title: "Note lifecycle" },
        { id: "topics", title: "Discussion queue" },
        { id: "template", title: "Capture template" },
        { id: "promote", title: "Promotion rules" },
      ] },
    ],
  },
  {
    label: "Architecture",
    chapters: [
      { href: "./huawei.html", number: "02", title: "Blackhole vs Ascend", note: "Compare mechanisms", sections: [
        { id: "flows", title: "Execution flows" }, { id: "matrix", title: "Comparison matrix" },
        { id: "questions", title: "Architecture questions" }, { id: "compiler", title: "Compiler stacks" },
        { id: "sources", title: "Source ledger" },
      ] },
      { href: "./async-kernels.html", number: "03", title: "Async kernels", note: "Dataflow + tile math", sections: [
        { id: "contracts", title: "Async contracts" }, { id: "geometry", title: "Matrix geometry" },
        { id: "huawei", title: "Huawei mapping" }, { id: "practice", title: "Practice path" },
      ] },
      { href: "./firmware-flow.html", number: "04", title: "Host → RISC flow", note: "Boot and launch", sections: [
        { id: "objects", title: "Binary objects" }, { id: "boot", title: "Cold boot" },
        { id: "operation", title: "Warm operation" }, { id: "quasar", title: "Quasar path" },
      ] },
    ],
  },
  {
    label: "Debug the machine",
    chapters: [
      { href: "./discussion-blackhole-bringup.html", number: "05", title: "Blackhole bring-up", note: "First missing boundary", sections: [
        { id: "star", title: "STAR case" }, { id: "toolchain", title: "Toolchain" }, { id: "model", title: "Execution model" },
        { id: "observer-tools", title: "Observer tools" }, { id: "decisions", title: "Decision chain" }, { id: "proof", title: "Proof ledger" },
      ] },
      { href: "./discussion-blackhole-synchronization.html", number: "06", title: "Synchronization", note: "Fence ≠ fence", sections: [
        { id: "fences", title: "Fence selector" }, { id: "semaphores", title: "Semaphore families" },
        { id: "debug", title: "Race debugging" }, { id: "labs", title: "Hands-on labs" },
      ] },
      { href: "./debug-low-level-kernel-flow.html", number: "07", title: "Kernel debug atlas", note: "Boot → kernel → done", sections: [
        { id: "boot", title: "Cold boot" }, { id: "launch", title: "Program launch" }, { id: "handoff", title: "NCRISC handoff" },
        { id: "interval", title: "Waypoint interval" }, { id: "tools", title: "Observer choice" }, { id: "dprint", title: "DPRINT flow" },
      ] },
    ],
  },
  {
    label: "Optimize the workload",
    chapters: [
      { href: "./discussion-transformer-blackhole-optimization.html", number: "08", title: "Transformer optimization", note: "Prefill + decode", sections: [
        { id: "decision", title: "Decision chain" }, { id: "code", title: "Code path" },
        { id: "compiler", title: "Compiler route" }, { id: "measure", title: "Measurement ledger" },
      ] },
      { href: "./discussion-quantization.html", number: "09", title: "LLM quantization", note: "Precision by tensor role", sections: [
        { id: "formats", title: "Format ledger" }, { id: "flow", title: "Precision flow" },
        { id: "apply", title: "Apply by tensor" }, { id: "calibration", title: "PTQ and calibration" }, { id: "review", title: "Logic review" },
      ] },
    ],
  },
  {
    label: "Explain and interview",
    chapters: [
      { href: "./discussion-architecture-interview.html", number: "10", title: "Architecture interview", note: "Plans + trade-offs", sections: [
        { id: "framework", title: "Answer contract" }, { id: "prep-map", title: "Study plan" }, { id: "evidence", title: "Owned evidence" },
        { id: "study-plan", title: "One-day sequence" }, { id: "scenarios", title: "Deep-dive cases" },
        { id: "question-bank", title: "Recall prompts" }, { id: "models", title: "Whiteboard models" }, { id: "diagrams", title: "Decision flows" },
      ] },
      { href: "./discussion-architecture-interview-qa.html", number: "11", title: "50-question reader", note: "Recall + defend", sections: [
        { id: "method", title: "Reading method" }, { id: "questions", title: "Question bank" },
      ] },
      { href: "./discussion-presentation.html", number: "12", title: "Presentation room", note: "Research story", sections: [
        { id: "deck", title: "Slide deck" }, { id: "boot", title: "Boot diagrams" },
        { id: "questions", title: "Technical Q&A" }, { id: "review", title: "Review gates" },
      ] },
    ],
  },
] as const satisfies readonly { label: string; chapters: readonly BookChapter[] }[];

const chapters: BookChapter[] = bookGroups.flatMap((group) => [...group.chapters] as BookChapter[]);
const routeName = (href: string) => href.replace(/^\.\//, "").split("#")[0];

function BookFrame({ children }: { children: ReactNode }) {
  const current = useMemo(() => {
    const currentRoute = window.location.pathname.split("/").pop() || "index.html";
    return chapters.find((chapter) => routeName(chapter.href) === currentRoute) ?? chapters[0];
  }, []);
  const [open, setOpen] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [progress, setProgress] = useState(0);
  const [activeSection, setActiveSection] = useState("");

  useEffect(() => {
    const query = window.matchMedia("(max-width: 980px)");
    const sync = () => {
      setMobile(query.matches);
      if (!query.matches) setOpen(false);
    };
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const update = () => {
      const maximum = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(maximum > 0 ? Math.min(100, Math.round((window.scrollY / maximum) * 100)) : 100);
      let nextSection = "";
      current.sections.forEach((section) => {
        const element = document.getElementById(section.id);
        if (element && element.getBoundingClientRect().top <= 180) nextSection = section.id;
      });
      setActiveSection(nextSection);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [current]);

  useEffect(() => {
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && open) setOpen(false);
    };
    document.addEventListener("keydown", closeWithEscape);
    return () => document.removeEventListener("keydown", closeWithEscape);
  }, [open]);

  const currentIndex = chapters.indexOf(current);
  const previous = currentIndex > 0 ? chapters[currentIndex - 1] : undefined;
  const next = currentIndex < chapters.length - 1 ? chapters[currentIndex + 1] : undefined;
  const sidebarHidden = mobile && !open;

  return (
    <div className={`book-frame${open ? " book-frame-open" : ""}`}>
      <a className="book-skip-link" href="#book-page-content">Skip to chapter content</a>
      <button className="book-frame-menu" type="button" aria-expanded={open} aria-controls="book-rail" onClick={() => setOpen((value) => !value)}><span aria-hidden="true">☰</span><b>Contents</b></button>
      <button className="book-frame-scrim" type="button" aria-label="Close table of contents" onClick={() => setOpen(false)} />
      <aside className="book-rail" id="book-rail" aria-label="TT-SIM book contents" aria-hidden={sidebarHidden} inert={sidebarHidden}>
        <header className="book-rail-head"><a href="./index.html"><span>TT•SIM</span><strong>Accelerator field book</strong></a><p>Architecture → software → evidence</p></header>
        <section className="book-rail-current" aria-label="Current chapter"><small>CHAPTER {current.number}</small><strong>{current.title}</strong><p>{current.note}</p></section>
        <div className="book-rail-progress" aria-label={`${progress}% of chapter read`}><div><span>Reading progress</span><strong>{progress}%</strong></div><div><i style={{ width: `${progress}%` }} /></div></div>
        <nav className="book-rail-chapters" aria-label="Book chapters">
          {bookGroups.map((group) => <section key={group.label}><h2>{group.label}</h2>{group.chapters.map((chapter) => {
            const active = chapter.href === current.href;
            return <a className={active ? "active" : ""} aria-current={active ? "page" : undefined} href={chapter.href} key={chapter.href} onClick={() => setOpen(false)}><span>{chapter.number}</span><div><strong>{chapter.title}</strong><small>{chapter.note}</small></div></a>;
          })}</section>)}
        </nav>
        {current.sections.length > 0 && <nav className="book-rail-outline" aria-label="On this page"><h2>On this page</h2>{current.sections.map((section) => <a className={activeSection === section.id ? "active" : ""} aria-current={activeSection === section.id ? "location" : undefined} href={`#${section.id}`} key={section.id} onClick={() => setOpen(false)}>{section.title}</a>)}</nav>}
        <nav className="book-rail-pager" aria-label="Adjacent chapters">{previous && <a href={previous.href}><span>← Previous</span><strong>{previous.title}</strong></a>}{next && <a className="next" href={next.href}><span>Next →</span><strong>{next.title}</strong></a>}</nav>
      </aside>
      <div className="book-frame-content" id="book-page-content">{children}</div>
    </div>
  );
}

export default BookFrame;
