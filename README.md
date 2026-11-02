# Developer Burnout Detector

A full-stack web app that predicts a developer's burnout status from a few daily habits, using a **Decision Tree implemented from scratch in TypeScript** (no ML libraries), and visualizes the trained tree as an interactive graph.

| | |
|---|---|
| **Live demo** | https://developer-burnout-detector-ashy.vercel.app |
| **Backend API** | https://developer-burnout-detector.onrender.com/api/health |
| **Repository** | https://github.com/rayakheraldine/Developer-Burnout-Detector |

> ⏳ The backend runs on Render's free plan, which sleeps after about 15 minutes without traffic. **The first load can take up to a minute** while it wakes up; after that, predictions are instant.

<img width="1891" height="921" alt="image" src="https://github.com/user-attachments/assets/82bd7f84-2184-4517-9517-2579f3766cca" />


## Features

- **Live predictions.** Move the sliders (sleep, meetings, stress) and the weekends checkbox, and the verdict updates instantly.
- **Explained verdicts.** The path the prediction took is highlighted in the tree, and the verdict shows how confident the model is (with a "close call" warning below 70%).
- **Interactive tree graph.** Every decision node shows its condition (e.g. "Stress level ≤ 6.55?") with Yes/No branches. Leaves are colored by class. Hovering a node shows its training statistics: sample count, class breakdown, impurity and information gain.
- **Retraining from the UI.** Change the maximum depth or the split criterion (Gini / Entropy) and retrain. The graph redraws and the new train/test accuracy is shown.
- **Train on your own data.** Upload a CSV or JSON file in the dashboard and retrain on it, or switch back to the built-in dataset. Invalid files are rejected with a clear message.

---

## Prediction classes

| Class | Meaning |
|---|---|
| 🟢 Healthy | Lowest burnout score (bottom ~23%) |
| 🟡 Risk of burnout | Early warning signs (~51%) |
| 🟠 Vacation required | High burnout score (~16%) |
| 🔴 Critical condition | Highest burnout score (top ~10%) |

**Input features** (the four required by the task): sleep hours, meetings per day, works on weekends (Yes/No), stress level (1–10).

---

## Tech stack

| Layer | Tools |
|---|---|
| Data preparation | Python, pandas, Jupyter (EDA and cleaning only) |
| Backend | Node.js, Express, TypeScript, Vitest |
| Frontend | React, TypeScript, Vite, React Flow (`@xyflow/react`) |
| Deployment | Render (backend), Vercel (frontend) |

---

## Data preparation

