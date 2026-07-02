import { Navigate } from "react-router-dom";
import useAuthStore from "../store/authStore.js";

export default function ProtectedRoute({ children, roles }) {
  const { token, user } = useAuthStore();
  if (!token) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user?.role)) return <Navigate to="/app/dashboard" replace />;
  return children;
}
