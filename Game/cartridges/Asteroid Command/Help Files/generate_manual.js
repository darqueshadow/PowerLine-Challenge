#!/usr/bin/env node
/**
 * ASTEROID COMMAND — TECHNICAL MANUAL GENERATOR v2.1
 * Generates a professional technical manual as .docx
 * with actual game screenshots
 */

const fs = require('fs');
const path = require('path');
const {
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
    ImageRun, Header, Footer, AlignmentType, HeadingLevel, BorderStyle,
    WidthType, ShadingType, PageBreak, LevelFormat, TabStopType, TabStopPosition,
    PageNumber, TableOfContents, BookmarkStart, BookmarkEnd
} = require('docx');

// ============================================
// COLOR THEME
// ============================================
const THEME = {
    primary: '1B3A2A',       // deep green
    primaryLight: '2D5A3F',
    accent: 'FFB800',        // amber
    headerBg: '0D1F15',
    tableBorder: '3A6B4A',
    tableHeaderBg: '1B3A2A',
    tableHeaderText: 'E0FFE8',
    tableAltRow: 'F0F8F2',
    text: '1A1A1A',
    textLight: '555555',
    danger: 'CC2200',
    warning: 'CC7700',
    white: 'FFFFFF',
    black: '000000',
};

// ============================================
// SCREENSHOT LOADING
// ============================================
const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots');

function loadScreenshot(filename) {
    const filePath = path.join(SCREENSHOTS_DIR, filename);
    if (!fs.existsSync(filePath)) {
        console.warn(`  Warning: Screenshot not found: ${filename}`);
        return null;
    }
    return fs.readFileSync(filePath);
}

/* All image generation functions removed — screenshots are loaded from screenshots/ directory */

// Placeholder for removed code — jump to DOCUMENT HELPERS

/*
function drawStars(ctx, w, h, count = 200) {
    for (let i = 0; i < count; i++) {
        const x = Math.random() * w;
        const y = Math.random() * h;
        const r = Math.random() * 2.5 + 0.3;
        const brightness = Math.floor(Math.random() * 100 + 155);
        ctx.fillStyle = `rgba(${brightness}, ${brightness}, ${255}, ${Math.random() * 0.5 + 0.5})`;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
    }
}

function drawAsteroid(ctx, x, y, radius, color1, color2) {
    const grad = ctx.createRadialGradient(x - radius * 0.3, y - radius * 0.3, radius * 0.1, x, y, radius);
    grad.addColorStop(0, color1);
    grad.addColorStop(1, color2);
    ctx.save();
    ctx.beginPath();
    const points = 12;
    for (let i = 0; i < points; i++) {
        const angle = (i / points) * Math.PI * 2;
        const wobble = radius * (0.8 + Math.random() * 0.4);
        const px = x + Math.cos(angle) * wobble;
        const py = y + Math.sin(angle) * wobble;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = color2;
    ctx.lineWidth = 2;
    ctx.stroke();
    for (let i = 0; i < 4; i++) {
        const cx = x + (Math.random() - 0.5) * radius * 1.2;
        const cy = y + (Math.random() - 0.5) * radius * 1.2;
        const cr = radius * (0.1 + Math.random() * 0.2);
        ctx.beginPath();
        ctx.arc(cx, cy, cr, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0,0,0,0.3)`;
        ctx.fill();
    }
    ctx.restore();
}

function drawTower(ctx, x, baseY, h, withShield = true) {
    const topY = baseY - h;
    const bodyGrad = ctx.createLinearGradient(x - 15, topY, x + 15, topY);
    bodyGrad.addColorStop(0, '#666');
    bodyGrad.addColorStop(0.5, '#ccc');
    bodyGrad.addColorStop(1, '#666');
    ctx.fillStyle = bodyGrad;
    ctx.fillRect(x - 8, topY + 20, 16, h - 20);
    for (let i = 0; i < 5; i++) {
        const cy = topY + 30 + i * (h - 40) / 5;
        const spread = 10 + i * 4;
        ctx.strokeStyle = '#aaa';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x - spread, cy);
        ctx.lineTo(x + spread, cy);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x - spread, cy);
        ctx.lineTo(x, cy - 15);
        ctx.lineTo(x + spread, cy);
        ctx.stroke();
    }
    ctx.fillStyle = '#ff0000';
    ctx.beginPath();
    ctx.arc(x, topY + 10, 5, 0, Math.PI * 2);
    ctx.fill();
    const rGlow = ctx.createRadialGradient(x, topY + 10, 0, x, topY + 10, 25);
    rGlow.addColorStop(0, 'rgba(255,0,0,0.4)');
    rGlow.addColorStop(1, 'rgba(255,0,0,0)');
    ctx.fillStyle = rGlow;
    ctx.beginPath();
    ctx.arc(x, topY + 10, 25, 0, Math.PI * 2);
    ctx.fill();
    if (withShield) {
        ctx.save();
        ctx.globalAlpha = 0.3;
        const shGrad = ctx.createRadialGradient(x, baseY - h * 0.5, 10, x, baseY - h * 0.3, h * 0.8);
        shGrad.addColorStop(0, 'rgba(0, 255, 136, 0.1)');
        shGrad.addColorStop(0.7, 'rgba(0, 255, 136, 0.3)');
        shGrad.addColorStop(1, 'rgba(0, 255, 136, 0.05)');
        ctx.fillStyle = shGrad;
        ctx.beginPath();
        ctx.ellipse(x, baseY - 10, 70, h + 30, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0, 255, 136, 0.6)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.restore();
    }
}

function drawLaserMissile(ctx, x1, y1, x2, y2) {
    for (let w = 20; w > 0; w -= 4) {
        ctx.strokeStyle = `rgba(0, ${200 + w * 2}, 255, ${0.1 + (20 - w) * 0.04})`;
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
    }
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
}

function drawExplosion(ctx, x, y, radius) {
    for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2 + Math.random() * 0.3;
        const len = radius * (0.5 + Math.random() * 0.8);
        const grad = ctx.createLinearGradient(x, y, x + Math.cos(angle) * len, y + Math.sin(angle) * len);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.3, '#ffff00');
        grad.addColorStop(0.6, '#ff6600');
        grad.addColorStop(1, 'rgba(255,0,0,0)');
        ctx.strokeStyle = grad;
        ctx.lineWidth = 4 + Math.random() * 6;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
        ctx.stroke();
    }
    const glow = ctx.createRadialGradient(x, y, 0, x, y, radius * 0.5);
    glow.addColorStop(0, 'rgba(255,255,255,0.9)');
    glow.addColorStop(0.5, 'rgba(255,200,0,0.6)');
    glow.addColorStop(1, 'rgba(255,80,0,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, radius * 0.5, 0, Math.PI * 2);
    ctx.fill();
}

// ============================================
// COVER ART
// ============================================

function generateCoverArt() {
    const w = 1200, h = 500;
    const { canvas, ctx } = createGradientRect(w, h, ['#000011', '#000033', '#0a0025']);
    drawStars(ctx, w, h, 400);

    // Ground
    const ground = ctx.createLinearGradient(0, h * 0.78, 0, h);
    ground.addColorStop(0, '#0a1a0a');
    ground.addColorStop(0.3, '#1a2a1a');
    ground.addColorStop(1, '#0a150a');
    ctx.fillStyle = ground;
    ctx.fillRect(0, h * 0.78, w, h * 0.22);

    drawTower(ctx, w * 0.5, h * 0.78, 160, true);

    drawAsteroid(ctx, 200, 120, 50, '#8b7355', '#4a3728');
    drawAsteroid(ctx, 850, 100, 55, '#6b8b55', '#3a5528');
    drawAsteroid(ctx, 650, 200, 35, '#9b6b45', '#5a3a18');
    drawAsteroid(ctx, 1000, 250, 40, '#7b9b55', '#4a6528');

    drawLaserMissile(ctx, w * 0.5, h * 0.52, 200, 120);
    drawLaserMissile(ctx, w * 0.5, h * 0.52, 850, 100);
    drawExplosion(ctx, 200, 120, 70);

    ctx.save();
    ctx.shadowColor = '#00ffaa';
    ctx.shadowBlur = 30;
    ctx.font = 'bold 60px "Arial Black", Arial, sans-serif';
    ctx.fillStyle = '#00ff88';
    ctx.textAlign = 'center';
    ctx.fillText('ASTEROID COMMAND', w / 2, h * 0.18);
    ctx.shadowBlur = 0;
    ctx.font = 'bold 22px Arial';
    ctx.fillStyle = '#ffcc00';
    ctx.fillText('TECHNICAL MANUAL', w / 2, h * 0.26);
    ctx.font = '16px Arial';
    ctx.fillStyle = '#88ccaa';
    ctx.fillText('NIAGARA REGION DEFENSE SYSTEM', w / 2, h * 0.32);
    ctx.restore();
    return canvas.toBuffer('image/png');
}

// ============================================
// DEFENSE ZONES DIAGRAM
// ============================================

function generateDefenseZones() {
    const w = 1200, h = 400;
    const { canvas, ctx } = createGradientRect(w, h, ['#0a1020', '#0a1530', '#0a0a15']);
    drawStars(ctx, w, h * 0.6, 80);

    const terrain = ctx.createLinearGradient(0, h * 0.68, 0, h);
    terrain.addColorStop(0, '#1a2a1a');
    terrain.addColorStop(0.5, '#2a3a2a');
    terrain.addColorStop(1, '#1a251a');
    ctx.fillStyle = terrain;
    ctx.fillRect(0, h * 0.68, w, h * 0.32);

    const baseY = h * 0.7;
    // Zone labels
    const zones = [
        { x: 120, label: 'SIR ADAM BECK', sub: 'Zone 1 - NOTL' },
        { x: 360, label: 'SKYLON TOWER', sub: 'Zone 2 - NIAGARA FALLS' },
        { x: 600, label: 'RADIO TOWER', sub: 'Command Center' },
        { x: 840, label: 'WELLAND CANAL', sub: 'Zone 3 - THOROLD' },
        { x: 1080, label: 'ROBIN HOOD MILL', sub: 'Zone 4 - PORT COLBORNE' },
    ];

    // Draw simple structures
    // Dam
    ctx.fillStyle = '#556677';
    ctx.fillRect(60, baseY - 60, 120, 60);
    ctx.fillStyle = '#4488cc';
    ctx.fillRect(60, baseY - 15, 120, 15);

    // Skylon
    ctx.fillStyle = '#667766';
    ctx.fillRect(355, baseY - 120, 10, 120);
    ctx.beginPath();
    ctx.ellipse(360, baseY - 90, 35, 15, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#778877';
    ctx.fill();

    // Tower with shield
    drawTower(ctx, 600, baseY, 120, true);

    // Canal bridge
    ctx.fillStyle = '#776655';
    ctx.fillRect(800, baseY - 50, 15, 50);
    ctx.fillRect(865, baseY - 50, 15, 50);
    ctx.fillStyle = '#887766';
    ctx.fillRect(800, baseY - 55, 80, 8);

    // Mill
    ctx.fillStyle = '#665566';
    ctx.fillRect(1030, baseY - 70, 100, 70);
    ctx.fillStyle = '#776677';
    ctx.fillRect(1060, baseY - 85, 40, 15);

    // Labels
    ctx.textAlign = 'center';
    zones.forEach(z => {
        ctx.font = 'bold 13px Arial';
        ctx.fillStyle = '#00ccff';
        ctx.fillText(z.label, z.x, h * 0.88);
        ctx.font = '11px Arial';
        ctx.fillStyle = '#88aacc';
        ctx.fillText(z.sub, z.x, h * 0.93);
    });

    // Dividers
    ctx.strokeStyle = 'rgba(0, 200, 100, 0.15)';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    [240, 480, 720, 960].forEach(x => {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
    });

    return canvas.toBuffer('image/png');
}

// ============================================
// HUD LAYOUT DIAGRAM
// ============================================

function generateHUDLayout() {
    const w = 1200, h = 300;
    const { canvas, ctx } = createGradientRect(w, h, ['#0a0a15', '#0a0a20', '#0a0a15']);

    // Left panel
    ctx.fillStyle = '#111822';
    ctx.fillRect(20, 20, 180, h - 40);
    ctx.strokeStyle = '#33ff66';
    ctx.lineWidth = 1;
    ctx.strokeRect(20, 20, 180, h - 40);
    ctx.font = 'bold 14px monospace';
    ctx.fillStyle = '#33ff66';
    ctx.textAlign = 'left';
    ctx.fillText('SCORE', 40, 55);
    ctx.font = '20px monospace';
    ctx.fillText('12,450', 40, 80);
    ctx.font = 'bold 14px monospace';
    ctx.fillText('RANK', 40, 115);
    ctx.font = '16px monospace';
    ctx.fillText('SIGNED OFF', 40, 140);
    ctx.font = 'bold 14px monospace';
    ctx.fillText('STREAK', 40, 175);
    ctx.font = '20px monospace';
    ctx.fillText('7', 40, 200);

    // Center play area
    ctx.fillStyle = '#0a1a0a';
    ctx.fillRect(220, 20, 760, h - 70);
    ctx.strokeStyle = '#225533';
    ctx.strokeRect(220, 20, 760, h - 70);
    // Game content hint
    ctx.font = '14px Arial';
    ctx.fillStyle = '#336644';
    ctx.textAlign = 'center';
    ctx.fillText('GAME CANVAS (16:9)', 600, 140);

    // VDS display bar at bottom center
    ctx.fillStyle = '#111822';
    ctx.fillRect(220, h - 45, 760, 25);
    ctx.strokeStyle = '#33ff66';
    ctx.strokeRect(220, h - 45, 760, 25);
    ctx.font = '12px monospace';
    ctx.fillStyle = '#33ff66';
    ctx.textAlign = 'left';
    ctx.fillText('> AP 2101 72103_', 230, h - 27);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#33ff66';
    ctx.fillText('+250 PERFECT', 970, h - 27);

    // Right panel
    ctx.fillStyle = '#111822';
    ctx.fillRect(1000, 20, 180, h - 40);
    ctx.strokeStyle = '#33ff66';
    ctx.lineWidth = 1;
    ctx.strokeRect(1000, 20, 180, h - 40);
    ctx.font = 'bold 12px monospace';
    ctx.fillStyle = '#ff6600';
    ctx.textAlign = 'center';
    ctx.fillText('BREACH', 1090, 50);
    ctx.fillText('TOLERANCE', 1090, 65);
    // Diamonds
    ctx.font = '24px monospace';
    ctx.fillStyle = '#00ff88';
    ctx.fillText('\u25C6 \u25C6 \u25C6', 1090, 95);
    // Shield bar
    ctx.font = 'bold 12px monospace';
    ctx.fillStyle = '#33ff66';
    ctx.fillText('SHIELD', 1090, 130);
    ctx.fillText('STRENGTH', 1090, 145);
    ctx.font = '16px monospace';
    ctx.fillStyle = '#00ff88';
    ctx.fillText('\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2591', 1090, 175);

    // Labels
    ctx.font = 'bold 11px Arial';
    ctx.fillStyle = '#ffcc00';
    ctx.textAlign = 'center';
    ctx.fillText('LEFT PANEL', 110, h - 10);
    ctx.fillText('PLAY AREA + COMMAND INPUT', 600, 15);
    ctx.fillText('RIGHT PANEL', 1090, h - 10);

    return canvas.toBuffer('image/png');
}

// ============================================
// COMBAT SCENE
// ============================================

function generateCombatScene() {
    const w = 1200, h = 450;
    const { canvas, ctx } = createGradientRect(w, h, ['#000015', '#000825', '#000a10']);
    drawStars(ctx, w, h, 150);

    const ground = ctx.createLinearGradient(0, h * 0.8, 0, h);
    ground.addColorStop(0, '#1a2a1a');
    ground.addColorStop(1, '#0a150a');
    ctx.fillStyle = ground;
    ctx.fillRect(0, h * 0.8, w, h * 0.2);

    drawTower(ctx, w * 0.5, h * 0.8, 140, true);
    drawLaserMissile(ctx, w * 0.5, h * 0.5, 180, 150);
    drawLaserMissile(ctx, w * 0.5, h * 0.5, 900, 120);
    drawAsteroid(ctx, 180, 150, 50, '#8b7355', '#4a3728');
    drawExplosion(ctx, 180, 150, 70);
    drawAsteroid(ctx, 900, 120, 50, '#6b8b55', '#3a5528');
    drawAsteroid(ctx, 450, 100, 35, '#7b9b55', '#4a6528');

    // Challenge box
    ctx.save();
    ctx.shadowColor = '#00ff66';
    ctx.shadowBlur = 10;
    ctx.fillStyle = 'rgba(0, 30, 10, 0.85)';
    ctx.fillRect(830, 55, 190, 42);
    ctx.strokeStyle = '#00ff66';
    ctx.lineWidth = 1;
    ctx.strokeRect(830, 55, 190, 42);
    ctx.font = 'bold 11px monospace';
    ctx.fillStyle = '#00ff88';
    ctx.shadowBlur = 0;
    ctx.fillText('Post to Niagara Falls', 838, 72);
    ctx.fillStyle = '#ffcc00';
    ctx.fillText('AP 2101 72100', 838, 88);
    ctx.restore();

    // Tether
    ctx.save();
    ctx.setLineDash([8, 6]);
    ctx.strokeStyle = 'rgba(0, 255, 100, 0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(900, 120);
    ctx.lineTo(925, 76);
    ctx.stroke();
    ctx.restore();

    return canvas.toBuffer('image/png');
}

// ============================================
// FILE STRUCTURE DIAGRAM
// ============================================

function generateFileStructure() {
    const w = 900, h = 500;
    const { canvas, ctx } = createGradientRect(w, h, ['#0d1a12', '#0a1510', '#0d1a12']);

    ctx.font = 'bold 16px monospace';
    ctx.fillStyle = '#00ff88';
    ctx.textAlign = 'left';
    ctx.fillText('asteroid-command/', 40, 40);

    const lines = [
        ['  files/', '#ffcc00', true],
        ['    index.html', '#88ccaa', false],
        ['    script.js', '#88ccaa', false],
        ['    style.css', '#88ccaa', false],
        ['    core/', '#ffcc00', true],
        ['      config.js', '#88ccaa', false],
        ['      data.js', '#88ccaa', false],
        ['      audio.js', '#88ccaa', false],
        ['    datasets/', '#ffcc00', true],
        ['      bases.csv', '#cc8888', false],
        ['      commands.csv', '#cc8888', false],
        ['      units.csv', '#cc8888', false],
        ['      progression.csv', '#cc8888', false],
        ['      scoring.csv', '#cc8888', false],
        ['    assets/', '#ffcc00', true],
        ['      Asteroids/', '#887766', true],
        ['      Zones/', '#887766', true],
        ['      Zone Objects/', '#887766', true],
        ['      Space Ships/', '#887766', true],
        ['      Menus/', '#887766', true],
        ['    music/', '#ffcc00', true],
    ];

    lines.forEach((line, i) => {
        ctx.font = line[2] ? 'bold 13px monospace' : '13px monospace';
        ctx.fillStyle = line[1];
        ctx.fillText(line[0], 40, 70 + i * 20);
    });

    // Description column
    const descs = [
        '', // files/
        'Main HTML entry point',
        'Game logic (6000+ lines)',
        'All visual styling',
        '',
        'CONFIG, SCORING, TIERS, TETHER constants',
        'CSV loader, challenge generation, tier system',
        'Web Audio synthesizer, music playback',
        '',
        'Station names and codes',
        'Action phrases and command codes',
        'Unit IDs and weights',
        'Rank thresholds and difficulty scaling',
        'Scoring multipliers and bonuses',
        '',
        '6 asteroid sprite PNGs',
        'Intact + destroyed zone sprites',
        'Freighters, Skylon bug, workers',
        'NanoMedic ambulance sprite',
        'Menu background images',
        'MP3 tracks (menu, gameplay, holodeck)',
    ];

    descs.forEach((desc, i) => {
        if (desc) {
            ctx.font = '12px Arial';
            ctx.fillStyle = '#556655';
            ctx.fillText('// ' + desc, 430, 70 + i * 20);
        }
    });

    return canvas.toBuffer('image/png');
}
--- END REMOVED CODE ---*/