**Source:** [Developer Burnout Prediction Dataset (7000 samples)](https://www.kaggle.com/datasets/asifxzaman/developer-burnout-prediction-dataset7000-samples) on Kaggle.

**Synthetic `Weekends` column:** the original dataset has no column for weekend work, which the task requires as an input. With Claude's help, I added a `Weekends` (Yes/No) column generated from each row's **daily work hours, stress level and sleep hours**, plus some randomness. Longer hours, higher stress and less sleep make "Yes" more likely, but don't guarantee it. This feature is therefore simulated, not observed (see [Known limitations](#known-limitations)).

Cleaning is done in [`data/data_eda.ipynb`](data/data_eda.ipynb). Output: `data/burnout_clean.csv`.

1. **Rows with no target label were dropped.** Imputing the label would mean training on made-up answers.
2. **Rows with missing stress were dropped, not imputed.** Stress is part of the label (see step 5), so a filled-in stress value could contradict the row's label. A first version used mean imputation, and the EDA found 58 rows whose imputed stress (5.4) didn't fit their class. Dropping these rows removed the problem.
3. **Other missing numeric values were filled with the column median** (robust to outliers). Meetings were rounded to whole numbers and hours to 2 decimals, matching the original data.
4. **Stress was rescaled** from 0–100 to the 1–10 scale the task asks for.
5. **The 4 target classes are built from a burnout score of all four features.** The original `burnout_level` turned out to be just `stress_level` cut at 35 and 70, with no overlap (Low = 0–35, Medium = 35–70, High = 70–100). My first version mapped those levels to the 4 classes, so the label was a pure function of stress: the tree only ever split on stress, and moving the sleep, meetings or weekends controls never changed the verdict. The label is now:
   - each feature turned into a 0–1 "how bad" value: stress `(s − 1) / 9`, sleep `(9 − h) / 5` (9 h+ → 0, 4 h → 1), meetings `m / 9`, weekends Yes → 1
   - `score = 0.30·stress + 0.25·sleep + 0.25·meetings + 0.20·weekends`, plus small random noise (σ = 0.04, fixed seed) so rows near a boundary can fall on either side, as with real people
   - the score cut at its 23rd / 74th / 90th percentiles → Healthy / Risk of burnout / Vacation required / Critical condition, which keeps the class balance of the original levels

   Stress has the largest weight, but the other three together outweigh it. With stress at 40%, the tree barely used sleep at a readable depth. This makes the labels **rule-based, not observed** (see [Known limitations](#known-limitations)).
6. **Only the four required features are kept** (sleep, meetings, weekends, stress). Daily work hours was explored in the EDA, and used to generate `Weekends`, but is not a model input.

### EDA findings
- **Classes are imbalanced.** About half the rows are "Risk of burnout", while "Critical condition" is only about 10%.
- **Stress is the strongest feature** (correlation ≈ 0.71 with the status), followed by weekends (0.63), meetings (0.49) and sleep (−0.46). With the original stress-only labels, stress was at 0.92 and the others had almost no independent effect.
- Developers who work weekends end up much more often in the worse categories: almost nobody who doesn't work weekends reaches "Critical condition".

---

## Algorithm: CART with Gini impurity

I implemented a **CART-style binary decision tree** and chose **Gini impurity** as the default split criterion. **Entropy** is implemented as an alternative and can be selected in the UI.

**Why CART:**
- **All splits are binary** (`feature <= threshold`). This handles the three numeric features naturally, without having to bin them into categories first (as ID3 would require).
- **The one categorical feature (weekends) is binary anyway**, so it fits the same yes/no structure.
- **Binary trees are easier to visualize.** Every node has exactly two children, which keeps the graph clean.

**Why Gini as the default:** it measures the same thing as entropy (how mixed the classes in a node are) and usually produces nearly identical trees. It's slightly cheaper because it needs no logarithms.

- Gini = 1 − Σ pᵢ² → 0 for a pure node, maximum 0.75 for 4 equal classes
- Entropy = −Σ pᵢ · log₂(pᵢ) → 0 for a pure node, maximum 2 bits for 4 equal classes
- Information gain = impurity of the node − weighted impurity of its two children

### How a split is found
For each numeric feature:
1. Sort the rows by that feature.
2. Start with all rows on the right side and move them to the left one at a time, updating the class counts incrementally.
3. Between every two **different** consecutive values, try the midpoint as a threshold.
4. Score each threshold by the **weighted impurity of the two children**: `(nL/n)·imp(left) + (nR/n)·imp(right)`. Keep the lowest.

This costs O(n log n) per feature, because the counts are updated instead of recomputed at every threshold. For weekends there is only one possible split (Yes vs No). The best split across all features is chosen.

### Stopping rules
A node becomes a leaf (predicting its majority class) when:
- it is **pure** (impurity = 0),
- it reached **`maxDepth`**,
- it has fewer than **`minSamplesSplit`** rows,
- **no feature can split it**, or
- the best split gives **no information gain** (it doesn't reduce impurity).

### Design decisions
- **One function decides the split direction.** `goesLeft()` (left = condition true: `value <= threshold`, or `weekends === "Yes"`) is used both when building the tree and when predicting, so training and prediction can never disagree.
- **Every node stores its stats** (`samples`, `classCounts`, `impurity`, and `gain` for decision nodes) for the hover tooltips in the graph.
- **Every node has a stable, path-based ID:** `n` is the root, `nL` its left child, `nLR` that node's right child, and so on. React Flow needs unique IDs, and the prediction path can be highlighted by ID.
- **Predictions return the decision path** (the node IDs passed) as well as the label and the class counts of the final leaf.
- **The train/test split uses a fixed seed** (80/20, seed 42), so the results below are reproducible.

---

## Results

Test accuracy for different `maxDepth` values (Gini, `minSamplesSplit = 20`):

| maxDepth | Real depth | Leaves | Train accuracy | Test accuracy | Features used |
|---|---|---|---|---|---|
| 1 | 1 | 2 | 0.518 | 0.478 | weekends |
| 2 | 2 | 4 | 0.659 | 0.653 | stress, weekends |
| 3 | 3 | 8 | 0.706 | 0.699 | stress, meetings, weekends |
| **4** | **4** | **16** | **0.791** | **0.787** | **stress, sleep, meetings, weekends** |
| 5 | 5 | 32 | 0.816 | 0.795 | stress, sleep, meetings, weekends |
| 8 | 8 | 173 | 0.887 | 0.824 | stress, sleep, meetings, weekends |

**Interpretation:**

- **The root split is weekends, then stress, then meetings, then sleep.** Weekends is a single Yes/No jump worth 20% of the score, so it separates the classes best in one cut. Stress is the strongest *numeric* feature.
- **Sleep only appears from depth 4.** Its effect is real, but smaller than the others in any single cut. At depth 3, moving the sleep slider never changed the verdict.
- **Depth 4 to 8 overfits.** Test accuracy keeps rising slowly, but the train–test gap grows from 0.004 to 0.063, and the tree grows from 16 to 173 leaves. The extra splits mostly learn the label noise.
- **`maxDepth = 4` is therefore the default:** every feature is used, there is no overfitting yet, and the graph (16 leaves) is still readable.
- **Before the label fix** (labels from stress only), depth 3 reached 98.6% using stress alone. That number came from the leakage, not from a good model.

**Close calls.** About 21% of test predictions land in a leaf where the majority class has under 70%. These are people near a class boundary, where the noise in the labels makes the answer genuinely uncertain. This is why the app shows confidence and a "close call" warning, not just the label.

---

## Architecture

```
React dashboard ──POST /api/predict──▶ Express API ──▶ predict()  (walk the tree)
       │         ──POST /api/train────▶             ──▶ buildTree() (train + evaluate)
       │         ◀──GET /api/tree──────             (current model as nested JSON)
       ▼
treeToFlow(): nested JSON → React Flow nodes + edges → custom node components
```

The backend only describes the model. All drawing decisions (layout, colors, highlighting) are made in the frontend.

### REST API

| Method | Endpoint | Body | Returns |
|---|---|---|---|
| `GET` | `/api/health` | – | `{ status: "ok" }` |
| `GET` | `/api/tree` | – | current tree, parameters, train/test accuracy |
| `POST` | `/api/predict` | `{ sleep, meetings, weekends, stress }` | verdict, decision path (node IDs), class counts of the leaf |
| `POST` | `/api/train` | `{ params?, csv?, rows? }` | the newly trained model |

`/api/train` trains on the built-in dataset by default, or on an uploaded dataset sent as a CSV string (`csv`) or a JSON array (`rows`). `params` can set `maxDepth` (0–15), `minSamplesSplit` and `criterion` (`"gini"` / `"entropy"`). The model is trained once at server startup, so predictions work immediately.

**Upload format.** The dashboard reads the selected file in the browser and sends its text as JSON, so no multipart upload is needed.
- **CSV:** a header row with `sleep, meetings, weekends, stress, status`. Extra columns are ignored.
- **JSON:** an array of objects with the same fields. `weekends` can be `"Yes"`/`"No"` or `true`/`false`.
- At least 10 rows, maximum 5 MB. Note that a node is only split if it has at least 20 rows, so after the 80/20 train/test split a file needs about 25+ rows to produce more than a single leaf.


Example requests, including invalid ones, are in [`backend/api.http`](backend/api.http).

### Validation and error handling
- **One validator for every input.** Prediction input, uploaded rows, CSV files and the built-in dataset all pass through the same checks: required fields, numbers, ranges (stress 1–10, sleep and meetings 0–24), Yes/No or true/false for weekends, and known class labels.
- **Errors are thrown as `HttpError`s and handled by one Express middleware.** Every error becomes a JSON response with a clear message: 400 for invalid input or malformed JSON (with the CSV line number where relevant), 413 for oversized uploads, 404 for unknown routes. Unexpected errors return a generic 500 and are logged. The server never crashes on bad input.
- **The frontend shows the backend's error message** in the dashboard instead of failing silently. Files that are too large or aren't valid JSON are caught in the browser before anything is sent. After a failed upload, the previous model stays active.
- **Test files for uploads** are in [`test-data/`](test-data/): valid and invalid CSV/JSON datasets, each with its expected result.

### Frontend
- **Tree → graph conversion** (`graph/toFlow.ts`): a recursive walk turns the nested tree into React Flow's flat `nodes` and `edges` lists. Each decision node asks its question ("Stress level ≤ 6.55?", "Works weekends?"), and its two edges are labelled **Yes** (left, condition true) and **No** (right).
- **Custom tree layout.** I first used the dagre layout library, but it doesn't know which child is "left" and drew every split mirrored (`>` on the left). I replaced it with a small tree layout: leaves get x positions in visiting order (left child first), parents are centered above their children, and every depth level is its own row. Nodes can't overlap, and the left/right order always matches the split condition.
- **Custom node components** (`graph/nodes.tsx`): decision nodes show the condition, leaves show the verdict colored by class with a confidence percentage. All class colors come from a single map (`colors.ts`), shared by the graph and the dashboard.
- **Instant predictions without flooding the server:**
  - Slider input is **debounced** (250 ms), so dragging a slider sends one request when the user pauses, not dozens.
  - Every new request **cancels the previous one** (`AbortController` in the effect cleanup), so an older, slower response can never overwrite a newer one.
- **State lives in `App`** (model, input, prediction). The dashboard and the graph both read from it, so retraining automatically re-runs the prediction and redraws the highlighted path.
- **The model controls follow the loaded model.** The max-depth slider and criterion dropdown are synced with the parameters the current model was actually trained with, so after a page reload they never show settings that don't match the tree on screen.

---

## Project structure

```
Developer-Burnout-Detector/
├── data/
│   ├── developer_burnout_dataset.csv  # raw Kaggle data + generated Weekends column
│   ├── data_eda.ipynb                 # cleaning + EDA
│   └── burnout_clean.csv              # cleaned training data (used by the backend)
├── test-data/                  # valid + invalid upload files, with expected results
├── backend/
│   ├── api.http                # example + invalid requests (REST Client)
│   ├── package.json            # dev / build / start / test scripts
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts            # trains the default model, starts the server
│       ├── app.ts              # Express routes + error middleware
│       ├── model.ts            # current model in memory, training + evaluation
│       ├── validation.ts       # input validation for all endpoints
│       ├── errors.ts           # HttpError
│       ├── data/
│       │   └── loadCsv.ts      # CSV parsing
│       └── tree/
│           ├── types.ts        # Row, TreeNode, TreeParams, ...
│           ├── impurity.ts     # gini, entropy, class counts, majority
│           ├── splits.ts       # best threshold search, goesLeft
│           ├── buildTree.ts    # recursive training + stopping rules
│           ├── predict.ts      # tree traversal, returns verdict + path
│           ├── evaluate.ts     # seeded train/test split, accuracy
│           └── *.test.ts       # unit tests (Vitest)
└── frontend/
    ├── index.html
    ├── package.json            # dev / build / lint scripts
    └── src/
        ├── main.tsx            # React entry point
        ├── App.tsx             # shared state, prediction requests, graph
        ├── Dashboard.tsx       # sliders, Reset, verdict, retraining controls, file upload
        ├── api.ts              # backend calls + error messages
        ├── useDebouncedValue.ts# waits until slider input is stable
        ├── colors.ts           # one color per class
        ├── types.ts            # mirrors the backend's response types
        ├── index.css           # layout, panel, nodes, tooltips
        └── graph/
            ├── toFlow.ts       # tree → nodes/edges + layout
            └── nodes.tsx       # custom decision/leaf nodes + tooltips
```

## Running locally

You need Node.js 20+. Run the backend and the frontend in two terminals.

```bash
# Terminal 1: backend (http://localhost:3001)
cd backend
npm install
npm run dev
npm test        # optional: run the unit tests
```

```bash
# Terminal 2: frontend (http://localhost:5173)
cd frontend
npm install
npm run dev
```

The frontend calls `http://localhost:3001` by default. Set `VITE_API_URL` to use another backend. The backend accepts requests from `http://localhost:5173` by default; set `FRONTEND_URL` to allow another origin.

## Known limitations
- **The CSV parser splits on commas**, so it doesn't support quoted fields containing commas. That's fine for the provided dataset, but would need a proper parser for arbitrary uploads.
- **The labels are rule-based.** They come from a weighted score I defined (step 5 of data preparation), not from a real burnout measurement. The tree is learning that formula back from the data, so its splits show *my* weights, not a discovered pattern. The original dataset's labels were no better: they were just stress cut into three ranges.
- **The `weekends` feature is synthetic.** It was generated from work hours, stress and sleep, so any link between weekends and burnout in this data comes from that generation step, not from real observations. This also explains why weekends correlates with the worse classes in the EDA.
- **The model is kept in memory.** A retrained model is lost when the server restarts, and all users share the same model: if one visitor retrains with different settings, everyone sees that tree until the next retrain or restart.

---

## AI collaboration

I used Claude (Anthropic) as a mentor and pair programmer throughout the project:

- **Planning:** turned the task into ordered steps (data → algorithm → API → frontend → deployment).
- **Dataset adaptation:** the Kaggle dataset had no weekend-work column, so with Claude I generated a `Weekends` column from work hours, stress and sleep, with added randomness.
- **Data review:** Claude reviewed my cleaning notebook and pointed out that mean-imputing stress *before* building the labels created contradictory rows. I changed the cleaning step and verified the fix with my own sanity-check cell.
- **Code:** Claude drafted the TypeScript types, the CSV loader, the tree functions, the API and most of the frontend, with explanations. I read and integrated them, ran the tests, and checked the results myself (the loader's output against the notebook, the API's error responses with `api.http`, the graph in the browser).
- **Learning with the mentor prompt:** for the frontend topics (tree → graph conversion, node styling and tooltips, the dashboard) I followed the four-step mentor format: intuition first, then code, AI prompting tips, and a small challenge. I wrote the edge labels, the "close call" warning and the Reset button as challenges, with Claude guiding me through them step by step.
- **Debugging:** helped with TypeScript/Node setup issues (ES modules vs CommonJS, `verbatimModuleSyntax`, `"types": ["node"]`, replacing ts-node with tsx) and Git setup (`.gitignore`).
- **Analysis and review:** I noticed that changing `maxDepth` seemed to have no effect; together we traced it to the data, not a bug. That led to the depth experiment and the leakage/overfitting findings. Checking screenshots of the graph, I found that every split was drawn mirrored (caused by the dagre layout) and that the tree was still at the old depth.
- **"Only stress matters" bug:** the verdict changed with the stress slider but never with sleep, meetings or weekends. Claude first checked the code (split search, `goesLeft`, the frontend input object), and all of it was correct. Then, training on the real CSV, the tree used only stress, and the original `burnout_level` turned out to be stress cut at 35/70. We rebuilt the label as a weighted score of all four features. We tried several weightings and measured, for each one, how often moving each slider changes the verdict. Then we raised the default depth to 4, where all four features are used without overfitting.
- **Deployment:** Claude walked me through deploying to Render and Vercel and through the CORS errors that followed: the frontend first pointed at a wrong backend URL, I then opened a per-deployment preview URL that CORS didn't allow, and production was still serving an old build. After deploying, I noticed the dashboard showed "depth 3" next to a deeper tree I had trained, which led to syncing the controls with the loaded model.
- **Requirements check:** at the end I had Claude compare the app against the task line by line. This found two gaps: decision nodes didn't show their condition (only the edges did), and file upload existed in the API but not in the UI. I fixed both, and Claude generated the `test-data/` files I used to test the upload and its error handling.

**Where AI got things wrong or needed correcting:**
- the first layout used dagre, which ignores left/right order, so it had to be replaced. Some setup suggestions didn't match the current tool versions (newer `tsc --init` defaults), which only showed up when running the code.
- **Testing the upload:** the first test files Claude generated were too small (12–14 rows). When I uploaded one, the app showed a single 40%-confidence leaf instead of a tree. We traced it to `minSamplesSplit = 20` combined with the train/test split, and regenerated the valid files with 60 rows.

**My decisions:** the dataset and the label formula, dropping instead of imputing stress, choosing CART/Gini, keeping only the four required features, the default depth based on the experiment, and the project structure.
