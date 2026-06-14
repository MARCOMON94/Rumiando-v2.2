import unittest
from pathlib import Path
import sys
from unittest.mock import patch


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

    def test_recent_birth_opens_birth_reader(self):
        action = first_ui_action("acaba de parir una")

        self.assertEqual(action["kind"], "silent_reader")
        self.assertEqual(action["action"], "parto")

    def test_rough_birth_spelling_opens_birth_reader(self):
        action = first_ui_action("a parido una")

        self.assertEqual(action["kind"], "silent_reader")
        self.assertEqual(action["action"], "parto")

    def test_insemination_opens_reproductive_flow(self):
        action = first_ui_action("he inseminado una oveja")

        self.assertEqual(action["kind"], "operation_flow")
        self.assertEqual(action["operationType"], "reproductive")
        self.assertEqual(action["draft"]["tipoEvento"], "INSEMINACION")
        self.assertEqual(action["draft"]["expectedSpecies"], "ovejas")

    def test_rough_insemination_opens_reproductive_flow(self):
        action = first_ui_action("inseminao oveja")

        self.assertEqual(action["kind"], "operation_flow")
        self.assertEqual(action["operationType"], "reproductive")
        self.assertEqual(action["draft"]["tipoEvento"], "INSEMINACION")

    def test_covering_opens_reproductive_flow(self):
        action = first_ui_action("cubri una cabra")

        self.assertEqual(action["kind"], "operation_flow")
        self.assertEqual(action["operationType"], "reproductive")
        self.assertEqual(action["draft"]["tipoEvento"], "CUBRICION")

    def test_rough_movement_opens_movement_flow(self):
        action = first_ui_action("cambias animales de corral")

        self.assertEqual(action["kind"], "operation_flow")
        self.assertEqual(action["operationType"], "movement")

    def test_discharge_command_without_crotal_opens_reader(self):
        action = first_ui_action("dar de baja animal")

        self.assertEqual(action["kind"], "silent_reader")
        self.assertEqual(action["action"], "baja")

    def test_rough_vaccination_opens_health_flow(self):
        action = first_ui_action("bacuna estas de lengua azul")

        self.assertEqual(action["kind"], "operation_flow")
        self.assertEqual(action["operationType"], "health")
        self.assertEqual(action["draft"]["healthType"], "vaccination")

    def test_rough_vaccination_full_pen_opens_health_flow(self):
        action = first_ui_action("anade vacnuacion a todo un corral")

        self.assertEqual(action["kind"], "operation_flow")
        self.assertEqual(action["operationType"], "health")
        self.assertEqual(action["draft"]["healthType"], "vaccination")
        self.assertTrue(action["draft"]["fullPen"])

    def test_rough_deworming_opens_health_flow(self):
        action = first_ui_action("desparacita lote")

        self.assertEqual(action["kind"], "operation_flow")
        self.assertEqual(action["operationType"], "health")
        self.assertEqual(action["draft"]["healthType"], "deworming")

    def test_excel_discharges_export_action(self):
        action = first_ui_action("hazme un excel de las bajas del ultimo mes")

        self.assertEqual(action["kind"], "analytics_export")
        self.assertEqual(action["query"]["dataset"], "discharges")
        self.assertEqual(action["query"]["view"], "list")
        self.assertTrue(action["query"]["filters"]["fechaDesde"])

    def test_majorera_is_breed_query(self):
        with patch("app.services.tools._api_get", return_value={
            "breeds": [{"id": 9, "nombre": "Majorera"}]
        }), patch("app.services.tools._api_post", return_value={"total": 12}):
            calls = run_app_tools("cuantas majoreras tengo", authorization="Bearer test")

        self.assertEqual(calls[0].name, "consultar_animales_por_raza")
        self.assertIn("12", calls[0].output_summary)
        self.assertIn("Majorera", calls[0].output_summary)


if __name__ == "__main__":
    unittest.main()
