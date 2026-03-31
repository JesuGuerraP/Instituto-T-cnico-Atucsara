import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const FinanceChart = ({ labels, income, expense }) => {
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          usePointStyle: true,
          padding: 20,
          font: {
            family: "'Inter', sans-serif",
            size: 11
          }
        }
      },
      tooltip: {
        backgroundColor: 'rgba(35, 64, 142, 0.9)',
        titleFont: { size: 13, weight: 'bold' },
        bodyFont: { size: 12 },
        padding: 12,
        cornerRadius: 8,
        displayColors: true,
        callbacks: {
          label: (context) => {
            const label = context.dataset.label || '';
            const value = context.parsed.y;
            return `${label}: $${value.toLocaleString()}`;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
          drawBorder: false
        },
        ticks: {
          callback: (value) => `$${(value / 1000).toFixed(0)}k`,
          font: { size: 10, color: '#94a3b8' }
        }
      },
      x: {
        grid: {
          display: false,
          drawBorder: false
        },
        ticks: {
          font: { size: 10, color: '#94a3b8' }
        }
      }
    },
    elements: {
      line: {
        tension: 0.4
      },
      point: {
        radius: 4,
        hoverRadius: 6,
        borderWidth: 2,
        backgroundColor: '#fff'
      }
    }
  };

  const data = {
    labels,
    datasets: [
      {
        label: 'Ingresos',
        data: income,
        borderColor: '#23408e',
        backgroundColor: 'rgba(35, 64, 142, 0.1)',
        fill: true,
      },
      {
        label: 'Gastos',
        data: expense,
        borderColor: '#ef4444',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        fill: true,
      }
    ],
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm h-[350px]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-800 tracking-tight">Análisis de Flujo de Caja</h3>
        <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded-full uppercase tracking-wider">Últimos 6 meses</span>
      </div>
      <div className="h-[280px]">
        <Line options={options} data={data} />
      </div>
    </div>
  );
};

export default FinanceChart;
