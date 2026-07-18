from decimal import Decimal
from unittest import TestCase

from receipt_worker.models import OcrLine
from receipt_worker.parser import parse_receipt


class ReceiptParserTests(TestCase):
    def test_parses_basic_polish_receipt(self) -> None:
        lines = [
            OcrLine("SKLEP TEST", 0.99),
            OcrLine("NIP 1234567890", 0.97),
            OcrLine("PARAGON FISKALNY", 0.98),
            OcrLine("MLEKO UHT 4,99", 0.95),
            OcrLine("CHLEB 3,50", 0.96),
            OcrLine("SUMA PLN 8,49", 0.99),
            OcrLine("12.07.2026", 0.98),
        ]

        parsed = parse_receipt(lines)

        self.assertEqual(parsed.merchant, "SKLEP TEST")
        self.assertEqual(parsed.purchased_at, "2026-07-12")
        self.assertEqual(parsed.total_amount, Decimal("8.49"))
        self.assertEqual([item.name for item in parsed.items], ["MLEKO UHT", "CHLEB"])
        self.assertEqual(parsed.validation_errors, [])

    def test_marks_inconsistent_sum_for_manual_review(self) -> None:
        lines = [
            OcrLine("SKLEP TEST", 0.99),
            OcrLine("PRODUKT 4,00", 0.90),
            OcrLine("SUMA 10,00", 0.95),
            OcrLine("12-07-2026", 0.95),
        ]

        parsed = parse_receipt(lines)

        self.assertTrue(any("różni się" in error for error in parsed.validation_errors))

    def test_finds_total_on_adjacent_line_and_does_not_create_date_item(self) -> None:
        lines = [
            OcrLine("0,122 39,", 0.99),
            OcrLine("MARKET ABC", 0.88),
            OcrLine("DATA 12.07.2026", 0.99),
            OcrLine("MLEKO UHT 4,99", 0.95),
            OcrLine("RAZEM", 0.96),
            OcrLine("4,99", 0.96),
        ]

        parsed = parse_receipt(lines)

        self.assertEqual(parsed.merchant, "MARKET ABC")
        self.assertEqual(parsed.purchased_at, "2026-07-12")
        self.assertEqual(parsed.total_amount, Decimal("4.99"))
        self.assertEqual([item.name for item in parsed.items], ["MLEKO UHT"])
        self.assertFalse(any("DATA" in item.source_text for item in parsed.items))

    def test_ignores_metadata_lines_with_amounts(self) -> None:
        lines = [
            OcrLine("SKLEP ABC", 0.98),
            OcrLine("NIP 1234567890", 0.98),
            OcrLine("PTU A 23% 2,00", 0.95),
            OcrLine("CHLEB 3,50", 0.96),
            OcrLine("SUMA 3,50", 0.99),
            OcrLine("12-07-2026", 0.98),
        ]

        parsed = parse_receipt(lines)

        self.assertEqual([item.name for item in parsed.items], ["CHLEB"])

    def test_joins_description_with_price_line_below(self) -> None:
        lines = [
            OcrLine("CENTRUM ZIELARSKO-MEDYCZNE", 0.98),
            OcrLine("12.04.2025", 0.98),
            OcrLine("PARAGON FISKALNY", 0.99, [[10, 80], [300, 80], [300, 100], [10, 100]]),
            OcrLine(
                "RATOWNIK - BALSAM DO SKÓRY I PIĘT I STÓP",
                0.96,
                [[10, 110], [520, 110], [520, 135], [10, 135]],
            ),
            OcrLine("1 SZT * 25,82 = 25,82 A", 0.97, [[220, 145], [520, 145], [520, 170], [220, 170]]),
            OcrLine("Sp.op.A", 0.94, [[10, 175], [90, 175], [90, 195], [10, 195]]),
            OcrLine("SUMA PLN", 0.99, [[10, 190], [180, 190], [180, 220], [10, 220]]),
            OcrLine("25,82", 0.99, [[430, 195], [520, 195], [520, 225], [430, 225]]),
        ]

        parsed = parse_receipt(lines)

        self.assertEqual(len(parsed.items), 1)
        self.assertEqual(parsed.merchant, "CENTRUM ZIELARSKO-MEDYCZNE")
        item = parsed.items[0]
        self.assertEqual(item.name, "RATOWNIK - BALSAM DO SKÓRY I PIĘT I STÓP")
        self.assertEqual(item.quantity, Decimal("1"))
        self.assertEqual(item.unit_price, Decimal("25.82"))
        self.assertEqual(item.total_price, Decimal("25.82"))
        self.assertEqual(parsed.total_amount, Decimal("25.82"))
        self.assertEqual(parsed.validation_errors, [])

    def test_pairs_left_product_descriptions_with_right_price_column(self) -> None:
        lines = [
            OcrLine("HEBE R199,10-748 OLSZTYN", 0.97, [[42, 167], [784, 167], [774, 355], [31, 294]]),
            OcrLine("UL. TUWIMA", 0.98, [[43, 277], [363, 271], [365, 366], [45, 372]]),
            OcrLine("2026-06-09 11:27", 0.98, [[46, 584], [530, 591], [528, 696], [44, 689]]),
            OcrLine("PARAGON FISKALNY", 0.99, [[400, 675], [1243, 759], [1234, 844], [392, 759]]),
            OcrLine("TOKP PHYS ZEL D MY X", 0.94, [[47, 741], [645, 757], [643, 848], [45, 833]]),
            OcrLine("DOVE ADU OR ROLL W X", 0.95, [[45, 820], [636, 832], [634, 921], [43, 909]]),
            OcrLine("1 x7.49 7.49A", 0.98, [[1193, 834], [1543, 867], [1536, 936], [1186, 902]]),
            OcrLine("AA CHUST INT HELP", 0.96, [[50, 902], [588, 910], [587, 995], [49, 988]]),
            OcrLine("1 x19,99 19,99A", 0.98, [[1149, 896], [1541, 933], [1535, 1002], [1143, 965]]),
            OcrLine("1 x8,99 8,99A", 0.98, [[1197, 966], [1540, 999], [1533, 1072], [1190, 1039]]),
            OcrLine("SPRZEDAZ OPODATKOWANA A", 0.96, [[55, 1015], [708, 1026], [707, 1111], [54, 1100]]),
            OcrLine("36,47", 0.99, [[1399, 1083], [1535, 1093], [1530, 1166], [1394, 1156]]),
            OcrLine("SUMA PLN", 0.99, [[34, 1230], [519, 1244], [514, 1405], [29, 1390]]),
            OcrLine("36,47", 0.99, [[1271, 1275], [1545, 1289], [1537, 1437], [1264, 1423]]),
        ]

        parsed = parse_receipt(lines)

        self.assertEqual(parsed.merchant, "HEBE")
        self.assertEqual([item.name for item in parsed.items], ["TOKP PHYS ZEL D MY", "DOVE ADU OR ROLL W", "AA CHUST INT HELP"])
        self.assertEqual([item.quantity for item in parsed.items], [Decimal("1"), Decimal("1"), Decimal("1")])
        self.assertEqual([item.unit_price for item in parsed.items], [Decimal("7.49"), Decimal("19.99"), Decimal("8.99")])
        self.assertEqual([item.total_price for item in parsed.items], [Decimal("7.49"), Decimal("19.99"), Decimal("8.99")])
        self.assertEqual(parsed.total_amount, Decimal("36.47"))
        self.assertFalse(any("różni się" in error for error in parsed.validation_errors))
