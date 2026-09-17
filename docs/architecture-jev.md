# JEV module seam

All TypeSafe/JEV prompt material lives in `packages/jev`. The Worker imports it. The React app consumes **HTTP DTOs only**. Evaluation traces (input, prompt, output) are persisted in D1 so prompt changes can be scored later.

```
packages/jev
  types.ts          SystemOne request/response + ReviewResponse DTOs
  questions.ts      General, persona-build, and job-review question maps
  score.ts          Composite JevScore weights (code, not the model)
  transform.ts      Answers → ReviewResponse
  provider.ts       JudgmentProvider interface
  http.ts           POST https://api.typesafe.ai/v1/systemone
  mock.ts           Deterministic adapter when TYPESAFE_API_KEY is unset
  index.ts          Public exports
```

To extract later: copy `packages/jev` into its own package; Worker already depends only on the public exports (`evaluate`, `build*Questions`, `transform*`, types).

To add another model later: implement `JudgmentProvider` and select it in `worker/engine.ts`. Do not scatter prompt strings into UI. The Worker still stores the compiled `questions` JSON on each eval run.
