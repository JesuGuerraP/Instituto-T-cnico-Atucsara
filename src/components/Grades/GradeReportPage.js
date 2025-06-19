import { useLocation, useNavigate } from 'react-router-dom';
import GradeReport from './GradeReport';

const GradeReportPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const grades = location.state?.grades || [];
  const modules = location.state?.modules || [];
  const groups = location.state?.groups || [];

  return (
    <div className="min-h-screen bg-[#f5f7fa] py-8 px-2">
      <div className="max-w-5xl mx-auto">
        <button
          onClick={() => navigate(-1)}
          className="mb-4 px-4 py-2 bg-[#009245] text-white rounded hover:bg-[#23408e] font-semibold"
        >
          ← Volver
        </button>
        <GradeReport
          grades={grades}
          modules={modules}
          groups={groups}
          onClose={() => navigate(-1)}
        />
      </div>
    </div>
  );
};

export default GradeReportPage;