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

  // **NUEVO ESTADO**: para manejar múltiples estudiantes y sus notas
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [studentGrades, setStudentGrades] = useState({});

  const [form, setForm] = useState({
    // studentId y studentName ya no se usan para la selección principal
    teacherId: '',
    teacherName: '',
    moduleId: '',
    moduleName: '',
    courseId: '',
    groupId: '',
    groupName: '',
    activityName: '',
    grade: '', // Se mantiene para el modo de edición individual
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
      // Pre-seleccionar el estudiante en modo edición
      const student = students.find(s => s.id === editGrade.studentId);
      if (student) {
        setSelectedStudents([{ value: student.id, label: `${student.name} ${student.lastName}` }]);
      }
    } else {
      if (currentUser?.role === 'teacher' && teachers.length > 0) {
        const teacher = teachers[0];
        setForm(f => ({
          ...f,
          teacherId: teacher.id,
          teacherName: `${teacher.name} ${teacher.lastName}`
        }));
      }
    }
  }, [editGrade, currentUser, teachers, students, selectedPeriod, selectedSemester, scope]);

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
    if (!form.moduleId) return [];

    const selectedModule = availableModules.find(m => m.id === form.moduleId);
    if (!selectedModule) return [];

    // Filtro base: solo estudiantes activos
    const activeStudents = students.filter(s => s.status === 'active');

    // Módulo general tratado como carrera: filtrar por carreras válidas, semestre y que tenga el módulo asignado
    if (scope === 'career' && selectedModule.isGeneral) {
      return activeStudents.filter(s => {
        const validCareer = Array.isArray(selectedModule.careerList)
          ? selectedModule.careerList.includes(s.career)
          : (selectedModule.carrera ? s.career === selectedModule.carrera : true);
        const validSemester = String(s.semester) === String(selectedModule.semestre) || String(s.semestre) === String(selectedModule.semestre);
        const hasModule = Array.isArray(s.modulosAsignados) && s.modulosAsignados.some(m => m.id === selectedModule.id);
        return validCareer && validSemester && hasModule;
      });
    }

    // ESTRATEGIA 1: Si el módulo tiene propiedades de carrera/curso, filtrar estudiantes por eso
    if (scope === 'career' && selectedModule.careerId) {
      // Filtrar estudiantes que pertenecen a la misma carrera Y al mismo semestre
      return activeStudents.filter(s => {
        const isInCareer = s.careerId === selectedModule.careerId || 
                          s.career === selectedModule.carrera ||
                          s.carrera === selectedModule.carrera;
        const isInSemester = !selectedSemester || 
                            String(s.semester) === String(selectedSemester) ||
                            String(s.semestre) === String(selectedSemester);
        return isInCareer && isInSemester;
      });
    }

    // ESTRATEGIA 2: Si es curso, filtrar por courseId
    if (scope === 'course' && selectedModule.courseId) {
      return activeStudents.filter(s => {
        if (Array.isArray(s.courses)) {
          return s.courses.includes(selectedModule.courseId);
        }
        return false;
      });
    }

    // ESTRATEGIA 3: Mostrar todos los estudiantes del semestre actual
    return activeStudents.filter(s => 
      !selectedSemester || 
      String(s.semester) === String(selectedSemester) ||
      String(s.semestre) === String(selectedSemester)
    );
  }, [form.moduleId, availableModules, students, scope, selectedSemester]);

  const handleChange = e => {
    const { name, value } = e.target;
    let newForm = { ...form, [name]: value };

    if (name === 'moduleId') {
      const mod = availableModules.find(m => m.id === value);
      newForm.moduleName = mod ? mod.nombre : '';
      if (scope === 'course' && mod) {
        newForm.courseId = mod.courseId;
      }
      // Limpiar estudiantes al cambiar de módulo
      setSelectedStudents([]);
      setStudentGrades({});
    }

    if (name === 'groupId') {
      const group = GROUP_OPTIONS.find(g => g.id === value);
      newForm.groupName = group ? group.name : '';
    }

    setForm(newForm);
  };

  // **MANEJADOR ACTUALIZADO**: para selección múltiple de estudiantes
  const handleStudentSelect = (options) => {
    setSelectedStudents(options || []);
    // Limpiar notas si la selección cambia
    if (!editGrade) {
      setStudentGrades({});
    }
  };

  // **NUEVO MANEJADOR**: para actualizar la nota de un estudiante específico
  const handleGradeChange = (studentId, grade) => {
    setStudentGrades(prev => ({
      ...prev,
      [studentId]: grade
    }));
  };

  const handleSubmit = e => {
    e.preventDefault();
    
    const isEditing = !!editGrade;

    if (isEditing) {
      // Lógica de guardado para edición individual (sin cambios)
      if (!form.studentId || !form.teacherId || !form.moduleId || !form.activityName || !form.grade) {
        alert('Completa los campos obligatorios para editar.');
        return;
      }
      onSave({ ...form, id: editGrade.id }, true);

    } else {
      // **NUEVA LÓGICA DE GUARDADO**: para múltiples estudiantes
      if (selectedStudents.length === 0 || !form.teacherId || !form.moduleId || !form.activityName) {
        alert('Debes seleccionar al menos un alumno y completar los campos de módulo, profesor y actividad.');
        return;
      }

      const studentsWithGrades = selectedStudents.filter(s => studentGrades[s.value] !== undefined && studentGrades[s.value] !== '');

      if (studentsWithGrades.length === 0) {
        alert('Debes ingresar la nota para al menos un alumno seleccionado.');
        return;
      }

      studentsWithGrades.forEach(student => {
        const studentId = student.value;
        const studentData = students.find(s => s.id === studentId);
        const grade = studentGrades[studentId];

        const gradeData = {
          ...form,
          studentId: studentId,
          studentName: studentData ? `${studentData.name} ${studentData.lastName}` : '',
          grade: grade,
          id: `${studentId}_${form.moduleId}_${form.activityName}_${Date.now()}`
        };

        if (scope === 'career') {
          delete gradeData.courseId;
        } else {
          delete gradeData.semester;
        }
        
        onSave(gradeData, false);
      });
    }
  };

  const studentOptions = useMemo(() => availableStudents.map(s => ({
    value: s.id,
    label: `${s.name} ${s.lastName}`
  })), [availableStudents]);

  const isMultiStudentMode = !editGrade;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-4xl w-full my-8 relative border-l-4 border-[#23408e]">
        <button className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 text-xl" onClick={onClose}>&times;</button>
        <h2 className="text-2xl font-bold mb-6 text-[#23408e]">{editGrade ? 'Editar Nota' : 'Registrar Nuevas Notas'}</h2>
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
              <label className="block font-semibold mb-1 text-[#009245]">Alumnos:</label>
              <Select
                value={selectedStudents}
                onChange={handleStudentSelect}
                options={studentOptions}
                placeholder={form.moduleId ? "Buscar o seleccionar alumnos..." : "Selecciona un módulo primero"}
                isClearable
                isMulti={isMultiStudentMode} // **CAMBIO**: Habilitar selección múltiple
                isDisabled={!form.moduleId || !!editGrade} // **CAMBIO**: Deshabilitar si no hay módulo o si se está editando
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

            {/* **CAMBIO**: El campo de nota individual solo aparece en modo edición */}
            {editGrade && (
              <div>
                <label className="block font-semibold mb-1 text-[#009245]">Valor de la Nota:</label>
                <input type="number" name="grade" value={form.grade} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded-md" placeholder="Ej: 4.5" min="0" max="5" step="0.1" required />
              </div>
            )}
          </div>

          {/* **NUEVA SECCIÓN**: para ingresar notas de múltiples estudiantes */}
          {isMultiStudentMode && selectedStudents.length > 0 && (
            <div className="mt-6 pt-4 border-t">
              <h3 className="text-xl font-semibold mb-4 text-[#23408e]">Ingresar Notas</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 max-h-60 overflow-y-auto pr-2">
                {selectedStudents.map(student => (
                  <div key={student.value} className="flex items-center space-x-4">
                    <label className="flex-1 font-medium text-gray-700">{student.label}</label>
                    <input
                      type="number"
                      value={studentGrades[student.value] || ''}
                      onChange={(e) => handleGradeChange(student.value, e.target.value)}
                      className="w-28 p-2 border border-gray-300 rounded-md"
                      placeholder="Nota"
                      min="0"
                      max="5"
                      step="0.1"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-8 flex justify-end space-x-3">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">Cancelar</button>
            <button type="submit" className="px-6 py-2 bg-[#009245] text-white rounded-md hover:bg-[#23408e] font-semibold">{editGrade ? 'Actualizar' : 'Guardar Notas'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default GradeForm;
