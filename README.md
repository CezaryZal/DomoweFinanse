# Domowe Finanse

> Worker paragonów jest rozdzielony na rozpoznawanie PaddleOCR i parser regułowy. Kolejne modele AI będą dodawane jako osobne silniki, bez modyfikowania `recognition/paddle/`.

Prywatna aplikacja webowa do monitorowania wydatków gospodarstwa domowego. Docelowo umożliwi ręczne dodawanie wydatków, analizę zdjęć paragonów, kategoryzację wspomaganą przez AI oraz wspólny dostęp członków gospodarstwa.

## Aktualny stan projektu

Zrealizowana jest pierwsza wersja frontendowa oraz moduł uwierzytelniania:

- ekran logowania przez adres e-mail i hasło;
- rejestracja konta przez adres e-mail i hasło;
- potwierdzenie hasła podczas rejestracji;
- obsługa komunikatów błędów i stanów formularza;
- obsługa sesji Supabase po odświeżeniu aplikacji;
- wylogowanie użytkownika;
- dashboard z wydatkami i kategoriami pobieranymi z bazy;
- prywatne przesyłanie i wyświetlanie zdjęć paragonów;
- kolejka zadań OCR i lokalny worker Python z PaddleOCR;
- jawne stany obsługi paragonu w interfejsie: oczekiwanie, przetwarzanie, weryfikacja, błąd i zatwierdzenie;
- automatyczne pokazanie wyniku OCR po zakończeniu przetwarzania bez nadpisywania rozpoczętej ręcznej korekty;
- ręczna korekta wyniku OCR w stanach „Do weryfikacji” oraz „Błąd OCR”; zapis kompletnej korekty po błędzie przenosi paragon do stanu „Do weryfikacji”;
- zatwierdzanie wyniku OCR w stanie „Do weryfikacji”; brak kategorii dowolnego produktu blokuje zatwierdzenie, natomiast różnica sum pozostaje ostrzeżeniem;
- edycja danych i pozycji analizowanego paragonu oraz usuwanie paragonu wraz z jego obrazem; usunięcie zatwierdzonego paragonu usuwa także powiązany wydatek;
- edycja zatwierdzonego paragonu z równoczesną aktualizacją powiązanego wydatku;
- kolorowe tagi kategorii dla ręcznych wydatków i paragonów oraz podsumowania kategorii w zwiniętym widoku paragonu;
- podstawowy responsywny interfejs zgodny z projektem graficznym.

Wydatki, kategorie i metadane paragonów są przechowywane w Supabase Postgres. Zdjęcia trafiają do prywatnego bucketu Supabase Storage, a ciężkie przetwarzanie obrazu wykonuje lokalny worker Python.

## Design i makiety

Źródłem prawdy dla makiet jest katalog [`design/`](design/README.md) w tym repozytorium. Zawiera on edytowalne źródło widoków oraz eksporty PNG wszystkich głównych ekranów aplikacji.

Canva służy jako edytowalna kopia robocza i miejsce do przeglądu:

