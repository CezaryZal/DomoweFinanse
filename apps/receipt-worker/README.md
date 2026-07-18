# Lokalny worker OCR paragonów

Worker pobiera zadania z Supabase, pobiera zdjęcia z prywatnego bucketu `receipt-images`, przygotowuje kilka wariantów obrazu przez OpenCV i uruchamia polski model PP-OCRv5 przez PaddleOCR. Wynik jest parsowany regułami i zawsze trafia do ręcznej weryfikacji w aplikacji.

## Wymagania

- Python 3.11 lub 3.12;
- około 4–8 GB wolnej pamięci RAM podczas pierwszego uruchomienia;
- dostęp do internetu przy instalacji zależności i pierwszym pobraniu modeli;
- sekretny klucz projektu Supabase przechowywany wyłącznie lokalnie.

## Konfiguracja środowiska

Worker szuka konfiguracji w następującej kolejności: zmienne uruchomionego procesu, główny plik `.env.local`, a następnie `apps/receipt-worker/.env` jako fallback.

W głównym `.env.local` pozostają zmienne frontendu `VITE_SUPABASE_URL` oraz `VITE_SUPABASE_PUBLISHABLE_KEY`. Aby uruchomić worker, dodaj tam osobną zmienną bez prefiksu `VITE_`:

```env
SUPABASE_SECRET_KEY=sb_secret_...
```

Sekret nie jest wystawiany do przeglądarki, ponieważ Vite udostępnia tylko zmienne zaczynające się od `VITE_`.

## Instalacja na Windows

W katalogu `apps/receipt-worker`:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
Copy-Item .env.example .env
```

Uzupełnij `.env`:

```env
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SECRET_KEY=<secret-key-for-trusted-local-worker>
```

Sekretnego klucza nie wolno umieszczać w frontendzie, dokumentacji ani repozytorium.

## Uruchomienie

Jedno zadanie testowe:

```powershell
python -m receipt_worker.main --once
```

Praca ciągła:

```powershell
python -m receipt_worker.main
```

Przy pierwszym uruchomieniu PaddleOCR pobierze modele. Worker działa domyślnie na CPU. Akceleracja MKL-DNN jest wyłączona ze względu na błąd wykonawczy PaddlePaddle 3.3 na Windows; poprawność ma pierwszeństwo przed benchmarkiem wydajności.

## Testy parsera

Testy nie wymagają instalowania PaddleOCR:

```powershell
python -m unittest discover -s tests -v
```

## Przygotowanie obrazu i wybór wyniku

Dla każdego paragonu worker sprawdza oryginalny obraz oraz warianty:

- poprawiony kontrast po odszumianiu;
- progowanie adaptacyjne, pomocne przy nierównym tle;
- progowanie Otsu, pomocne przy równomiernym skanie.

Przed przygotowaniem wariantów obraz jest prostowany, a mniejsze obrazy są powiększane. Parser porównuje wyniki i preferuje wariant, który rozpoznaje sklep, datę, sumę i pozycje oraz zachowuje zgodność sum.

## Rozpoznawanie pozycji produktów

Parser analizuje wyłącznie sekcję między nagłówkiem `PARAGON FISKALNY` a częścią podatkową lub podsumowaniem. Wykorzystuje współrzędne OCR (`bbox`) oraz kolejność wierszy, aby obsłużyć dwa częste układy:

- opis produktu, a poniżej ilość i ceny, np. `BALSAM ...` + `1 SZT * 25,82 = 25,82`;
- opis w lewej kolumnie, a ilość i ceny w prawej kolumnie tego samego obszaru paragonu.

Jeśli są dostępne, worker zapisuje również ilość i cenę jednostkową. Nie poprawia jednak samodzielnie literówek pochodzących z OCR — niepewny odczyt nazwy nadal wymaga ręcznej weryfikacji.

Nazwa sprzedawcy jest wybierana z nagłówka przed `PARAGON FISKALNY`. Adres, NIP i dane prawne firmy są odrzucane; numer placówki oraz kod pocztowy na końcu pierwszej linii są usuwane z wyświetlanej nazwy, np. `HEBE R199, 10-748 OLSZTYN` → `HEBE`.

## Ograniczenia obecnej wersji

- parser rozpoznaje podstawowy sklep, datę, sumę także z sąsiedniej linii oraz typowe układy pozycji produktowych;
- data, NIP, VAT, informacje o płatności i nagłówki nie powinny być zapisywane jako pozycje;
- ilości, rabaty i złożone układy będą rozwijane na podstawie benchmarku prawdziwych paragonów;
- Qwen nie jest jeszcze używany;
- kilka wariantów OCR zwiększa czas przetwarzania na CPU;
- worker używa zaufanego sekretnego klucza i powinien działać wyłącznie na kontrolowanym komputerze.
