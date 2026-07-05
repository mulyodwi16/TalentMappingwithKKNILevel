import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import Landing from "./pages/Landing.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import Layout from "./components/Layout.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import useAuthStore from "./store/authStore.js";
import UserDashboard from "./pages/user/UserDashboard.jsx";
import CVUpload from "./pages/user/CVUpload.jsx";
import Exam from "./pages/user/Exam.jsx";
import Kelas from "./pages/user/Kelas.jsx";
import SkillGap from "./pages/user/SkillGap.jsx";
import LearningPath from "./pages/user/LearningPath.jsx";
import Mentor from "./pages/user/Mentor.jsx";
import Toko from "./pages/user/Toko.jsx";
import Jobs from "./pages/user/Jobs.jsx";
import Profile from "./pages/user/Profile.jsx";
import HrdDashboard from "./pages/hrd/HrdDashboard.jsx";
import JobBoard from "./pages/hrd/JobBoard.jsx";
import AvatarEduSettings from "./pages/admin/AvatarEduSettings.jsx";
import AdminDashboard from "./pages/admin/AdminDashboard.jsx";
import UserManagement from "./pages/admin/UserManagement.jsx";
import RuleManagement from "./pages/admin/RuleManagement.jsx";
import QuestionBank from "./pages/admin/QuestionBank.jsx";
import RequestInbox from "./pages/admin/RequestInbox.jsx";
import AuditLogPage from "./pages/admin/AuditLogPage.jsx";

function DashboardGate() {
  const { user } = useAuthStore();
  if (user?.role === "hrd") return <Navigate to="/app/hrd" replace />;
  if (user?.role === "admin") return <Navigate to="/app/admin" replace />;
  return <UserDashboard />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: { background: "var(--bg-surface)", color: "var(--text-base)", border: "1px solid var(--border)" },
          success: { iconTheme: { primary: "#10b981", secondary: "var(--bg-surface)" } },
          error:   { iconTheme: { primary: "#ef4444", secondary: "var(--bg-surface)" } },
        }}
      />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="dashboard" replace />} />
          {/* User */}
          <Route path="dashboard" element={<DashboardGate />} />
          <Route path="cv-upload" element={<CVUpload />} />
          <Route path="kelas" element={<Kelas />} />
          <Route path="exam" element={<Exam />} />
          <Route path="skill-gap" element={<SkillGap />} />
          <Route path="learning-path" element={<LearningPath />} />
          <Route path="mentor" element={<Mentor />} />
          <Route path="toko" element={<Toko />} />
          <Route path="jobs" element={<Jobs />} />
          <Route path="profile" element={<Profile />} />
          {/* HRD */}
          <Route
            path="hrd"
            element={
              <ProtectedRoute roles={["hrd", "admin"]}>
                <HrdDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="hrd/jobs"
            element={
              <ProtectedRoute roles={["hrd", "admin"]}>
                <JobBoard />
              </ProtectedRoute>
            }
          />
          {/* Admin */}
          <Route
            path="admin"
            element={
              <ProtectedRoute roles={["admin"]}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/users"
            element={
              <ProtectedRoute roles={["admin"]}>
                <UserManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/rules"
            element={
              <ProtectedRoute roles={["admin"]}>
                <RuleManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/questions"
            element={
              <ProtectedRoute roles={["admin"]}>
                <QuestionBank />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/requests"
            element={
              <ProtectedRoute roles={["admin"]}>
                <RequestInbox />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/audit"
            element={
              <ProtectedRoute roles={["admin"]}>
                <AuditLogPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/avataredu"
            element={
              <ProtectedRoute roles={["admin"]}>
                <AvatarEduSettings />
              </ProtectedRoute>
            }
          />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
