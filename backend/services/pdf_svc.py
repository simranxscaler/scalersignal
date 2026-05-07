import io
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.colors import HexColor, white, black
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, HRFlowable, Table, TableStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER

SCALER_ORANGE = HexColor('#FF6B35')
SCALER_DARK = HexColor('#1A1A2E')
SCALER_CARD = HexColor('#16213E')
LIGHT_GRAY = HexColor('#F8FAFC')
MID_GRAY = HexColor('#64748B')
TEXT_DARK = HexColor('#1E293B')

def build_pdf(content: dict, lead_name: str, program: str = "") -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=18*mm,
        rightMargin=18*mm,
        topMargin=15*mm,
        bottomMargin=15*mm
    )

    styles = getSampleStyleSheet()

    # Custom styles
    style_headline = ParagraphStyle(
        'Headline',
        fontName='Helvetica-Bold',
        fontSize=22,
        textColor=TEXT_DARK,
        leading=28,
        spaceAfter=6
    )
    style_subheadline = ParagraphStyle(
        'Subheadline',
        fontName='Helvetica',
        fontSize=12,
        textColor=MID_GRAY,
        leading=18,
        spaceAfter=4
    )
    style_section_title = ParagraphStyle(
        'SectionTitle',
        fontName='Helvetica-Bold',
        fontSize=13,
        textColor=SCALER_ORANGE,
        leading=18,
        spaceBefore=14,
        spaceAfter=4
    )
    style_body = ParagraphStyle(
        'Body',
        fontName='Helvetica',
        fontSize=10.5,
        textColor=TEXT_DARK,
        leading=16,
        spaceAfter=6
    )
    style_evidence = ParagraphStyle(
        'Evidence',
        fontName='Helvetica-Oblique',
        fontSize=9.5,
        textColor=MID_GRAY,
        leading=14,
        leftIndent=10,
        spaceAfter=4
    )
    style_label = ParagraphStyle(
        'Label',
        fontName='Helvetica-Bold',
        fontSize=9,
        textColor=white,
        leading=12
    )
    style_cta = ParagraphStyle(
        'CTA',
        fontName='Helvetica-Bold',
        fontSize=12,
        textColor=white,
        leading=18,
        alignment=TA_CENTER
    )
    style_cta_sub = ParagraphStyle(
        'CTASub',
        fontName='Helvetica',
        fontSize=10,
        textColor=HexColor('#FFD0B5'),
        leading=14,
        alignment=TA_CENTER
    )

    story = []

    # Header bar — orange background with name
    header_data = [[
        Paragraph(f"<font color='white'><b>Prepared for {lead_name}</b></font>", ParagraphStyle('H', fontName='Helvetica-Bold', fontSize=11, textColor=white, leading=14)),
        Paragraph(f"<font color='#FFD0B5'>Scaler {program or 'Academy'}</font>", ParagraphStyle('HR', fontName='Helvetica-Bold', fontSize=11, textColor=HexColor('#FFD0B5'), leading=14, alignment=2))
    ]]
    header_table = Table(header_data, colWidths=[90*mm, 85*mm])
    header_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), SCALER_ORANGE),
        ('PADDING', (0, 0), (-1, -1), 10),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 14))

    # Headline + subheadline
    story.append(Paragraph(content.get('headline', ''), style_headline))
    story.append(Paragraph(content.get('subheadline', ''), style_subheadline))
    story.append(HRFlowable(width='100%', thickness=1, color=HexColor('#E2E8F0'), spaceAfter=8))

    # Sections
    for section in content.get('sections', []):
        story.append(Paragraph(section.get('title', ''), style_section_title))
        story.append(Paragraph(section.get('body', ''), style_body))
        evidence = section.get('evidence', '')
        if evidence:
            story.append(Paragraph(f"→ {evidence}", style_evidence))

    story.append(Spacer(1, 10))
    story.append(HRFlowable(width='100%', thickness=1, color=HexColor('#E2E8F0'), spaceAfter=10))

    # ROI calc box — only shown if salary was discussed on the call
    roi = content.get('roi_calc')
    if roi and isinstance(roi, dict):
        story.append(Paragraph("Your ROI Picture", style_section_title))
        roi_data = [
            [Paragraph("<b>Where you are now</b>", style_body), Paragraph(roi.get('current_ctc', '—'), style_body)],
            [Paragraph("<b>Realistic target</b>", style_body), Paragraph(roi.get('realistic_target', '—'), style_body)],
        ]
        roi_table = Table(roi_data, colWidths=[60*mm, 115*mm])
        roi_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), LIGHT_GRAY),
            ('ROWBACKGROUNDS', (0, 0), (-1, -1), [LIGHT_GRAY, HexColor('#EFF6FF')]),
            ('PADDING', (0, 0), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 0.5, HexColor('#E2E8F0')),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ]))
        story.append(roi_table)
        story.append(Spacer(1, 6))
        if roi.get('reasoning'):
            story.append(Paragraph(roi['reasoning'], style_body))

    # Placement stats box — always shown, data pulled from brochure
    placement = content.get('placement_stats', '')
    if placement and placement != 'Placement data not available.':
        story.append(Paragraph("Placement & Outcomes", style_section_title))
        placement_data = [[Paragraph(placement, style_body)]]
        placement_table = Table(placement_data, colWidths=[175*mm])
        placement_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), HexColor('#FFF7F0')),
            ('BOX', (0, 0), (-1, -1), 1.5, SCALER_ORANGE),
            ('PADDING', (0, 0), (-1, -1), 10),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ]))
        story.append(placement_table)
        story.append(Spacer(1, 6))

    story.append(Spacer(1, 14))

    # CTA box
    next_step = content.get('next_step', {})
    if next_step:
        cta_data = [[
            Paragraph(next_step.get('cta', 'Take the Scaler Entrance Test'), style_cta),
        ]]
        cta_sub_data = [[
            Paragraph(next_step.get('urgency_hook', ''), style_cta_sub),
        ]]
        cta_table = Table(cta_data, colWidths=[175*mm])
        cta_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), SCALER_DARK),
            ('PADDING', (0, 0), (-1, -1), 14),
            ('ROUNDEDCORNERS', [8]),
        ]))
        cta_sub_table = Table(cta_sub_data, colWidths=[175*mm])
        cta_sub_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), SCALER_DARK),
            ('PADDING', (0, 0), (-1, -1), [10, 0, 10, 14]),
        ]))
        story.append(cta_table)
        story.append(cta_sub_table)

    story.append(Spacer(1, 10))
    story.append(Paragraph(
        "Questions? Reply to this message — your BDA will respond personally.",
        ParagraphStyle('Footer', fontName='Helvetica', fontSize=9, textColor=MID_GRAY, alignment=TA_CENTER)
    ))

    doc.build(story)
    return buf.getvalue()
