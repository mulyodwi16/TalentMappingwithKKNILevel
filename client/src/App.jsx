import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
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
import Placement from "./pages/user/Placement.jsx";
import FinalExam from "./pages/user/FinalExam.jsx";
import LearningPath from "./pages/user/LearningPath.jsx";
import Mentor from "./pages/user/Mentor.jsx";
import Toko from "./pages/user/Toko.jsx";
import Jobs from "./pages/user/Jobs.jsx";
import Profile from "./pages/user/Profile.jsx";
import HrdDashboard from "./pages/hrd/HrdDashboard.jsx";
import JobBoard from "./pages/hrd/JobBoard.jsx";
import TalentList from "./pages/hrd/TalentList.jsx";
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

// Wrapper untuk animasi entrance di rute publik (/, /login, /register).
// Layout sudah pakai .page-enter untuk /app/*; ini menutupi celahnya.
function PublicPage({ children }) {
  const { pathname } = useLocation();
  return <div key={pathname} className="page-enter">{children}</div>;
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
        <Route path="/" element={<PublicPage><Landing /></PublicPage>} />
        <Route path="/login" element={<PublicPage><Login /></PublicPage>} />
        <Route path="/register" element={<PublicPage><Register /></PublicPage>} />
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
          <Route path="placement" element={<Placement />} />
          <Route path="final-exam" element={<FinalExam />} />
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
            path="hrd/talenta"
            element={
              <ProtectedRoute roles={["hrd", "admin"]}>
                <TalentList />
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
