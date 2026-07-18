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

Przed przygotowaniem wariantów obraz jest prostowany wyłącznie o niewielki przechył, a mniejsze obrazy są powiększane. Korekta zbliżona do 90° nie jest traktowana jako prostowanie; orientacją dokumentu zajmuje się OCR. Parser porównuje wyniki i preferuje wariant, który rozpoznaje sklep, datę, sumę i pozycje oraz zachowuje zgodność sum.

## Rozpoznawanie pozycji produktów

Parser analizuje wyłącznie sekcję między nagłówkiem `PARAGON FISKALNY` a częścią podatkową lub podsumowaniem. Wykorzystuje współrzędne OCR (`bbox`) oraz kolejność wierszy, aby obsłużyć dwa częste układy:

- opis produktu, a poniżej ilość i ceny, np. `BALSAM ...` + `1 SZT * 25,82 = 25,82`;
- opis w lewej kolumnie, a ilość i ceny w prawej kolumnie tego samego obszaru paragonu.

Gdy wiersz ilości zawiera tylko cenę jednostkową, np. `2 × 6,00`, parser szuka samodzielnej kwoty po prawej stronie i przyjmuje ją jako cenę końcową tylko po potwierdzeniu obliczenia `2 × 6,00 = 12,00`.

Wzorzec ilości obsługuje znaki `x`, `*` i `×`. Jeżeli liczba opisów produktów różni się od liczby wierszy cen, parser dobiera je według położenia pionowego; ma to zapobiegać przesunięciu wszystkich kolejnych par po pominiętym wierszu OCR. Dla układów z równą liczbą wierszy zachowuje dotychczasową kolejność odczytu.

Na początku parser szuka końcowej sumy oznaczonej `SUMA PLN` albo `DO ZAPŁATY PLN`. Etykieta może być odczytana jako jedno pole albo jako bliskie pola, np. osobno `SUMA` i `PLN`; kwota musi znajdować się w tym samym wierszu lub po jego prawej stronie. Wpisy `SUMA PTU` i `VAT` nie są traktowane jako suma paragonu.

`PARAGON FISKALNY` jest silnym sygnałem początku sekcji produktów i może być rozpoznany jako jedno albo dwa sąsiadujące pola OCR. Gdy go brakuje, worker używa bezpiecznego trybu awaryjnego: rozpoczyna analizę przy pierwszym wiarygodnym wierszu ilość × cena i oznacza wynik do ręcznej weryfikacji. Nie dobiera wtedy danych sklepu ani adresu z górnej części dokumentu jako produktów.

Jeśli są dostępne, worker zapisuje również ilość i cenę jednostkową. Nie poprawia jednak samodzielnie literówek pochodzących z OCR — niepewny odczyt nazwy nadal wymaga ręcznej weryfikacji.

Nazwa sprzedawcy jest wybierana z nagłówka przed `PARAGON FISKALNY`. Wiersz zawierający nazwę przed `sp. z o.o.` ma pierwszeństwo przed ogólnymi kandydatami, np. `AUCHAN POLSKA Sp. z o.o.` → `AUCHAN POLSKA`; rozpoznawany jest też OCR-owy wariant `0.0.`. Adres, NIP, REGON, BDO (również błędnie odczytane jako `BD0`) i dane prawne firmy są odrzucane; numer placówki oraz kod pocztowy na końcu pierwszej linii są usuwane z wyświetlanej nazwy, np. `HEBE R199, 10-748 OLSZTYN` → `HEBE`. Jeśli nagłówek zawiera wyłącznie niepewne fragmenty OCR, worker pozostawia nazwę pustą do ręcznej korekty zamiast zgadywać identyfikator firmy.

## Ograniczenia obecnej wersji

- parser rozpoznaje podstawowy sklep, datę, sumę także z sąsiedniej linii oraz typowe układy pozycji produktowych;
- data, NIP, VAT, informacje o płatności i nagłówki nie powinny być zapisywane jako pozycje;
- ilości, rabaty i złożone układy będą rozwijane na podstawie benchmarku prawdziwych paragonów;
- Qwen nie jest jeszcze używany;
- kilka wariantów OCR zwiększa czas przetwarzania na CPU;
- worker używa zaufanego sekretnego klucza i powinien działać wyłącznie na kontrolowanym komputerze.