// ============================================
// DOCUMENT HELPERS
// ============================================

const thinBorder = { style: BorderStyle.SINGLE, size: 1, color: THEME.tableBorder };
const borders = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };
const noBorders = {
    top: { style: BorderStyle.NONE, size: 0 },
    bottom: { style: BorderStyle.NONE, size: 0 },
    left: { style: BorderStyle.NONE, size: 0 },
    right: { style: BorderStyle.NONE, size: 0 },
};
const cellMargins = { top: 60, bottom: 60, left: 100, right: 100 };

function headerCell(text, width) {
    return new TableCell({
        borders,
        width: { size: width, type: WidthType.DXA },
        shading: { fill: THEME.tableHeaderBg, type: ShadingType.CLEAR },
        margins: cellMargins,
        children: [new Paragraph({
            children: [new TextRun({ text, bold: true, font: 'Arial', size: 18, color: THEME.tableHeaderText })]
        })]
    });
}

function bodyCell(text, width, opts = {}) {
    return new TableCell({
        borders,
        width: { size: width, type: WidthType.DXA },
        shading: opts.shading ? { fill: opts.shading, type: ShadingType.CLEAR } : undefined,
        margins: cellMargins,
        children: [new Paragraph({
            children: [new TextRun({
                text,
                font: opts.mono ? 'Consolas' : 'Arial',
                size: opts.size || 18,
                color: opts.color || THEME.text,
                bold: opts.bold || false,
            })]
        })]
    });
}

function heading(text, level = HeadingLevel.HEADING_1) {
    return new Paragraph({ heading: level, children: [new TextRun(text)], spacing: { before: 240, after: 120 } });
}

function para(text, opts = {}) {
    return new Paragraph({
        spacing: { after: opts.after || 120 },
        alignment: opts.align || AlignmentType.LEFT,
        children: [new TextRun({
            text,
            font: opts.font || 'Arial',
            size: opts.size || 22,
            color: opts.color || THEME.text,
            bold: opts.bold || false,
            italics: opts.italics || false,
        })]
    });
}

