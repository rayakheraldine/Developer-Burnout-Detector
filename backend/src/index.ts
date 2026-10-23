import { app } from "./app.js";
import { loadCsv } from "./data/loadCsv.js";
import { trainModel } from "./model.js";
import { DEFAULT_PARAMS } from "./tree/buildTree.js";

// Train on the built-in dataset at startup, so /predict works immediately
trainModel(loadCsv(), DEFAULT_PARAMS, "default");

const PORT = Number(process.env.PORT) || 3001;
app.listen(PORT, () => console.log(`API listening on http://localhost:${PORT}`));