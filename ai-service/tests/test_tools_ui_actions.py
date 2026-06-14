import unittest
from pathlib import Path
import sys


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.tools import run_app_tools  # noqa: E402


def first_ui_action(message):
    calls = run_app_tools(message, authorization=None)
    assert calls, f"No tool call for {message!r}"
    return calls[0].data.get("ui_action")


class ToolUiActionTests(unittest.TestCase):
    def test_movement_to_production(self):
        action = first_ui_action("quiero pasar 3 cabras a produccion")

        self.assertEqual(action["kind"], "operation_flow")
        self.assertEqual(action["operationType"], "movement")
        self.assertEqual(action["route"], "/operations/movement")
        self.assertEqual(action["draft"]["targetPenName"], "produccion")
        self.assertEqual(action["draft"]["expectedCount"], 3)
        self.assertEqual(action["draft"]["expectedSpecies"], "cabras")

    def test_open_movement_without_destination(self):
        action = first_ui_action("quiero cambiar ovejas de sitio")

        self.assertEqual(action["kind"], "operation_flow")
        self.assertEqual(action["operationType"], "movement")
        self.assertEqual(action["route"], "/operations/movement")
        self.assertEqual(action["draft"]["expectedSpecies"], "ovejas")

    def test_origin_destination_followup_is_movement(self):
        action = first_ui_action("de produccion a secado")

        self.assertEqual(action["kind"], "operation_flow")
        self.assertEqual(action["operationType"], "movement")
        self.assertEqual(action["route"], "/operations/movement")
        self.assertEqual(action["draft"]["targetPenName"], "secado")

    def test_vaccination(self):
        action = first_ui_action("vacuna estas de lengua azul")

        self.assertEqual(action["kind"], "operation_flow")
        self.assertEqual(action["operationType"], "health")
        self.assertEqual(action["draft"]["healthType"], "vaccination")
        self.assertEqual(action["draft"]["vacunaTexto"], "lengua azul")

    def test_deworming(self):
        action = first_ui_action("desparasita el lote")

        self.assertEqual(action["kind"], "operation_flow")
        self.assertEqual(action["operationType"], "health")
        self.assertEqual(action["draft"]["healthType"], "deworming")

    def test_reproductive_gestation_weeks(self):
        action = first_ui_action("pon estas como gestantes de 8 semanas")

        self.assertEqual(action["kind"], "operation_flow")
        self.assertEqual(action["operationType"], "reproductive")
        self.assertEqual(action["draft"]["tipoEvento"], "DIAGNOSTICO_GESTACION")
        self.assertEqual(action["draft"]["resultado"], "POSITIVO")
        self.assertEqual(action["draft"]["semanasGestacion"], "8")

    def test_death_opens_discharge_reader(self):
        action = first_ui_action("se ha muerto esta cabra")

        self.assertEqual(action["kind"], "silent_reader")
        self.assertEqual(action["action"], "baja")
        self.assertEqual(action["draft"]["motivo"], "muerte")

    def test_death_without_species_opens_discharge_reader(self):
        action = first_ui_action("se ha muerto un animal")

        self.assertEqual(action["kind"], "silent_reader")
        self.assertEqual(action["action"], "baja")
        self.assertEqual(action["draft"]["motivo"], "muerte")

    def test_birth_opens_birth_reader(self):
        action = first_ui_action("ha parido esta oveja")

        self.assertEqual(action["kind"], "silent_reader")
        self.assertEqual(action["action"], "parto")


if __name__ == "__main__":
    unittest.main()
