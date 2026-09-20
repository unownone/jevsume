#!/usr/bin/env python3
"""Write a one-page demo resume PDF for the studio mock."""

from pathlib import Path

from fpdf import FPDF

OUT = Path(__file__).resolve().parents[1] / "public" / "demo-resume.pdf"


class ResumePDF(FPDF):
    def header(self) -> None:
        return

    def footer(self) -> None:
        return


def build() -> None:
    pdf = ResumePDF(format="Letter", unit="pt")
    pdf.set_auto_page_break(False)
    pdf.add_page()
    pdf.set_margins(54, 54, 54)

    pdf.set_text_color(18, 18, 22)
    pdf.set_font("Times", "B", 22)
    pdf.set_xy(54, 58)
    pdf.cell(0, 28, "Jane Doe")

    pdf.set_font("Times", "", 12)
    pdf.set_xy(54, 88)
    pdf.set_text_color(70, 66, 58)
    pdf.cell(0, 16, "Staff Software Engineer")

    pdf.set_draw_color(210, 200, 180)
    pdf.set_line_width(0.6)
    pdf.line(54, 112, 558, 112)

    pdf.set_text_color(18, 18, 22)
    pdf.set_font("Times", "B", 11)
    pdf.set_xy(54, 128)
    pdf.cell(0, 14, "Summary")
    pdf.set_font("Times", "", 11)
    pdf.set_xy(54, 146)
    pdf.multi_cell(
        504,
        15,
        "Distributed systems engineer who ships event-driven platforms. Comfortable from protocol design through on-call, with a bias for measurable latency and cost wins.",
    )

    pdf.set_font("Times", "B", 11)
    pdf.set_xy(54, 198)
    pdf.cell(0, 14, "Experience")

    bullets = [
        "Built a Go + Kafka pipeline handling 2M events/day and cut p99 latency 40%.",
        "Led 6 engineers on a TypeScript control plane used by 30 product teams.",
        "Reduced AWS spend 18% by rewriting a hot path in Rust.",
    ]
    y = 220
    pdf.set_font("Times", "", 11)
    for line in bullets:
        pdf.set_xy(54, y)
        pdf.cell(12, 15, "-")
        pdf.set_xy(70, y)
        pdf.multi_cell(488, 15, line)
        y = pdf.get_y() + 8

    pdf.set_font("Times", "B", 11)
    pdf.set_xy(54, y + 8)
    pdf.cell(0, 14, "Skills")
    pdf.set_font("Times", "", 11)
    pdf.set_xy(54, y + 26)
    pdf.multi_cell(504, 15, "Go, Kafka, TypeScript, PostgreSQL, Terraform")

    skills_bottom = pdf.get_y()
    pdf.set_font("Times", "B", 11)
    pdf.set_xy(54, skills_bottom + 16)
    pdf.cell(0, 14, "Education")
    pdf.set_font("Times", "", 11)
    pdf.set_xy(54, skills_bottom + 34)
    pdf.multi_cell(504, 15, "B.S. Computer Science, State University")

    pdf.output(str(OUT))
    print(f"wrote {OUT} ({OUT.stat().st_size} bytes)")


if __name__ == "__main__":
    build()
