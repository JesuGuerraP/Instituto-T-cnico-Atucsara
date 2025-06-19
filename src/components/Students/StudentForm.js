import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { doc, getDoc, setDoc, updateDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';

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
    semester: ''
  });
  const [teachers, setTeachers] = useState([]);
  const [careers, setCareers] = useState([]);

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
    fetchCareers();
  }, []);

  useEffect(() => {
    if (id) {
      const fetchStudent = async () => {
        try {
          const docRef = doc(db, 'students', id);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setStudent(docSnap.data());
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
    const { name, value } = e.target;
    setStudent(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const studentData = {
        ...student,
        updatedAt: new Date().toISOString()
      };

      if (id) {
        await updateDoc(doc(db, 'students', id), studentData);
        toast.success('Estudiante actualizado correctamente');
      } else {
        await setDoc(doc(collection(db, 'students')), {
          ...studentData,
          createdAt: new Date().toISOString()
        });
        toast.success('Estudiante creado correctamente');
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
          <div>
            <label className="block font-semibold mb-1 text-[#009245]">Carrera</label>
            <select
              name="career"
              value={student.career}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#23408e]"
              required
            >
              <option value="">Seleccionar carrera</option>
              {careers.map(c => (
                <option key={c.id} value={c.nombre}>{c.nombre}</option>
              ))}
            </select>
          </div>
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
          {/* Campo para asignar semestre */}
          <div>
            <label className="block font-semibold mb-1 text-[#009245]">Semestre</label>
            <select
              name="semester"
              value={student.semester || ''}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#23408e]"
              required
            >
              <option value="">Seleccionar semestre</option>
              <option value="1">Semestre 1</option>
              <option value="2">Semestre 2</option>
              <option value="3">Semestre 3</option>
              <option value="4">Semestre 4</option>
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