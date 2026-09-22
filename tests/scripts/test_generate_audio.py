"""Tests for scripts/generate-audio.py (hash, manifest, TTS mocked)."""

import asyncio
import hashlib
import json
import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import importlib.util

import pytest

# Load generate-audio.py by path (hyphen in filename prevents normal import)
_script_path = Path(__file__).parent.parent.parent / "scripts" / "generate-audio.py"

# Patch edge_tts before importing the module so the ImportError guard doesn't trigger
edge_tts_mock = MagicMock()
sys.modules.setdefault("edge_tts", edge_tts_mock)

_spec = importlib.util.spec_from_file_location("generate_audio", _script_path)
ga = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(ga)


# ── make_hash ────────────────────────────────────────────────────────────────

class TestMakeHash:
    def test_returns_12_hex_chars(self):
        h = ga.make_hash("ciao", "it-IT-ElsaNeural")
        assert len(h) == 12
        assert all(c in "0123456789abcdef" for c in h)

    def test_deterministic(self):
        assert ga.make_hash("ciao", "it-IT-ElsaNeural") == ga.make_hash("ciao", "it-IT-ElsaNeural")

    def test_different_text_gives_different_hash(self):
        assert ga.make_hash("ciao", "it-IT-ElsaNeural") != ga.make_hash("arrivederci", "it-IT-ElsaNeural")

    def test_different_voice_gives_different_hash(self):
        assert ga.make_hash("ciao", "it-IT-ElsaNeural") != ga.make_hash("ciao", "it-IT-DiegoNeural")

    def test_matches_sha256(self):
        # Verified against scripts/generate-audio.py and JS computeAudioKey
        assert ga.make_hash("ciao", "it-IT-ElsaNeural") == "3f32d0fc46bc"

    def test_matches_stdlib_sha256(self):
        text, voice = "ciao", "it-IT-ElsaNeural"
        expected = hashlib.sha256(f"{text}|{voice}".encode()).hexdigest()[:12]
        assert ga.make_hash(text, voice) == expected


# ── collect_entries ──────────────────────────────────────────────────────────

SAMPLE_UNIT = {
    "schema": 1,
    "id": "u01_test",
    "order": 1,
    "title": "Test",
    "canDo": ["Ik kan testen"],
    "requires": [],
    "words": [
        {"id": "w_ciao", "it": "ciao", "pos": "interjection", "nl": ["hoi"],
         "register": "informal", "core": False},
    ],
    "verbs": [
        {"id": "v_parlare", "inf": "parlare", "nl": ["spreken"], "conj": "are"},
    ],
    "sentences": [
        {"id": "s_t_001", "it": "Ciao, sono Sam.", "nl": ["Hoi"], "register": "informal",
         "uses": ["w_ciao"], "audioText": None},
        {"id": "s_t_002", "it": "€10", "nl": ["tien euro"], "register": "neutral",
         "uses": [], "audioText": "dieci euro"},
    ],
    "dialogues": [
        {
            "id": "d_t_informal",
            "register": "informal",
            "title": "Test dialoog",
            "lines": [
                {"speaker": "A", "sentence": "s_t_001"},
                {"speaker": "B", "sentence": "s_t_002"},
            ],
        }
    ],
    "grammar": [],
    "tenses": [],
    "review": {"status": "draft"},
}


@pytest.fixture
def units_dir(tmp_path):
    unit_file = tmp_path / "u01_test.json"
    unit_file.write_text(json.dumps(SAMPLE_UNIT), encoding="utf-8")
    return tmp_path


class TestCollectEntries:
    def test_verb_uses_inf_field(self, units_dir):
        entries = ga.collect_entries(units_dir)
        verb_entries = [e for e in entries if e["id"] == "v_parlare"]
        assert len(verb_entries) == 1
        assert verb_entries[0]["text"] == "parlare"
        assert verb_entries[0]["voice"] == ga.VOICE_DEFAULT

    def test_word_uses_it_field(self, units_dir):
        entries = ga.collect_entries(units_dir)
        word_entries = [e for e in entries if e["id"] == "w_ciao"]
        assert len(word_entries) == 1
        assert word_entries[0]["text"] == "ciao"
        assert word_entries[0]["voice"] == ga.VOICE_DEFAULT

    def test_sentence_uses_it_when_no_audiotext(self, units_dir):
        entries = ga.collect_entries(units_dir)
        s1 = [e for e in entries if e["id"] == "s_t_001" and e["voice"] == ga.VOICE_A]
        assert any(e["text"] == "Ciao, sono Sam." for e in s1)

    def test_sentence_uses_audiotext_when_present(self, units_dir):
        entries = ga.collect_entries(units_dir)
        s2 = [e for e in entries if e["id"] == "s_t_002" and e["voice"] == ga.VOICE_A]
        assert any(e["text"] == "dieci euro" for e in s2)

    def test_dialogue_line_a_uses_elsa(self, units_dir):
        entries = ga.collect_entries(units_dir)
        dialogue_a = [e for e in entries if e["id"] == "s_t_001" and e["voice"] == ga.VOICE_A]
        assert len(dialogue_a) >= 1

    def test_dialogue_line_b_uses_diego(self, units_dir):
        entries = ga.collect_entries(units_dir)
        dialogue_b = [e for e in entries if e["id"] == "s_t_002" and e["voice"] == ga.VOICE_B]
        assert len(dialogue_b) == 1
        assert dialogue_b[0]["text"] == "dieci euro"

    def test_unknown_sentence_id_skipped_with_warning(self, units_dir, capsys):
        unit = dict(SAMPLE_UNIT)
        unit["dialogues"] = [
            {"id": "d_t_bad", "register": "informal", "title": "Bad",
             "lines": [{"speaker": "A", "sentence": "s_nonexistent"}]}
        ]
        bad_file = units_dir / "u99_bad.json"
        bad_file.write_text(json.dumps(unit), encoding="utf-8")

        entries = ga.collect_entries(units_dir)
        assert not any(e["id"] == "s_nonexistent" for e in entries)
        captured = capsys.readouterr()
        assert "s_nonexistent" in captured.err


