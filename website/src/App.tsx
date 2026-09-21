import { NavLink, Route, Routes } from "react-router-dom";
import ComplaintPage from "./pages/ComplaintPage";
import TrackPage from "./pages/TrackPage";

function navLinkClass({ isActive }: { isActive: boolean }): string {
  return `px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
    isActive
      ? "bg-violet-600 text-white"
      : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
  }`;
}

function App() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex flex-col items-center px-4 py-8 sm:px-6 sm:py-10 lg:py-12">
      <nav className="flex gap-2 mb-6">
        <NavLink to="/" end className={navLinkClass}>
          Gửi khiếu nại
        </NavLink>
        <NavLink to="/theo-doi" className={navLinkClass}>
          Theo dõi trạng thái
        </NavLink>
      </nav>

      <div className="w-full max-w-sm sm:max-w-md lg:max-w-lg">
        <Routes>
          <Route path="/" element={<ComplaintPage />} />
          <Route path="/theo-doi" element={<TrackPage />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;
