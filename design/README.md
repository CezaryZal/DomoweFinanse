# Design i makiety

Źródłem prawdy dla makiet aplikacji **Domowe Finanse** jest to repozytorium, a nie Canva.

## Lokalizacja źródeł

- `design/source/domowe-finanse-mockups.html` — edytowalne źródło wszystkich widoków;
- `design/mockups/` — aktualne eksporty PNG w rozdzielczości 1440 × 900 px;
- `design/dashboard-main.png` — wcześniejsza, zaakceptowana wersja referencyjna pulpitu.

## Makiety

| Widok | Plik |
| --- | --- |
| Pulpit | [`mockups/01-pulpit.png`](mockups/01-pulpit.png) |
| Wydatki — lista | [`mockups/02-wydatki-lista.png`](mockups/02-wydatki-lista.png) |
| Wydatki — dodawanie | [`mockups/03-wydatki-dodawanie.png`](mockups/03-wydatki-dodawanie.png) |
| Paragony — weryfikacja | [`mockups/04-paragony-weryfikacja.png`](mockups/04-paragony-weryfikacja.png) |
| Paragony — szczegóły produktu | [`mockups/05-paragony-szczegoly-produktu.png`](mockups/05-paragony-szczegoly-produktu.png) |
| Paragony — dodawanie produktu | [`mockups/06-paragony-dodawanie-produktu.png`](mockups/06-paragony-dodawanie-produktu.png) |
| Kategorie — lista | [`mockups/07-kategorie-lista.png`](mockups/07-kategorie-lista.png) |
| Kategorie — edycja | [`mockups/08-kategorie-edycja.png`](mockups/08-kategorie-edycja.png) |
| Ustawienia — parser paragonów | [`mockups/09-ustawienia-parser.png`](mockups/09-ustawienia-parser.png) |

Widok **Wydatki — lista** rozróżnia obecnie dwa typy zapisów:

- wydatek ręczny — pojedyncza transakcja przypisana do jednej kategorii;
- paragon — jedna transakcja sklepu, którą można rozwinąć do podsumowań kategorii wyliczonych z produktów.

Paragon nie jest rozbijany na niezależne wydatki. Dzięki temu jego kwota całkowita pozostaje jednym zapisem, a rozwinięcie pokazuje kontrolowany podział bez ryzyka podwójnego zliczania.

Widok **Ustawienia — parser paragonów** przewiduje wybór sposobu analizy nowych paragonów. Makieta obejmuje parser regułowy, wariant eksperymentalny z Qwen oraz model AI Gemini 3.5. Zmiana wymaga jawnego zapisania i nie wpływa na analizy już zakończone ani będące w toku. Konfiguracja danych dostępowych modelu AI pozostaje poza interfejsem przeglądarkowym.

## Canva

Canva jest edytowalną kopią roboczą i miejscem do przeglądu wizualnego. Nie zastępuje źródeł przechowywanych w repozytorium.

- [Edytuj projekt „Domowe Finanse” w Canvie](https://www.canva.com/d/vKeX4uOCwN5WDqL)
- [Otwórz podgląd projektu w Canvie](https://www.canva.com/d/GmU4mZTAWSAr8Ub)

Zestaw źródłowy zawiera dziewięć stron. Projekt Canva można zaktualizować przez import najnowszych plików z katalogu `design/mockups/`.

## Zasady aktualizacji

1. Zmiana zaakceptowana jako docelowa musi zostać odwzorowana w `design/source/domowe-finanse-mockups.html`.
2. Po zmianie należy ponownie wygenerować odpowiednie pliki PNG w `design/mockups/`.
3. Aktualną wersję można następnie zaimportować do Canvy do dalszej edycji lub prezentacji.
4. Zmiana wykonana wyłącznie w Canvie nie jest wersją źródłową. Przed uznaniem jej za obowiązującą trzeba przenieść ją do źródła HTML i odświeżyć eksporty PNG.
5. Kod aplikacji powinien być porównywany z makietami zapisanymi w repozytorium, nie z nieudokumentowanym szkicem w Canvie.

## Ikony

Makiety korzystają z prostych ikon liniowych zgodnych stylistycznie z biblioteką Lucide używaną przez frontend. Ikony występują w nawigacji, przyciskach, kartach podsumowań, kategoriach, akcjach edycji i usuwania, formularzach oraz weryfikacji paragonów.
