import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Initialize theme on app load
const root = document.documentElement;
const savedTheme = localStorage.getItem("theme") || "system";
const savedColorScheme = localStorage.getItem("colorScheme") || "default";

let effectiveTheme: "light" | "dark";
if (savedTheme === "system") {
  effectiveTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
} else {
  effectiveTheme = savedTheme as "light" | "dark";
}

root.classList.add(effectiveTheme);

createRoot(document.getElementById("root")!).render(<App />);
