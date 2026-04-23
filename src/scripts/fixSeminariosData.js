/**
 * SCRIPT DE CORRECCIÓN DE DATOS — SEMINARIOS
 * ============================================
 * Ejecutar UNA SOLA VEZ desde la consola del navegador
 * o desde un componente temporal de administración.
 *
 * REGLA DE NEGOCIO:
 *   - Solo los estudiantes del período 2025-1 (primer semestre)
 *     pueden tener seminarios en estado 'aprobado'.
 *   - Los períodos 2025-2 y 2026-1 arrancan desde cero → pendiente.
 *
 * CÓMO USAR:
 *   1. Importar en un componente admin temporal o en el AdminDashboard.
 *   2. Llamar a fixSeminariosData(db) con el objeto db de firebaseConfig.
 *   3. Revisar el log en consola y confirmar antes de escribir.
 *   4. Eliminar o deshabilitar el botón una vez ejecutado.
 */

import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';

/** Períodos que NO deben tener seminarios aprobados */
const PERIODOS_SIN_APROBACION = ['2025-2', '2026-1'];

/**
 * Calcula el período de un estudiante a partir de createdAt.
 * Replica la lógica de calculatePeriod en periodHelper.js.
 */
function calcularPeriodo(createdAt) {
  if (!createdAt) return null;
  let date;
  if (createdAt?.seconds) {
    date = new Date(createdAt.seconds * 1000);
  } else if (typeof createdAt === 'string') {
    date = new Date(createdAt);
  } else {
    date = new Date(createdAt);
  }
  if (isNaN(date.getTime())) return null;

  const year  = date.getFullYear();
  const month = date.getMonth() + 1; // 1–12
  // Semestre 1: enero–junio (1–6), Semestre 2: julio–diciembre (7–12)
  const semestre = month <= 6 ? '1' : '2';
  return `${year}-${semestre}`;
}

/**
 * Revoca el estado 'aprobado' de todos los seminarios de los estudiantes
 * cuyo período sea 2025-2 o 2026-1 (u otros en PERIODOS_SIN_APROBACION).
 *
 * @param {import('firebase/firestore').Firestore} db
 * @param {boolean} dryRun - Si true, solo muestra en consola sin escribir.
 */
export async function fixSeminariosData(db, dryRun = true) {
  console.group('🔧 Corrección de Seminarios');
  console.log(`Modo: ${dryRun ? '🔍 DRY RUN (simulación — no escribe en Firestore)' : '✏️ ESCRITURA REAL'}`);
  console.log(`Períodos afectados: ${PERIODOS_SIN_APROBACION.join(', ')}`);

  const studentsSnap = await getDocs(collection(db, 'students'));
  const total = studentsSnap.size;
  let afectados = 0;
  let modificados = 0;

  for (const studentDoc of studentsSnap.docs) {
    const data = studentDoc.data();
    const periodo = calcularPeriodo(data.createdAt) || data.period || '';

    // Si el período NO está en la lista de afectados, saltar
    if (!PERIODOS_SIN_APROBACION.includes(periodo)) continue;

    // Revisar si tiene algún seminario aprobado
    const seminarios = data.seminarios || [];
    const conAprobados = seminarios.filter(s => s.estado?.toLowerCase() === 'aprobado');

    if (conAprobados.length === 0) continue;

    afectados++;
    console.log(
      `👤 ${data.name} ${data.lastName || ''} | Período: ${periodo} | Seminarios aprobados (${conAprobados.length}):`,
      conAprobados.map(s => s.nombre)
    );

    if (!dryRun) {
      const seminariosCorregidos = seminarios.map(s =>
        s.estado?.toLowerCase() === 'aprobado'
          ? { ...s, estado: 'pendiente', aprobadoPor: '', fechaAprobacion: '' }
          : s
      );
      await updateDoc(doc(db, 'students', studentDoc.id), {
        seminarios: seminariosCorregidos
      });
      modificados++;
      console.log(`   ✅ Corregido → todos en pendiente`);
    }
  }

  console.log('──────────────────────────────────────────');
  console.log(`📊 Total estudiantes revisados: ${total}`);
  console.log(`⚠️  Estudiantes con inconsistencias: ${afectados}`);
  if (!dryRun) console.log(`✏️  Documentos corregidos en Firestore: ${modificados}`);
  if (dryRun && afectados > 0) {
    console.warn('⚡ Para aplicar los cambios, llama: fixSeminariosData(db, false)');
  } else if (afectados === 0) {
    console.log('🎉 No se encontraron inconsistencias. Los datos están correctos.');
  }
  console.groupEnd();
  return { total, afectados, modificados };
}
