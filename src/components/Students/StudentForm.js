import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { doc, getDoc, setDoc, updateDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import { calculatePeriod } from '../../utils/periodHelper';

const StudentForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(!!id);
  const [student, setStudent] = useState({
    name: '',
    lastName: '',
    dni: '',
    email: '',
    phone: '',
    address: '',
    career: '',
    status: 'active',
    teacherId: '',
    semester: '',
    courses: [],
    coursePeriod: ''
  });
  const [teachers, setTeachers] = useState([]);
  const [careers, setCareers] = useState([]);
  const [courses, setCourses] = useState([]);
  const [originalCourses, setOriginalCourses] = useState([]);
  const [enrollmentType, setEnrollmentType] = useState('carrera');

  useEffect(() => {
    const fetchTeachers = async () => {
      const snapshot = await getDocs(collection(db, 'teachers'));
      setTeachers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };
    fetchTeachers();
  }, []);

  useEffect(() => {
    const fetchCareers = async () => {
      const careersSnap = await getDocs(collection(db, 'careers'));
      setCareers(careersSnap.docs.map(doc => ({ id: doc.id, ...doc.data(), modulos: [] })));
    };
    const fetchCourses = async () => {
      const coursesSnap = await getDocs(collection(db, 'courses'));
      setCourses(coursesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };
    fetchCareers();
    fetchCourses();
  }, []);

  useEffect(() => {
    if (id) {
      const fetchStudent = async () => {
        try {
          const docRef = doc(db, 'students', id);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            setStudent({ ...data, courses: Array.isArray(data.courses) ? data.courses : [] });
            setOriginalCourses(Array.isArray(data.courses) ? data.courses : []);
            // Set enrollment type based on fetched data
            const hasCareer = !!data.career;
            const hasCourses = Array.isArray(data.courses) && data.courses.length > 0;
            if (hasCareer && hasCourses) {
              setEnrollmentType('ambos');
            } else if (hasCourses) {
              setEnrollmentType('curso');
            } else {
              setEnrollmentType('carrera');
            }
          }
          setLoading(false);
        } catch (error) {
          console.error("Error fetching student: ", error);
          setLoading(false);
        }
      };
      fetchStudent();
    } else {
      setLoading(false);
    }
  }, [id]);

  const handleChange = (e) => {
    const { name, value, multiple, options } = e.target;
    if (name === 'courses' && multiple) {
      const values = Array.from(options).filter(o => o.selected).map(o => o.value);
      setStudent(prev => ({ ...prev, courses: values }));
      return;
    }
    // Asegurarnos de que el semestre se guarde como string
    if (name === 'semester') {
      setStudent(prev => ({ ...prev, [name]: value ? String(value) : '' }));
    } else {
      setStudent(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const now = new Date();
      const period = calculatePeriod(now);
      
      let studentData = {
        ...student,
        semester: student.semester ? String(student.semester) : '',
        courses: Array.isArray(student.courses) ? student.courses : [],
        period: period, // Agregar período calculado
        updatedAt: now.toISOString()
      };

      // Clean up data based on enrollment type
      if (enrollmentType === 'carrera') {
        studentData.courses = [];
        studentData.coursePeriod = '';
      } else if (enrollmentType === 'curso') {
        studentData.career = '';
        studentData.semester = '';
      }

      let studentId = id;
      if (id) {
        await updateDoc(doc(db, 'students', id), studentData);
        studentId = id;
        toast.success('Estudiante actualizado correctamente');
      } else {
        const studentsCol = collection(db, 'students');
        const newDocRef = doc(studentsCol);
        await setDoc(newDocRef, {
          ...studentData,
          createdAt: now.toISOString()
        });
        studentId = newDocRef.id;
        toast.success('Estudiante creado correctamente');
      }

      // Sincronizar relación estudiante-curso en cada curso
      const studentName = `${student.name} ${student.lastName || ''}`.trim();
      const newCourses = studentData.courses; // Use cleaned up courses
      const prevCourses = Array.isArray(originalCourses) ? originalCourses : [];
      const toAdd = newCourses.filter(c => !prevCourses.includes(c));
      const toRemove = prevCourses.filter(c => !newCourses.includes(c));

      for (const courseId of toAdd) {
        const courseRef = doc(db, 'courses', courseId);
        const courseSnap = await getDoc(courseRef);
        const data = courseSnap.exists() ? courseSnap.data() : {};
        const courseStudents = Array.isArray(data.students) ? data.students : [];
        if (!courseStudents.some(s => s.id === studentId)) {
          courseStudents.push({ id: studentId, name: studentName });
          await updateDoc(courseRef, { students: courseStudents });
        }
      }
      for (const courseId of toRemove) {
        const courseRef = doc(db, 'courses', courseId);
        const courseSnap = await getDoc(courseRef);
        const data = courseSnap.exists() ? courseSnap.data() : {};
        const courseStudents = Array.isArray(data.students) ? data.students : [];
        const nextStudents = courseStudents.filter(s => s.id !== studentId);
        await updateDoc(courseRef, { students: nextStudents });
      }

      navigate('/dashboard/students');
    } catch (error) {
      toast.error('Error guardando el estudiante.');
      console.error('Error saving student: ', error);
    }
  };

  if (loading) return <div className="text-[#23408e] font-semibold">Cargando estudiante...</div>;

  return (
    <div className="bg-white p-8 rounded-lg shadow-md border-l-4 border-[#009245] max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 text-[#23408e]">
        {id ? 'Editar Estudiante' : 'Nuevo Estudiante'}
      </h2>
      <form onSubmit={handleSubmit}>
        <div className="mb-6 p-4 border rounded-md bg-gray-50">
            <label className="block font-semibold mb-2 text-[#009245]">Tipo de Inscripción</label>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="enrollmentType" value="carrera" checked={enrollmentType === 'carrera'} onChange={e => setEnrollmentType(e.target.value)} className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300" />
                    <span className="text-gray-700">Carrera</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="enrollmentType" value="curso" checked={enrollmentType === 'curso'} onChange={e => setEnrollmentType(e.target.value)} className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300" />
                    <span className="text-gray-700">Curso</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="enrollmentType" value="ambos" checked={enrollmentType === 'ambos'} onChange={e => setEnrollmentType(e.target.value)} className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300" />
                    <span className="text-gray-700">Ambos</span>
                </label>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block font-semibold mb-1 text-[#009245]">Nombre</label>
            <input
              type="text"
              name="name"
              value={student.name}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#23408e]"
              required
            />
          </div>
          <div>
            <label className="block font-semibold mb-1 text-[#009245]">Apellido</label>
            <input
              type="text"
              name="lastName"
              value={student.lastName}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#23408e]"
              required
            />
          </div>
          <div>
            <label className="block font-semibold mb-1 text-[#009245]">DNI</label>
            <input
              type="text"
              name="dni"
              value={student.dni}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#23408e]"
              required
            />
          </div>
          <div>
            <label className="block font-semibold mb-1 text-[#009245]">Email</label>
            <input
              type="email"
              name="email"
              value={student.email}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#23408e]"
              required
            />
          </div>
          <div>
            <label className="block font-semibold mb-1 text-[#009245]">Teléfono</label>
            <input
              type="tel"
              name="phone"
              value={student.phone}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#23408e]"
            />
          </div>
          <div>
            <label className="block font-semibold mb-1 text-[#009245]">Dirección</label>
            <input
              type="text"
              name="address"
              value={student.address}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#23408e]"
            />
          </div>

          {(enrollmentType === 'carrera' || enrollmentType === 'ambos') && (
            <>
              <div>
                <label className="block font-semibold mb-1 text-[#009245]">Carrera</label>
                <select
                  name="career"
                  value={student.career}
                  onChange={handleChange}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#23408e]"
                  required={enrollmentType === 'carrera' || enrollmentType === 'ambos'}
                >
                  <option value="">Seleccionar carrera</option>
                  {careers.map(c => (
                    <option key={c.id} value={c.nombre}>{c.nombre}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1 text-[#009245]">Semestre</label>
                <select
                  name="semester"
                  value={student.semester || ''}
                  onChange={handleChange}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#23408e]"
                  required={enrollmentType === 'carrera' || enrollmentType === 'ambos'}
                >
                  <option value="">Seleccionar semestre</option>
                  <option value="1">Semestre 1</option>
                  <option value="2">Semestre 2</option>
                  <option value="3">Semestre 3</option>
                  <option value="4">Semestre 4</option>
                </select>
              </div>
            </>
          )}

          {(enrollmentType === 'curso' || enrollmentType === 'ambos') && (
            <>
              <div className="md:col-span-2">
                <label className="block font-semibold mb-1 text-[#009245]">Cursos (opcional)</label>
                <select
                  multiple
                  name="courses"
                  value={student.courses || []}
                  onChange={handleChange}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#23408e] min-h-[120px]"
                >
                  {courses.map(c => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">Mantén Ctrl/⌘ para seleccionar múltiples cursos.</p>
              </div>
              <div>
                <label className="block font-semibold mb-1 text-[#009245]">Período del Curso</label>
                <select
                  name="coursePeriod"
                  value={student.coursePeriod || ''}
                  onChange={handleChange}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#23408e]"
                  required={enrollmentType === 'curso'}
                >
                  <option value="">Seleccionar período</option>
                  <option value={`${new Date().getFullYear()}-1`}>{`${new Date().getFullYear()}-1`}</option>
                  <option value={`${new Date().getFullYear()}-2`}>{`${new Date().getFullYear()}-2`}</option>
                </select>
              </div>
            </>
          )}

          <div>
            <label className="block font-semibold mb-1 text-[#009245]">Estado</label>
            <select
              name="status"
              value={student.status}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#23408e]"
              required
            >
              <option value="active">Activo</option>
              <option value="inactive">Inactivo</option>
            </select>
          </div>
          <div>
            <label className="block font-semibold mb-1 text-[#009245]">Profesor asignado</label>
            <select
              name="teacherId"
              value={student.teacherId || ''}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#23408e]"
            >
              <option value="">Sin asignar</option>
              {teachers.map(teacher => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.name} {teacher.lastName}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-6 flex justify-end space-x-3">
          <button
            type="button"
            onClick={() => navigate('/dashboard/students')}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-[#009245] text-white rounded-md hover:bg-[#23408e] font-semibold"
          >
            {id ? 'Actualizar' : 'Guardar'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default StudentForm;