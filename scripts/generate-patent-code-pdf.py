#!/usr/bin/env python3
"""
Генерация PDF с фрагментами исходного кода ПО «ПротоколЪ»
для идентификации программы (патентный поверенный).
"""
from __future__ import annotations

from datetime import date
from pathlib import Path

from fpdf import FPDF

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "Protokolъ-code-excerpt-for-patent.pdf"
FONT = Path("/Library/Fonts/Arial Unicode.ttf")
if not FONT.exists():
    FONT = Path("/System/Library/Fonts/Supplemental/Arial.ttf")

# (заголовок раздела, путь к файлу, начальная строка, конечная строка)
EXCERPTS: list[tuple[str, str, int, int]] = [
    (
        "Идентификация веб-приложения (index.html)",
        "index.html",
        1,
        14,
    ),
    (
        "Шаблоны экспорта юридических протоколов (суд / переговоры / совещание)",
        "src/lib/exportTemplates.ts",
        1,
        79,
    ),
    (
        "Экспорт расшифровки в DOCX (оформление Times New Roman, шаблон court)",
        "src/lib/exportDocx.ts",
        1,
        95,
    ),
    (
        "Маркировка документа AI-резюме (бренд ПротоколЪ)",
        "src/lib/exportSummary.ts",
        1,
        95,
    ),
    (
        "Сервис расшифровки аудио (загрузка, задачи, лимиты тарифа)",
        "src/lib/transcriptionService.ts",
        1,
        120,
    ),
    (
        "Квоты хранения аудио по подписке (ГБ, срок хранения)",
        "src/lib/tierLimits.ts",
        1,
        68,
    ),
]


class PatentCodePDF(FPDF):
    def __init__(self) -> None:
        super().__init__(orientation="P", unit="mm", format="A4")
        self.add_font("App", "", str(FONT))
        self.set_auto_page_break(auto=True, margin=15)

    def footer(self) -> None:
        self.set_y(-12)
        self.set_font("App", size=8)
        self.set_text_color(120, 120, 120)
        self.cell(0, 8, f"ПротоколЪ · https://протокол.рф · стр. {self.page_no()}", align="C")


def read_lines(rel_path: str, start: int, end: int) -> str:
    path = ROOT / rel_path
    lines = path.read_text(encoding="utf-8").splitlines()
    chunk = lines[start - 1 : end]
    numbered = [f"{start + i:5d} | {line}" for i, line in enumerate(chunk)]
    return "\n".join(numbered)


def add_title_page(pdf: PatentCodePDF) -> None:
    pdf.add_page()
    pdf.set_font("App", size=18)
    pdf.set_text_color(27, 58, 92)
    pdf.cell(0, 14, "ПротоколЪ", ln=True, align="C")
    pdf.set_font("App", size=12)
    pdf.set_text_color(0, 0, 0)
    pdf.ln(4)
    pdf.multi_cell(
        0,
        7,
        "Фрагменты исходного кода программы для ЭВМ\n"
        "«ПротоколЪ — расшифровка аудио для юристов»\n"
        "(Legal Transcript AI)",
        align="C",
    )
    pdf.ln(6)
    pdf.set_font("App", size=10)
    pdf.multi_cell(
        0,
        6,
        "Назначение: автоматическая расшифровка аудиозаписей судебных заседаний, "
        "переговоров и совещаний с разделением речи по спикерам (диаризация), "
        "редактированием текста, AI-резюме и экспортом в формате официального протокола (.docx).\n\n"
        "Сайт: https://протокол.рф\n"
        f"Дата подготовки выписки: {date.today().strftime('%d.%m.%Y')}\n\n"
        "Настоящий документ содержит характерные фрагменты исходного кода, "
        "по которым программа может быть идентифицирована как принадлежащая указанному ПО.",
    )


def add_excerpt(pdf: PatentCodePDF, title: str, rel_path: str, start: int, end: int) -> None:
    pdf.add_page()
    pdf.set_font("App", size=11)
    pdf.set_text_color(27, 58, 92)
    pdf.multi_cell(0, 6, title)
    pdf.ln(2)
    pdf.set_font("App", size=9)
    pdf.set_text_color(80, 80, 80)
    pdf.cell(0, 5, f"Файл: {rel_path}  ·  строки {start}–{end}", ln=True)
    pdf.ln(2)
    pdf.set_font("App", size=7.5)
    pdf.set_text_color(0, 0, 0)
    body = read_lines(rel_path, start, end)
    pdf.multi_cell(0, 3.8, body)


def main() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    pdf = PatentCodePDF()
    add_title_page(pdf)
    for title, rel_path, start, end in EXCERPTS:
        add_excerpt(pdf, title, rel_path, start, end)
    pdf.output(str(OUT))
    print(f"PDF создан: {OUT}")


if __name__ == "__main__":
    main()
