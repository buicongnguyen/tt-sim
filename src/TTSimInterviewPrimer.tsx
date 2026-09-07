const lessons = [
  {
    question: 'What is ttsim, and why would you use it?',
    answer: 'I use ttsim to investigate supported Tenstorrent device behavior without a physical accelerator. It helps me test a small execution path before moving to hardware validation.',
    steps: [
      ['Separate the projects', 'This website is a study guide. The upstream tenstorrent/ttsim repository provides the simulator; TT-Metal supplies the host runtime and device programs.'],
      ['Define the question', 'Start with a specific behavior, such as whether a kernel receives the intended arguments and returns the expected value.'],
      ['State the limit', 'A passing run provides evidence for that test and modeled behavior. It is not proof of every hardware feature or production performance.'],
    ],
    recall: 'Purpose → test → boundary.',
  },
  {
    question: 'How does a TT-Metal program reach the simulated device?',
    answer: 'I separate the software that prepares work from the library that models device execution. This makes it easier to locate which boundary failed.',
    steps: [
      ['Host runtime', 'The host program uses TT-Metal to prepare and launch device work. TT_METAL_SIMULATOR selects the simulator library through the TT-Metal integration.'],
      ['Simulator interface', 'The library API exposes device access and clock-advancement operations. Its documented embedding contract is single-threaded and non-reentrant; callers must serialize calls.'],
      ['Result verification', 'After completion, the host checks the returned data against an expected result. Loading the library alone does not show that a kernel executed correctly.'],
    ],
    recall: 'Prepare → execute → verify.',
  },
  {
    question: 'What does “Success: Result is 21” establish?',
    answer: 'It is a useful smoke-test result, not a complete accelerator qualification. I explain what that particular example exercises and what remains untested.',
    steps: [
      ['Positive evidence', 'For the recorded integer-add example, the expected value returned through the tested host/runtime/device path. Preserve the command, versions and complete log.'],
      ['Coverage boundary', 'Integer addition on a RISC-V path does not by itself validate a Tensix matrix kernel, a large tensor pipeline or model accuracy.'],
      ['Next test', 'Add a small supported tensor computation with an independent reference, then vary input values and supported shapes. A new passing case expands coverage; it does not erase the boundary.'],
    ],
    recall: 'One passing path ≠ the whole machine.',
  },
  {
    question: 'How would you investigate an incorrect result or simulator exit?',
    answer: 'I first reproduce the smallest failure and classify it. Then I test one hypothesis at a time instead of assuming that every exit is a kernel bug.',
    steps: [
      ['Freeze the baseline', 'Record the TT-Metal commit, simulator version, architecture descriptor, command and input. Confirm that the unchanged example works in that configuration.'],
      ['Locate the first mismatch', 'Compare arguments, addresses, buffer contents and completion ordering at observable boundaries. Reduce the workload until the failing behavior is isolated.'],
      ['Check support', 'Read the reported error and upstream support contract. Unsupported functionality needs a supported alternative or a concrete upstream report; suppressing the error is not a correctness fix.'],
    ],
    recall: 'Reproduce → localize → classify → test.',
  },
  {
    question: 'Can you choose the fastest kernel using ttsim?',
    answer: 'I can use functional tests and analytical resource estimates to narrow candidates, but I would not rank silicon performance using simulator elapsed time.',
    steps: [
      ['Check correctness first', 'Compare supported candidate implementations with a reference and include tail cases. A wrong answer cannot be accepted because it appears faster.'],
      ['Explain a hypothesis', 'For example, a fused operation may remove an intermediate write and read, but it can also increase live local-memory usage. Calculate the traffic and storage under explicit assumptions.'],
      ['Measure the device', 'On named hardware, compare repeated warm runs with the same workload and correctness threshold. Report latency or throughput only for the measurement boundary actually tested.'],
    ],
    recall: 'Functional evidence → cost hypothesis → hardware measurement.',
  },
  {
    question: 'How does this experience transfer to a Huawei interview?',
    answer: 'I transfer the engineering method, not undocumented implementation details. I can explain how I reduce a runtime or kernel problem and how I would validate the corresponding Ascend path.',
    steps: [
      ['Portable reasoning', 'Discuss tensor semantics, memory ownership, tiling constraints, synchronization and numerical validation. Explain the failure each contract prevents.'],
      ['Target-specific learning', 'Select an Ascend product and CANN version, then trace a supported operator through host tiling, kernel execution and result checking. Verify the actual API contracts.'],
      ['Honest ownership', 'Separate public source study, simulator experiments and professional work. Do not describe ttsim results as Ascend measurements or claim that the two devices share firmware internals.'],
    ],
    recall: 'Transfer the method; verify the target.',
  },
] as const;

export default function TTSimInterviewPrimer() {
  return <section id="simulator-interview" className="interview-primer">
    <h2>TT-SIM: six interview answers</h2>
    <p>Give the <strong>short answer</strong> first. Use the numbered points when the interviewer asks how, why or what can fail. These are explanations and proposed methods, not claims that every experiment has been run.</p>
    {lessons.map((lesson, index) => <article key={lesson.question}>
      <h3>{index + 1}. {lesson.question}</h3>
      <p>{lesson.answer}</p>
      <ol>{lesson.steps.map(([keyword, explanation]) => <li key={keyword}><strong>{keyword}.</strong> {explanation}</li>)}</ol>
      <p className="recall"><strong>Remember:</strong> {lesson.recall}</p>
    </article>)}
    <p><strong>Check the evidence:</strong> <a href="https://github.com/tenstorrent/ttsim">upstream ttsim README</a>; <a href="https://github.com/tenstorrent/ttsim/blob/main/docs/libttsim_api.md">library API contract</a>; <a href="https://github.com/tenstorrent/ttsim/blob/main/docs/unsupported_functionality.md">unsupported functionality</a>; <a href="./BLACKHOLE_SMOKE_TEST.md">dated local smoke-test record</a>. Upstream main can change: record the revision used by your experiment. Reading these sources is not a new simulator run.</p>
  </section>;
}
