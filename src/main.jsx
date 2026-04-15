import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import "./styles.css";
import { seedLocationsIfEmpty } from "./db/seed.js";
import { AuthProvider } from "./auth/AuthContext.jsx";

(async () => {
  // crea 504 ubicaciones si es primera vez
  await seedLocationsIfEmpty();
})();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
