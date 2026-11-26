import { loadCatalog } from "./modules/catalog.browser";
import { mountDeviceNotice } from "./ui/device-notice";
import { loading } from "./ui/loading";

mountDeviceNotice();

void loadCatalog()
  .then(() => import("./main"))
  .catch(loading.fail);
