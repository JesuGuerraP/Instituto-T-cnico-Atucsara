import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const AcademicOverview = ({ modules }) => {
  const options = {
    indexAxis: 'y', // Horizontal bars
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        backgroundColor: 'rgba(35, 64, 142, 0.95)',
        padding: 14,
        cornerRadius: 12,
        titleFont: { size: 13, weight: 'bold' },
        bodyFont: { size: 12 }
      }
    },
    scales: {
      x: {
        min: 0,
        max: 5,
        grid: {
          color: 'rgba(0, 0, 0, 0.03)',
          drawBorder: false
        },
        ticks: {
          stepSize: 1,
          font: { size: 10, weight: '700' },
          color: '#94a3b8'
        }
      },
      y: {
        grid: {
          display: false,
          drawBorder: false
        },
        ticks: {
          font: { size: 11, weight: '800' },
          color: '#334155'
        }
      }
    }
  };

  const data = {
    labels: modules.map(m => m.name.length > 25 ? m.name.substring(0, 22) + '...' : m.name),
    datasets: [
      {
        label: 'Promedio Módulo',
        data: modules.map(m => m.average),
        backgroundColor: modules.map(m => 
          parseFloat(m.average) >= 4.0 ? '#009245' :
          parseFloat(m.average) >= 3.0 ? '#23408e' :
          '#ef4444'
        ),
        borderRadius: 8,
        barThickness: 18,
        hoverBackgroundColor: '#ffd600'
      }
    ],
  };

  return (
    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm min-h-[400px] flex flex-col transition-all hover:shadow-md">
      <div className="flex items-center justify-between mb-8">
        <div>
           <h3 className="text-xl font-black text-slate-800 tracking-tight">Rendimiento por Módulo</h3>
           <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Ranking de Calificaciones (Top 8)</p>
        </div>
        <div className="bg-slate-50 px-3 py-1 rounded-full text-[10px] font-black text-slate-400 border border-slate-100 uppercase">Automático</div>
      </div>
      <div className="flex-1 w-full min-h-[250px]">
        {modules.length > 0 ? (
          <Bar options={options} data={data} />
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-2">
            <div className="w-12 h-12 rounded-full border-2 border-dashed border-slate-200 flex items-center justify-center">?</div>
            <p className="text-xs font-bold uppercase tracking-widest">Sin datos registrados</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AcademicOverview;
