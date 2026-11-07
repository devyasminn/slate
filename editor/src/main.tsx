import React from "react";
import ReactDOM from "react-dom/client";
import './styles/tokens.css';
import './styles/global.css';
import './styles/ui.css';
import './styles/radix.css';
import App from "./App";

document.addEventListener("contextmenu", (event) => event.preventDefault());

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
