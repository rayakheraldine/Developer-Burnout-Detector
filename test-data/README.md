# Test datasets for the upload feature

Upload these in the dashboard (Model → Training data) and click Retrain.

| File | Expected result |
|---|---|
| `valid_small.csv` | Trains (60 rows → 48 train / 12 test). A 4-leaf tree splitting only on stress, 100% test accuracy, "Data: uploaded file". |
| `valid_extra_column.csv` | Trains the same kind of tree. The extra `work_hours` column is ignored. |
| `valid_rows.json` | Trains the same kind of tree. JSON array; weekends given as "Yes"/"No" and true/false. |
| `invalid_weekends.csv` | 400: line 4, weekends must be "Yes"/"No" or true/false ("Maybe"). |
| `invalid_stress_range.csv` | 400: line 7, stress must be between 1 and 10 (got 55). |
| `invalid_not_a_number.csv` | 400: line 4, sleep must be a number ("eight"). |
| `invalid_unknown_label.csv` | 400: line 7, unknown status "Slightly tired". |
| `invalid_missing_column.csv` | 400: CSV is missing column "stress". |
| `invalid_too_few_rows.csv` | 400: need at least 10 rows to train (got 4). |
| `invalid_not_array.json` | 400: "rows" must be an array. |
| `invalid_syntax.json` | Error in the browser: file is not valid JSON (never sent to the server). |

After an error, the previous model stays active and the server keeps running.

**Why the valid files have 60 rows:** a node is only split if it has at least 20 rows (`minSamplesSplit = 20`). With the 80/20 train/test split, a file needs about 25+ rows before the tree can split at all; a smaller file trains successfully but produces a single leaf.
