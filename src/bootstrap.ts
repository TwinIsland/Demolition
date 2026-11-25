import { loadCatalog } from "./modules/catalog.browser";
import { loading } from "./ui/loading";

void loadCatalog()
  .then(() => import("./main"))
  .catch(loading.fail);
