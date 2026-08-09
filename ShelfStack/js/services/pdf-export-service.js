// ShelfStack/js/services/pdf-export-service.js
// Generates comprehensive PDF report of trends data with charts, statistics, and completed media list.

import { supabase } from '../supabase-client.js';

const mediaTypes = ["book", "manga", "anime", "tvshow", "movie", "concert"];
const labels = {
    book: "Books",
    manga: "Manga",
    anime: "Anime",
    tvshow: "TV Shows",
    movie: "Movies",
    concert: "Concerts"
};
const colors = {
    book: "#f5c842",
    manga: "#7aaee8",
    anime: "#c084fc",
    tvshow: "#22d3ee",
    movie: "#a0a0a0",
    concert: "#ff7fbf"
};

function normalizeType(rawType) {
    const t = String(rawType || "").toLowerCase().trim();
    if (t === "tv show" || t === "tvshow" || t === "tv_shows" || t === "tv shows") return "tvshow";
    if (t === "books") return "book";
    if (t === "movies") return "movie";
    if (t === "concerts") return "concert";
    return mediaTypes.includes(t) ? t : null;
}

function emptyByType() {
    const base = {};
    mediaTypes.forEach(type => { base[type] = 0; });
    return base;
}

function daysInMonth(year, monthIndex) {
    return new Date(year, monthIndex + 1, 0).getDate();
}

/**
 * Fetch trends data for a specific month
 */
