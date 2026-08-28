import { createRoot } from "react-dom/client";
import Home from "../app/page";
import "../app/globals.css";
import "../app/navigation.css";
import "../app/guide.css";
import "../app/map.css";
import "../app/key-wiki.css";
createRoot(document.getElementById("root")!).render(<Home />);
