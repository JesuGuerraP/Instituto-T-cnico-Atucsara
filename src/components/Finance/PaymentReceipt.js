import React, { forwardRef } from 'react';

// Componente de recibo institucional para impresión
const PaymentReceipt = forwardRef(({ pago, estudiante, reciboNumero }, ref) => {
  // Formatear fecha y valor
  const formatDate = (date) => {
    if (!date) return '';
    const d = new Date(date.seconds ? date.seconds * 1000 : date);
    return d.toLocaleDateString('es-CO');
  };
  const formatCOP = v => v?.toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 });

  return (
    <div ref={ref} className="bg-white w-[700px] max-w-full mx-auto border border-gray-400 rounded-xl shadow-lg p-0 print:p-0 print:shadow-none print:border-0 print:rounded-none print:w-full print:max-w-none">
      {/* Encabezado institucional */}
      <div className="flex flex-col sm:flex-row items-start sm:items-start justify-between px-2 sm:px-6 pt-4 sm:pt-6 pb-2 gap-2 sm:gap-0" style={{borderBottom: '2px solid #bdbdbd'}}>
        {/* Logo */}
        <img src={process.env.PUBLIC_URL + '/assets/logoInstituto.jpg'} alt="Logo" className="w-20 h-20 sm:w-24 sm:h-24 object-contain self-center sm:self-auto" style={{marginTop: 2}} />
        {/* Centro: Nombre y datos, alineado más a la izquierda, casi tocando el logo */}
        <div className="flex-1 flex flex-col items-start justify-center ml-0 sm:ml-2 pl-0 sm:pl-2 mt-2 sm:mt-0">
          <div className="w-full flex flex-row items-center">
            <span className="font-bold text-base leading-tight tracking-wide text-left whitespace-nowrap">INSTITUTO TÉCNICO LABORAL</span>
          </div>
          <div className="text-2xl sm:text-4xl font-extrabold tracking-wider text-[#222] -mt-1 text-left w-full">ATUCSARA</div>
          <div className="italic text-base sm:text-lg text-gray-700 -mt-1 text-left w-full">Innovación y Excelencia</div>
          {/* Dirección */}
          <div className="flex flex-row items-center gap-x-2 mt-2 w-full">
            <div className="flex flex-col items-start">
              <span className="uppercase text-[10px] tracking-widest text-gray-700 font-semibold">EDIFICIO ATUCSARA</span>
              <div className="flex flex-row items-center mt-0.5">
                <span className="text-[15px] mr-1 align-middle">📍</span>
                <span className="text-[13px] font-bold text-black">CLL. 17a # 16 - 61</span>
              </div>
              <span className="text-[13px] font-bold text-black -mt-1 ml-5">Brr. Montecatini</span>
            </div>
          </div>
        </div>
        {/* Recibo de caja menor y contacto */}
        <div className="flex flex-col items-end sm:items-end ml-0 sm:ml-4 mt-2 sm:mt-0 w-full sm:w-auto gap-2 relative">
          <div className="border border-gray-400 rounded px-3 py-1 text-right bg-gray-50 min-w-[110px] w-full sm:w-auto max-w-xs mx-auto sm:mx-0">
            <div className="font-bold text-xs">RECIBO DE CAJA MENOR</div>
            <div className="text-xs mt-1">N° <span className="font-bold">{reciboNumero}</span></div>
          </div>
          {/* Información de contacto responsiva */}
          <div className="flex flex-col items-end text-[12px] sm:text-[13px] pr-0 sm:pr-2 w-full sm:w-auto">
            <div className="flex items-center mb-0.5 flex-wrap justify-end">
              <span className="text-[16px] mr-1 align-middle text-pink-600">📞</span>
              <span className="font-bold text-black break-all">320 534 0909</span>
            </div>
            <div className="flex items-center flex-wrap justify-end">
              <span className="text-[16px] mr-1 align-middle text-purple-600">✉️</span>
              <span className="font-bold text-black break-all whitespace-normal">institutotecnicoatucsara@gmail.com</span>
            </div>
          </div>
        </div>
      </div>
      {/* Tabla de datos */}
      <table className="w-full border-x border-b border-gray-400 rounded-none mb-0 text-[15px]" style={{tableLayout: 'fixed'}}>
        <tbody>
          <tr>
            <td className="border border-gray-400 px-3 py-2 font-bold w-[20%] align-top">FECHA:</td>
            <td className="border border-gray-400 px-3 py-2 w-[30%] align-top">{formatDate(pago.date)}</td>
            <td className="border border-gray-400 px-3 py-2 font-bold w-[20%] align-top">VALOR $</td>
            <td className="border border-gray-400 px-3 py-2 w-[30%] align-top">{formatCOP(pago.amount)}</td>
          </tr>
          <tr>
            <td className="border border-gray-400 px-3 py-2 font-bold align-top">PAGADO POR:</td>
            <td className="border border-gray-400 px-3 py-2 align-top" colSpan={3}>
              {pago.type === 'expense'
                ? 'Meraly Martinez (Secretaria)'
                : estudiante
                  ? [estudiante.name, estudiante.lastName, estudiante.fullName].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
                  : ''}
            </td>
          </tr>
          <tr>
            <td className="border border-gray-400 px-3 py-2 font-bold align-top">POR CONCEPTO DE:</td>
            <td className="border border-gray-400 px-3 py-2 align-top" colSpan={3}>{pago.category} - {pago.description}</td>
          </tr>
          <tr>
            <td className="border border-gray-400 px-3 py-2 font-bold align-top">LA SUMA DE:</td>
            <td className="border border-gray-400 px-3 py-2 align-top" colSpan={3}>{formatCOP(pago.amount)}</td>
          </tr>
        </tbody>
      </table>
      {/* Bloque de firmas */}
      <div className="w-full border border-gray-400 rounded-b-xl mt-0 flex flex-row divide-x divide-gray-400" style={{minHeight: 90}}>
        {/* Aprobado */}
        <div className="flex-1 flex flex-col items-center justify-end py-2 px-2">
          <div className="w-full flex flex-col items-center justify-end h-full">
            <span className="text-[14px] text-gray-700 font-semibold mb-1">Aprobado:</span>
            <img
              src={process.env.PUBLIC_URL + '/assets/FirmaRectora.jpg'}
              alt="Firma Rectora"
              style={{ maxHeight: 38, maxWidth: '90%', objectFit: 'contain', marginBottom: 2, background: '#fff', padding: 0, borderRadius: 0, boxShadow: 'none', border: 'none', display: 'block' }}
              className="mx-auto select-none pointer-events-none"
              draggable="false"
            />
            <span className="block border-b border-[#23408e] w-4/5 mt-1" style={{height: 0}}></span>
            <span className="text-[12px] text-[#23408e] font-semibold mt-1">Luz Aminta Serpa Diaz <span className="italic text-gray-500 font-normal ml-1">Rectora</span></span>
            <span className="text-[11px] text-gray-500 mt-1">C.C No: 1067961674</span>
          </div>
        </div>
        {/* Contabilizado */}
        <div className="flex-1 flex flex-col items-center justify-end py-2 px-2">
          <div className="w-full flex flex-col items-center justify-end h-full">
            <span className="text-[14px] text-gray-700 font-semibold mb-1">Contabilizado:</span>
            <span className="block border-b border-[#23408e] w-4/5 mt-1" style={{height: 0}}></span>
            <span className="text-[12px] text-[#23408e] font-semibold mt-1"> <span className="italic text-gray-500 font-normal ml-1">Rectora</span></span>
            <span className="text-[11px] text-gray-500 mt-1">C.C No: </span>
          </div>
        </div>
        {/* Recibí */}
        <div className="flex-1 flex flex-col items-center justify-end py-2 px-2">
          <div className="w-full flex flex-col items-center justify-end h-full">
            <span className="text-[14px] text-gray-700 font-semibold mb-1">Recibí:</span>
            <img
              src={process.env.PUBLIC_URL + '/assets/FirmaSecretaria.jpg'}
              alt="Firma Secretaria"
              style={{ maxHeight: 38, maxWidth: '90%', objectFit: 'contain', marginBottom: 2, background: '#fff', padding: 0, borderRadius: 0, boxShadow: 'none', border: 'none', display: 'block' }}
              className="mx-auto select-none pointer-events-none"
              draggable="false"
            />
            <span className="block border-b border-[#23408e] w-4/5 mt-1" style={{height: 0}}></span>
            <span className="text-[12px] text-[#23408e] font-semibold mt-1">Meraly Martinez <span className="italic text-gray-500 font-normal ml-1">Secretaria</span></span>
            <span className="text-[11px] text-gray-500 mt-1">C.C No: 1067961674</span>
          </div>
        </div>
      </div>
      <div className="text-xs text-gray-400 mt-2 mb-2 text-center print:hidden">Recibo generado automáticamente - {new Date().toLocaleString('es-CO')}</div>
    </div>
  );
});

export default PaymentReceipt;
