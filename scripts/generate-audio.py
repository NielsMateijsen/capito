#!/usr/bin/env python3
"""Generate TTS audio files for all Italian content using edge-tts."""

import asyncio
import hashlib
import json
import sys
from pathlib import Path

try:
    import edge_tts
except ImportError:
    print(
        "Fout: edge-tts is niet geïnstalleerd.\n"
        "Installeer het met: pip install edge-tts\n"
        "Zie README \"Eenmalige setup\" voor meer informatie.",
        file=sys.stderr,
    )
    sys.exit(1)

ROOT = Path(__file__).parent.parent
CONTENT_DIR = ROOT / "content" / "units"
AUDIO_DIR = ROOT / "audio"
MANIFEST_PATH = ROOT / "src" / "generated" / "audio-manifest.json"

VOICE_A = "it-IT-ElsaNeural"
VOICE_B = "it-IT-DiegoNeural"
VOICE_DEFAULT = VOICE_A


def make_hash(text: str, voice: str) -> str:
    """Return 12-character hex hash of 'text|voice'."""
    return hashlib.md5(f"{text}|{voice}".encode()).hexdigest()[:12]


def collect_entries(units_dir: Path) -> list[dict]:
    """Collect all {text, voice, id} entries from every unit file."""
    entries: list[dict] = []

    for unit_file in sorted(units_dir.glob("*.json")):
        unit = json.loads(unit_file.read_text(encoding="utf-8"))
        sentences_by_id = {s["id"]: s for s in unit.get("sentences", [])}

        for word in unit.get("words", []):
            entries.append({"text": word["it"], "voice": VOICE_DEFAULT, "id": word["id"]})

        for sentence in unit.get("sentences", []):
            text = sentence.get("audioText") or sentence["it"]
            entries.append({"text": text, "voice": VOICE_DEFAULT, "id": sentence["id"]})

        for dialogue in unit.get("dialogues", []):
            for line in dialogue.get("lines", []):
                sentence_id = line["sentence"]
                sentence = sentences_by_id.get(sentence_id)
                if sentence is None:
                    print(
                        f"Waarschuwing: zin '{sentence_id}' niet gevonden in unit "
                        f"'{unit['id']}' — dialoogstap overgeslagen.",
                        file=sys.stderr,
                    )
                    continue
                text = sentence.get("audioText") or sentence["it"]
                voice = VOICE_A if line["speaker"] == "A" else VOICE_B
                entries.append({"text": text, "voice": voice, "id": sentence_id})

    return entries


def build_hash_map(entries: list[dict]) -> dict:
    """Group entries by hash; deduplicate IDs within each group.

    Returns {hash: {text, voice, ids}}.
    """
    result: dict[str, dict] = {}
    for entry in entries:
        h = make_hash(entry["text"], entry["voice"])
        if h not in result:
            result[h] = {"text": entry["text"], "voice": entry["voice"], "ids": []}
        if entry["id"] not in result[h]["ids"]:
            result[h]["ids"].append(entry["id"])
    return result


async def generate_missing(hash_map: dict, audio_dir: Path) -> int:
    """Generate mp3 files for hashes that have no file yet. Returns count generated."""
    audio_dir.mkdir(parents=True, exist_ok=True)
    generated = 0
    for h, info in hash_map.items():
        path = audio_dir / f"{h}.mp3"
        if path.exists():
            continue
        comm = edge_tts.Communicate(info["text"], info["voice"])
        await comm.save(str(path))
        print(f"  Gegenereerd: {h}.mp3  ({info['voice']})")
        generated += 1
    return generated


def build_manifest(hash_map: dict) -> dict:
    """Build the public manifest: {hash: {file, ids}}."""
    return {
        h: {"file": f"audio/{h}.mp3", "ids": info["ids"]}
        for h, info in hash_map.items()
    }


def write_manifest(manifest: dict, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


async def main() -> None:
    entries = collect_entries(CONTENT_DIR)
    hash_map = build_hash_map(entries)
    total = len(hash_map)

    print(f"Audio te verwerken: {total} unieke bestanden")
    generated = await generate_missing(hash_map, AUDIO_DIR)
    print(f"Klaar: {generated} nieuw gegenereerd, {total - generated} al aanwezig")

    manifest = build_manifest(hash_map)
    write_manifest(manifest, MANIFEST_PATH)
    print(f"Manifest geschreven: {MANIFEST_PATH.relative_to(ROOT)}")


if __name__ == "__main__":
    asyncio.run(main())
