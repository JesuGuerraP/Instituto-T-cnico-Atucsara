import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font, Image } from '@react-pdf/renderer';

// Formateador de moneda para el PDF
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(amount) || 0);
};

const styles = StyleSheet.create({
  page: { padding: 30, backgroundColor: '#ffffff', fontFamily: 'Helvetica' },
  headerContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, borderBottomWidth: 2, borderBottomColor: '#23408e', paddingBottom: 10 },
  logo: { width: 60, height: 60, marginRight: 15 },
  headerText: { flex: 1 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#23408e', marginBottom: 5 },
  subtitle: { fontSize: 12, color: '#555555' },
  filtersContainer: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 20, backgroundColor: '#f9fafb', padding: 10, borderRadius: 5 },
  filterItem: { width: '50%', marginBottom: 5 },
  filterLabel: { fontSize: 10, color: '#888888', fontWeight: 'bold' },
  filterValue: { fontSize: 11, color: '#333333' },
  
  summaryContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  summaryCard: { width: '30%', padding: 15, borderRadius: 8, color: '#ffffff' },
  summaryIncome: { backgroundColor: '#10b981' },
  summaryExpense: { backgroundColor: '#ef4444' },
  summaryBalance: { backgroundColor: '#23408e' },
  summaryLabel: { fontSize: 10, textTransform: 'uppercase', marginBottom: 5 },
  summaryValue: { fontSize: 18, fontWeight: 'bold' },

  sectionTitle: { fontSize: 16, fontWeight: 'bold', marginTop: 20, marginBottom: 10, color: '#333333', borderBottomWidth: 1, borderBottomColor: '#dddddd', paddingBottom: 5 },
  
  categoryContainer: { marginBottom: 15 },
  categoryHeader: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#f3f4f6', padding: 8, alignItems: 'center' },
  categoryName: { fontSize: 12, fontWeight: 'bold', color: '#374151' },
  categoryTotal: { fontSize: 12, fontWeight: 'bold', color: '#111827' },
  
  table: { width: '100%', marginTop: 5 },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#eeeeee', paddingVertical: 6, alignItems: 'center' },
  tableHeader: { backgroundColor: '#ffffff', borderBottomWidth: 2, borderBottomColor: '#cccccc' },
  tableColHeader: { fontSize: 9, fontWeight: 'bold', color: '#666666' },
  tableCol: { fontSize: 9, color: '#444444' },
  
  colPerson: { width: '35%', paddingLeft: 5 },
  colDetail: { width: '35%', paddingLeft: 5 },
  colCount: { width: '10%', textAlign: 'center' },
  colTotal: { width: '20%', textAlign: 'right', paddingRight: 5 },
  
  courseTag: { fontSize: 8, color: '#6b21a8', backgroundColor: '#f3e8ff', paddingHorizontal: 4, paddingVertical: 2, borderRadius: 2, marginBottom: 2 },
});

const CategoryTable = ({ categoryName, data, isIncome }) => (
  <View style={styles.categoryContainer} wrap={false}>
    <View style={styles.categoryHeader}>
      <Text style={styles.categoryName}>{categoryName} ({data.aggregatedItems.length} reg.)</Text>
      <Text style={[styles.categoryTotal, { color: isIncome ? '#059669' : '#dc2626' }]}>
        {formatCurrency(data.total)}
      </Text>
    </View>
    <View style={styles.table}>
      <View style={[styles.tableRow, styles.tableHeader]}>
        <Text style={[styles.tableColHeader, styles.colPerson]}>Persona Asociada</Text>
        <Text style={[styles.tableColHeader, styles.colDetail]}>Detalle / Curso / Descripción</Text>
        <Text style={[styles.tableColHeader, styles.colCount]}>Trans.</Text>
        <Text style={[styles.tableColHeader, styles.colTotal]}>Total Pagado</Text>
      </View>
      {data.aggregatedItems.map((item, idx) => (
        <View key={idx} style={styles.tableRow}>
          <Text style={[styles.tableCol, styles.colPerson]}>{item.personName}</Text>
          <View style={[styles.colDetail]}>
            {item.courseName && <Text style={styles.courseTag}>{item.courseName}</Text>}
            <Text style={styles.tableCol}>{item.descriptions}</Text>
          </View>
          <Text style={[styles.tableCol, styles.colCount]}>{item.count}</Text>
          <Text style={[styles.tableCol, styles.colTotal, { fontWeight: 'bold' }]}>{formatCurrency(item.totalAmount)}</Text>
        </View>
      ))}
    </View>
  </View>
);

