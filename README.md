# Developer Burnout Detector

A full-stack web app that predicts a developer's burnout status from a few daily habits, using a **Decision Tree implemented from scratch in TypeScript** (no ML libraries), and visualizes the trained tree as an interactive graph.

> 🚧 **Status: in progress.** The data pipeline and the decision tree algorithm are done and tested. The REST API, frontend and deployment are next.

| | |
|---|---|
| **Live demo** | _coming soon_ |
| **Repository** | https://github.com/rayakheraldine/Developer-Burnout-Detector |

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

I implemented a **CART-style binary decision tree** and chose **Gini impurity** as the default split criterion. **Entropy** is implemented as an alternative and can be selected when training.

**Why CART:**
- **All splits are binary** (`feature <= threshold`). This handles the three numeric features naturally, without having to bin them into categories first (as ID3 would require).
- **The one categorical feature (weekends) is binary anyway**, so it fits the same yes/no structure.
- **Binary trees are easier to visualize.** Every node has exactly two children, which keeps the graph clean.

**Why Gini as the default:** it measures the same thing as entropy (how mixed the classes in a node are) and usually produces nearly identical trees. It's slightly cheaper because it needs no logarithms.

- Gini = 1 − Σ pᵢ² → 0 for a pure node, maximum 0.75 for 4 equal classes
- Entropy = −Σ pᵢ · log₂(pᵢ) → 0 for a pure node, maximum 2 bits for 4 equal classes

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
- **Every node stores its stats** (`samples`, `classCounts`, `impurity`) for the hover tooltips in the graph.
- **Predictions return the decision path** as well as the label, so the frontend can highlight the route through the tree.
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
- **Deeper trees score slightly worse on the test set** (0.986 → 0.984). The extra splits on sleep, meetings and weekends fit a few noisy training rows near the class boundaries and don't generalize. This is overfitting.
- **Removing daily work hours didn't change the result at depths 1–3**, because those trees only use stress. It only changed which secondary features the deeper (overfitted) trees pick.
- **`maxDepth = 3` is therefore the default:** best test accuracy and the simplest tree.

---

## Project structure

```
Developer-Burnout-Detector/
├── data/
│   ├── data_eda.ipynb        # cleaning + EDA
│   └── burnout_clean.csv     # training data
└── backend/
    └── src/
        ├── data/
        │   └── loadCsv.ts    # CSV parsing + validation
        └── tree/
            ├── types.ts      # Row, TreeNode, TreeParams, ...
            ├── impurity.ts   # gini, entropy, class counts, majority
            ├── splits.ts     # best threshold search, goesLeft
            ├── buildTree.ts  # recursive training + stopping rules
            ├── predict.ts    # tree traversal, returns verdict + path
            ├── evaluate.ts   # seeded train/test split, accuracy
            └── *.test.ts     # unit tests (Vitest)
```

## Running locally

```bash
cd backend
npm install
npm test        # run the unit tests
```

## Known limitations
- **The CSV parser splits on commas**, so it doesn't support quoted fields containing commas. That's fine for the provided dataset, but would need a proper parser for arbitrary uploads.
- **Because of the label leakage described above**, the model mostly reflects how the labels were built rather than a deeper pattern.
- **The `weekends` feature is synthetic.** It was generated from work hours, stress and sleep, so any link between weekends and burnout in this data comes from that generation step, not from real observations. This also explains why weekends correlates with the worse classes in the EDA.

---

## AI collaboration

I used Claude (Anthropic) as a mentor and pair programmer throughout the project:

- **Planning:** turned the task into ordered steps (data → algorithm → API → frontend → deployment).
- **Dataset adaptation:** the Kaggle dataset had no weekend-work column, so with Claude I generated a `Weekends` column from work hours, stress and sleep, with added randomness.
- **Data review:** Claude reviewed my cleaning notebook and pointed out that mean-imputing stress *before* building the labels created contradictory rows. I changed the cleaning step and verified the fix with my own sanity-check cell.
- **Code:** Claude drafted the TypeScript types, the CSV loader and the tree functions, with explanations. I read and integrated them, ran the tests, and checked the loader's output against the notebook's row and class counts.
- **Debugging:** helped with TypeScript/Node setup issues (ES modules vs CommonJS, `verbatimModuleSyntax`, `"types": ["node"]`, replacing ts-node with tsx).
- **Analysis:** I noticed that changing `maxDepth` seemed to have no effect; together we traced it to the data, not a bug. That led to the depth experiment and the leakage/overfitting findings above.

**My decisions:** the dataset and label mapping, dropping instead of imputing stress, choosing CART/Gini, the default depth based on the experiment, and the project structure.