- [edytuj projekt „Domowe Finanse” w Canvie](https://www.canva.com/d/vKeX4uOCwN5WDqL);
- [otwórz podgląd projektu w Canvie](https://www.canva.com/d/GmU4mZTAWSAr8Ub).

Zmiana wykonana wyłącznie w Canvie nie jest wersją źródłową, dopóki nie zostanie przeniesiona do plików w `design/`.

## Uruchomienie lokalne

### Wymagania

- Node.js 20 lub nowszy;
- pnpm;
- dostęp do projektu Supabase.

### Instalacja

```bash
pnpm install
```

### Konfiguracja Supabase

Utwórz lokalny plik `.env.local` na podstawie `.env.example`:

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<publishable-key>
```

Do aplikacji frontendowej wolno używać wyłącznie klucza publishable. Klucza `service_role` ani innych sekretów nie należy umieszczać w kodzie przeglądarkowym.

W konfiguracji Supabase Auth należy dodać lokalne adresy:

- Site URL: `http://localhost:5151`;
- Redirect URL: `http://localhost:5151`.

### Start aplikacji

```bash
pnpm dev
```

Aplikacja będzie dostępna pod adresem [http://localhost:5151](http://localhost:5151).

Nie należy otwierać pliku `index.html` bezpośrednio z systemu plików. Aplikacja korzysta z serwera Vite.

### Build produkcyjny

```bash
pnpm run build
pnpm run preview
```

## Stack technologiczny

### Frontend

- React;
- TypeScript;
- Vite;
- CSS;
- `lucide-react` — ikony;
- `@supabase/supabase-js` — komunikacja z Supabase Auth, Postgres i Storage.

### Backend i dane

Docelowa architektura wykorzystuje:

- Supabase Auth — konta i sesje użytkowników;
- Supabase Postgres — wydatki, kategorie i gospodarstwa domowe;
- Row Level Security — ograniczenie dostępu do danych właściwego gospodarstwa;
- Supabase Edge Functions — operacje wymagające sekretów, AI lub dodatkowej walidacji.

Na obecnym etapie używane są Supabase Auth, Postgres i prywatny Storage. Schemat obejmuje tabele `categories`, `expenses`, `receipts`, `receipt_items` oraz `receipt_processing_jobs`.

### Lokalny worker OCR

Worker znajduje się w katalogu `apps/receipt-worker`. Wykorzystuje Python 3.11, OpenCV i polski model PP-OCRv5 przez PaddleOCR. Szczegółowa instrukcja instalacji i uruchomienia znajduje się w [README workera](apps/receipt-worker/README.md).

Worker wymaga lokalnego sekretnego klucza Supabase. Klucz służy wyłącznie zaufanemu procesowi backendowemu i nie może trafić do zmiennych `VITE_*`, frontendu ani repozytorium.

Przepływ paragonu:

1. Użytkownik dodaje zdjęcie JPEG, PNG lub WebP do 10 MB.
2. Zdjęcie trafia do prywatnego bucketu `receipt-images`.
3. Powstaje zadanie w `receipt_processing_jobs`; interfejs pokazuje oczekiwanie i blokuje korektę oraz zatwierdzanie.
4. Lokalny worker atomowo rezerwuje zadanie na ograniczony czas, pobiera obraz i wykonuje OCR, a interfejs pokazuje stan przetwarzania.
5. Po zapisaniu propozycji OCR paragon przechodzi do stanu „Do weryfikacji”, a formularz automatycznie pokazuje rozpoznane dane.
6. Użytkownik może poprawić sklep, datę, kwotę i pozycje. Kolejne odświeżenie danych nie nadpisuje rozpoczętej korekty.
7. Zatwierdzenie jest możliwe po przypisaniu kategorii do każdego produktu i tworzy wydatek ze źródłem `receipt`.
8. Po błędzie OCR użytkownik może jawnie wybrać „Popraw ręcznie”; zapis kompletnej korekty przenosi paragon do stanu „Do weryfikacji”, a zatwierdzenie pozostaje osobnym krokiem.

### Hosting docelowy

Frontend jest planowany do wdrożenia na Cloudflare Pages lub Workers Static Assets. Cloudflare Worker nie jest obecnie potrzebny i nie został dodany do projektu.

## Główny przepływ użytkownika

1. Użytkownik zakłada konto przy użyciu adresu e-mail i hasła.
2. Użytkownik potwierdza adres e-mail, jeśli wymaga tego konfiguracja projektu Supabase.
3. Użytkownik loguje się do aplikacji.
4. Aplikacja odtwarza aktywną sesję po odświeżeniu strony.
5. Użytkownik może wylogować się z poziomu interfejsu.

Docelowo po zalogowaniu użytkownik będzie mógł dodawać wydatki, tworzyć kategorie i zarządzać wspólnymi danymi gospodarstwa domowego.

## Plan rozwoju

### Etap 1 — wspólne gospodarstwo i ręczne wydatki

- tabele `categories` i `expenses` z podstawowymi metadanymi;
- odczyt i zapis danych przez klienta Supabase;
- RLS ograniczające dane do zalogowanego użytkownika;
- model gospodarstwa domowego i członków;
- tabele Supabase Postgres z RLS;
- zapisywanie, edycja i usuwanie wydatków;
- tworzenie oraz edycja kategorii;
- podsumowania oparte na rzeczywistych danych.

### Etap 2 — paragony i AI/OCR

- [x] prywatne przechowywanie zdjęć paragonów;
- [x] podstawowa analiza sprzedawcy, daty, pozycji i kwot;
- [x] kolejka elementów wymagających weryfikacji;
- [x] ręczna korekta danych przez użytkownika;
- [x] obsługa stanów OCR w interfejsie i bezpieczna synchronizacja wyniku z formularzem korekty;
- [x] odzyskiwanie zadań po awarii workera oraz transakcyjny zapis wyniku OCR;
- [x] ręczne odzyskanie paragonu po błędzie OCR bez ponownego uruchamiania workera;
- [ ] benchmark na prawdziwych polskich paragonach;
- [ ] propozycje kategorii na podstawie pozycji;
- [ ] opcjonalny lokalny Qwen, jeżeli benchmark wykaże potrzebę.

### Etap 3 — kolejne źródła danych

- import wyciągów bankowych;
- wykrywanie duplikatów;
- notatki i ewidencja inwestycji;
- budżety, cele oszczędnościowe i prognozy.

## Bezpieczeństwo

- Sekrety i klucze `service_role` nie mogą trafić do aplikacji frontendowej.
- Dane użytkowników będą chronione przez RLS, a nie wyłącznie przez ukrywanie elementów interfejsu.
- Każda operacja zapisu danych będzie walidowana po stronie backendu lub przez reguły bazy danych.
- Zdjęcia paragonów powinny być przechowywane prywatnie i dostępne tylko dla członków właściwego gospodarstwa.

## Weryfikacja ręczna

1. Otwórz aplikację pod `http://localhost:5151`.
2. Przełącz formularz na „Rejestracja” i utwórz konto.
3. Potwierdź e-mail, jeśli Supabase wysłał wiadomość.
4. Zaloguj się przy użyciu adresu e-mail i hasła.
5. Odśwież stronę i sprawdź, czy sesja nadal działa.
6. Wyloguj się.
7. Sprawdź, czy niezgodne hasła podczas rejestracji są odrzucane.
8. Dodaj zdjęcie paragonu i sprawdź kolejno komunikaty oczekiwania oraz przetwarzania; w tych stanach korekta i zatwierdzanie powinny być niedostępne.
9. Po zakończeniu OCR sprawdź, czy formularz automatycznie pokazuje rozpoznane dane.
10. Zacznij edytować nazwę produktu i sprawdź, czy można wpisać cały tekst bez utraty fokusu oraz czy kolejne odświeżenie danych nie nadpisuje korekty.
11. Usuń kategorię jednego produktu i sprawdź, czy zatwierdzenie jest zablokowane; różnica między sumą pozycji a sumą paragonu powinna pozostać tylko ostrzeżeniem.
12. Dla statusu błędu sprawdź komunikat i akcję „Popraw ręcznie”; zapisz kompletną korektę, potwierdź przejście do „Do weryfikacji” i dopiero wtedy zatwierdź paragon.
13. Anuluj ręczną korektę błędnego paragonu i sprawdź, że dane nie zostały zapisane ani zatwierdzone.
14. Dla zatwierdzonego paragonu sprawdź podgląd i jawną akcję edycji.
