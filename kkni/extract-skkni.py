#!/usr/bin/env python3
"""One-time: SKKNI PDF -> per-unit JSON chunks (so runtime never re-parses the PDF).
Usage: python extract-skkni.py video-editing/"SKKNI 2014-118.pdf" video-editing/skkni.json
ponytail: static doc, run once & commit the JSON. Re-run only if the PDF changes.
"""
import sys, re, json, pathlib
import pypdf

def clean(s: str) -> str:
    s = s.replace("-\n", "").replace("\n", " ")
    return re.sub(r"\s+", " ", s).strip()

def norm_kode(raw: str) -> str:
    # Source PDF is inconsistent: J.591200.004.01 vs J.591.200.004.01. Canonicalize.
    letter, digits = raw[0], re.sub(r"\D", "", raw)
    return f"{letter}.{digits[:6]}.{digits[6:9]}.{digits[9:11]}"

CODE = r"[A-Z][\d.]+\d{2}"  # loose; norm_kode fixes dot variants

def extract(pdf_path: str) -> list[dict]:
    reader = pypdf.PdfReader(pdf_path)
    full = "\n".join(p.extract_text() or "" for p in reader.pages)

    # Split on each "KODE UNIT :" — everything up to the next one is that unit.
    parts = re.split(r"(?=KODE UNIT\s*:)", full)
    units = []
    for p in parts:
        m = re.search(rf"KODE UNIT\s*:\s*({CODE})", p)
        if not m:
            continue
        kode = norm_kode(m.group(1))
        judul = re.search(r"JUDUL UNIT\s*:\s*(.*?)\s*DESKRIPSI UNIT", p, re.S)
        deskripsi = re.search(r"DESKRIPSI UNIT\s*:\s*(.*?)\s*ELEMEN KOMPETENSI", p, re.S)
        # Elemen = the numbered "N. Judul elemen" headers in the ELEMEN..BATASAN block.
        blk = re.search(r"ELEMEN KOMPETENSI.*?(?=BATASAN VARIABEL|KODE UNIT|$)", p, re.S)
        elemen = []
        if blk:
            elemen = [clean(e) for e in re.findall(r"\n\s*(\d+\.\s+[A-Z][^\n]{3,80})", blk.group(0))]
        units.append({
            "kode": kode,
            "judul": clean(judul.group(1)) if judul else "",
            "deskripsi": clean(deskripsi.group(1)) if deskripsi else "",
            "elemen": elemen,
            "text": clean(p),  # full unit text — payload sent to the LLM
        })
    return units

if __name__ == "__main__":
    pdf, out = sys.argv[1], sys.argv[2]
    units = extract(pdf)
    assert units, "no units parsed — PDF layout changed?"
    assert all(u["kode"] and u["text"] for u in units), "unit missing kode/text"
    doc = {
        "source": pathlib.Path(pdf).name,
        "profesi": pathlib.Path(pdf).parent.name,
        "unit_count": len(units),
        "units": units,
    }
    pathlib.Path(out).write_text(json.dumps(doc, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"OK {len(units)} units -> {out}")
    for u in units:
        print(f"  {u['kode']}  {u['judul'][:55]}  ({len(u['elemen'])} elemen)")