function richPara(runs, opts = {}) {
    return new Paragraph({
        spacing: { after: opts.after || 120 },
        alignment: opts.align || AlignmentType.LEFT,
        children: runs.map(r => new TextRun({
            text: r.text,
            font: r.font || r.mono ? 'Consolas' : 'Arial',
            size: r.size || 22,
            color: r.color || THEME.text,
            bold: r.bold || false,
            italics: r.italics || false,
        }))
    });
}

function bulletItem(text, ref = 'bullets', level = 0) {
    return new Paragraph({
        numbering: { reference: ref, level },
        spacing: { after: 60 },
        children: [new TextRun({ text, font: 'Arial', size: 22 })]
    });
}

function numberedItem(text, ref = 'numbers', level = 0) {
    return new Paragraph({
        numbering: { reference: ref, level },
        spacing: { after: 60 },
        children: [new TextRun({ text, font: 'Arial', size: 22 })]
    });
}

function codeLine(text) {
    return new Paragraph({
        spacing: { after: 40 },
        indent: { left: 360 },
        children: [new TextRun({ text, font: 'Consolas', size: 18, color: THEME.primaryLight })]
    });
}

function spacer(pts = 120) {
    return new Paragraph({ spacing: { after: pts }, children: [] });
}

function imageBlock(buffer, w, h, altDesc = 'Game screenshot') {
    if (!buffer) return new Paragraph({ children: [new TextRun({ text: '[Screenshot not available]', italics: true, color: '999999' })] });
    return new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 120, after: 120 },
        children: [new ImageRun({
            type: 'png',
            data: buffer,
            transformation: { width: w, height: h },
            altText: { title: altDesc, description: altDesc, name: altDesc.replace(/\s+/g, '_').toLowerCase() }
        })]
    });
}

function warningBox(text) {
    return new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [9360],
        rows: [new TableRow({
            children: [new TableCell({
                borders: {
                    top: { style: BorderStyle.SINGLE, size: 2, color: THEME.warning },
                    bottom: { style: BorderStyle.SINGLE, size: 2, color: THEME.warning },
                    left: { style: BorderStyle.SINGLE, size: 6, color: THEME.warning },
                    right: { style: BorderStyle.SINGLE, size: 2, color: THEME.warning },
                },
                width: { size: 9360, type: WidthType.DXA },
                shading: { fill: 'FFF8E8', type: ShadingType.CLEAR },
                margins: { top: 80, bottom: 80, left: 160, right: 120 },
                children: [new Paragraph({
                    children: [
                        new TextRun({ text: 'IMPORTANT: ', bold: true, font: 'Arial', size: 20, color: THEME.warning }),
                        new TextRun({ text, font: 'Arial', size: 20, color: THEME.text }),
                    ]
                })]
            })]
        })]
    });
}

function noteBox(text) {
    return new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [9360],
        rows: [new TableRow({
            children: [new TableCell({
                borders: {
                    top: { style: BorderStyle.SINGLE, size: 2, color: THEME.primary },
                    bottom: { style: BorderStyle.SINGLE, size: 2, color: THEME.primary },
                    left: { style: BorderStyle.SINGLE, size: 6, color: THEME.primary },
                    right: { style: BorderStyle.SINGLE, size: 2, color: THEME.primary },
                },
                width: { size: 9360, type: WidthType.DXA },
                shading: { fill: 'F0F8F2', type: ShadingType.CLEAR },
                margins: { top: 80, bottom: 80, left: 160, right: 120 },
                children: [new Paragraph({
                    children: [
                        new TextRun({ text: 'NOTE: ', bold: true, font: 'Arial', size: 20, color: THEME.primary }),
                        new TextRun({ text, font: 'Arial', size: 20, color: THEME.text }),
                    ]
                })]
            })]
        })]
    });
}

// ============================================
// BUILD DOCUMENT
// ============================================

