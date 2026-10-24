# Developer Burnout Detector

A full-stack web app that predicts a developer's burnout status from a few daily habits, using a **Decision Tree implemented from scratch in TypeScript** (no ML libraries), and visualizes the trained tree as an interactive graph.

| | |
|---|---|
| **Live demo** | https://developer-burnout-detector-ashy.vercel.app |
| **Backend API** | https://developer-burnout-detector.onrender.com/api/health |
| **Repository** | https://github.com/rayakheraldine/Developer-Burnout-Detector |

> ⏳ The backend runs on Render's free plan, which sleeps after about 15 minutes without traffic. **The first load can take up to a minute** while it wakes up; after that, predictions are instant.

<img width="1611" height="967" alt="image" src="https://github.com/user-attachments/assets/f2079f67-a105-4f5c-8de9-d751c7f6860b" />


## Features

- **Live predictions.** Move the sliders (sleep, meetings, stress) and the weekends checkbox, and the verdict updates instantly.
- **Explained verdicts.** The path the prediction took is highlighted in the tree, and the verdict shows how confident the model is (with a "close call" warning below 70%).
- **Interactive tree graph.** Every decision node shows its condition (e.g. "Stress level ≤ 3.45?") with Yes/No branches. Leaves are colored by class. Hovering a node shows its training statistics: sample count, class breakdown, impurity and information gain.
- **Retraining from the UI.** Change the maximum depth or the split criterion (Gini / Entropy) and retrain. The graph redraws and the new train/test accuracy is shown.
- **Train on your own data.** Upload a CSV or JSON file in the dashboard and retrain on it, or switch back to the built-in dataset. Invalid files are rejected with a clear message.

---

## Prediction classes

| Class | Meaning |
|---|---|
| 🟢 Healthy | No signs of burnout |
| 🟡 Risk of burnout | Early warning signs |
| 🟠 Vacation required | High burnout |
| 🔴 Critical condition | High burnout combined with very high stress |

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
2. **Rows with missing stress were dropped, not imputed.** The `Critical condition` label is defined using stress (see step 5), so a filled-in stress value could contradict the row's label. A first version used mean imputation, and the EDA found 58 rows whose imputed stress (5.4) didn't fit their class. Dropping these rows removed the problem.
3. **Other missing numeric values were filled with the column median** (robust to outliers). Meetings were rounded to whole numbers and hours to 2 decimals, matching the original data.
4. **Stress was rescaled** from 0–100 to the 1–10 scale the task asks for.
5. **The original 3 levels were mapped to the 4 target classes:**
   - `Low` → Healthy
   - `Medium` → Risk of burnout
   - `High` → Vacation required, or **Critical condition** if stress ≥ 8.5
6. **Only the four required features are kept** (sleep, meetings, weekends, stress). Daily work hours was explored in the EDA, and used to generate `Weekends`, but is not a model input.

### EDA findings
- **Classes are imbalanced.** About half the rows are "Risk of burnout", while "Critical condition" is only about 10%.
- **Stress is by far the strongest feature** (correlation ≈ 0.92 with the status). Work hours and weekends come next; meetings and sleep are weaker.
- Developers who work weekends end up much more often in the worse categories.

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

| maxDepth | Real depth | Leaves | Test accuracy | Features used |
|---|---|---|---|---|
| 1 | 1 | 2 | 0.717 | stress |
| 2 | 2 | 3 | 0.874 | stress |
| **3** | **3** | **5** | **0.986** | **stress** |
| 5 | 5 | 10 | 0.985 | stress, sleep, meetings |
| 8 | 8 | 16 | 0.984 | stress, sleep, meetings, weekends |

**Interpretation:**

