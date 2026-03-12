import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "./firebase";
import LoginPage from "./LoginPage";
import AppLayout from "./layouts/AppLayout";
import { UserProvider } from "./contexts/UserContext";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "sans-serif" }}>
        Loading...
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />}
        />
        <Route
          path="/*"
          element={
            user ? (
              <UserProvider uid={user.uid} email={user.email ?? ""}>
                <AppLayout />
              </UserProvider>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