# ── build_hash_map ───────────────────────────────────────────────────────────

class TestBuildHashMap:
    def test_groups_by_hash(self):
        entries = [
            {"text": "ciao", "voice": ga.VOICE_A, "id": "w_ciao"},
            {"text": "ciao", "voice": ga.VOICE_A, "id": "s_t_001"},
        ]
        hm = ga.build_hash_map(entries)
        assert len(hm) == 1
        key = ga.make_hash("ciao", ga.VOICE_A)
        assert set(hm[key]["ids"]) == {"w_ciao", "s_t_001"}

    def test_different_voices_are_separate_entries(self):
        entries = [
            {"text": "ciao", "voice": ga.VOICE_A, "id": "s_t_001"},
            {"text": "ciao", "voice": ga.VOICE_B, "id": "s_t_001"},
        ]
        hm = ga.build_hash_map(entries)
        assert len(hm) == 2

    def test_deduplicates_ids_within_hash(self):
        entries = [
            {"text": "ciao", "voice": ga.VOICE_A, "id": "w_ciao"},
            {"text": "ciao", "voice": ga.VOICE_A, "id": "w_ciao"},
        ]
        hm = ga.build_hash_map(entries)
        key = ga.make_hash("ciao", ga.VOICE_A)
        assert hm[key]["ids"].count("w_ciao") == 1

    def test_stores_text_and_voice(self):
        entries = [{"text": "ciao", "voice": ga.VOICE_A, "id": "w_ciao"}]
        hm = ga.build_hash_map(entries)
        key = ga.make_hash("ciao", ga.VOICE_A)
        assert hm[key]["text"] == "ciao"
        assert hm[key]["voice"] == ga.VOICE_A


# ── generate_missing ─────────────────────────────────────────────────────────

class TestGenerateMissing:
    def _make_hash_map(self, text="ciao", voice=None):
        voice = voice or ga.VOICE_A
        h = ga.make_hash(text, voice)
        return {h: {"text": text, "voice": voice, "ids": ["w_ciao"]}}

    def test_generates_missing_file(self, tmp_path):
        audio_dir = tmp_path / "audio"
        hash_map = self._make_hash_map()

        comm_mock = MagicMock()
        comm_mock.save = AsyncMock()
        with patch.object(ga.edge_tts, "Communicate", return_value=comm_mock):
            count = asyncio.run(ga.generate_missing(hash_map, audio_dir))

        assert count == 1
        comm_mock.save.assert_awaited_once()

    def test_skips_existing_file(self, tmp_path):
        audio_dir = tmp_path / "audio"
        audio_dir.mkdir()
        hash_map = self._make_hash_map()
        h = next(iter(hash_map))
        (audio_dir / f"{h}.mp3").write_bytes(b"fake")

        comm_mock = MagicMock()
        comm_mock.save = AsyncMock()
        with patch.object(ga.edge_tts, "Communicate", return_value=comm_mock):
            count = asyncio.run(ga.generate_missing(hash_map, audio_dir))

        assert count == 0
        comm_mock.save.assert_not_awaited()

    def test_creates_audio_dir_if_missing(self, tmp_path):
        audio_dir = tmp_path / "audio"
        hash_map = self._make_hash_map()

        comm_mock = MagicMock()
        comm_mock.save = AsyncMock()
        with patch.object(ga.edge_tts, "Communicate", return_value=comm_mock):
            asyncio.run(ga.generate_missing(hash_map, audio_dir))

        assert audio_dir.exists()


# ── build_manifest ───────────────────────────────────────────────────────────

class TestBuildManifest:
    def test_manifest_has_correct_shape(self):
        h = ga.make_hash("ciao", ga.VOICE_A)
        hash_map = {h: {"text": "ciao", "voice": ga.VOICE_A, "ids": ["w_ciao"]}}
        manifest = ga.build_manifest(hash_map)
        assert manifest[h]["file"] == f"audio/{h}.mp3"
        assert manifest[h]["ids"] == ["w_ciao"]
        assert "text" not in manifest[h]
        assert "voice" not in manifest[h]
