import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Export data to Excel file
 * @param data - Array of objects to export
 * @param filename - Output filename (without extension)
 * @param sheetName - Name of the worksheet
 */
export function exportToExcel(
    data: Record<string, unknown>[],
    filename: string,
    sheetName: string = 'Sheet1'
) {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    // Auto-size columns
    const maxWidth = 50;
    const colWidths = Object.keys(data[0] || {}).map(key => {
        const maxLength = Math.max(
            key.length,
            ...data.map(row => String(row[key] || '').length)
        );
        return { wch: Math.min(maxLength + 2, maxWidth) };
    });
    worksheet['!cols'] = colWidths;

    XLSX.writeFile(workbook, `${filename}.xlsx`);
}

/**
 * Export data to PDF file with table
 * @param data - Array of objects to export
 * @param columns - Column definitions { header: string, dataKey: string }[]
 * @param title - Title of the document
 * @param filename - Output filename (without extension)
 */
export function exportToPDF(
    data: Record<string, unknown>[],
    columns: { header: string; dataKey: string }[],
    title: string,
    filename: string
) {
    const doc = new jsPDF();

    // Add Thai font support note - for production, you'd add a Thai font
    // For now, we'll use basic PDF with English headers

    // Title
    doc.setFontSize(18);
    doc.text(title, 14, 20);

    // Date
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString('th-TH')}`, 14, 28);

    // Table
    autoTable(doc, {
        startY: 35,
        head: [columns.map(col => col.header)],
        body: data.map(row => columns.map(col => String(row[col.dataKey] ?? ''))),
        styles: {
            fontSize: 9,
            cellPadding: 3,
        },
        headStyles: {
            fillColor: [41, 128, 185],
            textColor: 255,
            fontStyle: 'bold',
        },
        alternateRowStyles: {
            fillColor: [245, 245, 245],
        },
    });

    doc.save(`${filename}.pdf`);
}

/**
 * Export payslip to PDF
 * @param employee - Employee info
 * @param payroll - Payroll record
 * @param period - Period info
 * @param organization - Organization info
 */
export function exportPayslipPDF(
    employee: { name: string; email: string },
    payroll: {
        base_salary: number;
        position_allowance: number;
        diligence_allowance: number;
        other_allowance: number;
        commission_total: number;
        total_earnings: number;
        social_security: number;
        withholding_tax: number;
        loan_deduction: number;
        other_deduction: number;
        total_deductions: number;
        net_salary: number;
    },
    period: { name: string; start: string; end: string },
    organization: { name: string }
) {
    const doc = new jsPDF();
    const formatCurrency = (n: number) => n.toLocaleString('th-TH', { minimumFractionDigits: 2 });

    // Header
    doc.setFontSize(16);
    doc.text('Payslip / Salary Statement', 105, 20, { align: 'center' });

    doc.setFontSize(12);
    doc.text(organization.name, 105, 28, { align: 'center' });

    doc.setFontSize(10);
    doc.text(`Period: ${period.name}`, 14, 40);
    doc.text(`Date: ${period.start} - ${period.end}`, 14, 46);

    // Employee Info
    doc.setFontSize(11);
    doc.text(`Employee: ${employee.name}`, 14, 58);
    doc.text(`Email: ${employee.email}`, 14, 64);

    // Earnings Table
    autoTable(doc, {
        startY: 75,
        head: [['Earnings', 'Amount (THB)']],
        body: [
            ['Base Salary', formatCurrency(payroll.base_salary)],
            ['Position Allowance', formatCurrency(payroll.position_allowance)],
            ['Diligence Allowance', formatCurrency(payroll.diligence_allowance)],
            ['Other Allowance', formatCurrency(payroll.other_allowance)],
            ['Commission', formatCurrency(payroll.commission_total)],
            ['Total Earnings', formatCurrency(payroll.total_earnings)],
        ],
        styles: { fontSize: 9 },
        headStyles: { fillColor: [46, 204, 113] },
        columnStyles: { 1: { halign: 'right' } },
        theme: 'grid',
    });

    // Deductions Table
    const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY || 120;

    autoTable(doc, {
        startY: finalY + 10,
        head: [['Deductions', 'Amount (THB)']],
        body: [
            ['Social Security (5%)', formatCurrency(payroll.social_security)],
            ['Withholding Tax', formatCurrency(payroll.withholding_tax)],
            ['Loan Deduction', formatCurrency(payroll.loan_deduction)],
            ['Other Deduction', formatCurrency(payroll.other_deduction)],
            ['Total Deductions', formatCurrency(payroll.total_deductions)],
        ],
        styles: { fontSize: 9 },
        headStyles: { fillColor: [231, 76, 60] },
        columnStyles: { 1: { halign: 'right' } },
        theme: 'grid',
    });

    // Net Salary
    const finalY2 = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY || 170;

    doc.setFontSize(14);
    doc.setTextColor(0, 100, 0);
    doc.text(`Net Salary: THB ${formatCurrency(payroll.net_salary)}`, 14, finalY2 + 15);

    doc.save(`payslip_${employee.name.replace(/\s+/g, '_')}_${period.name.replace(/\s+/g, '_')}.pdf`);
}

/**
 * Format data for sales report export
 */
export function formatSalesReportData(orders: {
    id: string;
    created_at: string;
    total_amount: number;
    payment_method: string;
    seller?: { first_name?: string; last_name?: string };
}[]) {
    return orders.map(order => ({
        'Order ID': order.id.slice(0, 8),
        'Date': new Date(order.created_at).toLocaleString('th-TH'),
        'Amount': order.total_amount,
        'Payment': order.payment_method,
        'Seller': `${order.seller?.first_name || ''} ${order.seller?.last_name || ''}`.trim() || '-',
    }));
}

/**
 * Format data for commission report export
 */
export function formatCommissionReportData(records: {
    user_name: string;
    total_sales: number;
    total_commission: number;
    pending_commission: number;
    paid_commission: number;
}[]) {
    return records.map(record => ({
        'Employee': record.user_name,
        'Total Sales': record.total_sales,
        'Commission': record.total_commission,
        'Pending': record.pending_commission,
        'Paid': record.paid_commission,
    }));
}

/**
 * Format data for payroll report export
 */
export function formatPayrollReportData(records: {
    employee_name: string;
    base_salary: number;
    commission_total: number;
    total_earnings: number;
    total_deductions: number;
    net_salary: number;
}[]) {
    return records.map(record => ({
        'Employee': record.employee_name,
        'Base Salary': record.base_salary,
        'Commission': record.commission_total,
        'Total Earnings': record.total_earnings,
        'Deductions': record.total_deductions,
        'Net Salary': record.net_salary,
    }));
}
