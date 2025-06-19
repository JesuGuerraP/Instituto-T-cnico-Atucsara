import { useState, useEffect } from 'react';
import { collection, setDoc, doc, updateDoc, getDocs } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import Select from 'react-select';

const GROUP_OPTIONS = [
  { id: 'ACTIVIDADES_1', name: 'ACTIVIDADES_1' },
  { id: 'ACTIVIDADES_2', name: 'ACTIVIDADES_2' },
  { id: 'EVALUACION_FINAL', name: 'EVALUACION_FINAL' }
];

const GradeForm = ({ students, teachers, modules, currentUser, onClose, onSave, editGrade }) => {
  const [form, setForm] = useState(editGrade || {
    studentId: '',
    studentName: '',
    teacherId: '',
    teacherName: '',
    moduleId: '',
    moduleName: '',
    groupId: '',
    groupName: '',
    activityName: '',
    grade: '',
    date: new Date().toISOString().slice(0, 10)
  });
  const [modulesByTeacher, setModulesByTeacher] = useState([]);

  useEffect(() => {
    if (editGrade) {
      setForm({
        ...editGrade,
        moduleId: editGrade.moduleId || '',
        moduleName: editGrade.moduleName || '',
      });
    } else {
      setForm({
        studentId: '',
        studentName: '',
        teacherId: '',
        teacherName: '',
        moduleId: '',
        moduleName: '',
        groupId: '',
        groupName: '',
        activityName: '',
        grade: '',
        date: new Date().toISOString().slice(0, 10)
      });
    }
  }, [editGrade, modules]);

  // Si es teacher, autocompletar y bloquear el campo profesor
  useEffect(() => {
    if (currentUser?.role === 'teacher' && teachers.length > 0) {
      const teacher = teachers[0];
      setForm(f => ({
        ...f,
        teacherId: teacher.id,
        teacherName: `${teacher.name} ${teacher.lastName}`
      }));
      setModulesByTeacher(modules || []);
    } else if (form.teacherId && teachers.length > 0 && modules) {
      // Filtrar módulos por profesor seleccionado (para admin)
      const teacher = teachers.find(t => t.id === form.teacherId);
      if (teacher) {
        const teacherFullName = `${teacher.name} ${teacher.lastName || ''}`.replace(/\s+/g, ' ').trim().toLowerCase();
        const teacherEmail = (teacher.email || '').toLowerCase();
        // Buscar módulos que tengan como profesor el nombre completo o el email
        const filtered = modules.filter(m => {
          const moduloProfesor = (m.profesor || '').replace(/\s+/g, ' ').trim().toLowerCase();
          const moduloProfesorEmail = (m.profesorEmail || '').toLowerCase();
          return moduloProfesor === teacherFullName || (teacherEmail && moduloProfesorEmail === teacherEmail);
        });
        // Si estamos editando y el módulo de la nota no está en el filtro, lo agregamos para que se preseleccione
        if (editGrade && editGrade.moduleId) {
          const exists = filtered.some(m => m.id === editGrade.moduleId);
          if (!exists) {
            const mod = (modules || []).find(m => m.id === editGrade.moduleId);
            if (mod) filtered.push(mod);
          }
        }
        setModulesByTeacher(filtered);
      } else {
        setModulesByTeacher([]);
      }
    } else {
      setModulesByTeacher(modules || []);
    }
  }, [currentUser, teachers, modules, form.teacherId, editGrade]);

  // Filtrar estudiantes solo de los módulos del teacher si es teacher
  const allowedStudents = currentUser?.role === 'teacher '  
    ? students.filter(s => s.modulosAsignados?.some(m => (modules || []).map(mm => mm.id).includes(m.id)))
    : students;

  const handleChange = e => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
    // Si cambia el módulo, también actualiza el nombre del módulo
    if (name === 'moduleId') {
      const mod = modulesByTeacher.find(m => m.id === value);
      setForm(f => ({ ...f, moduleName: mod ? mod.nombre : '' }));
    }
  };

  const handleSelect = (name, value, list, labelFields) => {
    const item = list.find(i => i.id === value);
    setForm(f => ({
      ...f,
      [name]: value,
      [`${name.replace('Id', 'Name')}`]: item ? labelFields.map(l => item[l]).join(' ') : ''
    }));
  };

  const handleGroupSelect = e => {
    const value = e.target.value;
    const item = GROUP_OPTIONS.find(g => g.id === value);
    setForm(f => ({
      ...f,
      groupId: value,
      groupName: item ? item.name : ''
    }));
  };

  const handleSubmit = async e => {
    e.preventDefault();
    if (!form.studentId || !form.teacherId || !form.moduleId || !form.activityName || !form.grade) {
      alert('Completa los campos obligatorios');
      return;
    }
    const id = editGrade ? editGrade.id : `${form.studentId}_${form.moduleId}_${form.activityName}_${Date.now()}`;
    const gradeData = { ...form, id };
    if (editGrade) {
      await updateDoc(doc(db, 'grades', id), gradeData);
    } else {
      await setDoc(doc(collection(db, 'grades'), id), gradeData);
    }
    onSave(gradeData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-2xl w-full relative border-l-4 border-[#23408e]">
        <button
          className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 text-xl"
          onClick={onClose}
        >
          &times;
        </button>
        <h2 className="text-2xl font-bold mb-4 text-[#23408e]">{editGrade ? 'Editar Nota' : 'Registrar Nueva Nota'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block font-semibold mb-1 text-[#009245]">Alumno:</label>
              <Select
                name="studentId"
                filterOption={(option, input) => {
                  // Buscar por nombre, apellido o carrera usando los datos originales
                  const student = students.find(s => s.id === option.value);
                  if (!student) return false;
                  const nombre = (student.name || '').toLowerCase();
                  const apellido = (student.lastName || '').toLowerCase();
                  let carrera = student.career || '';
                  if (/serv.*soci/i.test(carrera)) carrera = 'Serv. Social';
                  else if (/agro/i.test(carrera)) carrera = 'Agropecuario';
                  else if (/admin/i.test(carrera)) carrera = 'Administrativo';
                  else if (/prim.*inf/i.test(carrera)) carrera = 'Prim. Infancia';
                  else if ((/asist/i.test(carrera) && (/téc|tecn|tecnolog/i.test(carrera))) || /tecnolog/i.test(carrera)) carrera = 'Tecnologia';
                  else if (carrera.length > 16) carrera = carrera.slice(0, 16) + '…';
                  carrera = carrera.toLowerCase();
                  const inputValue = input.toLowerCase();
                  return (
                    nombre.includes(inputValue) ||
                    apellido.includes(inputValue) ||
                    carrera.includes(inputValue)
                  );
                }}
                value={(() => {
                  const s = students.find(s => s.id === form.studentId);
                  if (!s) return null;
                  let carrera = s.career || 'Sin carrera';
                  if (/serv.*soci/i.test(carrera)) carrera = 'Serv. Social';
                  else if (/agro/i.test(carrera)) carrera = 'Agropecuario';
                  else if (/admin/i.test(carrera)) carrera = 'Administrativo';
                  else if (/prim.*inf/i.test(carrera)) carrera = 'Prim. Infancia';
                  else if ((/asist/i.test(carrera) && (/tec|tecn|tecnolog/i.test(carrera))) || /tecnolog/i.test(carrera)) carrera = 'Tecnologia';
                  else if (carrera.length > 16) carrera = carrera.slice(0, 16) + '…';
                  return {
                    value: form.studentId,
                    label: (
                      <span>
                        <b>{s.name} {s.lastName}</b> <span className="text-gray-500">({carrera})</span>
                      </span>
                    )
                  };
                })()}
                onChange={option => {
                  const student = students.find(s => s.id === option?.value);
                  setForm(f => ({
                    ...f,
                    studentId: option ? option.value : '',
                    studentName: student ? `${student.name} ${student.lastName}` : ''
                  }));
                }}
                options={allowedStudents.map(s => {
                  let carrera = s.career || 'Sin carrera';
                  if (/serv.*soci/i.test(carrera)) carrera = 'Serv. Social';
                  else if (/agro/i.test(carrera)) carrera = 'Agropecuario';
                  else if (/admin/i.test(carrera)) carrera = 'Administrativo';
                  else if (/prim.*inf/i.test(carrera)) carrera = 'Prim. Infancia';
                  else if ((/asist/i.test(carrera) && (/téc|tecn|tecnolog/i.test(carrera))) || /tecnolog/i.test(carrera)) carrera = 'Tecnologia';
                  else if (carrera.length > 16) carrera = carrera.slice(0, 16) + '…';
                  return {
                    value: s.id,
                    label: (
                      <span>
                        <b>{s.name} {s.lastName}</b> <span className="text-gray-500">({carrera})</span>
                      </span>
                    )
                  };
                })}
                placeholder="Buscar o seleccionar alumno..."
                isClearable
                classNamePrefix="react-select"
                required
              />
            </div>
            <div>
              <label className="block font-semibold mb-1 text-[#009245]">Profesor:</label>
              {currentUser?.role === 'teacher' ? (
                <input
                  type="text"
                  value={teachers[0] ? `${teachers[0].name} ${teachers[0].lastName}` : ''}
                  className="w-full p-2 border border-gray-300 rounded-md bg-gray-100 text-gray-700"
                  disabled
                />
              ) : (
                <select
                  name="teacherId"
                  value={form.teacherId}
                  onChange={e => handleSelect('teacherId', e.target.value, teachers, ['name', 'lastName'])}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#23408e]"
                  required
                >
                  <option value="">-- Selecciona un profesor --</option>
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>{t.name} {t.lastName}</option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label className="block font-semibold mb-1 text-[#009245]">Módulo:</label>
              <select
                name="moduleId"
                value={form.moduleId}
                onChange={handleChange}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#23408e]"
                disabled={currentUser?.role === 'teacher' ? false : !form.teacherId}
                required
              >
                <option value="">-- Selecciona un módulo --</option>
                {modulesByTeacher.map(m => (
                  <option key={m.id} value={m.id}>{m.nombre} {m.carrera ? `(${m.carrera})` : ''}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold mb-1 text-[#009245]">Nombre de la Actividad:</label>
              <input
                type="text"
                name="activityName"
                value={form.activityName}
                onChange={handleChange}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#23408e]"
                placeholder="Ej: Prueba escrita, Taller"
                required
              />
            </div>
            <div>
              <label className="block font-semibold mb-1 text-[#009245]">Grupo de Actividad:</label>
              <select
                name="groupId"
                value={form.groupId}
                onChange={handleGroupSelect}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#23408e]"
              >
                <option value="">-- Selecciona un grupo --</option>
                {GROUP_OPTIONS.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold mb-1 text-[#009245]">Valor de la Nota:</label>
              <input
                type="number"
                name="grade"
                value={form.grade}
                onChange={handleChange}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#23408e]"
                placeholder="Ej: 4.5"
                min="0"
                max="5"
                step="0.1"
                required
              />
            </div>
          </div>
          <div className="mt-6 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-[#009245] text-white rounded-md hover:bg-[#23408e] font-semibold"
            >
              {editGrade ? 'Actualizar' : 'Guardar Nota'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default GradeForm;