export async function fetchTrendsDataForMonth(year, monthIndex) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        throw new Error('User not authenticated');
    }

    const startIso = `${year}-${String(monthIndex + 1).padStart(2, '0')}-01T00:00:00.000Z`;
    const lastDay = daysInMonth(year, monthIndex);
    const endIso = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}T23:59:59.999Z`;

    const [completedRes, journalRes] = await Promise.all([
        supabase
            .from("lu_media_status")
            .select("media_id,date_finished,status,lu_media(media_type,title,cover_art_url)")
            .eq("user_id", user.id)
            .eq("status", "completed")
            .gte("date_finished", startIso)
            .lte("date_finished", endIso),
        supabase
            .from("lu_journal_entry")
            .select("units,date_created,lu_media_status!inner(user_id,media_id,lu_media!inner(media_type))")
            .eq("lu_media_status.user_id", user.id)
            .gte("date_created", startIso)
            .lte("date_created", endIso)
    ]);

    if (completedRes.error || journalRes.error) {
        throw new Error('Failed to fetch trends data');
    }

    return aggregateTrendsData(year, monthIndex, completedRes.data || [], journalRes.data || []);
}

/**
 * Aggregate trends data by day and media type
 */
function aggregateTrendsData(year, monthIndex, completedRows, journalRows) {
    const totalDays = daysInMonth(year, monthIndex);
    const totalsCompleted = emptyByType();
    const totalsUnits = emptyByType();
    const journalDaysByType = emptyByType();
    const unitsByDay = {};
    const completedByDay = {};
    const completedItems = [];
    const journalDaysPerType = emptyByType();

    mediaTypes.forEach(type => {
        unitsByDay[type] = Array(totalDays).fill(0);
        completedByDay[type] = Array(totalDays).fill(0);
    });

    // Process completed media
    for (const row of completedRows) {
        const mediaType = normalizeType(row.lu_media?.media_type);
        if (!mediaType || !row.date_finished) continue;
        const d = new Date(row.date_finished.endsWith("Z") ? row.date_finished : row.date_finished + "Z");
        const dayIndex = d.getDate() - 1;
        totalsCompleted[mediaType] += 1;
        completedByDay[mediaType][dayIndex] += 1;
        completedItems.push({
            title: row.lu_media?.title || "Untitled",
            mediaType,
            date: row.date_finished,
            coverArtUrl: row.lu_media?.cover_art_url || null
        });
    }

    // Process journal entries
    const journalDaysDates = new Set();
    for (const row of journalRows) {
        const mediaType = normalizeType(row.lu_media_status?.lu_media?.media_type);
        if (!mediaType) continue;
        const units = Number(row.units || 0);
        const d = new Date(row.date_created);
        const dayIndex = d.getDate() - 1;
        const dateStr = d.toISOString().split('T')[0];

        totalsUnits[mediaType] += units;
        unitsByDay[mediaType][dayIndex] += units;

        // Track days with journal entries per media type
        if (!journalDaysDates.has(dateStr + '-' + mediaType)) {
            journalDaysPerType[mediaType] += 1;
            journalDaysDates.add(dateStr + '-' + mediaType);
        }
    }

    // Sort completed items by date (newest first)
    completedItems.sort((a, b) => new Date(b.date) - new Date(a.date));

    return {
        year,
        monthIndex,
        totalsCompleted,
        totalsUnits,
        unitsByDay,
        completedByDay,
        completedItems,
        journalDaysPerType,
        totalDays
    };
}

/**
 * Calculate statistics
 */
function calculateStats(agg) {
    const stats = {};
    mediaTypes.forEach(type => {
        const completed = agg.totalsCompleted[type];
        const units = agg.totalsUnits[type];
        const journalDays = agg.journalDaysPerType[type];
        stats[type] = {
            completed,
            units,
            journalDays,
            avgUnitsPerDay: journalDays > 0 ? (units / journalDays).toFixed(2) : 0,
            avgDaysToComplete: completed > 0 ? (journalDays / completed).toFixed(2) : 0
        };
    });
    return stats;
}

/**
 * Create a canvas-based bar chart (units per day for the month)
 */
function createUnitsPerDayChart(agg, width = 800, height = 300) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    const padding = { top: 30, right: 20, bottom: 40, left: 50 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    const barWidth = chartWidth / agg.totalDays;

    // Find max value for scaling
    let maxValue = 0;
    mediaTypes.forEach(type => {
        agg.unitsByDay[type].forEach(v => { maxValue = Math.max(maxValue, v); });
    });
    if (maxValue === 0) maxValue = 1;

    // Draw background
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, width, height);

    // Draw grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
        const y = padding.top + (chartHeight / 5) * i;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(width - padding.right, y);
        ctx.stroke();
    }

    // Draw axes
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, height - padding.bottom);
    ctx.lineTo(width - padding.right, height - padding.bottom);
    ctx.stroke();

    // Draw y-axis labels
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 5; i++) {
        const value = Math.floor((maxValue / 5) * i);
        const y = padding.top + (chartHeight / 5) * (5 - i);
        ctx.fillText(value, padding.left - 10, y + 4);
    }

    // Draw bars grouped by day
    const barHeight = (chartHeight / 5) / mediaTypes.length;
    mediaTypes.forEach((type, typeIdx) => {
        ctx.fillStyle = colors[type];
        agg.unitsByDay[type].forEach((value, dayIdx) => {
            if (value === 0) return;
            const barX = padding.left + dayIdx * barWidth + (typeIdx * barWidth / mediaTypes.length);
            const barBaseY = height - padding.bottom;
            const barY = barBaseY - (value / maxValue) * chartHeight;
            const barW = barWidth / mediaTypes.length - 1;
            ctx.fillRect(barX, barY, barW, barBaseY - barY);
        });
    });

    // Draw x-axis labels (every 5 days)
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    for (let day = 1; day <= agg.totalDays; day += Math.max(1, Math.floor(agg.totalDays / 10))) {
        const x = padding.left + (day - 0.5) * barWidth;
        ctx.fillText(day, x, height - padding.bottom + 20);
    }

    // Draw legend
    ctx.font = 'bold 12px sans-serif';
    let legendX = padding.left;
    mediaTypes.forEach(type => {
        ctx.fillStyle = colors[type];
        ctx.fillRect(legendX, 8, 12, 12);
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.textAlign = 'left';
        ctx.fillText(labels[type], legendX + 16, 18);
        legendX += 120;
    });

    return canvas.toDataURL('image/png');
}

/**
 * Create a canvas-based line chart (cumulative units)
 */
function createCumulativeUnitsChart(agg, width = 800, height = 300) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    const padding = { top: 30, right: 20, bottom: 40, left: 50 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    const dayWidth = chartWidth / agg.totalDays;

    // Calculate cumulative totals
    const cumulativeTotals = {};
    mediaTypes.forEach(type => {
        let running = 0;
        cumulativeTotals[type] = agg.unitsByDay[type].map(v => {
            running += v;
            return running;
        });
    });

    // Find max cumulative value
    let maxValue = 0;
    mediaTypes.forEach(type => {
        maxValue = Math.max(maxValue, cumulativeTotals[type][cumulativeTotals[type].length - 1] || 0);
    });
    if (maxValue === 0) maxValue = 1;

    // Draw background
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, width, height);

    // Draw grid
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
        const y = padding.top + (chartHeight / 5) * i;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(width - padding.right, y);
        ctx.stroke();
    }

    // Draw axes
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, height - padding.bottom);
    ctx.lineTo(width - padding.right, height - padding.bottom);
    ctx.stroke();

    // Draw y-axis labels
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 5; i++) {
        const value = Math.floor((maxValue / 5) * i);
        const y = padding.top + (chartHeight / 5) * (5 - i);
        ctx.fillText(value, padding.left - 10, y + 4);
    }

    // Draw lines
    mediaTypes.forEach(type => {
        ctx.strokeStyle = colors[type];
        ctx.lineWidth = 2;
        ctx.beginPath();
        cumulativeTotals[type].forEach((value, dayIdx) => {
            const x = padding.left + (dayIdx + 0.5) * dayWidth;
            const y = height - padding.bottom - (value / maxValue) * chartHeight;
            if (dayIdx === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();

        // Draw dots
        ctx.fillStyle = colors[type];
        cumulativeTotals[type].forEach((value, dayIdx) => {
            if (value === 0) return;
            const x = padding.left + (dayIdx + 0.5) * dayWidth;
            const y = height - padding.bottom - (value / maxValue) * chartHeight;
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, Math.PI * 2);
            ctx.fill();
        });
    });

    // Draw legend
    ctx.font = 'bold 12px sans-serif';
    let legendX = padding.left;
    mediaTypes.forEach(type => {
        ctx.strokeStyle = colors[type];
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(legendX, 15);
        ctx.lineTo(legendX + 12, 15);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.textAlign = 'left';
        ctx.fillText(labels[type], legendX + 16, 18);
        legendX += 120;
    });

    return canvas.toDataURL('image/png');
}

/**
 * Generate PDF using jsPDF
 */
export async function generateTrendsPDF(year, monthIndex) {
    // Ensure we're running in a browser environment and the jsPDF library is available.
    const globalObj = (typeof window !== 'undefined') ? window : (typeof globalThis !== 'undefined' ? globalThis : null);
    const jsPDFCtor = globalObj && ((globalObj.jspdf && globalObj.jspdf.jsPDF) || globalObj.jsPDF || (globalObj.jspdf && globalObj.jspdf));
    if (!jsPDFCtor) {
        throw new Error('jsPDF library not loaded. Please include: https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
    }

    const agg = await fetchTrendsDataForMonth(year, monthIndex);
    const stats = calculateStats(agg);

    // jsPDFCtor may be the namespace (with jsPDF property) or the constructor itself. Normalize to constructor.
    const jsPDFClass = jsPDFCtor.jsPDF ? jsPDFCtor.jsPDF : jsPDFCtor;
    const pdf = new jsPDFClass({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const monthNames = ["January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"];
    const monthName = monthNames[monthIndex];
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 15;
    const contentWidth = pageWidth - (2 * margin);
    let yPos = margin;

    // Helper to add page
    const addPage = () => {
        pdf.addPage();
        yPos = margin;
    };

    // Helper to add text
    const addText = (text, x = margin, size = 12, style = 'normal', color = [0, 0, 0]) => {
        pdf.setFont('helvetica', style);
        pdf.setFontSize(size);
        pdf.setTextColor(...color);
        const splitText = pdf.splitTextToSize(text, contentWidth - (x - margin) * 2);
        pdf.text(splitText, x, yPos);
        yPos += (splitText.length * size * 0.4) + 2;
        return splitText.length * size * 0.4;
    };

    // Helper to add section heading
    const addHeading = (text) => {
        if (yPos > pageHeight - 40) addPage();
        addText(text, margin, 16, 'bold', [124, 92, 252]);
        yPos += 2;
    };

    // Helper to add subheading
    const addSubheading = (text) => {
        if (yPos > pageHeight - 35) addPage();
        addText(text, margin, 13, 'bold', [100, 100, 100]);
        yPos += 1;
    };

    // Helper to add table
    const addTable = (headers, rows) => {
        if (yPos > pageHeight - 60) addPage();

        const colWidth = contentWidth / headers.length;
        const headerHeight = 7;

        // Header
        pdf.setFillColor(200, 180, 255);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(10);
        headers.forEach((header, i) => {
            pdf.rect(margin + (i * colWidth), yPos, colWidth, headerHeight, 'F');
            pdf.setTextColor(0, 0, 0);
            pdf.text(header, margin + (i * colWidth) + 1, yPos + 5);
        });
        yPos += headerHeight;

        // Rows
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        rows.forEach((row, rowIdx) => {
            if (yPos > pageHeight - 20) addPage();
            pdf.setTextColor(0, 0, 0);
            row.forEach((cell, i) => {
                if (rowIdx % 2 === 0) {
                    pdf.setFillColor(245, 245, 245);
                    pdf.rect(margin + (i * colWidth), yPos, colWidth, 6, 'F');
                }
                pdf.text(String(cell), margin + (i * colWidth) + 1, yPos + 5);
            });
            yPos += 6;
        });
        yPos += 2;
    };

    // PAGE 1: Title & Summary
    addText(`Trends Report`, margin, 24, 'bold', [124, 92, 252]);
    addText(`${monthName} ${year}`, margin, 18, 'normal', [100, 100, 100]);
    yPos += 5;

    addSubheading('Summary');
    const summaryRows = mediaTypes.map(type => [
        labels[type],
        agg.totalsCompleted[type],
        agg.totalsUnits[type],
        stats[type].journalDays,
        stats[type].avgUnitsPerDay,
        stats[type].avgDaysToComplete
    ]);
    addTable(
        ['Media Type', 'Completed', 'Total Units', 'Journal Days', 'Avg Units/Day', 'Avg Days to Complete'],
        summaryRows
    );

    yPos += 3;
    addSubheading('Key Metrics');
    const totalCompleted = mediaTypes.reduce((sum, t) => sum + agg.totalsCompleted[t], 0);
    const totalUnits = mediaTypes.reduce((sum, t) => sum + agg.totalsUnits[t], 0);
    const totalJournalDays = mediaTypes.reduce((sum, t) => sum + agg.journalDaysPerType[t], 0);

    addText(`Total Media Completed: ${totalCompleted}`);
    addText(`Total Units Logged: ${totalUnits}`);
    addText(`Days with Journal Entries: ${totalJournalDays}`);
    yPos += 2;

    // PAGE 2: Units Chart
    addPage();
    addHeading('Units Logged Per Day');
    const unitsChartImg = createUnitsPerDayChart(agg);
    pdf.addImage(unitsChartImg, 'PNG', margin, yPos, contentWidth, 80);
    yPos += 85;

    // PAGE 3: Cumulative Chart
    if (yPos > pageHeight - 100) addPage();
    addHeading('Cumulative Units');
    const cumulativeChartImg = createCumulativeUnitsChart(agg);
    pdf.addImage(cumulativeChartImg, 'PNG', margin, yPos, contentWidth, 80);
    yPos += 85;

    // PAGE 4+: Completed Media by Type
    if (agg.completedItems.length > 0) {
        addPage();
        addHeading('Completed Media');
        
        mediaTypes.forEach(type => {
            const itemsOfType = agg.completedItems.filter(item => item.mediaType === type);
            if (itemsOfType.length === 0) return;

            if (yPos > pageHeight - 40) addPage();
            addSubheading(`${labels[type]} (${itemsOfType.length})`);

            itemsOfType.forEach(item => {
                if (yPos > pageHeight - 15) addPage();
                const date = new Date(item.date).toLocaleDateString();
                addText(`• ${item.title} — ${date}`, margin + 5, 10);
            });
            yPos += 2;
        });
    }

    // Save PDF
    const fileName = `Trends_${monthName}_${year}.pdf`;
    pdf.save(fileName);
}