async function buildDocument() {
    console.log('Loading screenshots...');
    const titleScreenImg = loadScreenshot('title_screen.png');
    const mainMenuImg = loadScreenshot('main_menu.png');
    const catLoginImg = loadScreenshot('cat_login.png');
    const scoringPageImg = loadScreenshot('scoring_page.png');
    const settingsPageImg = loadScreenshot('settings_page.png');
    const highscoresPageImg = loadScreenshot('highscores_page.png');
    const bootLoadingImg = loadScreenshot('boot_loading.png');
    const hudLayoutImg = loadScreenshot('hud_layout.png');
    const combatSceneImg = loadScreenshot('combat_scene.png');
    const defenseZonesImg = loadScreenshot('defense_zones.png');
    const typingActionImg = loadScreenshot('typing_action.png');
    const damageStateImg = loadScreenshot('damage_state.png');
    const pauseScreenImg = loadScreenshot('pause_screen.png');
    const lateGameImg = loadScreenshot('late_game.png');

    console.log('Building document...');

    const doc = new Document({
        styles: {
            default: {
                document: {
                    run: { font: 'Arial', size: 22 },
                    paragraph: { spacing: { line: 276 } }
                }
            },
            paragraphStyles: [
                {
                    id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
                    run: { size: 36, bold: true, font: 'Arial', color: THEME.primary },
                    paragraph: { spacing: { before: 360, after: 200 }, outlineLevel: 0,
                        border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: THEME.primary, space: 4 } }
                    }
                },
                {
                    id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
                    run: { size: 28, bold: true, font: 'Arial', color: THEME.primaryLight },
                    paragraph: { spacing: { before: 280, after: 160 }, outlineLevel: 1 }
                },
                {
                    id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
                    run: { size: 24, bold: true, font: 'Arial', color: THEME.text },
                    paragraph: { spacing: { before: 200, after: 120 }, outlineLevel: 2 }
                },
            ]
        },
        numbering: {
            config: [
                {
                    reference: 'bullets',
                    levels: [{
                        level: 0, format: LevelFormat.BULLET, text: '\u2022', alignment: AlignmentType.LEFT,
                        style: { paragraph: { indent: { left: 720, hanging: 360 } } }
                    }, {
                        level: 1, format: LevelFormat.BULLET, text: '\u25E6', alignment: AlignmentType.LEFT,
                        style: { paragraph: { indent: { left: 1080, hanging: 360 } } }
                    }]
                },
                {
                    reference: 'numbers',
                    levels: [{
                        level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT,
                        style: { paragraph: { indent: { left: 720, hanging: 360 } } }
                    }]
                },
                {
                    reference: 'stepNumbers',
                    levels: [{
                        level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT,
                        style: { paragraph: { indent: { left: 720, hanging: 360 } } }
                    }]
                },
            ]
        },
        sections: [

            // ============================================
            // COVER PAGE
            // ============================================
            {
                properties: {
                    page: {
                        size: { width: 12240, height: 15840 },
                        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
                    }
                },
                children: [
                    spacer(300),
                    imageBlock(titleScreenImg, 580, 362, 'Title Screen'),
                    spacer(200),
                    para('ASTEROID COMMAND', { size: 52, bold: true, color: THEME.primary, align: AlignmentType.CENTER }),
                    para('Technical Manual', { size: 36, color: THEME.primaryLight, align: AlignmentType.CENTER }),
                    spacer(200),
                    para('Niagara Region Emergency Medical Services', { size: 22, color: THEME.textLight, align: AlignmentType.CENTER }),
                    para('Dispatch Training System v2.0', { size: 22, color: THEME.textLight, align: AlignmentType.CENTER }),
                    spacer(400),
                    para('DOCUMENT CLASSIFICATION: INTERNAL', { size: 18, bold: true, color: THEME.danger, align: AlignmentType.CENTER }),
                    para('Version 2.0  |  March 2026', { size: 18, color: THEME.textLight, align: AlignmentType.CENTER }),
                ]
            },

            // ============================================
            // TABLE OF CONTENTS
            // ============================================
            {
                properties: {
                    page: {
                        size: { width: 12240, height: 15840 },
                        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
                    }
                },
                headers: {
                    default: new Header({
                        children: [new Paragraph({
                            children: [new TextRun({ text: 'Asteroid Command \u2014 Technical Manual', font: 'Arial', size: 16, color: THEME.textLight })],
                            alignment: AlignmentType.RIGHT,
                            border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: THEME.primary, space: 4 } }
                        })]
                    })
                },
                footers: {
                    default: new Footer({
                        children: [new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [
                                new TextRun({ text: 'Page ', font: 'Arial', size: 16, color: THEME.textLight }),
                                new TextRun({ children: [PageNumber.CURRENT], font: 'Arial', size: 16, color: THEME.textLight })
                            ]
                        })]
                    })
                },
                children: [
                    heading('Table of Contents'),
                    new TableOfContents('Table of Contents', { hyperlink: true, headingStyleRange: '1-3' }),
                    new Paragraph({ children: [new PageBreak()] }),

                    // ============================================
                    // 1. SYSTEM OVERVIEW
                    // ============================================
                    heading('1. System Overview'),
                    para('Asteroid Command is a browser-based typing defense game designed as a training tool for Niagara Region EMS dispatchers. Players must type accurate CAD (Computer-Aided Dispatch) commands to intercept asteroids before they destroy defense zones representing real Niagara Region landmarks.'),
                    para('The game is a single HTML cartridge with no build system, no framework dependencies, and no server-side code. It runs entirely in the browser using plain JavaScript, HTML5 Canvas, SVG, and the Web Audio API.'),

                    heading('1.1 Architecture', HeadingLevel.HEADING_2),
                    para('The application consists of four JavaScript modules loaded in order:'),
                    new Table({
                        width: { size: 9360, type: WidthType.DXA },
                        columnWidths: [2200, 7160],
                        rows: [
                            new TableRow({ children: [headerCell('File', 2200), headerCell('Purpose', 7160)] }),
                            new TableRow({ children: [bodyCell('core/config.js', 2200, { mono: true }), bodyCell('CONFIG, SCORING, TIERS, TETHER, COORD_SYSTEM, godMode constants, asteroid color palette, and layout positions', 7160)] }),
                            new TableRow({ children: [bodyCell('core/data.js', 2200, { mono: true }), bodyCell('CSV parser, async data loader, fallback data, weighted random selection, tier management, and challenge generation (getTargetSpecs)', 7160)] }),
                            new TableRow({ children: [bodyCell('core/audio.js', 2200, { mono: true }), bodyCell('Web Audio API synthesizer with dual-mode sound (Standard and Holodeck), music playback with shuffle playlist, radio static effect', 7160)] }),
                            new TableRow({ children: [bodyCell('script.js', 2200, { mono: true }), bodyCell('Main game logic: initialization, rendering, game loop, HUD, input handling, defense zones, shield system, ambulance, Holodeck, boot sequence, VFX (6000+ lines)', 7160)] }),
                        ]
                    }),

                    heading('1.2 File Structure', HeadingLevel.HEADING_2),

                    heading('1.3 Virtual Coordinate System', HeadingLevel.HEADING_2),
                    para('All game logic operates in a 1600 x 900 virtual coordinate space (16:9 aspect ratio). The resize() function calculates the largest 16:9 rectangle that fits in the play area, then computes scale factors (canvasScaleX, canvasScaleY) from virtual to pixel space.'),
                    bulletItem('Virtual space: COORD_SYSTEM = { width: 1600, height: 900 }'),
                    bulletItem('Canvas is scaled using ctx.scale(canvasScaleX, canvasScaleY) in the render loop'),
                    bulletItem('The SVG tether layer uses viewBox="0 0 1600 900" for automatic coordinate mapping'),
                    bulletItem('All game logic bounds checks use COORD_SYSTEM.width/height, never DOM pixel sizes'),
                    warningBox('When adding new game elements, always use virtual coordinates (0-1600 horizontal, 0-900 vertical). The only place pixel coordinates are used is inside resize() and the pre-scale clearRect.'),

                    new Paragraph({ children: [new PageBreak()] }),

                    // ============================================
                    // 2. GAME MECHANICS
                    // ============================================
                    heading('2. Game Mechanics'),
                    imageBlock(combatSceneImg, 580, 362, 'Active Gameplay — Combat Scene'),

                    heading('2.1 Core Gameplay Loop', HeadingLevel.HEADING_2),
                    para('The game follows a repeating cycle:'),
                    numberedItem('Asteroids spawn at the top of the screen, each labeled with a challenge phrase (e.g., "Post to Niagara Falls") and a command code (e.g., "AP 2101 72100")'),
                    numberedItem('Asteroids fall toward randomly selected defense zones at speeds determined by the current tier'),
                    numberedItem('The player types the correct command code into the input field and presses Enter'),
                    numberedItem('A correct command fires a projectile from the Radio Tower to intercept the asteroid'),
                    numberedItem('Incorrect commands or empty submissions are misfires that damage the shield'),
                    numberedItem('If an asteroid reaches a defense zone, the zone is destroyed'),
                    numberedItem('When all zones are destroyed, the game ends'),

                    heading('2.2 Command Structure', HeadingLevel.HEADING_2),
                    imageBlock(typingActionImg, 580, 362, 'Typing Action — Player entering a command while asteroids descend'),
                    para('Each asteroid carries a challenge/command pair generated by getTargetSpecs() in core/data.js:'),
                    new Table({
                        width: { size: 9360, type: WidthType.DXA },
                        columnWidths: [2340, 2340, 2340, 2340],
                        rows: [
                            new TableRow({ children: [headerCell('Code', 2340), headerCell('Meaning', 2340), headerCell('Challenge Example', 2340), headerCell('Command', 2340)] }),
                            new TableRow({ children: [bodyCell('AP', 2340, { mono: true }), bodyCell('Assign/Post', 2340), bodyCell('"Post to Thorold"', 2340), bodyCell('AP 2101 72103', 2340, { mono: true })] }),
                            new TableRow({ children: [bodyCell('ENP', 2340, { mono: true }), bodyCell('Enroute', 2340), bodyCell('"Enroute to Grimsby"', 2340), bodyCell('ENP 2105 72105', 2340, { mono: true })] }),
                            new TableRow({ children: [bodyCell('BSE', 2340, { mono: true }), bodyCell('Base/Arriving', 2340), bodyCell('"Arriving at NOTL"', 2340), bodyCell('BSE 2120 72104', 2340, { mono: true })] }),
                            new TableRow({ children: [bodyCell('LA', 2340, { mono: true }), bodyCell('Local Area', 2340), bodyCell('"Area of Pelham"', 2340), bodyCell('LA 2115 72111', 2340, { mono: true })] }),
                        ]
                    }),
                    spacer(80),
                    para('Commands are composed of: [Action Code] [Unit ID] [Base Code]'),
                    noteBox('The command format matches real Niagara Region EMS CAD codes. Unit IDs and base codes are loaded from CSV datasets.'),

                    heading('2.3 Defense Zones', HeadingLevel.HEADING_2),
                    imageBlock(defenseZonesImg, 580, 362, 'Defense Zones — Multiple asteroids targeting zones'),
                    para('Five structures are positioned across the terrain. Four are destroyable zones; one is the command tower:'),
                    new Table({
                        width: { size: 9360, type: WidthType.DXA },
                        columnWidths: [800, 2100, 2400, 1600, 2460],
                        rows: [
                            new TableRow({ children: [headerCell('ID', 800), headerCell('Name', 2100), headerCell('Landmark', 2400), headerCell('Type', 1600), headerCell('Special Features', 2460)] }),
                            new TableRow({ children: [bodyCell('1', 800), bodyCell('NOTL', 2100), bodyCell('Sir Adam Beck Hydroelectric Dam', 2400), bodyCell('Zone', 1600), bodyCell('Zapped hydro workers VFX on destroy', 2460)] }),
                            new TableRow({ children: [bodyCell('2', 800), bodyCell('NIAGARA FALLS', 2100), bodyCell('Skylon Tower', 2400), bodyCell('Zone', 1600), bodyCell('Bug ejector VFX, aircraft warning light', 2460)] }),
                            new TableRow({ children: [bodyCell('tower', 800, { mono: true }), bodyCell('RADIO TOWER', 2100), bodyCell('Command Tower', 2400), bodyCell('Tower', 1600), bodyCell('Shield dome, ambulance repair system', 2460)] }),
                            new TableRow({ children: [bodyCell('3', 800), bodyCell('THOROLD', 2100), bodyCell('Welland Canal Lift Bridge', 2400), bodyCell('Zone', 1600), bodyCell('Animated lift bridge, freighter transit', 2460)] }),
                            new TableRow({ children: [bodyCell('4', 800), bodyCell('PORT COLBORNE', 2100), bodyCell('Robin Hood Flour Mill', 2400), bodyCell('Zone', 1600), bodyCell('Flour workers, ice formation VFX', 2460)] }),
                        ]
                    }),

                    heading('2.4 Shield and Tower System', HeadingLevel.HEADING_2),
                    imageBlock(damageStateImg, 580, 362, 'Damage State — Shield depleted, zones destroyed, tower under fire'),
                    para('The Radio Tower is protected by a glass dome energy shield with 9 hit points (HP), divided into 3 layers of 3 HP each. The HUD displays 3 diamond indicators corresponding to these layers.'),
                    bulletItem('Shield damage: Misfires deal 1 HP damage; direct asteroid impacts deal 3 HP damage'),
                    bulletItem('Shield colors: Green (HP 7-9), Orange (HP 4-6), Purple (HP 1-3)'),
                    bulletItem('When shields reach 0, the tower is exposed. The next impact destroys the tower'),
                    bulletItem('Tower destruction disables firing and triggers the ambulance repair sequence'),
                    bulletItem('Music degrades to broken radio static while the tower is down'),
                    bulletItem('Shields do NOT regenerate. Once lost, they stay at 0 for the rest of the session'),

                    heading('2.5 Ambulance Repair System', HeadingLevel.HEADING_2),
                    para('When the Radio Tower is destroyed, a NanoMedic ambulance is dispatched after a delay:'),
                    bulletItem('First tower destruction: 4-second delay before dispatch'),
                    bulletItem('Each subsequent destruction doubles the delay (8s, 16s, 32s, ...)'),
                    bulletItem('The ambulance navigates to the tower while evading asteroids (repulsion physics)'),
                    bulletItem('A repair beam activates for a duration that increases with each repair'),
                    bulletItem('After repair: tower comes online, but shields remain at 0'),
                    warningBox('During the repair phase (state.rebuilding = true), no asteroids spawn and the player cannot fire.'),

                    new Paragraph({ children: [new PageBreak()] }),

                    // ============================================
                    // 3. SCORING SYSTEM
                    // ============================================
                    heading('3. Scoring System'),
                    imageBlock(scoringPageImg, 580, 362, 'Scoring & Progression reference screen'),
                    para('All scoring values are defined in core/config.js (SCORING object) and can be overridden by datasets/scoring.csv. The scoring pipeline in calcScore() processes hits in this order: Base Hit, then multiplier bonuses, then streak multiplier, then flat bonuses, then penalties.'),

                    heading('3.1 Base Scoring', HeadingLevel.HEADING_2),
                    new Table({
                        width: { size: 9360, type: WidthType.DXA },
                        columnWidths: [2800, 1600, 4960],
                        rows: [
                            new TableRow({ children: [headerCell('Event', 2800), headerCell('Value', 1600), headerCell('Condition', 4960)] }),
                            new TableRow({ children: [bodyCell('Base Hit', 2800), bodyCell('Rank-based', 1600), bodyCell('Correct command typed. Value from progression.csv (100 at Trainee, up to 1200 at O.A.S)', 4960)] }),
                            new TableRow({ children: [bodyCell('Perfect Shot', 2800), bodyCell('+25% of Base', 1600), bodyCell('0 backspaces used on the command', 4960)] }),
                            new TableRow({ children: [bodyCell('Early Intercept', 2800), bodyCell('+50% of Base', 1600), bodyCell('Target cleared in the top 25% of screen (y < height * 0.25)', 4960)] }),
                            new TableRow({ children: [bodyCell('Speed Demon', 2800), bodyCell('+15% of Base', 1600), bodyCell('Target cleared within 1.5 seconds of spawning', 4960)] }),
                            new TableRow({ children: [bodyCell('Near-Miss Save', 2800), bodyCell('+15 flat', 1600), bodyCell('Target destroyed in the bottom 10% of screen', 4960)] }),
                        ]
                    }),
                    spacer(80),
                    noteBox('Perfect Shot, Early Intercept, and Speed Demon stack additively. A single kill can earn all three bonuses.'),

                    heading('3.2 Kill-Streak Multiplier', HeadingLevel.HEADING_2),
                    para('Consecutive asteroid kills without a zone being destroyed build a kill-streak multiplier:'),
                    new Table({
                        width: { size: 9360, type: WidthType.DXA },
                        columnWidths: [2340, 2340, 2340, 2340],
                        rows: [
                            new TableRow({ children: [headerCell('Streak Count', 2340), headerCell('Multiplier', 2340), headerCell('Bonus', 2340), headerCell('Status Text', 2340)] }),
                            new TableRow({ children: [bodyCell('0-2 kills', 2340), bodyCell('1.0x', 2340), bodyCell('None', 2340), bodyCell('(none)', 2340)] }),
                            new TableRow({ children: [bodyCell('3-4 kills', 2340), bodyCell('1.1x', 2340), bodyCell('+10%', 2340), bodyCell('(none)', 2340)] }),
                            new TableRow({ children: [bodyCell('5-7 kills', 2340), bodyCell('1.2x', 2340), bodyCell('+20%', 2340), bodyCell('WARMING UP', 2340)] }),
                            new TableRow({ children: [bodyCell('8-14 kills', 2340), bodyCell('1.35x', 2340), bodyCell('+35%', 2340), bodyCell('ON FIRE', 2340)] }),
                            new TableRow({ children: [bodyCell('15-24 kills', 2340), bodyCell('1.5x', 2340), bodyCell('+50%', 2340), bodyCell('UNSTOPPABLE', 2340)] }),
                            new TableRow({ children: [bodyCell('25+ kills', 2340), bodyCell('1.75x', 2340), bodyCell('+75%', 2340), bodyCell('LEGEND MODE', 2340)] }),
                        ]
                    }),

                    heading('3.3 Perfect Shot Streak', HeadingLevel.HEADING_2),
                    para('Consecutive perfect shots (0 backspaces) earn milestone bonuses. A single backspace is forgiven (streak continues but does not increment). Two or more backspaces on a single target break the streak.'),
                    new Table({
                        width: { size: 9360, type: WidthType.DXA },
                        columnWidths: [2340, 2340, 2340, 2340],
                        rows: [
                            new TableRow({ children: [headerCell('Threshold', 2340), headerCell('Flat Bonus', 2340), headerCell('Status Text', 2340), headerCell('Difficulty', 2340)] }),
                            new TableRow({ children: [bodyCell('5 Perfect', 2340), bodyCell('+75', 2340), bodyCell('LOCKED IN', 2340), bodyCell('Achievable', 2340)] }),
                            new TableRow({ children: [bodyCell('8 Perfect', 2340), bodyCell('+150', 2340), bodyCell('EXCELLENT', 2340), bodyCell('Moderate', 2340)] }),
                            new TableRow({ children: [bodyCell('15 Perfect', 2340), bodyCell('+400', 2340), bodyCell('UNSTOPPABLE', 2340), bodyCell('Hard', 2340)] }),
                            new TableRow({ children: [bodyCell('25 Perfect', 2340), bodyCell('+1,000', 2340), bodyCell('LEGEND', 2340), bodyCell('Elite', 2340)] }),
                        ]
                    }),

                    heading('3.4 Typing Penalties', HeadingLevel.HEADING_2),
                    new Table({
                        width: { size: 9360, type: WidthType.DXA },
                        columnWidths: [2800, 1800, 4760],
                        rows: [
                            new TableRow({ children: [headerCell('Event', 2800), headerCell('Penalty', 1800), headerCell('Trigger', 4760)] }),
                            new TableRow({ children: [bodyCell('Key Dust', 2800), bodyCell('-10% of Base', 1800), bodyCell('1-2 backspaces', 4760)] }),
                            new TableRow({ children: [bodyCell('Signal Noise', 2800), bodyCell('-20% of Base', 1800), bodyCell('3-4 backspaces', 4760)] }),
                            new TableRow({ children: [bodyCell('Comms Drift', 2800), bodyCell('-30 flat', 1800), bodyCell('5-6 backspaces', 4760)] }),
                            new TableRow({ children: [bodyCell('Static Jam', 2800), bodyCell('-50 flat', 1800), bodyCell('7+ backspaces (maximum typing penalty)', 4760)] }),
                            new TableRow({ children: [bodyCell('Misfire', 2800), bodyCell('-50 flat', 1800), bodyCell('Empty submission or wrong command. Also deals shield damage', 4760)] }),
                        ]
                    }),

                    heading('3.5 Micro-Rewards', HeadingLevel.HEADING_2),
                    new Table({
                        width: { size: 9360, type: WidthType.DXA },
                        columnWidths: [2600, 1400, 5360],
                        rows: [
                            new TableRow({ children: [headerCell('Reward', 2600), headerCell('Value', 1400), headerCell('Description', 5360)] }),
                            new TableRow({ children: [bodyCell('First Blood', 2600), bodyCell('+25', 1400), bodyCell('First asteroid destroyed in session (once per session)', 5360)] }),
                            new TableRow({ children: [bodyCell('Calibration Bonus', 2600), bodyCell('+50', 1400), bodyCell('Every 500 points earned within a rank tier (repeatable)', 5360)] }),
                            new TableRow({ children: [bodyCell('Comeback Bonus', 2600), bodyCell('+25', 1400), bodyCell('Destroy 3 asteroids after losing a base (once per base loss)', 5360)] }),
                            new TableRow({ children: [bodyCell('Rank-Up Bonus', 2600), bodyCell('2x Base Hit', 1400), bodyCell('Promotion to new rank (uses new rank base hit value)', 5360)] }),
                        ]
                    }),

                    heading('3.6 Score Rules', HeadingLevel.HEADING_2),
                    bulletItem('Score floor: Player score cannot go below 0'),
                    bulletItem('Penalty cap: No single event deducts more than 300 points'),
                    bulletItem('Consecutive base destruction: 1st base = no penalty, 2nd = -100, 3rd = -200, 4th+ = -300 (capped). Counter resets when any asteroid is destroyed'),
                    bulletItem('Bonus stacking order: Base Hit \u2192 Multiplier bonuses (Perfect/Early/Speed) \u2192 Kill-streak multiplier \u2192 Flat bonuses \u2192 Penalties'),

                    new Paragraph({ children: [new PageBreak()] }),

                    // ============================================
                    // 4. CAREER PROGRESSION
                    // ============================================
                    heading('4. Career Progression'),
                    para('Players progress through 8 ranks based on score. Each rank increases game difficulty and scoring potential. Rank data is defined in progression.csv and loaded by core/data.js at startup.'),

                    heading('4.1 Rank Table', HeadingLevel.HEADING_2),
                    new Table({
                        width: { size: 9360, type: WidthType.DXA },
                        columnWidths: [1800, 1200, 1100, 1100, 1100, 1100, 960, 1000],
                        rows: [
                            new TableRow({ children: [
                                headerCell('Rank', 1800), headerCell('Points', 1200), headerCell('Speed', 1100),
                                headerCell('Spawn (s)', 1100), headerCell('Max Tgts', 1100), headerCell('Base Hit', 1100),
                                headerCell('Penalty', 960), headerCell('Radius', 1000)
                            ]}),
                            ...([
                                ['TRAINEE', '0', '0.6-0.8x', '5-6.5', '6', '100', '-50', '20'],
                                ['MENTORING', '2,001', '0.8-1.0x', '4.5-5.5', '8', '125', '-60', '19'],
                                ['SIGNED OFF', '5,001', '1.0-1.2x', '4-5', '10', '200', '-100', '18'],
                                ['OUT OF PROBATION', '10,001', '1.2-1.4x', '3.5-4', '12', '300', '-150', '17'],
                                ['2 YEARS IN', '20,001', '1.5-1.8x', '3-3.5', '14', '450', '-225', '16'],
                                ['FULL TIME', '35,001', '1.8-2.2x', '2.5-3', '16', '600', '-300', '15'],
                                ['VETERAN', '55,001', '2.5-3.0x', '1.5-2', '20', '850', '-500', '14'],
                                ['O.A.S', '80,001', '3.0-4.0x', '0.8-1.2', '25', '1,200', '-600', '13'],
                            ]).map(row => new TableRow({
                                children: row.map((cell, i) => bodyCell(cell, [1800, 1200, 1100, 1100, 1100, 1100, 960, 1000][i], { size: 16 }))
                            }))
                        ]
                    }),
                    spacer(80),
                    para('Column definitions:', { bold: true }),
                    bulletItem('Speed: Asteroid fall speed multiplier range (randomized per asteroid)'),
                    bulletItem('Spawn: Time between asteroid spawns in seconds (randomized between min/max)'),
                    bulletItem('Max Tgts: Maximum simultaneous asteroids on screen'),
                    bulletItem('Base Hit: Points awarded per correct command'),
                    bulletItem('Penalty: Points deducted on consecutive base destruction'),
                    bulletItem('Radius: Asteroid size in virtual pixels (smaller = harder to read labels)'),

                    new Paragraph({ children: [new PageBreak()] }),

                    // ============================================
                    // 5. USER INTERFACE
                    // ============================================
                    heading('5. User Interface'),
                    imageBlock(hudLayoutImg, 580, 362, 'HUD Layout — Score, rank, and streak on left; play area center; shields on right'),

                    heading('5.1 HUD Layout', HeadingLevel.HEADING_2),
                    para('The HUD is divided into three panels:'),

                    para('Left Panel:', { bold: true }),
                    bulletItem('SCORE: Current score with comma formatting'),
                    bulletItem('RANK: Current tier label (e.g., "SIGNED OFF")'),
                    bulletItem('STREAK: Current kill-streak count'),

                    para('Center Area:', { bold: true }),
                    bulletItem('VDS Row: Dual Visual Display System with typewriter effect (VDS1 for numbers, VDS2 for text)'),
                    bulletItem('Command Input: Text input with Commodore PET-style block cursor'),
                    bulletItem('Game Canvas: 16:9 play area with all game rendering'),

                    para('Right Panel:', { bold: true }),
                    bulletItem('Breach Tolerance: 3 diamond indicators for shield layers'),
                    bulletItem('Shield Strength: 9-segment bar using block characters (\u2588 and \u2591)'),

                    heading('5.2 Menu System', HeadingLevel.HEADING_2),
                    para('The menu system has the following screens:'),
                    new Table({
                        width: { size: 9360, type: WidthType.DXA },
                        columnWidths: [2800, 6560],
                        rows: [
                            new TableRow({ children: [headerCell('Screen', 2800), headerCell('Description', 6560)] }),
                            new TableRow({ children: [bodyCell('Title Screen', 2800), bodyCell('Shows "PRESS ANY KEY" prompt with title music. Background image with credit line.', 6560)] }),
                            new TableRow({ children: [bodyCell('CAT Login', 2800), bodyCell('Commodore Automated Terminal. Prompts for NAME and OASIS # (masked). Shows top 10 leaderboard.', 6560)] }),
                            new TableRow({ children: [bodyCell('Main Menu', 2800), bodyCell('BEGIN MISSION, SCORING & PROGRESSION, SETTINGS, HIGH SCORES buttons', 6560)] }),
                            new TableRow({ children: [bodyCell('Settings', 2800), bodyCell('Music ON/OFF toggle, SFX ON/OFF toggle', 6560)] }),
                            new TableRow({ children: [bodyCell('Scoring & Progression', 2800), bodyCell('Reference card showing all scoring events and rank thresholds', 6560)] }),
                            new TableRow({ children: [bodyCell('High Scores', 2800), bodyCell('Top 10 dispatchers from localStorage', 6560)] }),
                            new TableRow({ children: [bodyCell('Pause Overlay', 2800), bodyCell('RESUME MISSION, RESTART MISSION, QUIT TO MENU', 6560)] }),
                            new TableRow({ children: [bodyCell('Game Over', 2800), bodyCell('Final score, stats, SUBMIT SCORE, RESTART, MAIN MENU buttons', 6560)] }),
                        ]
                    }),
                    spacer(80),
                    para('Keyboard navigation: Arrow keys move selection between menu buttons. Any non-modifier key activates the selected button. Mouse hover also syncs with keyboard selection.'),

                    heading('5.2.1 Main Menu', HeadingLevel.HEADING_3),
                    imageBlock(mainMenuImg, 480, 300, 'Main Menu — BEGIN MISSION, SCORING, SETTINGS, HIGH SCORES'),

                    heading('5.2.2 CAT Login Terminal', HeadingLevel.HEADING_3),
                    imageBlock(catLoginImg, 480, 300, 'CAT Login — Commodore Automated Terminal'),

                    heading('5.2.3 Scoring & Progression', HeadingLevel.HEADING_3),
                    imageBlock(scoringPageImg, 480, 300, 'Scoring & Progression reference screen'),

                    heading('5.2.4 Settings', HeadingLevel.HEADING_3),
                    imageBlock(settingsPageImg, 480, 300, 'Settings — Music and SFX toggles'),

                    heading('5.2.5 Pause Screen', HeadingLevel.HEADING_3),
                    imageBlock(pauseScreenImg, 480, 300, 'Pause Screen — Resume, Restart, or Quit options'),

                    heading('5.3 Keyboard Shortcuts', HeadingLevel.HEADING_2),
                    new Table({
                        width: { size: 9360, type: WidthType.DXA },
                        columnWidths: [3000, 6360],
                        rows: [
                            new TableRow({ children: [headerCell('Shortcut', 3000), headerCell('Action', 6360)] }),
                            new TableRow({ children: [bodyCell('Escape', 3000), bodyCell('Pause/Resume game', 6360)] }),
                            new TableRow({ children: [bodyCell('Ctrl + Shift + B', 3000), bodyCell('Open Dev Mode password prompt (10-second timer)', 6360)] }),
                            new TableRow({ children: [bodyCell('Ctrl + Shift + H', 3000), bodyCell('Open Holodeck password prompt (15-second timer)', 6360)] }),
                            new TableRow({ children: [bodyCell('Enter', 3000), bodyCell('Submit command (during gameplay) or activate selected button (in menus)', 6360)] }),
                            new TableRow({ children: [bodyCell('Arrow Keys', 3000), bodyCell('Navigate between menu buttons', 6360)] }),
                        ]
                    }),

                    new Paragraph({ children: [new PageBreak()] }),

                    // ============================================
                    // 6. DATASETS
                    // ============================================
                    heading('6. Datasets'),
                    para('Game data is loaded from five CSV files in the datasets/ directory. If CSV fetch fails (e.g., on file:// protocol), hardcoded fallback data in core/data.js is used.'),

                    heading('6.1 CSV Files', HeadingLevel.HEADING_2),

                    para('bases.csv', { bold: true }),
                    para('Maps challenge base names to command base codes. Columns: Challenge Base, Command Base, Weight (optional).'),
                    codeLine('Niagara Falls,72100,10'),
                    codeLine('Thorold,72103,10'),
                    codeLine('HQ,72120,5'),

                    para('commands.csv', { bold: true }),
                    para('Maps challenge phrases to command action codes. Columns: Challenge, Command, Type.'),
                    codeLine('Post to,AP,direction'),
                    codeLine('Enroute to,ENP,radio'),
                    codeLine('Arriving at,BSE,radio'),

                    para('units.csv', { bold: true }),
                    para('List of unit IDs. Columns: Units, Weight (optional). Includes regular units (2100-2126), superintendent units (2040-2046), special event units (2302-2398), bike/CARE/FIT/MHRT units.'),

                    para('progression.csv', { bold: true }),
                    para('Defines rank tiers. Columns: Rank / Tier, Points Required, Speed (Min), Speed (Max), Spawn (Min sec), Spawn (Max sec), Max Targets, Base Hit (Clear), Target Impact (Penalty), Asteroid Radius, Projectile Speed.'),

                    para('scoring.csv', { bold: true }),
                    para('Defines scoring multipliers. Columns: Scoring Event, Value / Multiplier, Trigger / Condition, Description, UI Flavor Text, Stacks / Resets. Parsed by name matching (e.g., rows containing "Perfect Shot" update SCORING.perfectMult).'),

                    heading('6.2 Editing Datasets', HeadingLevel.HEADING_2),
                    para('To modify game data:', { bold: true }),
                    numberedItem('Open the CSV file in a text editor or spreadsheet application', 'stepNumbers'),
                    numberedItem('Edit values. Ensure headers remain unchanged (the parser matches on header names)', 'stepNumbers'),
                    numberedItem('Save as CSV (comma-delimited, UTF-8)', 'stepNumbers'),
                    numberedItem('If running via HTTP server, refresh the browser. Changes load automatically', 'stepNumbers'),
                    numberedItem('If running via file:// protocol, use the UPDATE DATASETS button in Holodeck God Mode to trigger a file picker', 'stepNumbers'),
                    warningBox('The Weight column controls spawn probability. Higher weight = more frequent appearance. Default weight is 5. Setting weight to 0 effectively disables an item.'),

                    heading('6.3 Adding New Units', HeadingLevel.HEADING_2),
                    numberedItem('Open datasets/units.csv', 'stepNumbers'),
                    numberedItem('Add a new row with the unit ID and optional weight (e.g., "2999,10")', 'stepNumbers'),
                    numberedItem('Save the file and reload the game (or use UPDATE DATASETS in Holodeck)', 'stepNumbers'),
                    noteBox('New units are immediately available in the challenge pool. No code changes required.'),

                    heading('6.4 Adding New Bases', HeadingLevel.HEADING_2),
                    numberedItem('Open datasets/bases.csv', 'stepNumbers'),
                    numberedItem('Add a row: Challenge Base (display name), Command Base (code), Weight', 'stepNumbers'),
                    numberedItem('Example: "Crystal Beach,72125,8"', 'stepNumbers'),
                    numberedItem('Save and reload', 'stepNumbers'),

                    heading('6.5 Modifying Rank Progression', HeadingLevel.HEADING_2),
                    numberedItem('Open datasets/progression.csv', 'stepNumbers'),
                    numberedItem('Modify any values in the existing rows (Points Required, Speed, Spawn times, etc.)', 'stepNumbers'),
                    numberedItem('To add a new rank: insert a row in the correct position (ranks must be ordered by Points Required ascending)', 'stepNumbers'),
                    numberedItem('Save and reload. The TIERS object is rebuilt entirely from this CSV', 'stepNumbers'),
                    warningBox('Rank tier keys are generated by lowercasing the name and removing non-alphanumeric characters. Ensure names are unique after this transformation.'),

                    new Paragraph({ children: [new PageBreak()] }),

                    // ============================================
                    // 7. CONFIGURATION REFERENCE
                    // ============================================
                    heading('7. Configuration Reference'),
                    para('All game constants are defined in core/config.js. This section documents every configurable value and how to change it.'),

                    heading('7.1 CONFIG Object', HeadingLevel.HEADING_2),
                    new Table({
                        width: { size: 9360, type: WidthType.DXA },
                        columnWidths: [2600, 1200, 5560],
                        rows: [
                            new TableRow({ children: [headerCell('Property', 2600), headerCell('Default', 1200), headerCell('Description', 5560)] }),
                            new TableRow({ children: [bodyCell('maxShieldStrength', 2600, { mono: true }), bodyCell('9', 1200), bodyCell('Total shield HP (3 layers x 3 HP each)', 5560)] }),
                            new TableRow({ children: [bodyCell('hpPerShieldLayer', 2600, { mono: true }), bodyCell('3', 1200), bodyCell('HP per diamond indicator layer', 5560)] }),
                            new TableRow({ children: [bodyCell('misfireDamage', 2600, { mono: true }), bodyCell('1', 1200), bodyCell('Shield damage per misfire', 5560)] }),
                            new TableRow({ children: [bodyCell('impactDamage', 2600, { mono: true }), bodyCell('3', 1200), bodyCell('Shield damage per asteroid impact on tower', 5560)] }),
                            new TableRow({ children: [bodyCell('asteroidRadius', 2600, { mono: true }), bodyCell('20', 1200), bodyCell('Base asteroid radius (overridden by tier)', 5560)] }),
                            new TableRow({ children: [bodyCell('projectileSpeed', 2600, { mono: true }), bodyCell('800', 1200), bodyCell('Base projectile speed (overridden by tier)', 5560)] }),
                            new TableRow({ children: [bodyCell('ambulanceSpeed', 2600, { mono: true }), bodyCell('400', 1200), bodyCell('Ambulance movement speed', 5560)] }),
                            new TableRow({ children: [bodyCell('beamDuration', 2600, { mono: true }), bodyCell('2000', 1200), bodyCell('Base repair beam duration in ms', 5560)] }),
                            new TableRow({ children: [bodyCell('shieldRegenStreak', 2600, { mono: true }), bodyCell('5', 1200), bodyCell('Reserved (shield regen disabled)', 5560)] }),
                            new TableRow({ children: [bodyCell('altitudeThreshold', 2600, { mono: true }), bodyCell('0.25', 1200), bodyCell('Early Intercept zone (top 25% of screen)', 5560)] }),
                            new TableRow({ children: [bodyCell('devModePassword', 2600, { mono: true }), bodyCell('"DISPATCH"', 1200), bodyCell('Password for Dev Mode (Ctrl+Shift+B)', 5560)] }),
                            new TableRow({ children: [bodyCell('devModeTimeout', 2600, { mono: true }), bodyCell('10000', 1200), bodyCell('Dev Mode prompt timeout in ms', 5560)] }),
                            new TableRow({ children: [bodyCell('holodeckPassword', 2600, { mono: true }), bodyCell('"RED RABBIT"', 1200), bodyCell('Password for Holodeck (Ctrl+Shift+H)', 5560)] }),
                            new TableRow({ children: [bodyCell('holodeckTimeout', 2600, { mono: true }), bodyCell('15000', 1200), bodyCell('Holodeck prompt timeout in ms', 5560)] }),
                        ]
                    }),

                    heading('7.2 How to Change Config Values', HeadingLevel.HEADING_2),
                    para('To modify configuration:', { bold: true }),
                    numberedItem('Open files/core/config.js in a text editor', 'stepNumbers'),
                    numberedItem('Locate the CONFIG object at the top of the file', 'stepNumbers'),
                    numberedItem('Change the desired value (e.g., change maxShieldStrength: 9 to maxShieldStrength: 12)', 'stepNumbers'),
                    numberedItem('Save the file and refresh the browser. Changes take effect immediately', 'stepNumbers'),

                    heading('7.3 TETHER Physics', HeadingLevel.HEADING_2),
                    para('The TETHER object controls the physics of challenge label boxes floating above asteroids:'),
                    new Table({
                        width: { size: 9360, type: WidthType.DXA },
                        columnWidths: [2800, 1200, 5360],
                        rows: [
                            new TableRow({ children: [headerCell('Property', 2800), headerCell('Default', 1200), headerCell('Description', 5360)] }),
                            new TableRow({ children: [bodyCell('springConstant', 2800, { mono: true }), bodyCell('0.55', 1200), bodyCell('How aggressively labels snap back to their asteroid', 5360)] }),
                            new TableRow({ children: [bodyCell('repulsionForce', 2800, { mono: true }), bodyCell('0.25', 1200), bodyCell('How strongly labels push apart to avoid overlap', 5360)] }),
                            new TableRow({ children: [bodyCell('tetherVisibleDistance', 2800, { mono: true }), bodyCell('45', 1200), bodyCell('Minimum stretch distance before the tether line is drawn', 5360)] }),
                            new TableRow({ children: [bodyCell('friction', 2800, { mono: true }), bodyCell('0.50', 1200), bodyCell('Velocity damping per frame (lower = less wobble)', 5360)] }),
                            new TableRow({ children: [bodyCell('hoverOffset', 2800, { mono: true }), bodyCell('40', 1200), bodyCell('Vertical offset of label above asteroid center', 5360)] }),
                            new TableRow({ children: [bodyCell('energyFlowSpeed', 2800, { mono: true }), bodyCell('80', 1200), bodyCell('Speed of the animated energy dash on tether lines', 5360)] }),
                        ]
                    }),

                    heading('7.4 Asteroid Color Palette', HeadingLevel.HEADING_2),
                    para('The ASTEROID_COLORS object maps sprite indices (0-5) to color schemes. Each entry has accent, glow, and bg colors.'),
                    warningBox('Blue is reserved for "Unit Attached" in the CAD system and must never be used for asteroids or threats. The current palette uses only green family colors.'),

                    new Paragraph({ children: [new PageBreak()] }),

                    // ============================================
                    // 8. HOLODECK MODE
                    // ============================================
                    heading('8. Holodeck Mode'),
                    para('Holodeck is a training sandbox with LCARS/TNG-themed visuals, separate audio mode, and a God Mode control panel. It requires password authentication.'),

                    heading('8.1 Accessing Holodeck', HeadingLevel.HEADING_2),
                    numberedItem('From any menu screen, press Ctrl + Shift + H', 'stepNumbers'),
                    numberedItem('A timed password prompt appears (15 seconds). Yellow grid flash confirms the prompt is active', 'stepNumbers'),
                    numberedItem('Type "RED RABBIT" (case-insensitive) and press Enter', 'stepNumbers'),
                    numberedItem('On success: green grid flash, holodeck menu appears with ENTER HOLODECK and RETURN TO PROGRAM buttons', 'stepNumbers'),
                    numberedItem('On failure or timeout: red grid flash, prompt closes', 'stepNumbers'),

                    heading('8.2 God Mode Panel', HeadingLevel.HEADING_2),
                    para('When Holodeck is unlocked, the God Mode panel appears on the menu screen with two columns:'),

                    para('Toggle Controls (Left Column):', { bold: true }),
                    new Table({
                        width: { size: 9360, type: WidthType.DXA },
                        columnWidths: [3000, 2400, 3960],
                        rows: [
                            new TableRow({ children: [headerCell('Toggle', 3000), headerCell('Default', 2400), headerCell('Action', 3960)] }),
                            new TableRow({ children: [bodyCell('TARGETED ASTEROID FIRE', 3000), bodyCell('ON', 2400), bodyCell('Left-click an asteroid to fire at it', 3960)] }),
                            new TableRow({ children: [bodyCell('TOWER DESTROYED OVERRIDE', 3000), bodyCell('ON', 2400), bodyCell('Left-click destroys asteroids even when tower is down', 3960)] }),
                            new TableRow({ children: [bodyCell('DESTROY BASE', 3000), bodyCell('ON', 2400), bodyCell('Double-click a zone/tower to destroy it', 3960)] }),
                            new TableRow({ children: [bodyCell('REDIRECT ASTEROID', 3000), bodyCell('ON', 2400), bodyCell('Right-click asteroid then right-click target zone', 3960)] }),
                            new TableRow({ children: [bodyCell('MANUAL COMMAND ENTRY', 3000), bodyCell('ALWAYS ON', 2400), bodyCell('Standard command typing (cannot be disabled)', 3960)] }),
                        ]
                    }),

                    spacer(80),
                    para('Data Filters (Right Column):', { bold: true }),
                    para('Expandable checklist sections for filtering which data appears in challenges:'),
                    bulletItem('COMMANDS: Toggle AP, ENP, BSE, LA action codes'),
                    bulletItem('UNITS: Toggle individual unit IDs from the full roster'),
                    bulletItem('BASES: Toggle individual base codes'),
                    bulletItem('TARGETABLE BASES: Toggle which defense zones asteroids can target'),
                    noteBox('If all items in a filter section are deselected, the filter is ignored and the full dataset is used as a fallback.'),

                    heading('8.3 Update Datasets Button', HeadingLevel.HEADING_2),
                    para('At the bottom of the God Mode panel, the UPDATE DATASETS button reloads all CSV files:'),
                    bulletItem('Over HTTP: Fetches fresh copies from datasets/ with cache-busting'),
                    bulletItem('Over file:// protocol: Opens a multi-file picker dialog. Select all 5 CSV files at once'),
                    bulletItem('On success: Shows count of loaded units, bases, commands, and ranks'),
                    bulletItem('The God Mode menu is rebuilt automatically after dataset reload'),

                    heading('8.4 Holodeck Visual Differences', HeadingLevel.HEADING_2),
                    bulletItem('Yellow holodeck grid overlay with slow dissolve to grey watermark'),
                    bulletItem('LCARS/TNG-style synthesized sound effects (pure sine tones instead of industrial noise)'),
                    bulletItem('"MODE: HOLODECK" status badge on the canvas'),
                    bulletItem('Holodeck uses a smaller data subset by default (first 6 units, first 5 bases)'),
                    bulletItem('Empty command submission fires at the oldest asteroid instead of triggering a misfire'),

                    new Paragraph({ children: [new PageBreak()] }),

                    // ============================================
                    // 9. DEV MODE (BETA)
                    // ============================================
                    heading('9. Dev Mode (Beta)'),
                    para('Dev Mode is a testing tool that enables auto-fire for rapid iteration. It can be activated during gameplay or from menus.'),

                    heading('9.1 Activation', HeadingLevel.HEADING_2),
                    numberedItem('Press Ctrl + Shift + B', 'stepNumbers'),
                    numberedItem('A timed password prompt appears (10 seconds)', 'stepNumbers'),
                    numberedItem('Type "DISPATCH" (case-insensitive) and press Enter', 'stepNumbers'),
                    numberedItem('On success: "DEV MODE ACTIVATED" message. A "BETA MODE" indicator appears on the canvas', 'stepNumbers'),
                    numberedItem('Pressing Ctrl + Shift + B again toggles it off', 'stepNumbers'),

                    heading('9.2 Beta Mode Behavior', HeadingLevel.HEADING_2),
                    bulletItem('Any text typed + Enter fires at the oldest asteroid (command text is ignored)'),
                    bulletItem('Full base hit points are awarded per kill'),
                    bulletItem('If combined with Holodeck, Holodeck receives the beta flag and both modes are active'),

                    new Paragraph({ children: [new PageBreak()] }),

                    // ============================================
                    // 10. AUDIO SYSTEM
                    // ============================================
                    heading('10. Audio System'),
                    para('Audio is managed by the AudioManager singleton in core/audio.js. It provides two layers: synthesized sound effects (Web Audio API) and music playback (HTML5 Audio).'),

                    heading('10.1 Sound Effects', HeadingLevel.HEADING_2),
                    para('SFX are generated procedurally using oscillators and noise buffers. Each event has two variants: Standard (mechanical/industrial) and Holodeck (LCARS/TNG digital tones).'),
                    new Table({
                        width: { size: 9360, type: WidthType.DXA },
                        columnWidths: [2200, 3580, 3580],
                        rows: [
                            new TableRow({ children: [headerCell('Event', 2200), headerCell('Standard', 3580), headerCell('Holodeck', 3580)] }),
                            new TableRow({ children: [bodyCell('typing', 2200), bodyCell('Short noise click', 3580), bodyCell('Soft chirp 880Hz', 3580)] }),
                            new TableRow({ children: [bodyCell('fire', 2200), bodyCell('Rising sawtooth 200-600Hz', 3580), bodyCell('Descending sine 1200-400Hz', 3580)] }),
                            new TableRow({ children: [bodyCell('hit', 2200), bodyCell('Metallic noise + low square', 3580), bodyCell('Two-tone sine 600+800Hz', 3580)] }),
                            new TableRow({ children: [bodyCell('misfire', 2200), bodyCell('Static buzz 80Hz', 3580), bodyCell('Descending three-tone', 3580)] }),
                            new TableRow({ children: [bodyCell('targetImpact', 2200), bodyCell('Heavy thud 60Hz + noise', 3580), bodyCell('Red alert 400/600Hz alternating', 3580)] }),
                            new TableRow({ children: [bodyCell('shieldHit', 2200), bodyCell('Electric zap', 3580), bodyCell('Descending harmonic', 3580)] }),
                            new TableRow({ children: [bodyCell('shieldDown', 2200), bodyCell('Two-tone alarm', 3580), bodyCell('LCARS critical sequence', 3580)] }),
                            new TableRow({ children: [bodyCell('towerDown', 2200), bodyCell('Deep boom 40Hz', 3580), bodyCell('Low rumble + high whine', 3580)] }),
                            new TableRow({ children: [bodyCell('spawn', 2200), bodyCell('Low rumble 100Hz', 3580), bodyCell('Sensor ping 1000Hz', 3580)] }),
                            new TableRow({ children: [bodyCell('gameOver', 2200), bodyCell('Descending note sequence', 3580), bodyCell('LCARS shutdown', 3580)] }),
                        ]
                    }),

                    heading('10.2 Music System', HeadingLevel.HEADING_2),
                    bulletItem('Menu music: "Asteroid Command - Menus.mp3" (looped, starts at 5s offset)'),
                    bulletItem('Gameplay music: Shuffle playlist from music/ directory (plays all tracks before repeating)'),
                    bulletItem('Holodeck: No music (music is disabled in Holodeck mode)'),
                    bulletItem('Radio static effect: When tower is destroyed, music volume flickers and white noise overlay plays'),
                    bulletItem('Tab visibility: Music pauses when tab is hidden, resumes when visible'),

                    heading('10.3 Settings Integration', HeadingLevel.HEADING_2),
                    para('Music and SFX toggles on the Settings page control:'),
                    bulletItem('Music toggle: Sets AudioManager._musicMuted flag, immediately mutes/unmutes the HTML5 Audio element'),
                    bulletItem('SFX toggle: Sets AudioManager._sfxMuted flag. All AudioManager.play() calls exit early when muted'),

                    new Paragraph({ children: [new PageBreak()] }),

                    // ============================================
                    // 11. LEADERBOARD SYSTEM
                    // ============================================
                    heading('11. Leaderboard System'),
                    imageBlock(catLoginImg, 480, 300, 'CAT Login — Leaderboard display'),
                    para('High scores are stored in the browser localStorage under the key "asteroid-command-scores".'),

                    heading('11.1 Data Structure', HeadingLevel.HEADING_2),
                    para('Each score entry contains:'),
                    bulletItem('name: Player name (from CAT login, uppercase)'),
                    bulletItem('oasis: Player OASIS number (masked during input)'),
                    bulletItem('score: Final score (integer)'),
                    bulletItem('tier: Rank label at game end (e.g., "SIGNED OFF")'),
                    bulletItem('date: ISO date string (YYYY-MM-DD)'),

                    heading('11.2 Storage Limits', HeadingLevel.HEADING_2),
                    bulletItem('Top 100 scores are retained (sorted descending)'),
                    bulletItem('Top 10 are displayed in the High Scores menu and CAT login leaderboard'),
                    bulletItem('Scores are submitted manually via the SUBMIT SCORE button on the Game Over screen'),
                    warningBox('Clearing browser data (localStorage) will erase all saved scores. There is no server-side backup.'),

                    new Paragraph({ children: [new PageBreak()] }),

                    // ============================================
                    // 12. ASSET MANAGEMENT
                    // ============================================
                    heading('12. Asset Management'),

                    heading('12.1 Sprite Assets', HeadingLevel.HEADING_2),
                    para('All sprites are PNG files loaded at startup via Image() objects:'),
                    new Table({
                        width: { size: 9360, type: WidthType.DXA },
                        columnWidths: [2600, 3000, 3760],
                        rows: [
                            new TableRow({ children: [headerCell('Category', 2600), headerCell('Path', 3000), headerCell('Contents', 3760)] }),
                            new TableRow({ children: [bodyCell('Zone Sprites', 2600), bodyCell('assets/Zones/', 3000, { mono: true }), bodyCell('*_INTACT.png and *_DESTROYED.png for each zone', 3760)] }),
                            new TableRow({ children: [bodyCell('Asteroid Sprites', 2600), bodyCell('assets/Asteroids/', 3000, { mono: true }), bodyCell('asteroid_01.png through asteroid_06.png', 3760)] }),
                            new TableRow({ children: [bodyCell('Freighter Sprites', 2600), bodyCell('assets/Zone Objects/', 3000, { mono: true }), bodyCell('Freighter_1 through Freighter_SB2 (13 ships)', 3760)] }),
                            new TableRow({ children: [bodyCell('Ambulance', 2600), bodyCell('assets/Space Ships/', 3000, { mono: true }), bodyCell('NanoMedic.png', 3760)] }),
                            new TableRow({ children: [bodyCell('Zone Objects', 2600), bodyCell('assets/Zone Objects/', 3000, { mono: true }), bodyCell('Yellow_Bug.png (Skylon elevator bug)', 3760)] }),
                            new TableRow({ children: [bodyCell('Background', 2600), bodyCell('assets/', 3000, { mono: true }), bodyCell('master_background_sky.png', 3760)] }),
                        ]
                    }),

                    heading('12.2 Adding New Asteroid Sprites', HeadingLevel.HEADING_2),
                    numberedItem('Create a PNG file with transparent background', 'stepNumbers'),
                    numberedItem('Place it in files/assets/Asteroids/ with naming pattern asteroid_NN.png', 'stepNumbers'),
                    numberedItem('Open files/script.js and add the path to the ASTEROID_SPRITE_PATHS array', 'stepNumbers'),
                    numberedItem('Update the totalAssets count at the top of script.js', 'stepNumbers'),
                    numberedItem('Add a corresponding color entry in ASTEROID_COLORS in core/config.js', 'stepNumbers'),
                    warningBox('Remember: no blue colors. Blue is reserved for "Unit Attached" in the CAD system.'),

                    heading('12.3 Freighter Fleet', HeadingLevel.HEADING_2),
                    para('The Welland Canal zone features animated ship transits. Ships are defined in the FREIGHTER_FLEET object:'),
                    new Table({
                        width: { size: 9360, type: WidthType.DXA },
                        columnWidths: [2000, 4000, 3360],
                        rows: [
                            new TableRow({ children: [headerCell('Class', 2000), headerCell('Ships', 4000), headerCell('Dimensions (virtual)', 3360)] }),
                            new TableRow({ children: [bodyCell('standard', 2000, { mono: true }), bodyCell('Freighter_1 through Freighter_5', 4000), bodyCell('97 x 116', 3360)] }),
                            new TableRow({ children: [bodyCell('heavyBallast', 2000, { mono: true }), bodyCell('Freighter_6, Freighter_7', 4000), bodyCell('103 x 143', 3360)] }),
                            new TableRow({ children: [bodyCell('modern', 2000, { mono: true }), bodyCell('Freighter_8 through Freighter_10', 4000), bodyCell('111 x 151', 3360)] }),
                            new TableRow({ children: [bodyCell('stealth', 2000, { mono: true }), bodyCell('Freighter_SB1, Freighter_SB2', 4000), bodyCell('80 x 160', 3360)] }),
                        ]
                    }),

                    new Paragraph({ children: [new PageBreak()] }),

                    // ============================================
                    // 13. BOOT SEQUENCE
                    // ============================================
                    heading('13. Boot Sequence'),
                    imageBlock(bootLoadingImg, 580, 362, 'Boot Sequence — POST-style system initialization'),
                    para('The game includes a retro-styled boot animation that plays before the title screen:'),
                    numberedItem('Boot canvas (#boot-canvas) renders a POST-style text sequence', 'stepNumbers'),
                    numberedItem('System check messages appear with typewriter effect', 'stepNumbers'),
                    numberedItem('Title music begins playing during the boot sequence', 'stepNumbers'),
                    numberedItem('On completion, boot overlay fades out and title screen is revealed', 'stepNumbers'),
                    numberedItem('Player presses any key to dismiss title screen and enter CAT login', 'stepNumbers'),
                    noteBox('If the player has already logged in (returning from Game Over), pressing any key skips CAT login and goes directly to the main menu.'),

                    new Paragraph({ children: [new PageBreak()] }),

                    // ============================================
                    // 14. COMMON MODIFICATIONS
                    // ============================================
                    heading('14. Common Modifications'),

                    heading('14.1 Change the Dev Mode Password', HeadingLevel.HEADING_2),
                    numberedItem('Open files/core/config.js', 'stepNumbers'),
                    numberedItem('Find: devModePassword: "DISPATCH"', 'stepNumbers'),
                    numberedItem('Change "DISPATCH" to your desired password (will be compared case-insensitively)', 'stepNumbers'),
                    numberedItem('Save and refresh', 'stepNumbers'),

                    heading('14.2 Change the Holodeck Password', HeadingLevel.HEADING_2),
                    numberedItem('Open files/core/config.js', 'stepNumbers'),
                    numberedItem('Find: holodeckPassword: "RED RABBIT"', 'stepNumbers'),
                    numberedItem('Change "RED RABBIT" to your desired password', 'stepNumbers'),
                    numberedItem('Save and refresh', 'stepNumbers'),

                    heading('14.3 Adjust Shield Strength', HeadingLevel.HEADING_2),
                    numberedItem('Open files/core/config.js', 'stepNumbers'),
                    numberedItem('Change maxShieldStrength: 9 to desired value (must be divisible by hpPerShieldLayer for clean diamond display)', 'stepNumbers'),
                    numberedItem('Optionally adjust hpPerShieldLayer (each diamond represents one layer)', 'stepNumbers'),
                    numberedItem('The HUD shield bar auto-adjusts, but the diamond count is hardcoded to 3 in HTML', 'stepNumbers'),
                    warningBox('If changing shield layers beyond 3, you must also update the diamond HTML in index.html (#hit-diamonds) to add or remove diamond spans.'),

                    heading('14.4 Adjust Difficulty Scaling', HeadingLevel.HEADING_2),
                    numberedItem('Open datasets/progression.csv', 'stepNumbers'),
                    numberedItem('Modify Speed, Spawn, Max Targets, or Points Required columns', 'stepNumbers'),
                    numberedItem('Lower Spawn values = faster spawning = harder. Lower Speed values = slower asteroids = easier', 'stepNumbers'),
                    numberedItem('Save and reload. No code changes required', 'stepNumbers'),

                    heading('14.5 Adjust Scoring Multipliers', HeadingLevel.HEADING_2),
                    numberedItem('Open datasets/scoring.csv', 'stepNumbers'),
                    numberedItem('Find the row for the scoring event you want to change', 'stepNumbers'),
                    numberedItem('Modify the "Value / Multiplier" column', 'stepNumbers'),
                    numberedItem('For multipliers, use format like "0.25x". For flat values, use integers like "75"', 'stepNumbers'),
                    numberedItem('Save and reload. The SCORING object is rebuilt from this CSV', 'stepNumbers'),

                    heading('14.6 Add New Music Tracks', HeadingLevel.HEADING_2),
                    numberedItem('Place MP3 files in the files/music/ directory', 'stepNumbers'),
                    numberedItem('Open files/script.js and search for the gameplay music playlist setup', 'stepNumbers'),
                    numberedItem('Add the new file path to the tracks array passed to AudioManager.startPlaylist()', 'stepNumbers'),
                    numberedItem('The shuffle system will automatically include the new track', 'stepNumbers'),

                    heading('14.7 Disable the Boot Sequence', HeadingLevel.HEADING_2),
                    para('To skip the boot animation and go directly to the title screen:'),
                    numberedItem('Open files/index.html', 'stepNumbers'),
                    numberedItem('Add style="display:none" to the #boot-overlay div', 'stepNumbers'),
                    numberedItem('Or in files/script.js, find the boot sequence init code and set bootComplete = true immediately', 'stepNumbers'),

                    new Paragraph({ children: [new PageBreak()] }),

                    // ============================================
                    // 15. TECHNICAL NOTES
                    // ============================================
                    heading('15. Technical Notes'),

                    heading('15.1 Browser Compatibility', HeadingLevel.HEADING_2),
                    bulletItem('Requires a modern browser with HTML5 Canvas, Web Audio API, SVG support, and ES6+ JavaScript'),
                    bulletItem('Tested in Chrome, Firefox, and Edge'),
                    bulletItem('Cache busting: CSS and JS files are loaded with ?t=Date.now() query strings to prevent stale caches'),
                    bulletItem('No build system, no transpilation, no bundling. All code runs as-is in the browser'),

                    heading('15.2 Performance Considerations', HeadingLevel.HEADING_2),
                    bulletItem('AudioManager limits concurrent sounds to 8 (maxConcurrent) to prevent audio overload'),
                    bulletItem('Typing sound is throttled to 50ms intervals'),
                    bulletItem('SVG tether layer is rebuilt every frame (innerHTML cleared and recreated). This is intentional for simplicity'),
                    bulletItem('Environmental particles (fire, smoke, sparks) have a decay system to prevent particle count from growing unbounded'),
                    bulletItem('Spawn zone system uses a 16-zone spread with history-based blocking to prevent visual clustering'),

                    heading('15.3 Known Behaviors', HeadingLevel.HEADING_2),
                    bulletItem('Empty command in Holodeck targets the oldest asteroid (by design, not a bug)'),
                    bulletItem('After repair, tower comes online but shields remain at 0 permanently'),
                    bulletItem('The consecutive base destruction counter is separate from the kill-streak counter'),
                    bulletItem('Tab visibility change pauses/resumes music but does NOT pause the game loop'),

                    heading('15.4 Parent Arcade Integration', HeadingLevel.HEADING_2),
                    para('Asteroid Command is designed as a "cartridge" within a parent arcade system. The parent arcade lives at ../arcade.html and manages loading of individual game cartridges.'),

                    spacer(240),
                    para('\u2014 End of Technical Manual \u2014', { align: AlignmentType.CENTER, color: THEME.textLight, italics: true }),
                ]
            }
        ]
    });

    const buffer = await Packer.toBuffer(doc);
    const outputPath = path.join(__dirname, 'Asteroid Command - Technical Manual.docx');
    fs.writeFileSync(outputPath, buffer);
    console.log(`Generated: ${outputPath} (${(buffer.length / 1024).toFixed(0)} KB)`);
}

buildDocument().catch(err => {
    console.error('Failed to generate manual:', err);
    process.exit(1);
});
