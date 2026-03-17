import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "./firebase";
import LoginPage from "./LoginPage";
import AppLayout from "./layouts/AppLayout";
import TokenReviewPage from "./pages/TokenReviewPage";
import VendorIntakePage from "./pages/VendorIntakePage";
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
      <div className="flex items-center justify-center h-screen">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Public: token review page — works without login */}
        <Route path="/review" element={<TokenReviewPage />} />

        {/* Public: vendor intake form — works without login */}
        <Route path="/vendor-intake" element={<VendorIntakePage />} />

        <Route
          path="/login"
          element={user ? <Navigate to="/" replace /> : <LoginPage />}
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
