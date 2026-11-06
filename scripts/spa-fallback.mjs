// GitHub Pages serves 404.html for any path it has no file for: make that the app, so /wallet and /jobs/<id> load
// it and the router takes over. Real files (the guide, /network/, the installers) are served as they are.
import { copyFileSync } from "node:fs";
copyFileSync("dist/index.html", "dist/404.html");
