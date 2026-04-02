export const calcularEstadoModulo = (notas) => {
  const notaHabilitacion = notas.find(n => n.groupId === 'HABILITACION' || n.groupName === 'HABILITACION');

  if (notaHabilitacion) {
    const finalGrade = parseFloat(notaHabilitacion.grade);
    return {
      finalGrade: finalGrade.toFixed(2),
      isHabilitacion: true,
      estadoSugerido: finalGrade >= 3.0 ? 'aprobado' : 'reprobado',
      esDefinitivo: true,
      gruposCompletos: true
    };
  }

  const getNota = (grupo) => {
    const grupoNotas = notas.filter(n => n.groupId === grupo || n.groupName === grupo);
    if (!grupoNotas.length) return null;
    return grupoNotas.reduce((acc, n) => acc + parseFloat(n.grade), 0) / grupoNotas.length;
  };

  const act1 = getNota('ACTIVIDADES_1');
  const act2 = getNota('ACTIVIDADES_2');
  const evalFinal = getNota('EVALUACION_FINAL');
  
  const p1 = act1 != null ? act1 : 0;
  const p2 = act2 != null ? act2 : 0;
  const pf = evalFinal != null ? evalFinal : 0;
  
  const finalGrade = (p1 * 0.3 + p2 * 0.3 + pf * 0.4);
  
  const tieneA1 = act1 !== null;
  const tieneA2 = act2 !== null;
  const tieneEval = evalFinal !== null;
  const gruposCompletos = tieneA1 && tieneA2 && tieneEval;

  let estadoSugerido = 'cursando'; // default if not definitive and not passing yet
  let esDefinitivo = false;

  if (finalGrade >= 3.0) {
    estadoSugerido = 'aprobado';
    esDefinitivo = true;
  } else if (gruposCompletos) {
    // Has all groups but average is still < 3.0
    estadoSugerido = 'reprobado';
    esDefinitivo = true;
  }

  return {
    finalGrade: finalGrade.toFixed(2),
    isHabilitacion: false,
    estadoSugerido,
    esDefinitivo,
    gruposCompletos
  };
};

export const calcularPromedioFinal = (notas) => {
  const { finalGrade, isHabilitacion } = calcularEstadoModulo(notas);
  return { finalGrade, isHabilitacion };
};

import { doc, getDoc, updateDoc } from 'firebase/firestore';

/**
 * Función que sincroniza asincrónicamente el estado del módulo en el documento del estudiante en Firestore,
 * dependiendo del resultado dinámico de sus notas.
 *
 * @param {object} db - Instancia de Firestore
 * @param {string} studentId - ID del estudiante
 * @param {string} moduleId - ID del módulo
 * @param {Array} allGrades - Arreglo global de todas las notas del sistema (o al menos del alumno/módulo)
 */
export const syncStudentModuleStatus = async (db, studentId, moduleId, allGrades) => {
  try {
    // 1. Filtrar solo las notas relevantes para este estudiante y módulo
    const moduleGrades = allGrades.filter(g => g.studentId === studentId && (g.moduleId === moduleId || g.groupId === moduleId || g.moduleName === moduleId)); // Usualmente usan moduleId, pero algunos usan moduleName. Idealmente 'moduleId'.
    // Nota: GradeManager usa `Object.moduleId` en algun lado? Voy a asumir que usan moduleName o moduleId. GradeForm usa `moduleId`.

    // 2. Calcular estado sugerido
    const result = calcularEstadoModulo(moduleGrades);

    // 3. Obtener el documento del estudiante
    const studentRef = doc(db, 'students', studentId);
    const studentSnap = await getDoc(studentRef);
    if (!studentSnap.exists()) return;

    const studentData = studentSnap.data();
    let modulosAsignados = studentData.modulosAsignados || [];

    // 4. Buscar el módulo asignado
    const bModIndex = modulosAsignados.findIndex(m => m.id === moduleId);
    if (bModIndex === -1) return; // Módulo no asignado visualmente aún

    const mod = modulosAsignados[bModIndex];

    // Lógica para preservar el estado original (estadoBase) si no lo tiene.
    if (!mod.estadoBase) mod.estadoBase = mod.estado || 'pendiente';

    let nuevoEstado = mod.estado;

    if (result.esDefinitivo) {
      // Bloqueo estricto del estado definitivo
      nuevoEstado = result.estadoSugerido;
    } else {
      // Aún no es definitivo y es < 3.0: restaurar la base (profesor eligió si lo cursa o pende)
      nuevoEstado = mod.estadoBase;
    }

    // 5. Aplicar cambios sólo si son diferentes
    if (modulosAsignados[bModIndex].estado !== nuevoEstado || 
        !modulosAsignados[bModIndex].hasOwnProperty('estadoBase') ||
        modulosAsignados[bModIndex].esDefinitivo !== result.esDefinitivo) {
      modulosAsignados[bModIndex].estado = nuevoEstado;
      modulosAsignados[bModIndex].esDefinitivo = result.esDefinitivo;
      await updateDoc(studentRef, { modulosAsignados });
      console.log(`[sync] Estado de estudiante ${studentId} en modulo ${moduleId} actualizado a: ${nuevoEstado}`);
    }

  } catch (err) {
    console.error('Error sincronizando estado de módulo de alumno', err);
  }
};
