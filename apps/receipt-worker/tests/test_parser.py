from decimal import Decimal
from unittest import TestCase

from receipt_worker.models import OcrLine
from receipt_worker.parser import find_merchant, parse_receipt


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
            OcrLine("PARAGON FISKALNY", 0.98),
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
            OcrLine("PARAGON FISKALNY", 0.98),
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
            OcrLine("PARAGON FISKALNY", 0.99),
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

    def test_uses_nearby_total_for_multiple_quantity_product(self) -> None:
        lines = [
            OcrLine("SKLEP TEST", 0.99),
            OcrLine("09.06.2026", 0.98),
            OcrLine("PARAGON FISKALNY", 0.99, [[10, 80], [300, 80], [300, 100], [10, 100]]),
            OcrLine("LIFTINGUJĄCE PŁATKI POD OCZY", 0.95, [[10, 110], [420, 110], [420, 135], [10, 135]]),
            OcrLine("2*6.00", 0.98, [[10, 145], [120, 145], [120, 170], [10, 170]]),
            OcrLine("12.00A", 0.98, [[430, 145], [520, 145], [520, 170], [430, 170]]),
            OcrLine("SUMA PLN", 0.99, [[10, 190], [180, 190], [180, 220], [10, 220]]),
            OcrLine("12.00", 0.99, [[430, 195], [520, 195], [520, 225], [430, 225]]),
        ]

        parsed = parse_receipt(lines)

        self.assertEqual(len(parsed.items), 1)
        item = parsed.items[0]
        self.assertEqual(item.quantity, Decimal("2"))
        self.assertEqual(item.unit_price, Decimal("6.00"))
        self.assertEqual(item.total_price, Decimal("12.00"))
        self.assertEqual(parsed.total_amount, Decimal("12.00"))
        self.assertEqual(parsed.validation_errors, [])

    def test_parses_unicode_multiplication_symbol_for_multiple_quantity_product(self) -> None:
        lines = [
            OcrLine("SKLEP TEST", 0.99),
            OcrLine("13.07.2026", 0.99),
            OcrLine("PARAGON FISKALNY", 0.99, [[10, 80], [300, 80], [300, 100], [10, 100]]),
            OcrLine("HIMALAYA GUM", 0.95, [[10, 110], [300, 110], [300, 135], [10, 135]]),
            OcrLine("2 ×12,99 25,98A", 0.98, [[420, 115], [590, 115], [590, 140], [420, 140]]),
            OcrLine("SUMA PLN 25,98", 0.99, [[10, 190], [300, 190], [300, 220], [10, 220]]),
        ]

        parsed = parse_receipt(lines)

        self.assertEqual(len(parsed.items), 1)
        item = parsed.items[0]
        self.assertEqual(item.name, "HIMALAYA GUM")
        self.assertEqual(item.quantity, Decimal("2"))
        self.assertEqual(item.unit_price, Decimal("12.99"))
        self.assertEqual(item.total_price, Decimal("25.98"))
        self.assertEqual(parsed.total_amount, Decimal("25.98"))
        self.assertEqual(parsed.validation_errors, [])

    def test_assumes_one_item_when_ocr_omits_quantity_before_multiplication(self) -> None:
        lines = [
            OcrLine("SKLEP TEST", 0.99),
            OcrLine("PARAGON FISKALNY", 0.99, [[10, 80], [300, 80], [300, 100], [10, 100]]),
            OcrLine("MLEKO UHT", 0.95, [[10, 110], [300, 110], [300, 135], [10, 135]]),
            OcrLine("\u00d76,98 6,98A", 0.98, [[420, 115], [590, 115], [590, 140], [420, 140]]),
            OcrLine("SUMA PLN 6,98", 0.99, [[10, 190], [300, 190], [300, 220], [10, 220]]),
        ]

        parsed = parse_receipt(lines)

        self.assertEqual(len(parsed.items), 1)
        item = parsed.items[0]
        self.assertEqual(item.name, "MLEKO UHT")
        self.assertEqual(item.quantity, Decimal("1"))
        self.assertEqual(item.unit_price, Decimal("6.98"))
        self.assertEqual(item.total_price, Decimal("6.98"))
        self.assertEqual(parsed.total_amount, Decimal("6.98"))

    def test_spatial_alignment_skips_unpriced_description_without_shifting_later_items(self) -> None:
        lines = [
            OcrLine("SKLEP TEST", 0.99),
            OcrLine("PARAGON FISKALNY", 0.99, [[10, 80], [300, 80], [300, 100], [10, 100]]),
            OcrLine("PRODUKT A", 0.96, [[10, 110], [300, 110], [300, 135], [10, 135]]),
            OcrLine("1 x10,00 10,00A", 0.98, [[420, 115], [590, 115], [590, 140], [420, 140]]),
            OcrLine("OPIS BEZ CENY", 0.96, [[10, 170], [300, 170], [300, 195], [10, 195]]),
            OcrLine("PRODUKT C", 0.96, [[10, 230], [300, 230], [300, 255], [10, 255]]),
            OcrLine("1 x30,00 30,00A", 0.98, [[420, 235], [590, 235], [590, 260], [420, 260]]),
            OcrLine("SUMA PLN 40,00", 0.99, [[10, 300], [300, 300], [300, 330], [10, 330]]),
        ]

        parsed = parse_receipt(lines)

        self.assertEqual([item.name for item in parsed.items], ["PRODUKT A", "PRODUKT C"])
        self.assertEqual([item.total_price for item in parsed.items], [Decimal("10.00"), Decimal("30.00")])
        self.assertTrue(any("ceny dla cz" in error for error in parsed.validation_errors))
        self.assertFalse(any("40.00 PLN r" in error for error in parsed.validation_errors))

    def test_uses_name_before_company_suffix_and_skips_promotions(self) -> None:
        lines = [
            OcrLine("Dołącz do nas na Facebooku", 0.99),
            OcrLine("www.facebook.com/inglotpolska", 0.99),
            OcrLine("INGLOT Sp. z o.o.", 0.96),
            OcrLine("Galeria Warmińska", 0.94),
            OcrLine("Tuwima 26", 0.94),
            OcrLine("10-748 Olsztyn", 0.94),
            OcrLine("NIP: 7952194802", 0.98),
            OcrLine("PARAGON FISKALNY", 0.99),
            OcrLine("PRODUKT 77,00", 0.98),
            OcrLine("SUMA PLN 77,00", 0.99),
        ]

        parsed = parse_receipt(lines)

        self.assertEqual(parsed.merchant, "INGLOT")

    def test_prefers_name_before_company_suffix_over_earlier_generic_header_text(self) -> None:
        lines = [
            OcrLine("HIPERMARKET AUCHAN", 0.99),
            OcrLine("AUCHAN POLSKA SP.Z 0.0.", 0.96),
            OcrLine("PARAGON FISKALNY", 0.99),
        ]

        parsed = parse_receipt(lines)

        self.assertEqual(parsed.merchant, "AUCHAN POLSKA")

    def test_does_not_use_bdo_or_unreliable_header_fragments_as_merchant(self) -> None:
        lines = [
            OcrLine("3", 0.22),
            OcrLine("y (d no ds epadn : y)", 0.45),
            OcrLine("( d p (a)", 0.53),
            OcrLine("hughy fi IP", 0.61),
            OcrLine("BD0:000514349", 0.89),
            OcrLine("ur:35618", 0.96),
            OcrLine("PALSOGON", 0.78),
            OcrLine("FISKAL NY", 0.96),
        ]

        self.assertIsNone(find_merchant(lines))

    def test_prefers_sum_pln_in_the_right_column_over_tax_total(self) -> None:
        lines = [
            OcrLine("ROSSMANN SDP", 0.98),
            OcrLine("PARACON FISKALNY", 0.98, [[10, 80], [300, 80], [300, 105], [10, 105]]),
            OcrLine("BEBIO COSMETICS", 0.96, [[10, 115], [360, 115], [360, 140], [10, 140]]),
            OcrLine("1 x17,99 17,99A", 0.98, [[420, 115], [590, 115], [590, 140], [420, 140]]),
            OcrLine("SUMA PTU", 0.99, [[10, 190], [180, 190], [180, 220], [10, 220]]),
            OcrLine("26,72", 0.99, [[430, 195], [520, 195], [520, 225], [430, 225]]),
            OcrLine("SUMA PLN", 0.99, [[10, 240], [180, 240], [180, 270], [10, 270]]),
            OcrLine("142,91", 0.99, [[430, 245], [540, 245], [540, 275], [430, 275]]),
        ]

        parsed = parse_receipt(lines)

        self.assertEqual(parsed.total_amount, Decimal("142.91"))
        self.assertEqual([item.name for item in parsed.items], ["BEBIO COSMETICS"])

    def test_finds_do_zaplaty_pln_in_the_right_column(self) -> None:
        lines = [
            OcrLine("SKLEP TEST", 0.99),
            OcrLine("PARAGON FISKALNY", 0.99, [[10, 80], [300, 80], [300, 105], [10, 105]]),
            OcrLine("DO ZAPŁATY PLN", 0.99, [[10, 140], [250, 140], [250, 170], [10, 170]]),
            OcrLine("77,00", 0.99, [[430, 145], [520, 145], [520, 175], [430, 175]]),
        ]

        parsed = parse_receipt(lines)

        self.assertEqual(parsed.total_amount, Decimal("77.00"))

    def test_uses_safe_fallback_without_receipt_header(self) -> None:
        lines = [
            OcrLine("SKLEP ABC", 0.99),
            OcrLine("UL. TESTOWA 1", 0.98),
            OcrLine("PRODUKT TEST", 0.97),
            OcrLine("1 x17,99 17,99A", 0.98),
            OcrLine("SUMA PLN 17,99", 0.99),
        ]

        parsed = parse_receipt(lines)

        self.assertEqual([item.name for item in parsed.items], ["PRODUKT TEST"])
        self.assertTrue(any("tryb awaryjny" in error for error in parsed.validation_errors))

    def test_does_not_use_metadata_as_fallback_product_without_price_row(self) -> None:
        lines = [
            OcrLine("SKLEP ABC", 0.99),
            OcrLine("UL. TESTOWA 1", 0.98),
            OcrLine("PRODUKT 17,99", 0.97),
            OcrLine("SUMA PLN 17,99", 0.99),
        ]

        parsed = parse_receipt(lines)

        self.assertEqual(parsed.items, [])
        self.assertTrue(any("Nie rozpoznano pozycji" in error for error in parsed.validation_errors))

    def test_joins_split_rossmann_header_and_total_labels(self) -> None:
        lines = [
            OcrLine("Rossmann SDP SP. Z O.O. Sklep nr 199", 0.94, [[326, 282], [1184, 288], [1184, 364], [326, 357]]),
            OcrLine("FISKALNY", 0.99, [[707, 554], [1135, 583], [1131, 645], [703, 617]]),
            OcrLine("PARAGON", 0.99, [[363, 576], [709, 557], [713, 620], [366, 639]]),
            OcrLine("BEBIO COSMETICS P\\AX", 0.97, [[78, 635], [569, 623], [570, 688], [80, 700]]),
            OcrLine("1 x17,99 17,99A", 0.94, [[1058, 641], [1412, 641], [1412, 700], [1058, 700]]),
            OcrLine("NEBOA MEN SEBUM CAX", 0.96, [[78, 745], [567, 730], [569, 796], [80, 811]]),
            OcrLine("1 x15,99 15,99A", 0.93, [[1055, 745], [1411, 747], [1411, 807], [1055, 805]]),
            OcrLine("SPRZEDAZ OPODATKOWANA A", 0.98, [[70, 1269], [631, 1257], [633, 1326], [72, 1338]]),
            OcrLine("142,91", 0.92, [[1259, 1269], [1410, 1272], [1409, 1338], [1258, 1335]]),
            OcrLine("PTU A 23%", 0.99, [[68, 1330], [300, 1323], [302, 1386], [70, 1394]]),
            OcrLine("26,72", 0.90, [[1278, 1328], [1413, 1331], [1411, 1395], [1277, 1393]]),
            OcrLine("SUMA PTU", 0.99, [[68, 1387], [276, 1379], [279, 1448], [70, 1455]]),
            OcrLine("26,72", 0.90, [[1280, 1384], [1414, 1389], [1412, 1456], [1278, 1452]]),
            OcrLine("SUMA", 0.999, [[65, 1445], [278, 1445], [278, 1564], [65, 1564]]),
            OcrLine("PLN", 0.999, [[293, 1445], [465, 1437], [470, 1554], [298, 1561]]),
            OcrLine("142,91", 0.98, [[1116, 1439], [1417, 1444], [1415, 1574], [1114, 1569]]),
        ]

        parsed = parse_receipt(lines)

        self.assertEqual([item.name for item in parsed.items], ["BEBIO COSMETICS P\\AX", "NEBOA MEN SEBUM CAX"])
        self.assertEqual(parsed.total_amount, Decimal("142.91"))
        self.assertFalse(any("tryb awaryjny" in error for error in parsed.validation_errors))
