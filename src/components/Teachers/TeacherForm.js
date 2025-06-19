import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { doc, getDoc, setDoc, updateDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';

const TeacherForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(!!id);
  const [teacher, setTeacher] = useState({
    name: '',
    lastName: '',
    specialty: '',
    email: '',
    phone: '',
    salary: '', // Nuevo campo para salario mensual
    career: '', // Nueva carrera asignada
    status: 'active'
  });
  const [careers, setCareers] = useState([]);
  const [modulosAsignados, setModulosAsignados] = useState([]);

  useEffect(() => {
    if (id) {
      const fetchTeacher = async () => {
        try {
          const docRef = doc(db, 'teachers', id);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setTeacher(docSnap.data());
          }
          setLoading(false);
        } catch (error) {
          console.error("Error fetching teacher: ", error);
          setLoading(false);
        }
      };
      fetchTeacher();
    } else {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    const fetchCareers = async () => {
      const careersSnap = await getDocs(collection(db, 'careers'));
      setCareers(careersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };
    fetchCareers();
  }, []);

  useEffect(() => {
    // Buscar módulos asignados a este profesor
    const fetchModulos = async () => {
      if (!teacher.name) return;
      let modulos = [];
      const careersSnap = await getDocs(collection(db, 'careers'));
      for (const carreraDoc of careersSnap.docs) {
        const carrera = carreraDoc.data();
        const modulosSnap = await getDocs(collection(db, 'careers', carreraDoc.id, 'modules'));
        modulosSnap.forEach(m => {
          const modulo = m.data();
          if (modulo.profesor === teacher.name + (teacher.lastName ? ' ' + teacher.lastName : '')) {
            modulos.push({ ...modulo, carrera: carrera.nombre, semestre: modulo.semestre });
          }
        });
      }
      setModulosAsignados(modulos);
    };
    fetchModulos();
  }, [teacher.name, teacher.lastName]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setTeacher(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const teacherData = {
        ...teacher,
        updatedAt: new Date().toISOString()
      };

      if (id) {
        await updateDoc(doc(db, 'teachers', id), teacherData);
        toast.success('Profesor actualizado correctamente');
      } else {
        await setDoc(doc(collection(db, 'teachers')), {
          ...teacherData,
          createdAt: new Date().toISOString()
        });
        toast.success('Profesor creado correctamente');
      }
      navigate('/dashboard/teachers');
    } catch (error) {
      toast.error('Error guardando el profesor.');
      console.error('Error saving teacher: ', error);
    }
  };

  if (loading) return <div className="text-[#23408e] font-semibold">Cargando profesor...</div>;

  return (
    <div className="bg-white p-8 rounded-lg shadow-md border-l-4 border-[#ffd600] max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 text-[#23408e]">
        {id ? 'Editar Profesor' : 'Registrar Nuevo Profesor'}
      </h2>
      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          <div>
            <label className="block font-semibold mb-1 text-[#23408e]">Nombre Completo</label>
            <input
              type="text"
              name="name"
              value={teacher.name}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#23408e]"
              placeholder="Ej: Prof. María García"
              required
            />
          </div>
          <div>
            <label className="block font-semibold mb-1 text-[#23408e]">Correo Electrónico</label>
            <input
              type="email"
              name="email"
              value={teacher.email}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#23408e]"
              placeholder="profesor@instituto.com"
              required
            />
          </div>
          <div>
            <label className="block font-semibold mb-1 text-[#23408e]">Teléfono</label>
            <input
              type="tel"
              name="phone"
              value={teacher.phone}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#23408e]"
              placeholder="123-456-7890"
            />
          </div>
          <div>
            <label className="block font-semibold mb-1 text-[#23408e]">Especialización</label>
            <input
              type="text"
              name="specialty"
              value={teacher.specialty}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#23408e]"
              placeholder="Especialización del profesor"
              required
            />
          </div>
          <div>
            <label className="block font-semibold mb-1 text-[#23408e]">Salario Mensual ($)</label>
            <input
              type="number"
              name="salary"
              value={teacher.salary}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#23408e]"
              placeholder="0"
              min="0"
            />
          </div>
          <div>
            <label className="block font-semibold mb-1 text-[#23408e]">Carrera asignada</label>
            <select
              name="career"
              value={teacher.career}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#23408e]"
              required
            >
              <option value="">Selecciona una carrera</option>
              {careers.map((c) => (
                <option key={c.id} value={c.nombre}>{c.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-semibold mb-1 text-[#23408e]">Estado</label>
            <select
              name="status"
              value={teacher.status}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#23408e]"
              required
            >
              <option value="active">Activo</option>
              <option value="inactive">Inactivo</option>
            </select>
          </div>
        </div>
        <div className="mt-6 flex justify-end space-x-3">
          <button
            type="button"
            onClick={() => navigate('/dashboard/teachers')}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-[#2563eb] text-white rounded-md hover:bg-[#23408e] font-semibold"
          >
            {id ? 'Actualizar' : 'Registrar'}
          </button>
        </div>
      </form>
      {/* Tabla de módulos asignados */}
      {modulosAsignados.length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-bold mb-2 text-[#23408e]">Módulos asignados</h3>
          <table className="w-full border text-sm mb-4">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-2">Módulo</th>
                <th className="p-2">Carrera</th>
                <th className="p-2">Semestre</th>
              </tr>
            </thead>
            <tbody>
              {modulosAsignados.map((modulo, idx) => (
                <tr key={idx}>
                  <td className="p-2">{modulo.nombre}</td>
                  <td className="p-2">{modulo.carrera}</td>
                  <td className="p-2">{modulo.semestre}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default TeacherForm;