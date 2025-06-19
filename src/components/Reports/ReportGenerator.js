import { useState } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import StudentReportPDF from './StudentReportPDF';

const ReportGenerator = ({ students = [], courses = [], grades = [] }) => {
  const [selectedReport, setSelectedReport] = useState('student_list');
  const [selectedStudent, setSelectedStudent] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('');

  const generateReport = () => {
    switch (selectedReport) {
      case 'student_list':
        return {
          filename: `lista_estudiantes_${format(new Date(), 'yyyyMMdd')}.pdf`,
          document: <StudentReportPDF 
            title="Lista de Estudiantes" 
            data={students} 
            columns={[
              { header: 'Nombre', accessor: 'name' },
              { header: 'Apellido', accessor: 'lastName' },
              { header: 'DNI', accessor: 'dni' },
              { header: 'Carrera', accessor: 'career' },
              { header: 'Estado', accessor: 'status' }
            ]}
          />
        };
      case 'student_grades':
        const student = students.find(s => s.id === selectedStudent);
        const studentGrades = grades.filter(g => g.studentId === selectedStudent);
        
        return {
          filename: `boletin_${student?.dni || 'estudiante'}_${format(new Date(), 'yyyyMMdd')}.pdf`,
          document: <StudentReportPDF 
            title={`Boletín de Notas - ${student?.name || ''} ${student?.lastName || ''}`}
            data={studentGrades.map(grade => {
              const course = courses.find(c => c.id === grade.courseId);
              return {
                course: course?.name || 'Desconocido',
                grade: grade.grade,
                status: grade.grade >= 6 ? 'Aprobado' : 'Reprobado'
              };
            })}
            columns={[
              { header: 'Materia', accessor: 'course' },
              { header: 'Nota', accessor: 'grade' },
              { header: 'Estado', accessor: 'status' }
            ]}
          />
        };
      case 'course_grades':
        const course = courses.find(c => c.id === selectedCourse);
        const courseGrades = grades.filter(g => g.courseId === selectedCourse);
        
        return {
          filename: `notas_${course?.code || 'curso'}_${format(new Date(), 'yyyyMMdd')}.pdf`,
          document: <StudentReportPDF 
            title={`Notas del Curso - ${course?.name || ''}`}
            data={courseGrades.map(grade => {
              const student = students.find(s => s.id === grade.studentId);
              return {
                student: student ? `${student.name} ${student.lastName}` : 'Desconocido',
                grade: grade.grade,
                status: grade.grade >= 6 ? 'Aprobado' : 'Reprobado'
              };
            })}
            columns={[
              { header: 'Estudiante', accessor: 'student' },
              { header: 'Nota', accessor: 'grade' },
              { header: 'Estado', accessor: 'status' }
            ]}
          />
        };
      default:
        return null;
    }
  };

  const report = generateReport();

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6">Generador de Reportes</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Reporte</label>
          <select
            value={selectedReport}
            onChange={(e) => setSelectedReport(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md"
          >
            <option value="student_list">Lista de Estudiantes</option>
            <option value="student_grades">Boletín de Notas</option>
            <option value="course_grades">Notas por Curso</option>
          </select>
        </div>

        {selectedReport === 'student_grades' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Estudiante</label>
            <select
              value={selectedStudent}
              onChange={(e) => setSelectedStudent(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md"
            >
              <option value="">Seleccionar estudiante</option>
              {students.map(student => (
                <option key={student.id} value={student.id}>
                  {student.name} {student.lastName} - {student.dni}
                </option>
              ))}
            </select>
          </div>
        )}

        {selectedReport === 'course_grades' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Curso</label>
            <select
              value={selectedCourse}
              onChange={(e) => setSelectedCourse(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md"
            >
              <option value="">Seleccionar curso</option>
              {courses.map(course => (
                <option key={course.id} value={course.id}>
                  {course.name} ({course.code})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="flex justify-center">
        {report ? (
          <PDFDownloadLink
            document={report.document}
            fileName={report.filename}
            className="bg-indigo-600 text-white px-6 py-3 rounded-md hover:bg-indigo-700"
          >
            {({ loading }) => (loading ? 'Preparando reporte...' : 'Descargar Reporte')}
          </PDFDownloadLink>
        ) : (
          <button
            disabled
            className="bg-gray-400 text-white px-6 py-3 rounded-md cursor-not-allowed"
          >
            Seleccione opciones para generar reporte
          </button>
        )}
      </div>
    </div>
  );
};

export default ReportGenerator;