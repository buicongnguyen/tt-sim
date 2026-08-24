import { useMemo, useState } from "react";
import { qaCategories, qaItems, type QACategory } from "./architecture-interview-qa-data";

type CategoryFilter = "All topics" | QACategory;

const normalize = (value: string) => value.trim().toLocaleLowerCase();

function ArchitectureInterviewQAApp() {
  const [category, setCategory] = useState<CategoryFilter>("All topics");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(() => new Set([1]));

  const filtered = useMemo(() => {
    const needle = normalize(query);
    return qaItems.filter((item) => {
      const matchesCategory = category === "All topics" || item.category === category;
      const haystack = `${item.question} ${item.answer} ${item.deeper} ${item.proof} ${item.memory} ${item.category}`.toLocaleLowerCase();
      return matchesCategory && (!needle || haystack.includes(needle));
    });
  }, [category, query]);

  const toggle = (id: number) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandVisible = () => setExpanded((current) => new Set([...current, ...filtered.map((item) => item.id)]));
  const collapseVisible = () => setExpanded((current) => {
    const next = new Set(current);
    filtered.forEach((item) => next.delete(item.id));
    return next;
  });

  return (
    <div className="qa-page">
      <header className="qa-topbar">
        <a className="qa-brand" href="./index.html"><b>TT•SIM</b><span>principal NPU interview reader</span></a>
        <nav aria-label="Page navigation"><a href="#questions">50 answers</a><a href="#method">How to read</a><a href="./discussion-architecture-interview.html">Architecture workbench</a><a className="qa-back" href="./discussion.html">← Discussion</a></nav>
      </header>

      <main>
        <section className="qa-hero">
          <div className="qa-hero-index"><span>DISCUSSION</span><strong>08</strong><small>QUESTION<br/>+ ANSWER</small></div>
          <article>
            <p>DIRECT ANSWER → DEEPER REASONING → PROOF → MEMORY LINE</p>
            <h1>Fifty questions.<br/><em>Fifty defensible answers.</em></h1>
            <div className="qa-thesis"><b>Reading contract</b><p>Start with the direct answer. Open the deeper reasoning only after you can explain the branch yourself. A principal answer names the constraint, evidence, trade-off and validation—not only the optimization.</p></div>
          </article>
          <aside>
            <div><span>QUESTIONS</span><strong>50</strong><small>exactly</small></div>
            <div><span>TOPIC GROUPS</span><strong>07</strong><small>from architecture to leadership</small></div>
            <div><span>ANSWER SHAPE</span><strong>04</strong><small>answer · depth · proof · recall</small></div>
          </aside>
        </section>

        <section id="method" className="qa-method qa-section">
          <header><span>00 / HOW TO USE THIS READER</span><h2>Read once.<br/>Recall twice.</h2><p>The content is deliberately layered so it works as a reference today and an interview drill tomorrow.</p></header>
          <ol>
            <li><span>01</span><b>Read</b><p>Read the direct answer aloud. Keep the first response under about 45 seconds.</p></li>
            <li><span>02</span><b>Cover</b><p>Close the answer and reconstruct it from the memory line without copying phrases.</p></li>
            <li><span>03</span><b>Defend</b><p>Use the deeper section for two follow-ups: “why?” and “what can go wrong?”</p></li>
            <li><span>04</span><b>Prove</b><p>End with the named measurement, correctness gate and rollback condition.</p></li>
          </ol>
        </section>

        <section id="questions" className="qa-section qa-reader">
          <header><span>01 / THE QUESTION BANK</span><h2>Find the topic.<br/>Open the evidence.</h2><p>Search any concept or filter by topic. The source links distinguish public architecture facts from personal professional evidence.</p></header>

          <div className="qa-controls">
            <label className="qa-search"><span>SEARCH</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try HBM, KV cache, fusion, simulator…" aria-label="Search 50 interview questions" /></label>
            <div className="qa-view-actions"><button type="button" onClick={expandVisible}>Expand visible</button><button type="button" onClick={collapseVisible}>Collapse visible</button></div>
          </div>

          <div className="qa-filters" role="group" aria-label="Filter questions by topic">
            {(["All topics", ...qaCategories] as const).map((item) => <button type="button" className={category === item ? "active" : ""} aria-pressed={category === item} onClick={() => setCategory(item)} key={item}>{item}<small>{item === "All topics" ? qaItems.length : qaItems.filter((question) => question.category === item).length}</small></button>)}
          </div>

          <div className="qa-result"><span>SHOWING {filtered.length} OF {qaItems.length}</span>{(query || category !== "All topics") && <button type="button" onClick={() => { setQuery(""); setCategory("All topics"); }}>Clear filters</button>}</div>

          {filtered.length ? (
            <ol className="qa-list">
              {filtered.map((item) => {
                const isOpen = expanded.has(item.id);
                const number = String(item.id).padStart(2, "0");
                return (
                  <li id={`qa-${number}`} className={isOpen ? "open" : ""} key={item.id}>
                    <button type="button" className="qa-question" aria-expanded={isOpen} aria-controls={`answer-${number}`} onClick={() => toggle(item.id)}>
                      <span>{number}</span><div><small>{item.category}</small><h3>{item.question}</h3></div><i>{isOpen ? "CLOSE" : "READ"}</i>
                    </button>
                    <article id={`answer-${number}`} className="qa-answer" hidden={!isOpen}>
                      <div className="qa-direct"><span>DIRECT ANSWER</span><p>{item.answer}</p></div>
                      <div className="qa-depth"><span>PRINCIPAL DEPTH</span><p>{item.deeper}</p></div>
                      <div className="qa-proof"><span>HOW TO PROVE IT</span><p>{item.proof}</p></div>
                      <blockquote><span>MEMORY LINE</span><p>{item.memory}</p></blockquote>
                      <nav aria-label={`Sources for question ${item.id}`}><b>SOURCES</b>{item.sources.map((itemSource) => <a href={itemSource.href} key={itemSource.href}>{itemSource.label} ↗</a>)}</nav>
                    </article>
                  </li>
                );
              })}
            </ol>
          ) : <div className="qa-empty"><b>No matching question.</b><p>Try a broader word or clear the topic filter.</p></div>}
        </section>

        <section className="qa-close">
          <div><span>FINAL RECALL</span><h2>Do not memorize<br/>the conclusion.</h2></div>
          <blockquote>Memorize the decision path: define the objective, localize the limit, compare real options, choose under constraints, and state what evidence would prove you wrong.</blockquote>
          <nav><a href="./discussion-architecture-interview.html">13-topic preparation plan →</a><a href="./discussion-presentation.html">Presentation room →</a><a href="./discussion.html">Discussion hub →</a></nav>
        </section>
      </main>

      <footer className="qa-footer"><div><b>TT•SIM · DISCUSSION SUBPAGE 08</b><p>Fifty principal-level NPU interview questions with evidence and recall cues.</p></div><a href="#questions">Back to questions ↑</a><a href="./discussion-architecture-interview.html">Architecture workbench →</a><a href="./index.html">Book →</a></footer>
    </div>
  );
}

export default ArchitectureInterviewQAApp;
