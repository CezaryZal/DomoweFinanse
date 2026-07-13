# Domowe Finanse

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
- ręczna korekta wyniku OCR przed utworzeniem wydatku;
- podstawowy responsywny interfejs zgodny z projektem graficznym.

Wydatki, kategorie i metadane paragonów są przechowywane w Supabase Postgres. Zdjęcia trafiają do prywatnego bucketu Supabase Storage, a ciężkie przetwarzanie obrazu wykonuje lokalny worker Python.

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
3. Powstaje zadanie w `receipt_processing_jobs`.
4. Lokalny worker pobiera obraz, wykonuje OCR i zapisuje propozycję danych.
5. Użytkownik poprawia sklep, datę, kwotę i kategorię.
6. Zatwierdzenie tworzy wydatek ze źródłem `receipt`.

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
