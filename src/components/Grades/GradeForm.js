import { useState, useEffect, useMemo } from 'react';
import { db } from '../../firebaseConfig';
import Select from 'react-select';

const GROUP_OPTIONS = [
  { id: 'ACTIVIDADES_1', name: 'ACTIVIDADES_1' },
  { id: 'ACTIVIDADES_2', name: 'ACTIVIDADES_2' },
  { id: 'EVALUACION_FINAL', name: 'EVALUACION_FINAL' }
];

const GradeForm = ({ 
    students, 
    teachers, 
    modules, 
    currentUser, 
    onClose, 
    onSave, 
    editGrade, 
    selectedSemester, 
    selectedPeriod,
    scope = 'career' 
}) => {

  const [form, setForm] = useState({
    studentId: '',
    studentName: '',
    teacherId: '',
    teacherName: '',
    moduleId: '',
    moduleName: '',
    courseId: '', // Para ámbito de curso
    groupId: '',
    groupName: '',
    activityName: '',
    grade: '',
    date: new Date().toISOString().slice(0, 10),
    period: selectedPeriod || '',
    semester: scope === 'career' ? selectedSemester || '1' : ''
  });

  useEffect(() => {
    if (editGrade) {
      setForm({
        ...editGrade,
        date: editGrade.date || new Date().toISOString().slice(0, 10),
      });
    } else {
      // Pre-llenar profesor si el rol es 'teacher'
      if (currentUser?.role === 'teacher' && teachers.length > 0) {
        const teacher = teachers[0];
        setForm(f => ({
          ...f,
          teacherId: teacher.id,
          teacherName: `${teacher.name} ${teacher.lastName}`
        }));
      }
    }
  }, [editGrade, currentUser, teachers, selectedPeriod, selectedSemester, scope]);

  const availableModules = useMemo(() => {
    return modules.filter(m => {
        if (scope === 'career') {
            if (m.source !== 'career') return false;
            return !selectedSemester || String(m.semestre || m.semester) === String(selectedSemester);
        }
        if (scope === 'course') {
            return m.source === 'course';
        }
        return false;
    });
  }, [modules, scope, selectedSemester]);

  const availableStudents = useMemo(() => {
    if (scope === 'career') {
        return students.filter(s => !selectedSemester || String(s.semester) === String(selectedSemester));
    }
    if (scope === 'course') {
        const selectedModule = availableModules.find(m => m.id === form.moduleId);
        if (selectedModule) {
            // Filtrar estudiantes que están en el curso de ese módulo
            return students.filter(s => Array.isArray(s.courses) && s.courses.includes(selectedModule.courseId));
        }
        return students.filter(s => Array.isArray(s.courses) && s.courses.length > 0);
    }
    return [];
  }, [students, scope, selectedSemester, form.moduleId, availableModules]);

  const handleChange = e => {
    const { name, value } = e.target;
    let newForm = { ...form, [name]: value };

    if (name === 'moduleId') {
      const mod = availableModules.find(m => m.id === value);
      newForm.moduleName = mod ? mod.nombre : '';
      if (scope === 'course' && mod) {
        newForm.courseId = mod.courseId;
      }
    }

    if (name === 'groupId') {
      const group = GROUP_OPTIONS.find(g => g.id === value);
      newForm.groupName = group ? group.name : '';
    }

    setForm(newForm);
  };

  const handleStudentSelect = (option) => {
    const student = availableStudents.find(s => s.id === option?.value);
    setForm(f => ({
      ...f,
      studentId: option ? option.value : '',
      studentName: student ? `${student.name} ${student.lastName}` : ''
    }));
  };

  const handleSubmit = e => {
    e.preventDefault();
    if (!form.studentId || !form.teacherId || !form.moduleId || !form.activityName || !form.grade) {
      alert('Completa los campos obligatorios');
      return;
    }

    const isEditing = !!editGrade;
    const id = isEditing ? editGrade.id : `${form.studentId}_${form.moduleId}_${form.activityName}_${Date.now()}`;
    
    let gradeData = { ...form, id };

    // Limpiar campos irrelevantes según el ámbito
    if (scope === 'career') {
      delete gradeData.courseId;
    } else { // course
      delete gradeData.semester;
    }

    onSave(gradeData, isEditing);
  };

  const studentOptions = useMemo(() => availableStudents.map(s => ({
    value: s.id,
    label: `${s.name} ${s.lastName}`
  })), [availableStudents]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-2xl w-full relative border-l-4 border-[#23408e]">
        <button className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 text-xl" onClick={onClose}>&times;</button>
        <h2 className="text-2xl font-bold mb-6 text-[#23408e]">{editGrade ? 'Editar Nota' : 'Registrar Nueva Nota'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            <div>
              <label className="block font-semibold mb-1 text-[#009245]">Módulo:</label>
              <select name="moduleId" value={form.moduleId} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#23408e]" required>
                <option value="">-- Selecciona un módulo --</option>
                {availableModules.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.nombre} {scope === 'career' && m.carrera ? `(${m.carrera})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold mb-1 text-[#009245]">Alumno:</label>
              <Select
                value={studentOptions.find(opt => opt.value === form.studentId)}
                onChange={handleStudentSelect}
                options={studentOptions}
                placeholder="Buscar o seleccionar alumno..."
                isClearable
                required
              />
            </div>

            <div>
              <label className="block font-semibold mb-1 text-[#009245]">Profesor:</label>
              {currentUser?.role === 'teacher' ? (
                <input type="text" value={form.teacherName} className="w-full p-2 border border-gray-300 rounded-md bg-gray-100" disabled />
              ) : (
                <select name="teacherId" value={form.teacherId} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#23408e]" required>
                  <option value="">-- Selecciona un profesor --</option>
                  {teachers.map(t => <option key={t.id} value={t.id}>{t.name} {t.lastName}</option>)}
                </select>
              )}
            </div>

            <div>
              <label className="block font-semibold mb-1 text-[#009245]">Nombre de la Actividad:</label>
              <input type="text" name="activityName" value={form.activityName} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded-md" placeholder="Ej: Prueba escrita, Taller" required />
            </div>

            <div>
              <label className="block font-semibold mb-1 text-[#009245]">Grupo de Actividad:</label>
              <select name="groupId" value={form.groupId} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded-md">
                <option value="">-- Selecciona un grupo --</option>
                {GROUP_OPTIONS.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block font-semibold mb-1 text-[#009245]">Valor de la Nota:</label>
              <input type="number" name="grade" value={form.grade} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded-md" placeholder="Ej: 4.5" min="0" max="5" step="0.1" required />
            </div>

          </div>
          <div className="mt-8 flex justify-end space-x-3">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">Cancelar</button>
            <button type="submit" className="px-6 py-2 bg-[#009245] text-white rounded-md hover:bg-[#23408e] font-semibold">{editGrade ? 'Actualizar' : 'Guardar Nota'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default GradeForm;