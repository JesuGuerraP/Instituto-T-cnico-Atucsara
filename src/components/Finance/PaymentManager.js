import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { format } from 'date-fns';
import { toast } from 'react-toastify';
import PaymentReceipt from './PaymentReceipt';
import Select from 'react-select';

const categoryOptions = [
  'Matrícula',
  'Pago de módulo',
  'Cursos Especiales',
  'Certificaciones',
  'Otros',
];
const typeOptions = [
  { value: 'income', label: 'Ingreso' },
  { value: 'expense', label: 'Gasto' },
];
const statusOptions = [
  { value: 'completed', label: 'Completado' },
  { value: 'pending', label: 'Pendiente' },
  { value: 'cancelled', label: 'Cancelado' },
];

// Definir calculateDiscountedAmount fuera del componente para evitar problemas de inicialización
const calculateDiscountedAmount = (amount, discount) => {
  return amount - (amount * (discount / 100));
};

const PaymentManager = () => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterCategory, setFilterCategory] = useState(''); // Nuevo estado para filtro de categoría
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [formData, setFormData] = useState({
    type: 'income',
    category: '',
    description: '',
    amount: 0,
    status: 'completed',
    date: format(new Date(), 'yyyy-MM-dd'),
  });
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [resumenEstudianteId, setResumenEstudianteId] = useState(null);
  const [discounts, setDiscounts] = useState({}); // Almacenar descuentos por estudiante
  // Estado para búsqueda de estudiante en el modal
  const [studentSearchTerm, setStudentSearchTerm] = useState('');

  // Estados para el modal de confirmación de eliminación
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState(null);
  const [pagoParaRecibo, setPagoParaRecibo] = useState(null);
  const [reciboNumero, setReciboNumero] = useState('');
  const printAreaRef = React.useRef();

  useEffect(() => {
    fetchTransactions();
    fetchStudents();
    fetchTeachers();
  }, []);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const snapshot = await getDocs(collection(db, 'payments'));
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      console.log('Transacciones obtenidas:', data); // Log para depuración
      setTransactions(data);
    } catch (error) {
      console.error('Error al cargar transacciones:', error);
      // toast.error('No se pudieron cargar las transacciones.');
    } finally {
      setLoading(false);
    }
  };

  // Obtener estudiantes
  const fetchStudents = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'students'));
      const studentsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setStudents(studentsData);
      // Poblar descuentos desde Firestore
      const discountsFromDb = {};
      studentsData.forEach(student => {
        discountsFromDb[student.id] = student.descuento || 0;
      });
      setDiscounts(discountsFromDb);
    } catch (error) {
      console.error('Error al cargar estudiantes:', error);
    }
  };

  // Obtener profesores
  const fetchTeachers = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'teachers'));
      setTeachers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error('Error al cargar profesores:', error);
    }
  };

  const filteredTransactions = transactions.filter(transaction => {
    // Buscar estudiante relacionado
    const student = students.find(s => s.id === transaction.studentId);
    // Buscar por descripción, categoría o estudiante
    const matchesSearch =
      (transaction.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (transaction.category || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (student && (
        (student.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (student.fullName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (student.email || '').toLowerCase().includes(searchTerm.toLowerCase())
      ));
    const matchesType = filterType === 'all' || transaction.type === filterType;
    const matchesStatus = filterStatus === 'all' || transaction.status === filterStatus;
    const matchesCategory = !filterCategory || transaction.category === filterCategory;
    return matchesSearch && matchesType && matchesStatus && matchesCategory;
  });

  // 1. Validar que el selector de estudiante sea obligatorio para matrícula/pago de módulo, y el de profesor para pagos a profesor
  const isStudentPayment = formData.category === 'Matrícula' || formData.category === 'Pago de módulo';
  const isTeacherPayment = formData.category === 'Pago a profesor';

  // Determinar si el selector de estudiante debe mostrarse y si es requerido
  const categoriasConEstudianteOpcional = ['Cursos Especiales', 'Certificaciones', 'Otros'];
  const showStudentSelect = isStudentPayment || categoriasConEstudianteOpcional.includes(formData.category);
  const studentSelectRequired = isStudentPayment;

 const handleSubmit = async (e) => {
  e.preventDefault();
  setLoading(true);
  try {
    let dataToSave = { ...formData };
    if (isStudentPayment) {
      dataToSave.teacherId = '';
    }
    if (isTeacherPayment) {
      dataToSave.studentId = '';
    }
    // Guardar descuento en el estudiante si es matrícula
    if (formData.category === 'Matrícula' && formData.studentId) {
      const descuentoAplicado = discounts[formData.studentId] || 0;
      await updateDoc(doc(db, 'students', formData.studentId), { descuento: descuentoAplicado });
    }
    // Calcular el siguiente número de recibo secuencial
    let nextRecibo = 1;
    if (!editingTransaction) {
      // Buscar el mayor número de recibo existente
      const recibos = transactions
        .map(t => t.reciboNumero)
        .filter(n => n && /^\d{4}$/.test(n))
        .map(n => parseInt(n, 10));
      if (recibos.length > 0) {
        nextRecibo = Math.max(...recibos) + 1;
      }
      dataToSave.reciboNumero = nextRecibo.toString().padStart(4, '0');
    }
    // Guardar la fecha exactamente como la selecciona el usuario, sin manipular offset
    const fechaSeleccionada = formData.date;
    if (editingTransaction) {
      await updateDoc(doc(db, 'payments', editingTransaction.id), {
        ...dataToSave,
        date: fechaSeleccionada,
        updated_at: fechaSeleccionada,
      });
      toast.success('Transacción actualizada correctamente');
    } else {
      await addDoc(collection(db, 'payments'), {
        ...dataToSave,
        date: fechaSeleccionada,
        created_at: fechaSeleccionada,
        updated_at: fechaSeleccionada,
      });
      toast.success('Transacción registrada correctamente');
    }
    await fetchTransactions();
    await fetchStudents(); // Refrescar descuentos
    resetForm();
  } catch (error) {
    toast.error('Error al guardar la transacción.');
    console.error('Error al guardar transacción:', error);
  } finally {
    setLoading(false);
  }
};

  const resetForm = () => {
    setFormData({
      type: 'income',
      category: '',
      description: '',
      amount: 0,
      status: 'completed',
      date: format(new Date(), 'yyyy-MM-dd'),
    });
    setEditingTransaction(null);
    setIsDialogOpen(false);
  };

  const handleEdit = (transaction) => {
    setEditingTransaction(transaction);
    setFormData({
      type: transaction.type,
      category: transaction.category,
      description: transaction.description,
      amount: transaction.amount,
      status: transaction.status,
      date: transaction.date || format(new Date(), 'yyyy-MM-dd'),
      studentId: transaction.studentId || '',
      teacherId: transaction.teacherId || '',
    });
    setIsDialogOpen(true);
    // Si se está editando desde el resumen de pagos de módulo, cerrar el modal de resumen
    setResumenEstudianteId(null);
  };

  // Reemplazar handleDelete para usar modal y toast
  const handleDelete = (id) => {
    setTransactionToDelete(id);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    try {
      await deleteDoc(doc(db, 'payments', transactionToDelete));
      await fetchTransactions();
      toast.success('Transacción eliminada correctamente');
      setShowDeleteModal(false);
      setTransactionToDelete(null);
    } catch (error) {
      toast.error('Error al eliminar la transacción.');
      setShowDeleteModal(false);
      setTransactionToDelete(null);
    }
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setTransactionToDelete(null);
  };

  // Eliminar un pago de módulo desde el resumen
  const handleDeletePagoModulo = async (pagoId) => {
    setTransactionToDelete(pagoId);
    setShowDeleteModal(true);
  };

  const confirmDeletePagoModulo = async () => {
    try {
      await deleteDoc(doc(db, 'payments', transactionToDelete));
      await fetchTransactions();
      toast.success('Pago de módulo eliminado correctamente');
      setShowDeleteModal(false);
      setTransactionToDelete(null);
      // Si ya no quedan pagos de módulo para el estudiante, cerrar el modal y actualizar la vista principal
      const pagosRestantes = transactions.filter(t => t.category === 'Pago de módulo' && t.studentId === resumenEstudianteId && t.id !== transactionToDelete);
      if (pagosRestantes.length === 0) {
        setResumenEstudianteId(null);
      }
    } catch (error) {
      toast.error('Error al eliminar el pago de módulo.');
      setShowDeleteModal(false);
      setTransactionToDelete(null);
    }
  };

  const getStatusBadge = (status) => {
    const variants = {
      completed: 'bg-green-100 text-green-800',
      pending: 'bg-yellow-100 text-yellow-800',
      cancelled: 'bg-red-100 text-red-800',
    };
    const labels = {
      completed: 'Completado',
      pending: 'Pendiente',
      cancelled: 'Cancelado',
    };
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${variants[status]}`}>{labels[status]}</span>
    );
  };

  const calculateStats = () => {
    const completedTransactions = transactions.filter(t => t.status === 'completed');
    const totalIncome = completedTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + Number(t.amount), 0);
    const totalExpenses = completedTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + Number(t.amount), 0);
    const pendingIncome = transactions.filter(t => t.type === 'income' && t.status === 'pending').reduce((sum, t) => sum + Number(t.amount), 0);
    return {
      totalIncome,
      totalExpenses,
      balance: totalIncome - totalExpenses,
      pendingIncome,
    };
  };

  const stats = calculateStats();

  // Agrupar pagos de módulo por estudiante
  const pagosModuloPorEstudiante = {};
  filteredTransactions.forEach(transaction => {
    if (transaction.category === 'Pago de módulo' && transaction.studentId) {
      if (!pagosModuloPorEstudiante[transaction.studentId]) pagosModuloPorEstudiante[transaction.studentId] = [];
      pagosModuloPorEstudiante[transaction.studentId].push(transaction);
    }
  });

  const handleOpenResumen = (studentId) => {
    setResumenEstudianteId(studentId);
  };

  const handleDiscountChange = (studentId, discount) => {
    setDiscounts(prev => ({ ...prev, [studentId]: discount }));
  };

  // Generar número de recibo (puedes mejorar la lógica según tu necesidad)
  const generarNumeroRecibo = (pago) => {
    // Ejemplo: usar los últimos 6 dígitos del id + día/mes
    if (!pago?.id) return '';
    const fecha = pago.date ? new Date(pago.date) : new Date();
    return `${fecha.getDate().toString().padStart(2, '0')}${(fecha.getMonth()+1).toString().padStart(2, '0')}-${pago.id.slice(-6)}`;
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Al cambiar el estudiante en el formulario, mostrar el descuento guardado
  const handleStudentSelect = (e) => {
    const studentId = e.target.value;
    setFormData({ ...formData, studentId });
    // Si hay descuento guardado, mostrarlo
    if (studentId && discounts[studentId] !== undefined) {
      setDiscounts(prev => ({ ...prev, [studentId]: discounts[studentId] }));
    }
  };

  // Función para imprimir solo el área del recibo (modal)
  const handlePrintModal = () => {
    if (printAreaRef.current) {
      const printContents = printAreaRef.current.innerHTML;
      const originalContents = document.body.innerHTML;
      document.body.innerHTML = printContents;
      window.print();
      document.body.innerHTML = originalContents;
      window.location.reload(); // Para recargar el estado de la app después de imprimir
    }
  };

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3v18h18" /></svg>
            Gestión Financiera
          </h1>
          <p className="text-gray-600 mt-2">Administra los ingresos, gastos y balance financiero del instituto</p>
        </div>
        <button onClick={() => setIsDialogOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-semibold flex items-center">
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          Nueva Transacción
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Ingresos Totales</p>
            <p className="text-2xl font-bold text-green-600">${stats.totalIncome.toLocaleString()}</p>
          </div>
          <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 12l5 5L20 7" /></svg>
        </div>
        <div className="bg-white rounded-lg shadow p-6 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Gastos Totales</p>
            <p className="text-2xl font-bold text-red-600">${stats.totalExpenses.toLocaleString()}</p>
          </div>
          <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 12l-5 5L4 7" /></svg>
        </div>
        <div className="bg-white rounded-lg shadow p-6 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Balance</p>
            <p className={`text-2xl font-bold ${stats.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>${stats.balance.toLocaleString()}</p>
          </div>
          <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v8m0 0l-4-4m4 4l4-4" /></svg>
        </div>
        <div className="bg-white rounded-lg shadow p-6 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Pendientes</p>
            <p className="text-2xl font-bold text-yellow-600">${stats.pendingIncome.toLocaleString()}</p>
          </div>
          <svg className="w-8 h-8 text-yellow-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7v6l4 2" /></svg>
        </div>
      </div>

      {/* Filtros y búsqueda */}
      <div className="bg-white rounded-lg shadow p-4 md:p-6 mb-6 flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
          <input
            className="pl-10 border rounded px-2 py-1 text-sm w-full"
            placeholder="Buscar por descripción, categoría o estudiante..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <select className="border rounded px-2 py-1 text-sm w-full sm:w-40" value={filterType} onChange={e => setFilterType(e.target.value)}>
            <option value="all">Todos</option>
            <option value="income">Ingresos</option>
            <option value="expense">Gastos</option>
          </select>
          <select className="border rounded px-2 py-1 text-sm w-full sm:w-40" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="all">Todos</option>
            <option value="completed">Completados</option>
            <option value="pending">Pendientes</option>
            <option value="cancelled">Cancelados</option>
          </select>
          <select className="border rounded px-2 py-1 text-sm w-full sm:w-40" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
            <option value="">Todas las categorías</option>
            {categoryOptions.concat('Pago a profesor').map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Lista de transacciones */}
      <div className="grid gap-4">
        {/* Mostrar agrupados los pagos de módulo por estudiante */}
        {Object.keys(pagosModuloPorEstudiante).map(studentId => {
          const student = students.find(s => s.id === studentId);
          const pagos = pagosModuloPorEstudiante[studentId];
          // Sumar los pagos de módulo tal cual, sin descuento
          const totalPagado = pagos.reduce((sum, t) => sum + Number(t.amount), 0);
          // El descuento solo se aplica al valor total del semestre
          const valorSemestreConDescuento = calculateDiscountedAmount(200000, discounts[studentId] || 0);
          const saldoPendiente = valorSemestreConDescuento - totalPagado;

          return (
            <div key={studentId} className="bg-white rounded-lg shadow hover:shadow-md transition-shadow p-6 flex items-center justify-between border-l-4 border-green-200">
              <div>
                <h3 className="font-semibold text-gray-900">Pago de módulo</h3>
                <p className="text-sm text-gray-600">Estudiante: {student ? (student.name || student.fullName || student.email) : 'Desconocido'}</p>
                <div className="text-xs text-blue-700 font-semibold cursor-pointer hover:underline" onClick={() => handleOpenResumen(studentId)}>
                  {pagos.length} pagos de módulo - Ver resumen
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-green-600">+${totalPagado.toLocaleString()}</p>
                <p className="text-sm text-yellow-600">Saldo pendiente: ${saldoPendiente.toLocaleString()}</p>
              </div>
            </div>
          );
        })}
        {/* Mostrar el resto de transacciones (matrícula, pagos a profesor, otros) */}
        {filteredTransactions.filter(t => t.category !== 'Pago de módulo').map(transaction => {
          const student = students.find(s => s.id === transaction.studentId);
          const teacher = teachers.find(t => t.id === transaction.teacherId);
          // Calcular progreso de pago del semestre para el estudiante
          let studentProgress = null;
          if (transaction.category === 'Matrícula' || transaction.category === 'Pago de módulo') {
            const pagosEstudiante = transactions.filter(t => t.studentId === transaction.studentId && (t.category === 'Matrícula' || t.category === 'Pago de módulo'));
            const totalPagado = pagosEstudiante.reduce((sum, t) => sum + Number(t.amount), 0);
            studentProgress = {
              pagado: totalPagado,
              deuda: 200000 - totalPagado
            };
          }
          // Calcular total pagado a profesor
          let teacherProgress = null;
          if (transaction.category === 'Pago a profesor') {
            const pagosProfesor = transactions.filter(t => t.teacherId === transaction.teacherId && t.category === 'Pago a profesor');
            const totalPagado = pagosProfesor.reduce((sum, t) => sum + Number(t.amount), 0);
            teacherProgress = {
              pagado: totalPagado
            };
          }
          return (
            <div key={transaction.id} className={`bg-white rounded-lg shadow hover:shadow-md transition-shadow p-4 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 ${transaction.type === 'income' ? 'border-l-4 border-green-200' : 'border-l-4 border-red-200'}`}>
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${transaction.type === 'income' ? 'bg-green-100' : 'bg-red-100'}`}>
                  {transaction.type === 'income' ? (
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 12l5 5L20 7" /></svg>
                  ) : (
                    <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 12l-5 5L4 7" /></svg>
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{transaction.description}</h3>
                  <p className="text-sm text-gray-600">{transaction.category}</p>
                  {/* Mostrar nombre y progreso */}
                  {student && (transaction.category === 'Matrícula' || transaction.category === 'Cursos Especiales' || transaction.category === 'Certificaciones' || transaction.category === 'Otros') && (
                    <div className="text-xs text-blue-700 font-semibold">Estudiante: {student.name || student.fullName || student.email}</div>
                  )}
                  {teacher && (
                    <div className="text-xs text-purple-700 font-semibold">Profesor: {teacher.name || teacher.fullName || teacher.email}</div>
                  )}
                </div>
              </div>
              <div className="flex flex-col md:flex-row items-end md:items-center gap-2 md:gap-4">
                <div className="text-right">
                  <p className="text-sm text-gray-600">Fecha</p>
                  <p className="font-medium">{transaction.date ? (() => {
                    // Evitar desfase de zona horaria interpretando yyyy-MM-dd como local
                    const [year, month, day] = transaction.date.split('-');
                    return `${day}/${month}/${year}`;
                  })() : ''}</p>
                </div>
                <div className="text-right">
                  <p className={`text-2xl font-bold ${transaction.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>{transaction.type === 'income' ? '+' : '-'}${Number(transaction.amount).toLocaleString()}</p>
                  {getStatusBadge(transaction.status)}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleEdit(transaction)} className="border rounded px-2 py-1 text-[#ffd600] hover:bg-gray-50 text-xs">Editar</button>
                  <button onClick={() => handleDelete(transaction.id)} className="border rounded px-2 py-1 text-red-600 hover:bg-red-100 text-xs">Eliminar</button>
                  <button onClick={() => { setPagoParaRecibo(transaction); setReciboNumero(transaction.reciboNumero || ''); }} className="border rounded px-2 py-1 text-blue-600 hover:bg-blue-50 text-xs">Imprimir</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal de Nueva/Editar Transacción */}
      {isDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full relative border-t-4 border-blue-600">
            <h3 className="text-xl font-bold mb-4 text-blue-700">{editingTransaction ? 'Editar Transacción' : 'Registrar Nueva Transacción'}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Tipo</label>
                <select className="w-full border rounded p-2" value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })}>
                  {typeOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Categoría</label>
                <select className="w-full border rounded p-2" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} required>
                  <option value="">Selecciona una categoría</option>
                  {categoryOptions.concat('Pago a profesor').map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>
              {/* Selector de estudiante obligatorio si es matrícula o pago de módulo */}
              {showStudentSelect && (
                <div>
                  <label className="block text-sm font-medium mb-1">Estudiante</label>
                  <Select
                    className="mb-2"
                    options={students.map(student => ({
                      value: student.id,
                      label: student.name || student.fullName || student.email
                    }))}
                    value={students
                      .filter(student => student.id === formData.studentId)
                      .map(student => ({ value: student.id, label: student.name || student.fullName || student.email }))[0] || null}
                    onChange={option => {
                      const studentId = option ? option.value : '';
                      setFormData({ ...formData, studentId });
                      if (studentId && discounts[studentId] !== undefined) {
                        setDiscounts(prev => ({ ...prev, [studentId]: discounts[studentId] }));
                      }
                    }}
                    isClearable
                    placeholder="Buscar y seleccionar estudiante..."
                    isSearchable
                    required={studentSelectRequired}
                  />
                </div>
              )}
              {/* Campo de descuento solo si es matrícula o si es pago de módulo y el estudiante tiene descuento */}
              {(formData.category === 'Matrícula' || (formData.category === 'Pago de módulo' && discounts[formData.studentId] > 0)) && (
                <div>
                  <label className="block text-sm font-medium mb-1">Descuento (%)</label>
                  <input
                    className="w-full border rounded p-2"
                    type="number"
                    value={discounts[formData.studentId] === 0 || discounts[formData.studentId] === undefined ? '' : discounts[formData.studentId]}
                    onChange={e => handleDiscountChange(formData.studentId, parseFloat(e.target.value) || 0)}
                    placeholder="Descuento"
                    min="0"
                    max="100"
                    disabled={formData.category === 'Pago de módulo'}
                  />
                </div>
              )}
              {/* Selector de profesor obligatorio si es pago a profesor */}
              {isTeacherPayment && (
                <div>
                  <label className="block text-sm font-medium mb-1">Profesor</label>
                  <select className="w-full border rounded p-2" value={formData.teacherId || ''} onChange={e => setFormData({ ...formData, teacherId: e.target.value })} required>
                    <option value="">Selecciona un profesor</option>
                    {teachers.map(teacher => (
                      <option key={teacher.id} value={teacher.id}>{teacher.name || teacher.fullName || teacher.email}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium mb-1">Descripción</label>
                <input className="w-full border rounded p-2" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="Describe la transacción" required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Monto ($)</label>
                <input className="w-full border rounded p-2" type="number" value={formData.amount === 0 ? '' : formData.amount} onChange={e => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })} placeholder="Monto" min="0" step="0.01" required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Estado</label>
                <select className="w-full border rounded p-2" value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })}>
                  {statusOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </div>
              <div className="flex gap-2 pt-4">
                <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-semibold">
                  {loading ? 'Procesando...' : (editingTransaction ? 'Actualizar' : 'Registrar')}
                </button>
                <button type="button" className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50" onClick={resetForm}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de resumen de pagos de módulo */}
      {resumenEstudianteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg p-8 max-w-lg w-full relative border-t-4 border-blue-600">
            <button className="absolute top-2 right-2 text-gray-500 hover:text-gray-700" onClick={() => setResumenEstudianteId(null)}>&times;</button>
            <h3 className="text-xl font-bold mb-4 text-blue-700">Resumen de pagos de módulo</h3>
            <p className="mb-2 font-semibold">Estudiante: {(() => { const s = students.find(st => st.id === resumenEstudianteId); return s ? (s.name || s.fullName || s.email) : 'Desconocido'; })()}</p>
            <table className="w-full text-sm mb-4">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-1">Descripción</th>
                  <th className="text-left py-1">Fecha</th>
                  <th className="text-right py-1">Valor</th>
                  <th className="text-right py-1">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {pagosModuloPorEstudiante[resumenEstudianteId]?.map(pago => (
                  <tr key={pago.id} className="border-b">
                    <td className="py-1">{pago.description}</td>
                    <td className="py-1">{pago.date ? (() => {
                      const [year, month, day] = pago.date.split('-');
                      return `${day}/${month}/${year}`;
                    })() : ''}</td>
                    <td className="py-1 text-right">${Number(pago.amount).toLocaleString()}</td>
                    <td className="py-1 text-right flex gap-2 justify-end">
                      <button onClick={() => handleEdit(pago)} className="border rounded px-2 py-1 text-[#ffd600] hover:bg-gray-50 text-xs">Editar</button>
                      <button onClick={() => handleDeletePagoModulo(pago.id)} className="border rounded px-2 py-1 text-red-600 hover:bg-red-100 text-xs">Eliminar</button>
                      <button
                        onClick={() => {
                          setPagoParaRecibo(pago);
                          setReciboNumero(pago.reciboNumero || '');
                        }}
                        className="border rounded px-2 py-1 text-blue-600 hover:bg-blue-50 text-xs"
                      >Imprimir</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="font-semibold text-right">Total pagado: ${pagosModuloPorEstudiante[resumenEstudianteId]?.reduce((sum, t) => sum + Number(t.amount), 0).toLocaleString()}</div>
          </div>
        </div>
      )}

      {/* Modal de confirmación de eliminación */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg p-8 max-w-sm w-full relative border-t-4 border-[#009245]">
            <h3 className="text-lg font-bold mb-4 text-[#23408e]">¿Eliminar transacción?</h3>
            <p className="mb-6 text-gray-700">Esta acción no se puede deshacer. ¿Deseas continuar?</p>
            <div className="flex justify-end gap-4">
              <button onClick={cancelDelete} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">Cancelar</button>
              <button onClick={resumenEstudianteId ? confirmDeletePagoModulo : confirmDelete} className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600">Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de impresión de recibo */}
      {pagoParaRecibo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 print:bg-transparent">
          <div className="bg-white rounded-lg shadow-lg p-2 sm:p-4 md:p-8 max-w-full w-full sm:max-w-2xl sm:w-auto relative border-t-4 border-blue-600 print:shadow-none print:border-0 print:p-0 print:rounded-none max-h-[90vh] overflow-y-auto sm:max-h-none sm:overflow-y-visible">
            <button className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 print:hidden" onClick={() => setPagoParaRecibo(null)}>&times;</button>
            <div ref={printAreaRef} className="overflow-x-auto">
              <PaymentReceipt
                pago={pagoParaRecibo}
                estudiante={students.find(s => s.id === pagoParaRecibo.studentId)}
                reciboNumero={reciboNumero}
              />
            </div>
            <div className="flex justify-end mt-6 gap-2 print:hidden">
              <button onClick={() => setPagoParaRecibo(null)} className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">Cerrar</button>
              <button
                onClick={handlePrintModal}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-semibold"
              >Imprimir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentManager;
