import { Routes, Route } from "react-router-dom";
import Nav from "./components/Nav.jsx";

import Home from "./pages/Home.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import Profile from "./pages/Profile.jsx";
import Admin from "./pages/Admin.jsx";

import Quality from "./pages/Quality.jsx";
import Dispatch from "./pages/Dispatch.jsx";
import Daily from "./pages/Daily.jsx";
import Camera from "./pages/Camera.jsx";

// Cámara (operación legacy)
import Entry from "./pages/Entry.jsx";
import AssignFIFO from "./pages/AssignFIFO.jsx";
import Exit from "./pages/Exit.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Search from "./pages/Search.jsx";
import Export from "./pages/Export.jsx";

import RequireAuth from "./components/RequireAuth.jsx";
import RequireRole from "./components/RequireRole.jsx";
import { ROLES } from "./auth/roles.js";

export default function App() {
  return (
    <div className="appShell">
      <div className="appContainer">
        <Nav />

        <main className="pageContent">
          <Routes>
            {/* Public */}
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Auth */}
            <Route
              path="/profile"
              element={
                <RequireAuth>
                  <Profile />
                </RequireAuth>
              }
            />

            <Route
              path="/admin"
              element={
                <RequireAuth>
                  <RequireRole allow={[ROLES.ADMIN]}>
                    <Admin />
                  </RequireRole>
                </RequireAuth>
              }
            />

            {/* Operational areas */}
            <Route
              path="/quality"
              element={
                <RequireAuth>
                  <RequireRole allow={[ROLES.ADMIN, ROLES.QC_PROCESS, ROLES.QC_DISPATCH]}>
                    <Quality />
                  </RequireRole>
                </RequireAuth>
              }
            />

            <Route
              path="/dispatch"
              element={
                <RequireAuth>
                  <RequireRole allow={[ROLES.ADMIN, ROLES.DISPATCH]}>
                    <Dispatch />
                  </RequireRole>
                </RequireAuth>
              }
            />

            <Route
              path="/camera"
              element={
                <RequireAuth>
                  <RequireRole allow={[ROLES.ADMIN, ROLES.STORAGE]}>
                    <Camera />
                  </RequireRole>
                </RequireAuth>
              }
            />

            <Route
              path="/entry"
              element={
                <RequireAuth>
                  <RequireRole allow={[ROLES.ADMIN, ROLES.STORAGE]}>
                    <Entry />
                  </RequireRole>
                </RequireAuth>
              }
            />
            <Route
              path="/assign-fifo"
              element={
                <RequireAuth>
                  <RequireRole allow={[ROLES.ADMIN, ROLES.STORAGE]}>
                    <AssignFIFO />
                  </RequireRole>
                </RequireAuth>
              }
            />
            <Route
              path="/exit"
              element={
                <RequireAuth>
                  <RequireRole allow={[ROLES.ADMIN, ROLES.STORAGE]}>
                    <Exit />
                  </RequireRole>
                </RequireAuth>
              }
            />

            {/* Reports / consult */}
            <Route
              path="/daily"
              element={
                <RequireAuth>
                  <Daily />
                </RequireAuth>
              }
            />
            <Route
              path="/dashboard"
              element={
                <RequireAuth>
                  <Dashboard />
                </RequireAuth>
              }
            />
            <Route
              path="/search"
              element={
                <RequireAuth>
                  <Search />
                </RequireAuth>
              }
            />
            <Route
              path="/export"
              element={
                <RequireAuth>
                  <Export />
                </RequireAuth>
              }
            />
          </Routes>
        </main>
      </div>
    </div>
  );
}
