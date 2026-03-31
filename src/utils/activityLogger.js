import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

/**
 * Registra una actividad en la colección global de auditoría
 * @param {Firestore} db - Instancia de Firestore
 * @param {Object} currentUser - Usuario actual de la sesión
 * @param {Object} activityData - Datos de la actividad { action, entityType, entityName, details }
 */
export const saveActivity = async (db, currentUser, { action, entityType, entityName, details }) => {
  if (!currentUser) return;

  try {
    const userName = (currentUser.name && currentUser.lastName) 
      ? `${currentUser.name} ${currentUser.lastName}` 
      : (currentUser.email || 'Sistema');

    const logEntry = {
      user: userName,
      userRole: currentUser.role || 'Desconocido',
      userId: currentUser.uid || currentUser.id,
      action: action.toUpperCase(), // CREACIÓN, EDICIÓN, ELIMINACIÓN, ASIGNACIÓN, etc.
      entityType: entityType.toUpperCase(), // ESTUDIANTE, DOCENTE, USUARIO, etc.
      entityName: entityName || '',
      details: details || '',
      timestamp: serverTimestamp()
    };

    await addDoc(collection(db, 'activityLogs'), logEntry);
  } catch (error) {
    console.error('Error logging activity:', error);
  }
};
