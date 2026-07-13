# Lokalny worker OCR paragonów

Worker pobiera zadania z Supabase, pobiera zdjęcia z prywatnego bucketu `receipt-images`, przygotowuje obraz przez OpenCV i uruchamia polski model PP-OCRv5 przez PaddleOCR. Wynik jest parsowany regułami i zawsze trafia do ręcznej weryfikacji w aplikacji.

## Wymagania

- Python 3.11 lub 3.12;
- około 4–8 GB wolnej pamięci RAM podczas pierwszego uruchomienia;
- dostęp do internetu przy instalacji zależności i pierwszym pobraniu modeli;
- sekretny klucz projektu Supabase przechowywany wyłącznie lokalnie.

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

## Ograniczenia pierwszej wersji

- parser rozpoznaje podstawowy sklep, datę, sumę i wiersze zakończone ceną;
- ilości, rabaty i złożone układy będą rozwijane na podstawie benchmarku prawdziwych paragonów;
- Qwen nie jest jeszcze używany;
- worker używa zaufanego sekretnego klucza i powinien działać wyłącznie na kontrolowanym komputerze.