- **Stress alone reaches 98.6% accuracy at depth 3.** This is expected, not a sign of a great model: the `Critical condition` label is defined partly by stress (≥ 8.5), and in this dataset the original burnout levels fall into almost non-overlapping stress ranges. The tree essentially learns those ranges.
- **Deeper trees score slightly worse on the test set** (0.986 → 0.984). The extra splits on sleep, meetings and weekends fit a few noisy training rows near the class boundaries and don't generalize. This is overfitting. It can be reproduced in the app by raising the max depth and retraining.
- **Removing daily work hours didn't change the result at depths 1–3**, because those trees only use stress. It only changed which secondary features the deeper (overfitted) trees pick.
- **`maxDepth = 3` is therefore the default:** best test accuracy and the simplest tree.

**The gray zone around stress 3.5.** One leaf of the default tree covers stress between 3.45 and 3.55. It contains 31 Healthy and 33 Risk rows: 52% confidence and impurity 0.5, the maximum for two classes. People with almost identical stress ended up in different classes, so a prediction landing there is close to a coin flip. This is why the app shows confidence and a "close call" warning, not just the label.

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
- At least 10 rows, maximum 5 MB.

Example requests, including invalid ones, are in [`backend/api.http`](backend/api.http).

### Validation and error handling
- **One validator for every input.** Prediction input, uploaded rows, CSV files and the built-in dataset all pass through the same checks: required fields, numbers, ranges (stress 1–10, sleep and meetings 0–24), Yes/No or true/false for weekends, and known class labels.
- **Errors are thrown as `HttpError`s and handled by one Express middleware.** Every error becomes a JSON response with a clear message: 400 for invalid input or malformed JSON (with the CSV line number where relevant), 413 for oversized uploads, 404 for unknown routes. Unexpected errors return a generic 500 and are logged. The server never crashes on bad input.
- **The frontend shows the backend's error message** in the dashboard instead of failing silently. Files that are too large or aren't valid JSON are caught in the browser before anything is sent. After a failed upload, the previous model stays active.
- **Test files for uploads** are in [`test-data/`](test-data/): valid and invalid CSV/JSON datasets, each with its expected result.

### Frontend
- **Tree → graph conversion** (`graph/toFlow.ts`): a recursive walk turns the nested tree into React Flow's flat `nodes` and `edges` lists. Each decision node asks its question ("Stress level ≤ 3.45?", "Works weekends?"), and its two edges are labelled **Yes** (left, condition true) and **No** (right).
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
│   ├── data_eda.ipynb          # cleaning + EDA
│   └── burnout_clean.csv       # training data
├── test-data/                  # valid + invalid upload files, with expected results
├── backend/
│   ├── api.http                # example + invalid requests (REST Client)
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
    └── src/
        ├── App.tsx             # shared state, prediction requests, graph
        ├── Dashboard.tsx       # sliders, verdict, retraining controls, file upload
        ├── api.ts              # backend calls + error messages
        ├── useDebouncedValue.ts
        ├── colors.ts           # one color per class
        ├── types.ts
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
- **Because of the label leakage described above**, the model mostly reflects how the labels were built rather than a deeper pattern.
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
- **Deployment:** Claude walked me through deploying to Render and Vercel and through the CORS errors that followed: the frontend first pointed at a wrong backend URL, I then opened a per-deployment preview URL that CORS didn't allow, and production was still serving an old build. After deploying, I noticed the dashboard showed "depth 3" next to a deeper tree I had trained, which led to syncing the controls with the loaded model.
- **Requirements check:** at the end I had Claude compare the app against the task line by line. This found two gaps: decision nodes didn't show their condition (only the edges did), and file upload existed in the API but not in the UI. I fixed both, and Claude generated the `test-data/` files I used to test the upload and its error handling.

**Where AI got things wrong or needed correcting:** the first layout used dagre, which ignores left/right order, so it had to be replaced. Some setup suggestions didn't match the current tool versions (newer `tsc --init` defaults), which only showed up when running the code.

**My decisions:** the dataset and label mapping, dropping instead of imputing stress, choosing CART/Gini, keeping only the four required features, the default depth based on the experiment, and the project structure.