export const FinancialReportPDF = ({ stats, filters }) => {
  const isBalancePositive = stats.balance >= 0;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Encabezado */}
        <View style={styles.headerContainer}>
          <Image src="/assets/logoInstituto.jpg" style={styles.logo} />
          <View style={styles.headerText}>
            <Text style={styles.title}>Informe Financiero Integral</Text>
            <Text style={styles.subtitle}>Instituto Técnico Atucsara</Text>
          </View>
        </View>

        {/* Filtros Activos */}
        <View style={styles.filtersContainer}>
          <View style={styles.filterItem}>
            <Text style={styles.filterLabel}>Criterio de Tiempo:</Text>
            <Text style={styles.filterValue}>{filters.filterTypeLabel}</Text>
          </View>
          {filters.detailLabel && (
            <View style={styles.filterItem}>
              <Text style={styles.filterLabel}>Detalle del Filtro:</Text>
              <Text style={styles.filterValue}>{filters.detailLabel}</Text>
            </View>
          )}
        </View>

        {/* Tarjetas de Resumen */}
        <View style={styles.summaryContainer}>
          <View style={[styles.summaryCard, styles.summaryIncome]}>
            <Text style={styles.summaryLabel}>Ingresos Totales</Text>
            <Text style={styles.summaryValue}>{formatCurrency(stats.totalIncome)}</Text>
          </View>
          <View style={[styles.summaryCard, styles.summaryExpense]}>
            <Text style={styles.summaryLabel}>Egresos Totales</Text>
            <Text style={styles.summaryValue}>{formatCurrency(stats.totalExpense)}</Text>
          </View>
          <View style={[styles.summaryCard, styles.summaryBalance, !isBalancePositive && { backgroundColor: '#ea580c' }]}>
            <Text style={styles.summaryLabel}>Balance Neto</Text>
            <Text style={styles.summaryValue}>{formatCurrency(stats.balance)}</Text>
          </View>
        </View>

        {/* Desglose de Ingresos */}
        <Text style={styles.sectionTitle}>Desglose de Ingresos</Text>
        {Object.keys(stats.categoriesIncome).length === 0 ? (
          <Text style={{ fontSize: 10, color: '#666', fontStyle: 'italic' }}>No hay ingresos registrados en este período.</Text>
        ) : (
          Object.entries(stats.categoriesIncome)
            .sort((a,b) => b[1].total - a[1].total)
            .map(([catName, data]) => (
              <CategoryTable key={catName} categoryName={catName} data={data} isIncome={true} />
            ))
        )}

        {/* Desglose de Egresos */}
        <Text style={[styles.sectionTitle, { marginTop: 30 }]}>Desglose de Egresos</Text>
        {Object.keys(stats.categoriesExpense).length === 0 ? (
          <Text style={{ fontSize: 10, color: '#666', fontStyle: 'italic' }}>No hay egresos registrados en este período.</Text>
        ) : (
          Object.entries(stats.categoriesExpense)
            .sort((a,b) => b[1].total - a[1].total)
            .map(([catName, data]) => (
              <CategoryTable key={catName} categoryName={catName} data={data} isIncome={false} />
            ))
        )}

      </Page>
    </Document>
  );
};
