import React from 'react';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend
} from 'chart.js';
import { Doughnut } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend);

const StudentDistribution = ({ labels, fullData }) => {
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '75%',
    plugins: {
      legend: {
        display: false 
      },
      tooltip: {
        backgroundColor: 'rgba(35, 64, 142, 0.9)',
        padding: 12,
        cornerRadius: 12,
        displayColors: true,
        titleFont: { size: 14, weight: 'bold' },
        bodyFont: { size: 12 }
      }
    }
  };

  const activeTotals = Object.values(fullData).map(v => v.active);

  const chartData = {
    labels,
    datasets: [
      {
        data: activeTotals,
        backgroundColor: [
          '#23408e',
          '#009245',
          '#ffd600',
          '#ef4444',
          '#a855f7',
          '#f97316',
          '#0ea5e9',
          '#64748b',
        ],
        borderWidth: 3,
        borderColor: '#ffffff',
        hoverOffset: 15
      }
    ],
  };

  const globalTotal = Object.values(fullData).reduce((sum, val) => sum + val.total, 0);
  const globalActive = Object.values(fullData).reduce((sum, val) => sum + val.active, 0);

  return (
    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm h-full flex flex-col">
      <div className="w-full flex items-start justify-between mb-8">
        <div>
          <h3 className="text-2xl font-black text-slate-800 tracking-tight">Estudiantes por Carrera</h3>
          <p className="text-sm text-slate-500 font-medium">Análisis detallado de inscritos y estados</p>
        </div>
        <div className="bg-[#23408e]/5 px-4 py-2 rounded-2xl flex flex-col items-end">
          <div className="text-2xl font-black text-[#23408e] leading-none mb-1">{globalTotal}</div>
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Total Inscritos</div>
        </div>
      </div>

      <div className="flex flex-col xl:flex-row items-center gap-12 flex-1">
        {/* Gráfico más grande */}
        <div className="relative w-56 h-56 xl:w-64 xl:h-64 shrink-0 transition-transform hover:scale-105 duration-300">
          <Doughnut options={options} data={chartData} />
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Activos</span>
            <span className="text-4xl font-black text-blue-900 leading-none">{globalActive}</span>
          </div>
        </div>

        {/* Tabla más profesional y legible */}
        <div className="flex-1 w-full overflow-hidden">
          <div className="overflow-y-auto max-h-[300px] custom-scrollbar pr-4">
            <table className="w-full border-separate border-spacing-y-2">
              <thead className="text-slate-400 font-bold uppercase tracking-widest text-[10px] text-left">
                <tr>
                  <th className="px-4 pb-2">Carrera o Especialidad</th>
                  <th className="px-4 pb-2 text-center">Total</th>
                  <th className="px-4 pb-2 text-center text-green-600">Activos</th>
                  <th className="px-4 pb-2 text-center text-red-400">Inactivos</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(fullData).map(([name, stats], idx) => (
                  <tr key={name} className="group hover:bg-slate-50 transition-all rounded-2xl">
                    <td className="py-3 px-4 flex items-center gap-3 bg-slate-50 group-hover:bg-white rounded-l-2xl border-l-4 border-transparent group-hover:border-[#23408e]">
                       <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: chartData.datasets[0].backgroundColor[idx % 8] }}></span>
                       <span className="font-bold text-slate-700 text-sm truncate max-w-[150px] xl:max-w-none" title={name}>{name}</span>
                    </td>
                    <td className="py-3 px-4 text-center font-black text-slate-800 bg-slate-50 group-hover:bg-white text-sm">{stats.total}</td>
                    <td className="py-3 px-4 text-center text-green-600 font-black bg-slate-50 group-hover:bg-white text-sm">{stats.active}</td>
                    <td className="py-3 px-4 text-center text-red-400 font-bold bg-slate-50 group-hover:bg-white rounded-r-2xl text-sm">{stats.inactive}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      
      {/* Barra de capacidad mejorada */}
      <div className="mt-8 p-5 bg-slate-50 rounded-3xl border border-slate-100/50">
        <div className="flex justify-between items-center text-xs font-black text-slate-600 uppercase mb-3 px-1">
           <span className="flex items-center gap-2">
             <div className="w-2 h-2 rounded-full bg-[#23408e] animate-pulse"></div>
             Tasa de Retención Actual
           </span>
           <span className="text-[#23408e]">{((globalActive / (globalTotal || 1)) * 100).toFixed(1)}%</span>
        </div>
        <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden flex">
           <div 
             className="bg-gradient-to-r from-[#23408e] to-[#4069e2] h-full rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(35,64,142,0.3)]" 
             style={{ width: `${(globalActive / (globalTotal || 1)) * 100}%` }}
           ></div>
        </div>
      </div>
    </div>
  );
};

export default StudentDistribution;
