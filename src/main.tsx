import React from "react";
import ReactDOM from "react-dom/client";
import "./variables.css";
import "./App.css";
import App from "./App";
import { ThemeProvider } from "./contexts/ThemeContext";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>,
);
